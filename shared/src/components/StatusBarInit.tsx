"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

const THEME_COLOR = "#059669";

/**
 * StatusBarInit — programmatically sets the native status bar to the
 * Sbjiwala brand emerald green via Capacitor's runtime plugin registry
 * (Capacitor.Plugins).  This avoids importing @capacitor/status-bar or
 * @capacitor/app as package-level dependencies so the component is safe
 * to bundle in any Next.js app that only has @capacitor/core installed.
 */
export function StatusBarInit() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const applyStatusBar = () => {
      try {
        // Access plugins via the Capacitor runtime registry — no extra package needed.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const plugins = (Capacitor as any).Plugins as Record<string, any> | undefined;
        const StatusBar = plugins?.["StatusBar"];
        if (StatusBar) {
          StatusBar.setBackgroundColor({ color: THEME_COLOR }).catch(() => {});
          // Style.Dark = "DARK" — white icons on dark background
          StatusBar.setStyle({ style: "DARK" }).catch(() => {});
          StatusBar.show().catch(() => {});
        }
      } catch {
        // Silently ignore — web preview or plugin not registered
      }
    };

    applyStatusBar();

    // Re-apply on resume so the system can't reset it (e.g. after screen lock)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plugins = (Capacitor as any).Plugins as Record<string, any> | undefined;
      const App = plugins?.["App"];
      if (App) {
        App.addListener("resume", applyStatusBar);
      }
    } catch {
      // Silently ignore
    }
  }, []);

  return null;
}
