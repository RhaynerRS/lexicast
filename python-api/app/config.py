import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    ollama_base_url: str
    ollama_api_key: str
    ollama_model: str
    token_encoding: str
    storage_dir: str
    job_workers: int


def _load() -> Settings:
    base_url = os.environ.get("OLLAMA_BASE_URL")
    if not base_url:
        raise RuntimeError(
            "OLLAMA_BASE_URL environment variable is required "
            "(e.g. http://localhost:11434/v1)"
        )
    return Settings(
        ollama_base_url=base_url.rstrip("/"),
        ollama_api_key=os.environ.get("OLLAMA_API_KEY", "ollama"),
        ollama_model=os.environ.get("OLLAMA_MODEL", "qwen3"),
        token_encoding=os.environ.get("TOKEN_ENCODING", "cl100k_base"),
        storage_dir=os.environ.get("STORAGE_DIR", "./data"),
        job_workers=int(os.environ.get("JOB_WORKERS", "4")),
    )


settings = _load()
