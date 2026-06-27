"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import VendorLayout from "@/components/VendorLayout";
import DeliveryLayout from "@/components/DeliveryLayout";
import AgentLayout from "@/components/AgentLayout";
import AppShell from "@/components/AppShell";
import { AppUpdater } from "@sbjiwala/shared";
import PublicPageWrapper from "@/components/PublicPageWrapper";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Helper to determine the home path of the current app portal
const getPortalHome = (pathname: string) => {
  if (pathname.startsWith("/admin")) return "/admin";
  if (pathname.startsWith("/vendor")) return "/vendor";
  if (pathname.startsWith("/delivery")) return "/delivery";
  if (pathname.startsWith("/agent")) return "/agent";
  if (pathname.startsWith("/app")) return "/app";
  return "/";
};

// Main 500 Error Content Component
function ErrorContent({ error, reset, pathname }: ErrorProps & { pathname: string }) {
  const homeLink = getPortalHome(pathname);

  useEffect(() => {
    console.error("Sbjiwala Unified Runtime Error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center space-y-6 max-w-md mx-auto py-12">
      {/* Animated Carrot SVG */}
      <div className="w-full flex justify-center py-6">
        <svg
          width="200"
          height="180"
          viewBox="0 0 200 180"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible"
        >
          <defs>
            <linearGradient id="carrot-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="70%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#c2410c" />
            </linearGradient>
            <ellipse cx="100" cy="165" rx="35" ry="8" fill="#000" opacity="0.12" />
          </defs>
          <style>
            {`
              @keyframes shiver {
                0%, 100% { transform: translate(0, 0) rotate(-15deg); }
                10% { transform: translate(-2px, -1px) rotate(-16deg); }
                20% { transform: translate(1px, 2px) rotate(-14deg); }
                30% { transform: translate(-1px, -2px) rotate(-15deg); }
                40% { transform: translate(2px, 1px) rotate(-13deg); }
                50% { transform: translate(-1px, 2px) rotate(-16deg); }
                60% { transform: translate(-2px, -1px) rotate(-14deg); }
                70% { transform: translate(1px, 1px) rotate(-15deg); }
                80% { transform: translate(-1px, -2px) rotate(-16deg); }
                90% { transform: translate(2px, -1px) rotate(-14deg); }
              }
              @keyframes sweat-drop {
                0%, 50% { transform: translate(0, 0); opacity: 0; }
                60% { opacity: 1; }
                100% { transform: translate(-10px, 30px); opacity: 0; }
              }
              .carrot-group {
                animation: shiver 0.3s linear infinite;
                transform-origin: 100px 120px;
              }
              .sweat-1 {
                animation: sweat-drop 2.5s ease-in-out infinite;
              }
              .sweat-2 {
                animation: sweat-drop 2.5s ease-in-out infinite;
                animation-delay: 1.25s;
              }
            `}
          </style>

          {/* Carrot character group */}
          <g className="carrot-group" transform="rotate(-15 100 120)">
            <path d="M85 60 C90 35, 110 35, 115 60 C120 90, 105 145, 100 160 C95 145, 80 90, 85 60 Z" fill="url(#carrot-grad)" />
            <path d="M100 45 C100 20, 80 15, 75 10 C85 20, 95 30, 100 45 Z" fill="#22c55e" />
            <path d="M100 45 C110 20, 120 15, 125 10 C115 20, 105 30, 100 45 Z" fill="#22c55e" />
            <path d="M100 45 C100 15, 100 10, 100 5 C103 15, 101 30, 100 45 Z" fill="#15803d" />
            <path d="M88 80 Q98 83 103 81" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M97 105 Q107 108 112 106" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M91 125 Q98 127 103 126" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M85 75 L93 81 L85 87" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M115 75 L107 81 L115 87" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M93 100 Q96 97 98 100 T103 100 T107 100" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" fill="none" />
            <circle cx="82" cy="92" r="5" fill="#38bdf8" opacity="0.6" />
            <circle cx="118" cy="92" r="5" fill="#38bdf8" opacity="0.6" />
            <path d="M103 100 L118 108" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
            <circle cx="118" cy="108" r="3" fill="#ef4444" />
          </g>

          {/* Flying Sweat Drops */}
          <path className="sweat-1" d="M75 80 Q70 85 73 90" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path className="sweat-2" d="M125 75 Q130 80 127 85" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" fill="none" />
        </svg>
      </div>

      {/* Text Details */}
      <div className="space-y-2">
        <h1 className="text-6xl font-black text-amber-600 dark:text-amber-500">500</h1>
        <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Oh no! Our veggies encountered a soil error.</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-sm">
          Something went wrong with the system connection. The soil chemistry or code nutrition might be out of balance.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          onClick={() => reset()}
          className="w-full sm:w-auto bg-amber-600 hover:bg-amber-500 dark:bg-amber-500 dark:hover:bg-amber-400 text-white font-bold px-8 py-3 rounded-full shadow-md hover:shadow-lg transition-all text-sm tracking-wide"
        >
          Try Again
        </button>
        <Link
          href={homeLink}
          className="w-full sm:w-auto border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold px-8 py-3 rounded-full shadow-sm transition-all text-sm tracking-wide text-center"
        >
          Go Back Home
        </Link>
      </div>
    </div>
  );
}

// Layout Switcher Wrapper
export default function UnifiedErrorPage({ error, reset }: ErrorProps) {
  const pathname = usePathname() || "";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Avoid hydration mismatch on layout wrapping
  }

  // Wrap in corresponding Portal layout
  if (pathname.startsWith("/admin")) {
    return (
      <AdminLayout title="System Error">
        <ErrorContent error={error} reset={reset} pathname={pathname} />
      </AdminLayout>
    );
  }

  if (pathname.startsWith("/vendor")) {
    return (
      <VendorLayout title="System Error">
        <ErrorContent error={error} reset={reset} pathname={pathname} />
      </VendorLayout>
    );
  }

  if (pathname.startsWith("/delivery")) {
    return (
      <DeliveryLayout>
        <ErrorContent error={error} reset={reset} pathname={pathname} />
      </DeliveryLayout>
    );
  }

  if (pathname.startsWith("/agent")) {
    return (
      <AgentLayout title="System Error">
        <ErrorContent error={error} reset={reset} pathname={pathname} />
      </AgentLayout>
    );
  }

  if (pathname.startsWith("/app")) {
    return (
      <>
        <AppShell>
          <div className="bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 min-h-[70vh] flex flex-col items-center justify-center">
            <ErrorContent error={error} reset={reset} pathname={pathname} />
          </div>
        </AppShell>
        <AppUpdater appName="customer" />
      </>
    );
  }

  // Fallback to Public layout wrapper
  return (
    <PublicPageWrapper>
      <ErrorContent error={error} reset={reset} pathname={pathname} />
    </PublicPageWrapper>
  );
}
