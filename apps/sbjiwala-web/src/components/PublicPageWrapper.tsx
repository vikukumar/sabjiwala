"use client";

import React, { useState, useEffect, useContext } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Leaf,
  User,
  LogOut,
  ArrowRight,
  Phone,
  Mail,
  MapPin
} from "lucide-react";
import { api } from "@sbjiwala/shared";
import { AppShellContext } from "./AppShell";

interface UserPayload {
  sub: string;
  user_type: string;
  username?: string;
  email?: string;
  phone?: string;
  [key: string]: any;
}

export default function PublicPageWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserPayload | null>(null);
  const [theme, setTheme] = useState<"light" | "dark" | "amoled">("light");
  const isInsideAppShell = useContext(AppShellContext);

  useEffect(() => {
    // Check theme
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("sw_theme") as "light" | "dark" | "amoled" | null;
      if (stored) {
        setTheme(stored);
      } else {
        const isDark = document.documentElement.classList.contains("dark");
        setTheme(isDark ? "dark" : "light");
      }
    }

    // Check token
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("sw_access_token");
      if (token) {
        try {
          const base64Url = token.split(".")[1];
          const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
          const jsonPayload = decodeURIComponent(
            window
              .atob(base64)
              .split("")
              .map(function (c) {
                return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
              })
              .join("")
          );
          const decoded = JSON.parse(jsonPayload);
          setCurrentUser(decoded);
        } catch (e) {
          console.error("Failed to decode token", e);
        }
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("sw_access_token");
    localStorage.removeItem("sw_refresh_token");
    setCurrentUser(null);
    window.location.reload();
  };

  const toggleTheme = () => {
    const themes: ("light" | "dark" | "amoled")[] = ["light", "dark", "amoled"];
    const currentIdx = themes.indexOf(theme);
    const nextTheme = themes[(currentIdx + 1) % themes.length];

    setTheme(nextTheme);
    localStorage.setItem("sw_theme", nextTheme);

    document.documentElement.classList.remove("dark", "amoled");
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (nextTheme === "amoled") {
      document.documentElement.classList.add("dark", "amoled");
    }
  };

  const getRoleDashboard = (role: string) => {
    if (role === "vendor" || role === "vendor_manager") return "/vendor";
    if (role === "delivery_boy") return "/delivery";
    if (role === "admin" || role === "super_admin") return "/admin";
    return "/app";
  };

  return (
    <div className={`transition-colors duration-300 antialiased font-sans relative overflow-x-hidden ${isInsideAppShell ? '' : 'min-h-screen bg-slate-50 dark:bg-[#090d10] amoled:bg-black text-slate-800 dark:text-slate-100 flex flex-col justify-between'}`}>

      {/* Background blobs to match landing page design */}
      {!isInsideAppShell && (
        <div className="blob-container opacity-40">
          <div className="blob bg-emerald-500/10 w-[300px] h-[300px] top-[-50px] left-[-50px] absolute rounded-full blur-3xl" />
          <div className="blob bg-teal-500/15 w-[350px] h-[350px] top-[30%] right-[-100px] absolute rounded-full blur-3xl" />
        </div>
      )}

      {/* Header */}
      {!isInsideAppShell && (
        <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 amoled:bg-black/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm transition-all duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 hover:opacity-90 active:scale-95 transition-all">
              <img src="/logo_horizontal.png" alt="Sbjiwala Logo" className="h-10 w-auto object-contain dark:brightness-110" />
              <span className="hidden sm:inline-flex bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border border-emerald-500/10">
                Ecosystem
              </span>
            </Link>

            {/* Navigation Links */}
            <nav className="hidden lg:flex items-center gap-8">
              <Link href="/#features" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                Pillars
              </Link>
              <Link href="/#workspaces" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                Portals
              </Link>
              <Link href="/#metrics" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                Metrics
              </Link>
              <Link href="/#download" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                Get App
              </Link>
              <Link href="/about" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                Story
              </Link>
              <Link href="/contact" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                Support
              </Link>
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 amoled:bg-zinc-900 text-slate-600 dark:text-slate-300 hover:scale-105 active:scale-95 transition-all border border-slate-200 dark:border-slate-700 font-extrabold text-sm"
                title="Toggle theme"
              >
                {theme === "light" && "☀️"}
                {theme === "dark" && "🌙"}
                {theme === "amoled" && "⚡"}
              </button>

              {currentUser ? (
                <div className="flex items-center gap-2">
                  <div className="hidden sm:block text-right">
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase leading-none">Session Active</p>
                    <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate leading-tight mt-0.5 max-w-[120px]">
                      {currentUser.username || currentUser.email || currentUser.phone || "User"}
                    </p>
                  </div>
                  <Link
                    href={getRoleDashboard(currentUser.user_type)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-4.5 py-2.5 rounded-2xl transition-all shadow-md flex items-center gap-1.5 uppercase tracking-wider hover:scale-[1.02] active:scale-95"
                  >
                    <User className="w-3.5 h-3.5" /> Portal
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-455 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all border border-rose-100 dark:border-rose-950/40"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Link
                  href="/app/login"
                  className="bg-emerald-600 hover:bg-emerald-505 text-white font-black text-xs px-5 py-3 rounded-2xl transition-all shadow-md flex items-center gap-1.5 uppercase tracking-wider hover:scale-[1.02] active:scale-95 border border-emerald-500/20"
                >
                  Sign In <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className={`${isInsideAppShell ? '' : 'flex-1 max-w-7xl w-full mx-auto py-12 px-4 sm:px-6 lg:px-8 relative z-10'}`} style={{ overflow: "visible" }}>
        {children}
      </main>

      {/* Footer */}
      {!isInsideAppShell && (
        <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 amoled:bg-black py-12 transition-all duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-12 gap-8 mb-8">
            <div className="md:col-span-5 space-y-4 text-center md:text-left">
              <img src="/logo_horizontal.png" alt="Sbjiwala Logo" className="h-10 w-auto object-contain dark:brightness-110 mx-auto md:mx-0" />
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold max-w-sm mx-auto md:mx-0">
                Procuring certified organic produce directly from family farms, cleaned in 3-stage ozone rinses, and delivered to your doorstep in Navi Mumbai in Instant flat.
              </p>
              <div className="flex justify-center md:justify-start gap-4">
                <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-xl text-slate-550 dark:text-slate-400"><Phone className="w-4 h-4" /></div>
                <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-xl text-slate-550 dark:text-slate-400"><Mail className="w-4 h-4" /></div>
                <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-xl text-slate-550 dark:text-slate-400"><MapPin className="w-4 h-4" /></div>
              </div>
            </div>

            <div className="md:col-span-3 text-center md:text-left space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Workspaces</h4>
              <div className="flex flex-col gap-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <Link href="/app" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Customer App</Link>
                <Link href="/vendor" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Vendor Dashboard</Link>
                <Link href="/delivery" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Courier Console</Link>
                <Link href="/admin" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">System Oversight</Link>
              </div>
            </div>

            <div className="md:col-span-4 text-center md:text-left space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Company & Support</h4>
              <div className="flex flex-col gap-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <Link href="/about" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">About Our Sourcing</Link>
                <Link href="/contact" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Contact Support Desk</Link>
                <Link href="/terms" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Terms of Service</Link>
                <Link href="/privacy" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Privacy Policy</Link>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-800/80 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-450 dark:text-slate-500">
            <div className="flex items-center gap-1.5 justify-center sm:justify-start">
              <Leaf className="w-4 h-4 text-emerald-500" />
              <span>&copy; 2026 Sbjiwala Ecosystem. Farmer-to-Home Network.</span>
            </div>
            <div className="flex items-center gap-4.5 justify-center sm:justify-end">
              <Link href="/about" className="hover:underline">About</Link>
              <Link href="/terms" className="hover:underline">Terms</Link>
              <Link href="/privacy" className="hover:underline">Privacy</Link>
              <Link href="/contact" className="hover:underline">Contact</Link>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
