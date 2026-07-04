from __future__ import annotations

import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from epub_translator import LLM, SubmitKind, translate

from .config import settings


@dataclass
class JobState:
    id: str
    source_filename: str
    status: str = "queued"  # queued | running | completed | failed
    progress: float = 0.0
    error: Optional[str] = None
    last_warning: Optional[str] = None
    source_path: Optional[Path] = None
    target_path: Optional[Path] = None
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def to_public_dict(self) -> dict:
        with self.lock:
            return {
                "job_id": self.id,
                "status": self.status,
                "progress": round(self.progress, 4),
                "error": self.error,
                "warning": self.last_warning,
            }


class JobManager:
    def __init__(self, max_workers: int):
        self._jobs: dict[str, JobState] = {}
        self._executor = ThreadPoolExecutor(max_workers=max_workers)

    def create_job(self, source_filename: str) -> JobState:
        job = JobState(id=uuid.uuid4().hex, source_filename=source_filename)
        self._jobs[job.id] = job
        return job

    def get(self, job_id: str) -> Optional[JobState]:
        return self._jobs.get(job_id)

    def submit(
        self,
        job: JobState,
        target_language: str,
        concurrency: int,
        user_prompt: Optional[str],
    ) -> None:
        self._executor.submit(self._run, job, target_language, concurrency, user_prompt)

    def _run(
        self,
        job: JobState,
        target_language: str,
        concurrency: int,
        user_prompt: Optional[str],
    ) -> None:
        with job.lock:
            job.status = "running"

        def on_progress(progress: float) -> None:
            with job.lock:
                job.progress = progress

        def on_fill_failed(event) -> None:
            with job.lock:
                job.last_warning = (
                    f"{event.error_message} "
                    f"(retry {event.retried_count}, "
                    f"over_maximum_retries={event.over_maximum_retries})"
                )

        try:
            llm = LLM(
                key=settings.ollama_api_key,
                url=settings.ollama_base_url,
                model=settings.ollama_model,
                token_encoding=settings.token_encoding,
            )
            translate(
                source_path=job.source_path,
                target_path=job.target_path,
                target_language=target_language,
                submit=SubmitKind.APPEND_BLOCK,
                user_prompt=user_prompt,
                concurrency=concurrency,
                llm=llm,
                on_progress=on_progress,
                on_fill_failed=on_fill_failed,
            )
            with job.lock:
                job.progress = 1.0
                job.status = "completed"
        except Exception as exc:
            with job.lock:
                job.status = "failed"
                job.error = str(exc)


job_manager = JobManager(max_workers=settings.job_workers)
