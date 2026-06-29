"use client";

import React, { useEffect, useState, useRef } from "react";
import { Capacitor } from "@capacitor/core";

const THEME_COLOR = "#059669";

/**
 * StatusBarInit — programmatically sets the native status bar to the
 * Sbjiwala brand emerald green via Capacitor's runtime plugin registry.
 * Also configures the Android hardware Back button behavior and handles
 * premium Pull-to-Refresh functionality globally across all apps.
 */
export function StatusBarInit() {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartRef = useRef(0);
  const isAtTopRef = useRef(true);

  // 1. Android Back Button & Status Bar Init
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const applyStatusBar = () => {
      try {
        const plugins = (Capacitor as any).Plugins as Record<string, any> | undefined;
        const StatusBar = plugins?.["StatusBar"];
        if (StatusBar) {
          StatusBar.setBackgroundColor({ color: THEME_COLOR }).catch(() => {});
          StatusBar.setStyle({ style: "DARK" }).catch(() => {});
          StatusBar.show().catch(() => {});
        }
      } catch {
        // Silently ignore
      }
    };

    applyStatusBar();

    // Re-apply status bar on app resume
    try {
      const plugins = (Capacitor as any).Plugins as Record<string, any> | undefined;
      const App = plugins?.["App"];
      if (App) {
        App.addListener("resume", applyStatusBar);

        // Hardware Back Button Router Integration
        App.addListener("backButton", (info: any) => {
          const path = window.location.pathname;
          // Exit app if on root entry dashboards or login/register pages
          if (
            path === "/" || 
            path === "/app" || 
            path === "/vendor" || 
            path === "/delivery" || 
            path === "/admin" || 
            path === "/agent" ||
            path.endsWith("/login") ||
            path.endsWith("/register")
          ) {
            App.exitApp();
          } else if (info.canGoBack) {
            window.history.back();
          } else {
            App.exitApp();
          }
        });
      }
    } catch (e) {
      console.warn("Failed to register App listeners:", e);
    }
  }, []);

  // 2. Global Pull-to-Refresh Gesture Listener
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect first scrollable parent node
    const getScrollParent = (node: HTMLElement | null): HTMLElement | null => {
      if (node == null || node === document.body || node === document.documentElement) return null;
      const style = window.getComputedStyle(node);
      const overflowY = style.overflowY || style.overflow;
      const isScrollable = (overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight;
      if (isScrollable) return node;
      return getScrollParent(node.parentElement);
    };

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const scrollParent = getScrollParent(target);
      
      const isAtTop = scrollParent 
        ? scrollParent.scrollTop === 0 
        : window.scrollY === 0;

      isAtTopRef.current = isAtTop;
      if (isAtTop) {
        touchStartRef.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isAtTopRef.current || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const distance = currentY - touchStartRef.current;

      if (distance > 0) {
        if (distance > 5 && e.cancelable) {
          e.preventDefault();
        }
        // Apply resistance
        const resistanceDistance = Math.min(distance * 0.45, 90);
        setPullDistance(resistanceDistance);
      }
    };

    const handleTouchEnd = () => {
      if (!isAtTopRef.current || isRefreshing) return;

      if (pullDistance >= 60) {
        setIsRefreshing(true);
        setPullDistance(60);
        
        setTimeout(() => {
          window.location.reload();
        }, 300);
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullDistance, isRefreshing]);

  if (pullDistance === 0 && !isRefreshing) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes ptr-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .ptr-spinning {
          animation: ptr-spin 0.8s linear infinite;
        }
      `}} />
      <div
        style={{
          position: "fixed",
          top: `${pullDistance - 42}px`,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "42px",
          height: "42px",
          borderRadius: "50%",
          backgroundColor: "#ffffff",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.18)",
          transition: pullDistance === 0 ? "top 0.3s ease" : "none",
        }}
      >
        <svg
          className={isRefreshing ? "ptr-spinning" : ""}
          style={{
            width: "22px",
            height: "22px",
            color: "#059669",
            transform: isRefreshing ? "none" : `rotate(${pullDistance * 4}deg)`,
            transition: isRefreshing ? "none" : "transform 0.1s ease",
          }}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    </>
  );
}
