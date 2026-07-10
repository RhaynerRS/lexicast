"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isTauri } from "@/lib/tauri";

/** Renders nothing outside the desktop app, since there's no per-user LLM
 * config to change in the browser/self-hosted setup. */
export function SettingsLink() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isTauri());
  }, []);

  if (!show) return null;

  return (
    <Link href="/settings" className="text-folium-ink/50 hover:text-folium-ink">
      Settings
    </Link>
  );
}
