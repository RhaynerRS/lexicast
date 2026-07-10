import { getApiBaseUrl } from "./tauri";
import type { SubmitKind, Translation } from "./types";

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return typeof body.detail === "string" ? body.detail : res.statusText;
  } catch {
    return res.statusText;
  }
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
  return res.json();
}

export interface CreateTranslationInput {
  file: File;
  targetLanguage: string;
  concurrency: number;
  submitKind: SubmitKind;
  userPrompt?: string;
}

export interface CreateTranslationResponse {
  job_id: string;
  status: string;
}

export async function createTranslation(
  input: CreateTranslationInput
): Promise<CreateTranslationResponse> {
  const formData = new FormData();
  formData.set("file", input.file);
  formData.set("target_language", input.targetLanguage);
  formData.set("concurrency", String(input.concurrency));
  formData.set("submit_kind", input.submitKind);
  if (input.userPrompt) formData.set("user_prompt", input.userPrompt);

  const apiUrl = await getApiBaseUrl();
  const res = await fetch(`${apiUrl}/translations`, {
    method: "POST",
    body: formData,
  });
  return asJson<CreateTranslationResponse>(res);
}

export async function getTranslation(jobId: string): Promise<Translation> {
  const apiUrl = await getApiBaseUrl();
  const res = await fetch(`${apiUrl}/translations/${jobId}`);
  return asJson<Translation>(res);
}

export async function cancelTranslation(jobId: string): Promise<Translation> {
  const apiUrl = await getApiBaseUrl();
  const res = await fetch(`${apiUrl}/translations/${jobId}/cancel`, {
    method: "POST",
  });
  return asJson<Translation>(res);
}

export async function downloadTranslationUrl(jobId: string): Promise<string> {
  const apiUrl = await getApiBaseUrl();
  return `${apiUrl}/translations/${jobId}/download`;
}

export async function downloadTranslation(jobId: string): Promise<Blob> {
  const url = await downloadTranslationUrl(jobId);
  const res = await fetch(url);
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
  return res.blob();
}

/**
 * Manually parses the `/translations/{id}/events` SSE stream via fetch
 * (instead of EventSource) purely for consistency with the rest of this
 * module. Returns an unsubscribe function.
 */
export function streamTranslationEvents(
  jobId: string,
  onUpdate: (job: Translation) => void,
  onError?: (err: unknown) => void
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const apiUrl = await getApiBaseUrl();
      const res = await fetch(`${apiUrl}/translations/${jobId}/events`, {
        headers: { Accept: "text/event-stream" },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new ApiError(res.status, await errorMessage(res));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          const dataLines = rawEvent
            .split("\n")
            .filter((line) => line.startsWith("data: "))
            .map((line) => line.slice(6));
          if (dataLines.length === 0) continue;

          const job = JSON.parse(dataLines.join("\n")) as Translation;
          onUpdate(job);
          if (TERMINAL_STATUSES.has(job.status)) {
            controller.abort();
            return;
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      onError?.(err);
    }
  })();

  return () => controller.abort();
}
