"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SettingsLink } from "@/components/layout/settings-link";
import { ApiError, createTranslation } from "@/lib/api";
import { LANGUAGES, type SubmitKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const SUBMIT_KINDS: { value: SubmitKind; description: string; badge?: string }[] = [
  {
    value: "REPLACE",
    description: "Original text is replaced entirely with the translation.",
  },
  {
    value: "APPEND_TEXT",
    description: "Translation is inserted inline, right after each paragraph.",
  },
  {
    value: "APPEND_BLOCK",
    description: "Translation is added as its own block after each section.",
    badge: "DEFAULT",
  },
];

export default function TranslatePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [targetLang, setTargetLang] = useState("Spanish");
  const [instructions, setInstructions] = useState("");
  const [concurrency, setConcurrency] = useState(4);
  const [submitKind, setSubmitKind] = useState<SubmitKind>("APPEND_BLOCK");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const hasFile = !!file;
  const fileSizeMb = file ? parseFloat((file.size / (1024 * 1024)).toFixed(1)) : 0;

  function applyFile(candidate: File | null | undefined) {
    if (!candidate) return;
    setSubmitError(null);
    setFile(candidate);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    applyFile(e.dataTransfer.files?.[0]);
  }

  async function handleSubmit() {
    if (!file) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const result = await createTranslation({
        file,
        targetLanguage: targetLang,
        concurrency,
        submitKind,
        userPrompt: instructions.trim() || undefined,
      });
      router.push(`/translate/status?job=${result.job_id}`);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again."
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-folium-paper pb-24">
      <div className="mx-auto max-w-[1000px] px-10 pt-9">
        <div className="flex items-center justify-between text-sm text-folium-ink/50">
          <div>
            <Link href="/" className="text-folium-ink/50 hover:text-folium-ink">
              Folium
            </Link>{" "}
            / <span className="font-semibold text-folium-ink">New Translation</span>
          </div>
          <SettingsLink />
        </div>
        <h1 className="mt-3.5 text-[34px] font-bold tracking-tight text-folium-ink">
          New Translation
        </h1>

        <div className="mt-8 flex flex-wrap items-start gap-8">
          <div className="flex min-w-[420px] flex-1 flex-col gap-7">
            <div>
              <div className="mb-2.5 text-[13px] font-bold tracking-wide text-folium-ink/50 uppercase">
                EPUB file
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".epub"
                onChange={(e) => applyFile(e.target.files?.[0])}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className={cn(
                  "cursor-pointer rounded-[20px] text-center",
                  hasFile
                    ? "border-[1.5px] border-folium-blue/40 bg-folium-blue/[0.04] p-[22px]"
                    : "border-2 border-dashed border-black/[0.18] bg-white/50 p-12"
                )}
              >
                {hasFile ? (
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-folium-blue/10">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M6 2H14L20 8V20C20 21.1 19.1 22 18 22H6C4.9 22 4 21.1 4 20V4C4 2.9 4.9 2 6 2Z"
                          stroke="#0A84FF"
                          strokeWidth="1.6"
                        />
                        <path d="M14 2V8H20" stroke="#0A84FF" strokeWidth="1.6" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="text-[15px] font-semibold text-folium-ink">
                        {file!.name}
                      </div>
                      <div className="text-[13px] text-folium-ink/50">
                        {fileSizeMb} MB · click to replace
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <svg
                      width="30"
                      height="30"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="mx-auto"
                    >
                      <path
                        d="M12 16V4M12 4L7 9M12 4L17 9"
                        stroke="#0A84FF"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M4 16V18C4 19.1 4.9 20 6 20H18C19.1 20 20 19.1 20 18V16"
                        stroke="#0A84FF"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="mt-3.5 text-[15px] font-semibold text-folium-ink">
                      Drop your EPUB here, or click to browse
                    </div>
                    <div className="mt-1.5 text-[13px] text-folium-ink/45">
                      Supports EPUB 2 and EPUB 3
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <div className="mb-2.5 text-[13px] font-bold tracking-wide text-folium-ink/50 uppercase">
                Target language
              </div>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-[15px] text-folium-ink"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-2.5 text-[13px] font-bold tracking-wide text-folium-ink/50 uppercase">
                Instructions for the translator{" "}
                <span className="font-normal text-folium-ink/35 normal-case">
                  (optional)
                </span>
              </div>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. Keep character names untranslated. Use a formal register."
                rows={3}
                className="w-full resize-y rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-[15px] text-folium-ink"
              />
            </div>

            <div>
              <div className="mb-2.5 flex justify-between">
                <div className="text-[13px] font-bold tracking-wide text-folium-ink/50 uppercase">
                  Concurrency
                </div>
                <div className="text-[13px] font-bold text-folium-blue">
                  {concurrency} concurrent session(s)
                </div>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={concurrency}
                onChange={(e) => setConcurrency(parseInt(e.target.value, 10))}
                className="w-full"
              />
              <div className="mt-1 flex justify-between text-[11px] text-folium-ink/40">
                <span>1</span>
                <span>10</span>
              </div>
            </div>

            <div>
              <div className="mb-2.5 text-[13px] font-bold tracking-wide text-folium-ink/50 uppercase">
                Submit kind
              </div>
              <div className="flex flex-wrap gap-3.5">
                {SUBMIT_KINDS.map((kind) => (
                  <div
                    key={kind.value}
                    onClick={() => setSubmitKind(kind.value)}
                    className={cn(
                      "min-w-[220px] flex-1 cursor-pointer rounded-2xl p-[18px]",
                      submitKind === kind.value
                        ? "border-2 border-folium-blue bg-folium-blue/[0.06]"
                        : "border border-black/[0.08] bg-white"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-sm font-bold text-folium-ink">
                        {kind.value}
                      </div>
                      {kind.badge && (
                        <div className="rounded-md bg-folium-blue/10 px-1.5 py-0.5 text-[10px] font-bold text-folium-blue">
                          {kind.badge}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-[13px] leading-relaxed text-folium-ink/60">
                      {kind.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="w-full flex-none sm:w-[300px]">
            <div className="sticky top-9 rounded-[22px] border border-black/[0.06] bg-white/70 p-7 backdrop-blur-xl">
              <div className="text-[13px] font-bold tracking-wide text-folium-ink/50 uppercase">
                Summary
              </div>
              <div className="mt-[18px] flex justify-between text-sm text-folium-ink/60">
                <div>File size</div>
                <div className="font-semibold text-folium-ink">
                  {hasFile ? `${fileSizeMb} MB` : "–"}
                </div>
              </div>
              <div className="mt-2.5 flex justify-between text-sm text-folium-ink/60">
                <div>Sessions</div>
                <div className="font-semibold text-folium-ink">{concurrency}</div>
              </div>
              <div className="mt-2.5 flex justify-between text-sm text-folium-ink/60">
                <div>Mode</div>
                <div className="font-mono text-xs font-semibold text-folium-ink">
                  {submitKind}
                </div>
              </div>
              <button
                onClick={handleSubmit}
                disabled={!hasFile || submitting}
                className={cn(
                  "mt-6 w-full rounded-full py-[15px] text-[15px] font-bold",
                  hasFile && !submitting
                    ? "cursor-pointer bg-folium-blue text-white"
                    : "cursor-not-allowed bg-black/10 text-folium-ink/40"
                )}
              >
                {submitting ? "Starting…" : "Translate"}
              </button>
              {submitError && (
                <div className="mt-3 text-center text-xs leading-relaxed text-folium-red">
                  {submitError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {submitting && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-folium-black/50 backdrop-blur-sm">
          <div className="flex w-full max-w-[420px] flex-col items-center rounded-[26px] border border-white/60 bg-white/85 p-10 text-center shadow-[0_40px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-folium-blue/15 border-t-folium-blue" />
            <div className="mt-[18px] text-sm text-folium-ink/60">
              Uploading your EPUB and starting the translation…
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
