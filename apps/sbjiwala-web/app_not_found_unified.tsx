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

// Helper to determine the home path of the current app portal
const getPortalHome = (pathname: string) => {
  if (pathname.startsWith("/admin")) return "/admin";
  if (pathname.startsWith("/vendor")) return "/vendor";
  if (pathname.startsWith("/delivery")) return "/delivery";
  if (pathname.startsWith("/agent")) return "/agent";
  if (pathname.startsWith("/app")) return "/app";
  return "/";
};

// Main 404 Content Component
function NotFoundContent({ pathname }: { pathname: string }) {
  const homeLink = getPortalHome(pathname);
  
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center space-y-6 max-w-md mx-auto py-12">
      {/* Animated Tomato SVG */}
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
            <radialGradient id="tomato-grad" cx="40%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#ff6b6b" />
              <stop offset="70%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#b91c1c" />
            </radialGradient>
            <ellipse id="shadow" cx="100" cy="160" rx="40" ry="10" fill="#000" opacity="0.15" />
          </defs>
          <style>
            {`
              @keyframes tomato-roll {
                0% { transform: translateX(-40px) rotate(0deg); }
                50% { transform: translateX(40px) rotate(180deg); }
                100% { transform: translateX(-40px) rotate(360deg); }
              }
              @keyframes shadow-slide {
                0% { transform: translateX(-40px) scaleX(1); opacity: 0.15; }
                50% { transform: translateX(40px) scaleX(0.85); opacity: 0.25; }
                100% { transform: translateX(-40px) scaleX(1); opacity: 0.15; }
              }
              .tomato-body-group {
                animation: tomato-roll 4s ease-in-out infinite;
                transform-origin: 100px 105px;
              }
              .shadow-ellipse {
                animation: shadow-slide 4s ease-in-out infinite;
                transform-origin: 100px 160px;
              }
            `}
          </style>
          
          {/* Sliding shadow under the tomato */}
          <g className="shadow-ellipse">
            <use href="#shadow" />
          </g>
          
          {/* Tomato body group */}
          <g className="tomato-body-group">
            <circle cx="100" cy="105" r="45" fill="url(#tomato-grad)" />
            <path d="M100 60 C98 50, 102 50, 100 45 C95 52, 92 52, 90 56 C95 58, 97 59, 100 60 Z" fill="#10b981" />
            <path d="M100 60 C110 52, 112 55, 118 52 C110 59, 105 59, 100 60 Z" fill="#10b981" />
            <path d="M100 60 C88 54, 85 57, 80 54 C89 60, 94 60, 100 60 Z" fill="#10b981" />
            <path d="M100 60 C104 62, 106 66, 108 72 C103 68, 101 64, 100 60 Z" fill="#10b981" />
            <path d="M100 60 C96 62, 94 66, 92 72 C97 68, 99 64, 100 60 Z" fill="#10b981" />
            <rect x="98" y="42" width="4" height="8" rx="2" fill="#047857" />
            <circle cx="85" cy="100" r="4.5" fill="#1e293b" />
            <circle cx="115" cy="100" r="4.5" fill="#1e293b" />
            <circle cx="83.5" cy="98.5" r="1.5" fill="white" />
            <circle cx="113.5" cy="98.5" r="1.5" fill="white" />
            <path d="M78 92 C82 94, 86 94, 90 92" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M110 92 C114 94, 118 94, 122 92" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M94 118 Q100 112 106 118" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" fill="none" />
            <circle cx="77" cy="106" r="5" fill="#ef4444" opacity="0.5" />
            <circle cx="123" cy="106" r="5" fill="#ef4444" opacity="0.5" />
          </g>
        </svg>
      </div>

      {/* Text Details */}
      <div className="space-y-2">
        <h1 className="text-6xl font-black text-emerald-600 dark:text-emerald-400">404</h1>
        <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Oops! This tomato rolled off the cart.</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-sm">
          We couldn't find the page you were looking for. It might have been harvested, eaten, or moved to another market.
        </p>
      </div>

      {/* Return Button */}
      <div className="pt-2">
        <Link
          href={homeLink}
          className="inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white font-bold px-8 py-3 rounded-full shadow-md hover:shadow-lg transition-all text-sm tracking-wide"
        >
          Go Back Home
        </Link>
      </div>
    </div>
  );
}

// Layout Switcher Wrapper
export default function UnifiedNotFound() {
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
      <AdminLayout title="404 - Not Found">
        <NotFoundContent pathname={pathname} />
      </AdminLayout>
    );
  }

  if (pathname.startsWith("/vendor")) {
    return (
      <VendorLayout title="404 - Not Found">
        <NotFoundContent pathname={pathname} />
      </VendorLayout>
    );
  }

  if (pathname.startsWith("/delivery")) {
    return (
      <DeliveryLayout>
        <NotFoundContent pathname={pathname} />
      </DeliveryLayout>
    );
  }

  if (pathname.startsWith("/agent")) {
    return (
      <AgentLayout title="404 - Not Found">
        <NotFoundContent pathname={pathname} />
      </AgentLayout>
    );
  }

  if (pathname.startsWith("/app")) {
    return (
      <>
        <AppShell>
          <div className="bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 min-h-[70vh] flex flex-col items-center justify-center">
            <NotFoundContent pathname={pathname} />
          </div>
        </AppShell>
        <AppUpdater appName="customer" />
      </>
    );
  }

  // Fallback to Public layout wrapper
  return (
    <PublicPageWrapper>
      <NotFoundContent pathname={pathname} />
    </PublicPageWrapper>
  );
}
