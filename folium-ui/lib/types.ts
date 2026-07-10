export type SubmitKind = "REPLACE" | "APPEND_TEXT" | "APPEND_BLOCK";

export type JobStatus =
  | "queued"
  | "running"
  | "cancelling"
  | "completed"
  | "failed"
  | "cancelled";

// Mirrors JobState.to_public_dict() in folium-api/app/jobs.py exactly (snake_case
// keys), so the API response can be used as-is without a mapping layer.
export interface Translation {
  job_id: string;
  source_filename: string;
  target_language: string;
  submit_kind: SubmitKind;
  concurrency: number;
  created_at: string;
  status: JobStatus;
  progress: number; // 0..1
  error: string | null;
  warning: string | null;
  user_prompt: string | null;
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  queued: "Queued",
  running: "In Progress",
  cancelling: "Cancelling",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const LANGUAGES = [
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Japanese",
  "Italian",
  "Mandarin Chinese",
  "Korean",
  "Russian",
  "Arabic",
];
