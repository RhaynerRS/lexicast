"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getLlmSettings, isTauri, saveLlmSettings, type LlmProvider, type LlmSettings } from "@/lib/tauri";
import { cn } from "@/lib/utils";

const PROVIDERS: { value: LlmProvider; label: string; baseUrlPlaceholder: string; modelPlaceholder: string; needsKey: boolean }[] = [
  {
    value: "ollama",
    label: "Ollama (local)",
    baseUrlPlaceholder: "http://localhost:11434/v1",
    modelPlaceholder: "qwen2.5:3b-instruct-q4_K_M",
    needsKey: false,
  },
  {
    value: "deepseek",
    label: "DeepSeek",
    baseUrlPlaceholder: "https://api.deepseek.com",
    modelPlaceholder: "deepseek-chat",
    needsKey: true,
  },
  {
    value: "openai",
    label: "OpenAI",
    baseUrlPlaceholder: "https://api.openai.com/v1",
    modelPlaceholder: "gpt-4o-mini",
    needsKey: true,
  },
];

function SettingsForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/translate";

  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<LlmProvider>("ollama");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningOutsideTauri, setRunningOutsideTauri] = useState(false);

  useEffect(() => {
    if (!isTauri()) {
      setRunningOutsideTauri(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    getLlmSettings()
      .then((settings) => {
        if (cancelled || !settings) return;
        setProvider(settings.provider);
        setApiKey(settings.api_key ?? "");
        setBaseUrl(settings.base_url ?? "");
        setModel(settings.model ?? "");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = PROVIDERS.find((p) => p.value === provider)!;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selected.needsKey && !apiKey.trim()) {
      setError(`${selected.label} requires an API key.`);
      return;
    }
    setSaving(true);
    try {
      const settings: LlmSettings = {
        provider,
        api_key: apiKey.trim() || undefined,
        base_url: baseUrl.trim() || undefined,
        model: model.trim() || undefined,
      };
      await saveLlmSettings(settings);
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings. Please try again.");
      setSaving(false);
    }
  }

  if (runningOutsideTauri) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-folium-paper text-center">
        <div className="text-xl font-bold text-folium-ink">
          This screen is only available in the Folium desktop app.
        </div>
        <p className="max-w-[420px] text-sm text-folium-ink/55">
          In the browser/self-hosted setup, LLM provider settings come from the API&apos;s
          environment variables instead.
        </p>
        <Link href="/" className="text-sm text-folium-blue">
          ← Back to home
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-folium-paper">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-folium-blue/15 border-t-folium-blue" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-folium-paper px-10 py-9">
      <div className="mx-auto max-w-[560px]">
        <div className="text-sm text-folium-ink/50">
          <Link href="/" className="text-folium-ink/50 hover:text-folium-ink">
            Folium
          </Link>{" "}
          / <span className="font-semibold text-folium-ink">LLM Settings</span>
        </div>
        <h1 className="mt-3.5 text-[28px] font-bold tracking-tight text-folium-ink">
          Set up your translation engine
        </h1>
        <p className="mt-2 text-[15px] text-folium-ink/55">
          Folium runs translations through an LLM you provide. Pick a provider and, if it
          needs one, an API key — you can change this anytime.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
          <div>
            <div className="mb-2.5 text-[13px] font-bold tracking-wide text-folium-ink/50 uppercase">
              Provider
            </div>
            <div className="flex flex-wrap gap-3">
              {PROVIDERS.map((p) => (
                <button
                  type="button"
                  key={p.value}
                  onClick={() => setProvider(p.value)}
                  className={cn(
                    "min-w-[140px] flex-1 rounded-2xl border px-4 py-3.5 text-left text-sm font-semibold",
                    provider === p.value
                      ? "border-2 border-folium-blue bg-folium-blue/[0.06] text-folium-ink"
                      : "border-black/[0.08] bg-white text-folium-ink/70"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2.5 text-[13px] font-bold tracking-wide text-folium-ink/50 uppercase">
              API key{" "}
              {!selected.needsKey && (
                <span className="font-normal text-folium-ink/35 normal-case">(not required for Ollama)</span>
              )}
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={selected.needsKey ? "sk-..." : "leave empty"}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-[15px] text-folium-ink"
            />
          </div>

          <div>
            <div className="mb-2.5 text-[13px] font-bold tracking-wide text-folium-ink/50 uppercase">
              Base URL <span className="font-normal text-folium-ink/35 normal-case">(optional override)</span>
            </div>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={selected.baseUrlPlaceholder}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-[15px] text-folium-ink"
            />
          </div>

          <div>
            <div className="mb-2.5 text-[13px] font-bold tracking-wide text-folium-ink/50 uppercase">
              Model <span className="font-normal text-folium-ink/35 normal-case">(optional override)</span>
            </div>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={selected.modelPlaceholder}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-[15px] text-folium-ink"
            />
          </div>

          {error && <div className="text-sm text-folium-red">{error}</div>}

          <button
            type="submit"
            disabled={saving}
            className={cn(
              "rounded-full py-[15px] text-[15px] font-bold text-white",
              saving ? "cursor-not-allowed bg-black/20" : "cursor-pointer bg-folium-blue"
            )}
          >
            {saving ? "Saving…" : "Save and continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-folium-paper">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-folium-blue/15 border-t-folium-blue" />
        </div>
      }
    >
      <SettingsForm />
    </Suspense>
  );
}
