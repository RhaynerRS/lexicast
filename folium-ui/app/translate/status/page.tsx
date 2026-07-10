"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SettingsLink } from "@/components/layout/settings-link";
import {
  ApiError,
  cancelTranslation,
  downloadTranslation,
  getTranslation,
  streamTranslationEvents,
} from "@/lib/api";
import type { Translation } from "@/lib/types";

const RUNNING_STATUSES = new Set(["queued", "running", "cancelling"]);
const CANCELLABLE_STATUSES = new Set(["queued", "running"]);

function stageMessage(pct: number) {
  if (pct >= 85) return "Finalizing translated file…";
  if (pct >= 50) return "Reviewing formatting & structure…";
  if (pct >= 20) return "Translating chapters…";
  return "Parsing EPUB structure…";
}

function TranslateStatusContent() {
  const jobId = useSearchParams().get("job");

  const [job, setJob] = useState<Translation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;

    getTranslation(jobId)
      .then((initial) => {
        if (cancelled) return;
        setJob(initial);
        if (RUNNING_STATUSES.has(initial.status)) {
          unsubscribeRef.current = streamTranslationEvents(
            jobId,
            (update) => !cancelled && setJob(update),
            () => {
              /* stream ended unexpectedly; last known job state stays on screen */
            }
          );
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : "Failed to load this translation.");
        }
      });

    return () => {
      cancelled = true;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [jobId]);

  async function handleCancel() {
    if (!job) return;
    setCancelling(true);
    try {
      const updated = await cancelTranslation(job.job_id);
      setJob(updated);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to cancel this translation.");
    } finally {
      setCancelling(false);
    }
  }

  async function handleDownload() {
    if (!job) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await downloadTranslation(job.job_id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `translated_${job.source_filename}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : "Failed to download the file.");
    } finally {
      setDownloading(false);
    }
  }

  if (!jobId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-folium-paper text-center">
        <div className="text-xl font-bold text-folium-ink">
          No translation in progress
        </div>
        <Link href="/translate" className="text-sm text-folium-blue">
          Start a translation →
        </Link>
      </div>
    );
  }

  if (loadError && !job) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-folium-paper text-center">
        <div className="text-xl font-bold text-folium-ink">{loadError}</div>
        <Link href="/translate" className="text-sm text-folium-blue">
          Start a new translation →
        </Link>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-folium-paper">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-folium-blue/15 border-t-folium-blue" />
      </div>
    );
  }

  const breadcrumb = (
    <div className="mx-auto max-w-[900px] px-10">
      <div className="flex items-center justify-between text-sm text-folium-ink/50">
        <div>
          <Link href="/" className="text-folium-ink/50 hover:text-folium-ink">
            Folium
          </Link>{" "}
          / <span className="font-semibold text-folium-ink">{job.source_filename}</span>
        </div>
        <SettingsLink />
      </div>
    </div>
  );

  if (RUNNING_STATUSES.has(job.status)) {
    const pct = Math.round(job.progress * 100);
    const isCancelling = job.status === "cancelling";
    return (
      <div className="min-h-screen bg-folium-paper px-10 py-9">
        {breadcrumb}
        <div className="mx-auto mt-[60px] max-w-[640px] rounded-[28px] border border-black/[0.06] bg-white/75 p-12 text-center shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur-2xl">
          <div className="mx-auto h-16 w-16 animate-spin rounded-full border-[5px] border-folium-blue/15 border-t-folium-blue" />
          <div className="mt-[26px] text-2xl font-bold text-folium-ink">
            {`Translating ${job.source_filename}`}
          </div>
          <div className="mt-2 text-[15px] text-folium-ink/55">
            {isCancelling ? "Cancelling…" : stageMessage(pct)}
          </div>
          <div className="mt-7 h-2.5 overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className="h-full rounded-full bg-folium-blue transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-3 text-sm font-bold text-folium-blue">{pct}%</div>
          {job.warning && (
            <div className="mt-4 rounded-xl bg-amber-500/10 px-4 py-2.5 text-xs text-folium-ink/60">
              {job.warning}
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-7 text-[13px] text-folium-ink/50">
            <div>
              Job{" "}
              <span className="font-mono font-semibold text-folium-ink">
                {job.job_id.slice(0, 8)}
              </span>
            </div>
            <div>{job.concurrency} sessions</div>
            <div className="font-mono">{job.submit_kind}</div>
          </div>
          {loadError && (
            <div className="mt-4 text-xs text-folium-red">{loadError}</div>
          )}
          {CANCELLABLE_STATUSES.has(job.status) && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="mt-[34px] rounded-full bg-folium-red/10 px-[26px] py-3.5 text-sm font-semibold text-folium-red disabled:opacity-50"
            >
              {cancelling ? "Cancelling…" : "Cancel translation"}
            </button>
          )}
        </div>
      </div>
    );
  }

  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";

  const statusHeadline = isCompleted
    ? "Translation complete"
    : isFailed
      ? "Translation failed"
      : "Translation cancelled";
  const statusSubline = isCompleted
    ? "Your translated EPUB is ready to download."
    : isFailed
      ? job.error ?? "Something went wrong while translating this book."
      : "This job was cancelled before it finished.";
  const iconBg = isCompleted
    ? "bg-folium-green/12"
    : isFailed
      ? "bg-folium-red/12"
      : "bg-folium-gray/15";

  return (
    <div className="min-h-screen bg-folium-paper px-10 py-9">
      {breadcrumb}
      <div className="mx-auto mt-[60px] max-w-[640px] rounded-[28px] border border-black/[0.06] bg-white/75 p-12 text-center shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur-2xl">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${iconBg}`}
        >
          {isCompleted && (
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 12L10 18L20 6"
                stroke="#34C759"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {isFailed && (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6L18 18M18 6L6 18"
                stroke="#FF3B30"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          )}
          {!isCompleted && !isFailed && (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 8V13"
                stroke="#8E8E93"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx="12" cy="16.5" r="1.4" fill="#8E8E93" />
            </svg>
          )}
        </div>
        <div className="mt-6 text-2xl font-bold text-folium-ink">
          {statusHeadline}
        </div>
        <div className="mt-2 text-[15px] text-folium-ink/55">
          {statusSubline}
        </div>

        <div className="mt-7 flex flex-col gap-2.5 rounded-2xl bg-black/[0.03] p-[22px] text-left">
          <Row label="File" value={job.source_filename} />
          <Row label="Language" value={job.target_language} />
          <Row label="Submit kind" value={job.submit_kind} mono />
          <Row label="Job ID" value={job.job_id} mono />
        </div>

        {downloadError && (
          <div className="mt-4 text-xs text-folium-red">{downloadError}</div>
        )}

        {isCompleted ? (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="mt-7 block w-full rounded-full bg-folium-blue py-[15px] text-base font-semibold text-white disabled:opacity-60"
          >
            {downloading ? "Downloading…" : "Download translated EPUB"}
          </button>
        ) : (
          <Link
            href="/translate"
            className="mt-7 block w-full rounded-full bg-folium-blue py-[15px] text-base font-semibold text-white"
          >
            Try again
          </Link>
        )}
        <Link href="/" className="mt-4 block text-sm text-folium-ink/50">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

export default function TranslateStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-folium-paper">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-folium-blue/15 border-t-folium-blue" />
        </div>
      }
    >
      <TranslateStatusContent />
    </Suspense>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between text-sm">
      <div className="text-folium-ink/50">{label}</div>
      <div
        className={`font-semibold text-folium-ink ${mono ? "font-mono" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
