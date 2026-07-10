import Link from "next/link";
import { LiquidGlassCard } from "@/components/ui/liquid-glass";
import { LiquidGradient } from "@/components/landing/liquid-gradient";

export function Hero() {
  return (
    <div className="relative w-full overflow-x-hidden">
      <LiquidGradient />
      <div className="relative z-10 mx-auto flex max-w-[1400px] flex-col items-center px-6 py-16 text-center sm:px-10 sm:py-20 lg:py-24">
        <div className="mb-4 text-[15px] font-semibold tracking-wide text-folium-blue">
          Introducing Folium
        </div>
        <h1 className="max-w-[980px] text-[36px] leading-[1.08] font-bold tracking-tight text-folium-paper sm:text-[48px] md:text-[60px] xl:text-[72px]">
          Translate any EPUB.
          <br />
          Keep every page.
        </h1>
        <p className="mt-5 max-w-[640px] text-base leading-relaxed text-white/65 sm:text-[20px]">
          State-of-the-art LLMs translate your books cover to cover,
          preserving formatting, structure, and style.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <Link
            href="/translate"
            className="rounded-full bg-folium-blue px-8 py-4 text-[17px] font-semibold text-white"
          >
            Get started
          </Link>
        </div>

        <div className="hero-preview relative mt-14 w-full max-w-[1040px]">
          <div className="flex items-end justify-center gap-8 pb-6">
            <LiquidGlassCard
              draggable={false}
              borderRadius="24px"
              blurIntensity="lg"
              glowIntensity="sm"
              shadowIntensity="sm"
              className="w-[230px] translate-y-6 animate-float-a border border-white/[0.16] bg-white/[0.08]"
            >
              <div className="relative z-30 p-[22px] text-left">
                <div className="h-[130px] w-full rounded-xl bg-gradient-to-br from-folium-indigo to-folium-blue" />
                <div className="mt-3.5 text-sm font-semibold text-white">
                  Dune.epub
                </div>
                <div className="mt-1 text-xs text-white/55">
                  → French · APPEND_BLOCK
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.14]">
                  <div className="h-full w-[62%] rounded-full bg-folium-blue" />
                </div>
              </div>
            </LiquidGlassCard>

            <LiquidGlassCard
              draggable={false}
              borderRadius="22px"
              blurIntensity="lg"
              glowIntensity="sm"
              shadowIntensity="sm"
              className="w-[210px] -translate-y-6 animate-float-c border border-white/[0.15] bg-white/[0.07]"
            >
              <div className="relative z-30 p-5 text-left">
                <div className="mb-1.5 text-xs text-white/50">Concurrency</div>
                <div className="flex h-9 items-end gap-1">
                  <div className="h-[40%] w-3 rounded-sm bg-folium-indigo" />
                  <div className="h-[70%] w-3 rounded-sm bg-folium-indigo" />
                  <div className="h-full w-3 rounded-sm bg-folium-indigo" />
                  <div className="h-[55%] w-3 rounded-sm bg-folium-indigo" />
                  <div className="h-[85%] w-3 rounded-sm bg-folium-indigo" />
                </div>
                <div className="mt-2.5 text-xs text-white/55">
                  6 of 10 sessions active
                </div>
              </div>
            </LiquidGlassCard>

            <LiquidGlassCard
              draggable={false}
              borderRadius="24px"
              blurIntensity="lg"
              glowIntensity="sm"
              shadowIntensity="sm"
              className="w-[250px] translate-y-10 animate-float-b border border-white/[0.18] bg-white/[0.09]"
            >
              <div className="relative z-30 p-[22px] text-left">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-folium-green/15">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 12L10 18L20 6"
                        stroke="#34C759"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="text-sm font-semibold text-white">
                    The Great Gatsby.epub
                  </div>
                </div>
                <div className="mt-3 text-xs text-white/55">
                  Translated to Spanish · ready to download
                </div>
                <div className="mt-3.5 rounded-full bg-folium-green py-2.5 text-center text-[13px] font-bold text-[#04220f]">
                  Download
                </div>
              </div>
            </LiquidGlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
