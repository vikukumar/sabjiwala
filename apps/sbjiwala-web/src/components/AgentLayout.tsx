"use client";

import React, { useState, useEffect } from "react";
import {
  MessageSquare, Phone, LogOut,
  Clock, Menu, X, Loader2, Radio, User,
  RotateCcw, ShoppingBag, ShieldCheck
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import versionInfo from "../app/version.json";
import { useQuery } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";

export const resolveAgentLink = (href: string) => {
  const isUnified = process.env.NEXT_PUBLIC_APP_MODE === "unified";
  if (isUnified) {
    if (href === "/") return "/agent";
    if (href.startsWith("/agent")) return href;
    return `/agent${href}`;
  } else {
    if (href === "/agent") return "/";
    if (href.startsWith("/agent/")) return href.substring(6);
  }
  return href;
};

interface AgentLayoutProps {
  children: React.ReactNode;
  title?: string;
  isAvailable?: boolean;
  onAvailabilityToggle?: (val: boolean) => void;
}

export default function AgentLayout({ children, title = "Agent Portal", isAvailable = true, onAvailabilityToggle }: AgentLayoutProps) {
  const { success, error: showError } = useToast();
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  const { data: publicSettings } = useQuery<any>({
    queryKey: ["publicSettings"],
    queryFn: async () => {
      const res = await api.get("/installation/public-settings");
      return res.data?.data || res.data || {};
    },
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const primaryColor = publicSettings?.app_primary_color || "#059669";

    let styleTag = document.getElementById("dynamic-agent-brand-styles");
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "dynamic-agent-brand-styles";
      document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = `
      :root {
        --primary-brand-color: ${primaryColor};
        --emerald-600: ${primaryColor};
        --emerald-500: ${primaryColor};
        --emerald-750: ${primaryColor};
        --emerald-700: ${primaryColor};
      }
      .bg-emerald-600 { background-color: var(--primary-brand-color) !important; }
      .text-emerald-600 { color: var(--primary-brand-color) !important; }
      .hover\\:bg-emerald-600:hover { background-color: var(--primary-brand-color) !important; }
      .hover\\:text-emerald-600:hover { color: var(--primary-brand-color) !important; }
      .bg-emerald-500 { background-color: var(--primary-brand-color) !important; }
      .text-emerald-505 { color: var(--primary-brand-color) !important; }
      .text-emerald-500 { color: var(--primary-brand-color) !important; }
      .border-emerald-500 { border-color: var(--primary-brand-color) !important; }
      .focus\\:border-emerald-500:focus { border-color: var(--primary-brand-color) !important; }
      .bg-emerald-100 { background-color: var(--primary-brand-color)1a !important; }
      .text-emerald-700 { color: var(--primary-brand-color) !important; }
    `;
  }, [publicSettings]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sw_access_token") : null;
    if (!token) {
      router.replace(resolveAgentLink("/login"));
      return;
    }
    setIsAuthed(true);
  }, [router]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDark = document.documentElement.classList.contains("dark") || localStorage.getItem("sw_theme") === "dark";
      setTheme(isDark ? "dark" : "light");
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("sw_theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("sw_access_token");
    localStorage.removeItem("sw_refresh_token");
    router.replace(resolveAgentLink("/login"));
  };

  const getActiveTab = () => {
    if (typeof window === "undefined") return "dashboard";
    const path = window.location.pathname;
    if (path.includes("/calls")) return "calls";
    if (path.includes("/orders")) return "orders";
    if (path.includes("/returns")) return "returns";
    if (path.includes("/kyc")) return "kyc";
    if (path.includes("/settings")) return "settings";
    return "dashboard";
  };

  const activeTab = getActiveTab();

  if (isAuthed === null) {
    return (
      <div className="h-screen w-screen bg-slate-100 dark:bg-[#090d10] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
      </div>
    );
  }

  const navItems = [
    { id: "dashboard", label: "Agent Console", icon: MessageSquare, href: resolveAgentLink("/") },
    { id: "calls", label: "Call Logs", icon: Phone, href: resolveAgentLink("/calls") },
    { id: "orders", label: "Active Orders", icon: ShoppingBag, href: resolveAgentLink("/orders") },
    { id: "returns", label: "Customer Returns", icon: RotateCcw, href: resolveAgentLink("/returns") },
    { id: "kyc", label: "KYC Onboarding", icon: ShieldCheck, href: resolveAgentLink("/kyc") },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between font-sans">
      <div className="space-y-6 flex flex-col h-[calc(100%-150px)]">
        <div className="flex items-center gap-2 flex-shrink-0">
          <img
            src={publicSettings?.app_logo_url || "/logo_horizontal.png"}
            alt={publicSettings?.app_name || "Logo"}
            className="h-6 w-auto object-contain brightness-0 invert"
            onError={(e) => { e.currentTarget.src = "/logo_horizontal.png"; }}
          />
          <span className="text-[10px] uppercase tracking-wider bg-slate-800 text-slate-440 font-bold px-2 py-0.5 rounded">
            Support Agent
          </span>
        </div>

        {/* Scrollable sidebar menu area */}
        <nav className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left font-medium text-sm transition-all cursor-pointer ${
                  isActive ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/10" : "hover:bg-slate-850 hover:text-white text-slate-400"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 flex-shrink-0 pt-4 border-t border-slate-800">
        <div className="bg-slate-850 rounded-xl p-4 space-y-3 border border-slate-800">
          <div className="flex justify-between items-center">
            <p className="text-[10px] text-slate-500 uppercase font-black">Agent Status</p>
            <button
              onClick={() => onAvailabilityToggle?.(!isAvailable)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-all border-0 cursor-pointer ${
                isAvailable
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-slate-700 text-slate-400"
              }`}
            >
              <Radio className={`w-3 h-3 ${isAvailable ? "animate-pulse" : ""}`} />
              {isAvailable ? "Online" : "Offline"}
            </button>
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-white truncate flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              Support Workspace
            </h4>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-xs hover:bg-rose-950/20 text-rose-400 hover:text-rose-300 font-bold transition-all cursor-pointer border-0 bg-transparent"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
        <p className="text-[10px] text-center text-slate-500 font-mono mt-2">
          Sbjiwala Agent v{versionInfo.version}
        </p>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 antialiased font-sans flex transition-colors duration-200">
      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[9999] flex md:hidden font-sans">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          {/* Drawer Content */}
          <aside className="relative w-64 max-w-xs bg-slate-900 text-slate-350 flex flex-col p-6 border-r border-slate-800 h-full">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-white border-0 bg-transparent"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="h-full">
              {sidebarContent}
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col p-6 border-r border-slate-800 flex-shrink-0 h-full">
        {sidebarContent}
      </aside>

      {/* Main Layout (Only Inner Content Scrolls) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between shadow-sm transition-colors duration-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border-0 bg-transparent"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-2 md:hidden">
              <img
                src={publicSettings?.app_logo_url || "/logo_horizontal.png"}
                alt={publicSettings?.app_name || "Logo"}
                className="h-7 w-auto object-contain"
                onError={(e) => { e.currentTarget.src = "/logo_horizontal.png"; }}
              />
              <span className="text-[9px] uppercase bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold px-1.5 py-0.5 rounded-full">
                Support
              </span>
            </div>

            <h2 className="text-base md:text-lg font-black text-slate-800 dark:text-slate-100 hidden md:block">
              {title}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-450 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
              <span>Shift: 24/7 Active Agent Support</span>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-500/30 cursor-pointer"
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {theme === "light" ? (
                <span className="text-sm" role="img" aria-label="light mode">🍋</span>
              ) : (
                <span className="text-sm" role="img" aria-label="dark mode">🍆</span>
              )}
            </button>
          </div>
        </header>

        {/* Scrollable Content Container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
