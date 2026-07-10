"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getLlmSettings, isTauri } from "@/lib/tauri";

/** Gates the translate flow behind having LLM settings configured, since
 * folium-api needs a provider/key to do anything. Only applies inside the
 * desktop app — in the browser/self-hosted setup those come from the API's
 * own env vars instead, so there's nothing to gate. */
export default function TranslateLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isTauri()) {
      setReady(true);
      return;
    }
    let cancelled = false;
    getLlmSettings().then((settings) => {
      if (cancelled) return;
      if (!settings || !settings.provider) {
        router.replace(`/settings?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-folium-paper">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-folium-blue/15 border-t-folium-blue" />
      </div>
    );
  }

  return <>{children}</>;
}
