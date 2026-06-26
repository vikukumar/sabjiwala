"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * StatusBarInit — programmatically sets the native status bar to the
 * Sbjiwala brand emerald green (#059669) on Android via the Capacitor
 * StatusBar plugin.  Should be rendered once near the root of every app.
 */
export function StatusBarInit() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let StatusBar: typeof import("@capacitor/status-bar").StatusBar;

    (async () => {
      try {
        const mod = await import("@capacitor/status-bar");
        StatusBar = mod.StatusBar;

        await StatusBar.setBackgroundColor({ color: "#059669" });
        await StatusBar.setStyle({ style: mod.Style.Dark });
        await StatusBar.show();
      } catch (e) {
        // Plugin may not be installed in web preview – silently ignore
        console.debug("[StatusBarInit] StatusBar plugin unavailable:", e);
      }
    })();

    // Re-apply when the app comes back to foreground (App plugin resume event)
    const applyOnResume = async () => {
      try {
        const { App } = await import("@capacitor/app");
        const { StatusBar: SB, Style } = await import("@capacitor/status-bar");
        App.addListener("resume", async () => {
          await SB.setBackgroundColor({ color: "#059669" });
          await SB.setStyle({ style: Style.Dark });
        });
      } catch {
        // Silently ignore if App plugin is unavailable
      }
    };

    applyOnResume();
  }, []);

  return null;
}
