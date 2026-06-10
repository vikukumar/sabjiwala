"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Leaf,
  ShoppingBag,
  Building2,
  Truck,
  Shield,
  ArrowRight,
  LogOut,
  User,
  Check,
  Sparkles,
  MapPin,
  HelpCircle,
  Phone,
  Mail,
  Zap,
  TrendingUp,
  Award,
  Globe
} from "lucide-react";
import { api } from "@sbjiwala/shared";

interface UserPayload {
  sub: string;
  user_type: string;
  username?: string;
  email?: string;
  phone?: string;
  [key: string]: any;
}

export default function UnifiedLandingPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserPayload | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Check theme
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");

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
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("sw_theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Maps roles to human-friendly terms and landing pages
  const getRoleDashboard = (role: string) => {
    if (role === "vendor" || role === "vendor_manager") return "/vendor";
    if (role === "delivery_boy") return "/delivery";
    if (role === "admin" || role === "super_admin") return "/admin";
    return "/app";
  };

  const getRoleLabel = (role: string) => {
    if (role === "vendor" || role === "vendor_manager") return "Vendor";
    if (role === "delivery_boy") return "Delivery Partner";
    if (role === "admin" || role === "super_admin") return "Admin";
    return "Customer";
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 flex flex-col justify-between transition-colors duration-300 antialiased font-sans">
      {/* Premium Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo_horizontal.png" alt="Sbjiwala Logo" className="h-10 w-auto object-contain" />
            <span className="hidden sm:inline-flex bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-450 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
              Unified Platform
            </span>
          </div>

          {/* Navigation Links for Roles */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/app"
              className="text-sm font-extrabold text-slate-600 dark:text-slate-350 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors uppercase tracking-wider"
            >
              Customer
            </Link>
            <Link
              href="/vendor"
              className="text-sm font-extrabold text-slate-600 dark:text-slate-350 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors uppercase tracking-wider"
            >
              Vendor
            </Link>
            <Link
              href="/delivery"
              className="text-sm font-extrabold text-slate-600 dark:text-slate-350 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors uppercase tracking-wider"
            >
              Delivery Partner
            </Link>
            <Link
              href="/admin"
              className="text-sm font-extrabold text-slate-600 dark:text-slate-350 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors uppercase tracking-wider"
            >
              Admin
            </Link>
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:scale-105 active:scale-95 transition-all border border-slate-200 dark:border-slate-700"
              title="Toggle theme"
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>

            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:block text-right">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase leading-none">
                    Logged In
                  </p>
                  <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate leading-tight mt-0.5">
                    {currentUser.username || currentUser.email || "User"}
                  </p>
                </div>
                <Link
                  href={getRoleDashboard(currentUser.user_type)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 uppercase tracking-wider"
                >
                  <User className="w-3.5 h-3.5" /> Workspace
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all border border-rose-100 dark:border-rose-950/40"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/app/login"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-5 py-3 rounded-xl transition-all shadow-md flex items-center gap-1.5 uppercase tracking-wider"
              >
                Sign In <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content / Hero Portal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col justify-center gap-10">
        {/* Banner Intro */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-400/5 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase tracking-widest animate-pulse">
            <Sparkles className="w-4 h-4" /> Organic Marketplace Ecosystem
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight text-slate-900 dark:text-white">
            Kisan ke Ghar Se<br className="sm:hidden" /> Apke Ghar tak —
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent ml-2">
              Fresh in 10 Mins
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-550 dark:text-slate-400 leading-relaxed max-w-xl mx-auto">
            Choose your custom portal to continue. Our hyper-local network connects organic farmers, local vendors, and courier partners seamlessly.
          </p>
        </div>

        {/* Current Auth Status Callout */}
        {currentUser && (
          <div className="max-w-xl mx-auto w-full p-4 bg-emerald-500/10 dark:bg-emerald-400/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                You are currently active as a{" "}
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 uppercase">
                  {getRoleLabel(currentUser.user_type)}
                </span>
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                Token Session ID: {currentUser.sub}
              </p>
            </div>
            <Link
              href={getRoleDashboard(currentUser.user_type)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 uppercase tracking-wider"
            >
              Open Dashboard <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Dynamic Grid Cards for Roles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Customer */}
          <div className="group card card-hover p-6 flex flex-col justify-between text-center lg:text-left relative overflow-hidden bg-white dark:bg-slate-900">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-300"></div>
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto lg:mx-0 shadow-sm mb-4">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Customer App</h3>
              <p className="text-xs text-slate-550 dark:text-slate-450 mt-2 leading-relaxed">
                Shop organic vegetables, fruits, and daily green items direct from local farms. Get ultra-fast 10-minute delivery.
              </p>
            </div>
            <div className="mt-6">
              <Link
                href="/app"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 uppercase tracking-wider"
              >
                Go Shopping <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Card 2: Vendor */}
          <div className="group card card-hover p-6 flex flex-col justify-between text-center lg:text-left relative overflow-hidden bg-white dark:bg-slate-900">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-300"></div>
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto lg:mx-0 shadow-sm mb-4">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Vendor Portal</h3>
              <p className="text-xs text-slate-550 dark:text-slate-450 mt-2 leading-relaxed">
                Manage your digital inventory, update product rates, process outgoing orders, and customize delivery configurations.
              </p>
            </div>
            <div className="mt-6">
              <Link
                href="/vendor"
                className="w-full bg-slate-850 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 uppercase tracking-wider"
              >
                Vendor Workspace <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Card 3: Delivery Boy */}
          <div className="group card card-hover p-6 flex flex-col justify-between text-center lg:text-left relative overflow-hidden bg-white dark:bg-slate-900">
            <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-300"></div>
            <div>
              <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto lg:mx-0 shadow-sm mb-4">
                <Truck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Delivery Partner</h3>
              <p className="text-xs text-slate-550 dark:text-slate-450 mt-2 leading-relaxed">
                Accept delivery tasks, view routes on live maps, update customer OTPs, and track your daily payouts and metrics.
              </p>
            </div>
            <div className="mt-6">
              <Link
                href="/delivery"
                className="w-full bg-slate-850 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 uppercase tracking-wider"
              >
                Delivery Console <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Card 4: Admin */}
          <div className="group card card-hover p-6 flex flex-col justify-between text-center lg:text-left relative overflow-hidden bg-white dark:bg-slate-900">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-300"></div>
            <div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto lg:mx-0 shadow-sm mb-4">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Admin Control</h3>
              <p className="text-xs text-slate-550 dark:text-slate-450 mt-2 leading-relaxed">
                Platform metrics oversight, register new categories, review partner KYC submissions, and manage system parameters.
              </p>
            </div>
            <div className="mt-6">
              <Link
                href="/admin"
                className="w-full bg-slate-850 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 uppercase tracking-wider"
              >
                Oversight Board <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* Small Platform Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl text-center shadow-sm">
          <div className="space-y-1">
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-455">10 Min</p>
            <p className="text-[10px] text-slate-400 uppercase font-extrabold">Delivery Promise</p>
          </div>
          <div className="space-y-1 border-l border-slate-200 dark:border-slate-800">
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-455">100%</p>
            <p className="text-[10px] text-slate-400 uppercase font-extrabold">Hygienic Sorting</p>
          </div>
          <div className="space-y-1 border-l border-slate-200 dark:border-slate-800">
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-455">Direct</p>
            <p className="text-[10px] text-slate-400 uppercase font-extrabold">Farmer Partnerships</p>
          </div>
          <div className="space-y-1 border-l border-slate-200 dark:border-slate-800">
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-455">Secure</p>
            <p className="text-[10px] text-slate-400 uppercase font-extrabold">Role Authorization</p>
          </div>
        </div>
      </main>

      {/* Premium Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-6 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-1.5">
            <Leaf className="w-4 h-4 text-emerald-500" />
            <span>&copy; 2026 Sbjiwala Ecosystem • Farmer-to-Home Network</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/app/about" className="hover:underline">About Us</Link>
            <Link href="/app/faq" className="hover:underline">FAQ</Link>
            <Link href="/app/terms" className="hover:underline">Terms</Link>
            <Link href="/app/privacy" className="hover:underline">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
