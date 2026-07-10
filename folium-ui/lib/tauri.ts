import { invoke, isTauri as isTauriRuntime } from "@tauri-apps/api/core";

export type LlmProvider = "ollama" | "deepseek" | "openai";

export interface LlmSettings {
  provider: LlmProvider;
  api_key?: string;
  base_url?: string;
  model?: string;
}

const HEALTH_POLL_ATTEMPTS = 20;
const HEALTH_POLL_INTERVAL_MS = 300;

export function isTauri(): boolean {
  return typeof window !== "undefined" && isTauriRuntime();
}

export function getLlmSettings(): Promise<LlmSettings | null> {
  return invoke<LlmSettings | null>("get_llm_settings");
}

export async function saveLlmSettings(settings: LlmSettings): Promise<string> {
  const port = await invoke<number>("save_llm_settings", { settings });
  const url = `http://127.0.0.1:${port}`;
  cachedApiBaseUrl = waitUntilHealthy(url);
  return cachedApiBaseUrl;
}

async function waitUntilHealthy(baseUrl: string): Promise<string> {
  for (let attempt = 0; attempt < HEALTH_POLL_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return baseUrl;
    } catch {
      // sidecar not accepting connections yet (still booting/extracting)
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_INTERVAL_MS));
  }
  // Give up waiting and hand back the URL anyway — normal request-level
  // error handling in the UI takes over from here.
  return baseUrl;
}

let cachedApiBaseUrl: Promise<string> | null = null;

/**
 * Resolves the base URL to send API requests to. Inside the desktop app this
 * asks the Tauri wrapper which port it started the folium-api sidecar on
 * (and waits for it to actually answer /health, since the PyInstaller
 * bootloader takes a moment to unpack/boot); in a plain browser (e.g. `next
 * dev` against a docker-compose'd API) it falls back to the build-time env
 * var, unchanged from before.
 */
export function getApiBaseUrl(): Promise<string> {
  if (!isTauri()) {
    const envUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
    return Promise.resolve(envUrl);
  }
  if (!cachedApiBaseUrl) {
    cachedApiBaseUrl = invoke<number>("get_api_port").then((port) =>
      waitUntilHealthy(`http://127.0.0.1:${port}`)
    );
  }
  return cachedApiBaseUrl;
}
