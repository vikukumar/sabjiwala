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
  Globe,
  Star,
  Download,
  ShieldAlert,
  ArrowUpRight,
  ChevronRight,
  MessageSquare,
  Smartphone
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
  const [theme, setTheme] = useState<"light" | "dark" | "amoled">("light");
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

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

  const getRoleLabel = (role: string) => {
    if (role === "vendor" || role === "vendor_manager") return "Vendor";
    if (role === "delivery_boy") return "Delivery Partner";
    if (role === "admin" || role === "super_admin") return "Admin";
    return "Customer";
  };

  const faqs = [
    {
      question: "How does Sbjiwala deliver in under 10 minutes?",
      answer: "We operate a network of hyper-local dark stores (micro-fulfillment sourcing hubs) stocked with fresh produce. When you order, our automated packing line selects items in seconds, and local delivery partners dispatch immediately."
    },
    {
      question: "What is 3-Stage Ozone Washing?",
      answer: "To ensure maximum safety, all incoming greens and fruits are washed in natural, oxygenated ozone gas. This eliminates 99.9% of harmful bacteria, viruses, surface dust, and pesticide residues without leaving any chemical aftertaste."
    },
    {
      question: "Do you procure directly from local farmers?",
      answer: "Yes! We work directly with over 450 family farms, cutting out wholesale middlemen entirely. This allows us to pay growers 35% higher profits while keeping consumers' prices highly competitive."
    },
    {
      question: "What is your refund policy for quality issues?",
      answer: "Your trust is our priority. If any item fails to meet your freshness expectations, you can request an instant wallet refund or replacement directly in the customer app within 16 hours of delivery."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] amoled:bg-black text-slate-800 dark:text-slate-100 flex flex-col justify-between transition-colors duration-300 antialiased font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 amoled:bg-black/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-90 active:scale-95 transition-all">
            <img src="/logo_horizontal.png" alt="Sbjiwala Logo" className="h-10 w-auto object-contain dark:brightness-110" />
            <span className="hidden sm:inline-flex bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border border-emerald-500/10">
              Ecosystem
            </span>
          </Link>

          {/* Navigation links */}
          <nav className="hidden lg:flex items-center gap-8">
            <a href="#features" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Pillars
            </a>
            <a href="#workspaces" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Portals
            </a>
            <a href="#metrics" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Metrics
            </a>
            <a href="#download" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Get App
            </a>
            <Link href="/about" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Story
            </Link>
            <Link href="/contact" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Support
            </Link>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {/* Theme selector */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 amoled:bg-zinc-900 text-slate-600 dark:text-slate-300 hover:scale-105 active:scale-95 transition-all border border-slate-200 dark:border-slate-700 font-extrabold text-sm"
              title="Toggle theme (Light / Dark / AMOLED)"
            >
              {theme === "light" && "☀️"}
              {theme === "dark" && "🌙"}
              {theme === "amoled" && "⚡"}
            </button>

            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:block text-right">
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase leading-none">
                    Session Active
                  </p>
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
                  className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all border border-rose-100 dark:border-rose-950/40"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/app/login"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 py-3 rounded-2xl transition-all shadow-md flex items-center gap-1.5 uppercase tracking-wider hover:scale-[1.02] active:scale-95 border border-emerald-500/20"
              >
                Sign In <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Hero & Sections */}
      <main className="flex-1 space-y-24 pb-20">
        
        {/* Section 1: Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 md:pt-16 grid lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-400/5 border border-emerald-555/20 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase tracking-wider animate-pulse mx-auto lg:mx-0">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Sourced directly from village farms
            </div>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] text-slate-900 dark:text-white">
              Kisan ke Ghar Se<br />
              <span className="bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-450 dark:to-teal-400 bg-clip-text text-transparent">
                Apke Ghar tak
              </span><br />
              <span className="text-emerald-600 dark:text-emerald-450 font-black relative">
                Fresh in 10 Minutes
              </span>
            </h1>

            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl mx-auto lg:mx-0 font-medium">
              We cut out wholesale middlemen entirely. Experience crisp, fresh, and ozone-gas sanitized vegetables delivered from local growers directly to your kitchen.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2">
              <Link
                href="/app"
                className="bg-emerald-600 hover:bg-emerald-505 text-white font-extrabold text-xs px-8 py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 uppercase tracking-wider hover:scale-[1.02] active:scale-95"
              >
                Start Shopping <ShoppingBag className="w-4 h-4" />
              </Link>
              <a
                href="#workspaces"
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs px-8 py-4 rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-wider border border-slate-200 dark:border-slate-800 hover:scale-[1.02] active:scale-95"
              >
                Partner Portals <Building2 className="w-4 h-4" />
              </a>
            </div>

            {/* Quick value badges */}
            <div className="grid grid-cols-3 gap-4 pt-4 max-w-md mx-auto lg:mx-0 text-left border-t border-slate-200 dark:border-slate-800/80">
              <div>
                <p className="text-base font-black text-slate-800 dark:text-white">100%</p>
                <p className="text-[9px] uppercase font-black tracking-wider text-slate-450">Ozone Sanitized</p>
              </div>
              <div className="border-l border-slate-200 dark:border-slate-800/80 pl-4">
                <p className="text-base font-black text-slate-800 dark:text-white">&lt; 16 Hrs</p>
                <p className="text-[9px] uppercase font-black tracking-wider text-slate-450">Harvest to Door</p>
              </div>
              <div className="border-l border-slate-200 dark:border-slate-800/80 pl-4">
                <p className="text-base font-black text-slate-800 dark:text-white">35%+</p>
                <p className="text-[9px] uppercase font-black tracking-wider text-slate-450">Farmer Profit Share</p>
              </div>
            </div>
          </div>

          {/* Right Image/Visual Column */}
          <div className="lg:col-span-5 relative group">
            {/* Visual background accents */}
            <div className="absolute inset-0 bg-emerald-500/10 dark:bg-emerald-450/5 rounded-[40px] blur-3xl scale-95 group-hover:scale-105 transition-transform duration-500" />
            
            <div className="relative border border-slate-200 dark:border-slate-800/60 rounded-[32px] overflow-hidden shadow-2xl bg-white dark:bg-slate-900/60 p-4 hover:scale-[1.01] transition-all duration-300">
              <img
                src="/hero_vegetables.png"
                alt="Fresh Organic Vegetables"
                className="w-full h-auto object-cover rounded-2xl"
              />
              
              {/* Glassmorphic overlay card */}
              <div className="absolute bottom-8 left-8 right-8 bg-white/70 dark:bg-slate-950/75 backdrop-blur-md border border-white/20 dark:border-slate-850 p-4.5 rounded-2xl shadow-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
                    <Leaf className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-black text-slate-450 tracking-wider">Quality Guarantee</p>
                    <p className="text-xs font-black text-slate-805 dark:text-white">Pure & Pesticide Free</p>
                  </div>
                </div>
                <div className="bg-emerald-600 text-white font-black text-[10px] px-2.5 py-1 rounded-full uppercase">
                  Grade A
                </div>
              </div>
            </div>
          </div>

        </section>

        {/* Section 2: Core Value Pillars */}
        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
          <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
            <h2 className="text-xs uppercase tracking-widest font-black text-emerald-600 dark:text-emerald-455">Our Sourcing Pillars</h2>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
              Why Sbjiwala Taste & Safety is Unmatched
            </p>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              We redesigned the agricultural supply chain from scratch to deliver vegetables that are healthier, cleaner, and fairer to rural growers.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 */}
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6.5 hover:scale-[1.02] hover:border-emerald-555/30 transition-all duration-300 flex flex-col justify-between shadow-sm">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Leaf className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Direct Farm Sourcing</h3>
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
                  We bypass local wholesale brokers completely. Buying direct from 450+ verified growers ensures vegetables reach you fresher and farmer profits rise by 35%.
                </p>
              </div>
              <div className="pt-6 border-t border-slate-100 dark:border-slate-850 mt-6 flex items-center gap-1 text-[10px] font-black uppercase text-emerald-650 dark:text-emerald-400 tracking-wider">
                Our growers story <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6.5 hover:scale-[1.02] hover:border-emerald-555/30 transition-all duration-300 flex flex-col justify-between shadow-sm">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-teal-650 dark:text-teal-400 flex items-center justify-center">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">3-Stage Ozone Rinsing</h3>
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
                  All greens undergo multi-stage sanitizing gas washes to eliminate 99.9% of microbes, fungus, dirt particles, and chemical pesticide traces.
                </p>
              </div>
              <div className="pt-6 border-t border-slate-100 dark:border-slate-850 mt-6 flex items-center gap-1 text-[10px] font-black uppercase text-teal-600 dark:text-teal-400 tracking-wider">
                Learn process details <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6.5 hover:scale-[1.02] hover:border-emerald-555/30 transition-all duration-300 flex flex-col justify-between shadow-sm">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Award className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Insulated Cold Chain</h3>
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
                  From harvest transit to packing stations, our vegetables stay at optimal, constant temperatures to lock in moisture, crispness, and vitamins.
                </p>
              </div>
              <div className="pt-6 border-t border-slate-100 dark:border-slate-850 mt-6 flex items-center gap-1 text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">
                Cold storage info <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 4 */}
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6.5 hover:scale-[1.02] hover:border-emerald-555/30 transition-all duration-300 flex flex-col justify-between shadow-sm">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">10-Minute Dispatch</h3>
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
                  Our hyper-local micro dark stores ensure quick fulfillment. Couriers load and deliver orders immediately to reach your home in under 10 minutes.
                </p>
              </div>
              <div className="pt-6 border-t border-slate-100 dark:border-slate-850 mt-6 flex items-center gap-1 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                Fulfillment rules <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Interactive Partner Portals */}
        <section id="workspaces" className="bg-slate-100 dark:bg-slate-905/30 amoled:bg-zinc-950 border-y border-slate-200 dark:border-slate-850 py-20 scroll-mt-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
              <h2 className="text-xs uppercase tracking-widest font-black text-emerald-600 dark:text-emerald-455">Workspace Consoles</h2>
              <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                Access Your Respective Portal
              </p>
              <p className="text-xs sm:text-sm text-slate-550 dark:text-slate-400 font-medium">
                Choose the correct dashboard panel to proceed. The unified platform syncs customers, organic growers, dispatch partners, and system admin nodes.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Portal 1: Customer */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group shadow-md">
                <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-300" />
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Customer App</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed font-semibold">
                    Explore daily farm fresh rates, compile your basket, load local wallet cash, and track deliveries.
                  </p>
                </div>
                <div className="mt-8">
                  <Link
                    href="/app"
                    className="w-full bg-emerald-600 hover:bg-emerald-505 text-white font-extrabold text-xs py-3.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 uppercase tracking-wider hover:scale-[1.01]"
                  >
                    Enter Shop <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>

              {/* Portal 2: Vendor */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group shadow-md">
                <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-300" />
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-sm">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Vendor Portal</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-455 leading-relaxed font-semibold">
                    For local store managers and farmers. Update rates, pack outgoing crates, and adjust delivery partner configurations.
                  </p>
                </div>
                <div className="mt-8">
                  <Link
                    href="/vendor"
                    className="w-full bg-slate-850 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-extrabold text-xs py-3.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 uppercase tracking-wider hover:scale-[1.01]"
                  >
                    Vendor Console <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>

              {/* Portal 3: Delivery */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group shadow-md">
                <div className="absolute top-0 right-0 w-28 h-28 bg-teal-500/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-300" />
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-teal-650 dark:text-teal-400 flex items-center justify-center shadow-sm">
                    <Truck className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Delivery Partner</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-455 leading-relaxed font-semibold">
                    For delivery couriers. View maps, scan OTP status, claim payouts, and manage live transit availability.
                  </p>
                </div>
                <div className="mt-8">
                  <Link
                    href="/delivery"
                    className="w-full bg-slate-850 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-extrabold text-xs py-3.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 uppercase tracking-wider hover:scale-[1.01]"
                  >
                    Courier Console <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>

              {/* Portal 4: Admin */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group shadow-md">
                <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-300" />
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-sm">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Admin Control</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-455 leading-relaxed font-semibold">
                    For administrators. Check dashboard stats, verify partner KYC documents, adjust tax parameters, and manage items.
                  </p>
                </div>
                <div className="mt-8">
                  <Link
                    href="/admin"
                    className="w-full bg-slate-850 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-extrabold text-xs py-3.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 uppercase tracking-wider hover:scale-[1.01]"
                  >
                    Oversight Board <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Live Statistics */}
        <section id="metrics" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
          <div className="bg-slate-900 dark:bg-slate-950 border border-slate-800 rounded-[32px] p-8 sm:p-12 text-white relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl" />
            
            <div className="grid lg:grid-cols-3 gap-12 items-center">
              <div className="space-y-4 lg:col-span-1">
                <div className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Live Operations
                </div>
                <h3 className="text-3xl font-black tracking-tight leading-tight">
                  Real-time Portal Operations
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                  Our hyper-local sourcing network runs 24 hours a day, linking agricultural yields to consumer demand dynamically.
                </p>
              </div>

              <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-1">
                  <p className="text-3xl font-black text-emerald-400">450+</p>
                  <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Family Farms</p>
                </div>
                
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-1">
                  <p className="text-3xl font-black text-emerald-400">10 Mins</p>
                  <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Avg Delivery</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-1">
                  <p className="text-3xl font-black text-emerald-400">16 Hrs</p>
                  <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Farm to Table</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-1">
                  <p className="text-3xl font-black text-emerald-400">99.9%</p>
                  <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Clean Wash</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Mobile App Promo */}
        <section id="download" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
          <div className="bg-gradient-to-br from-emerald-900 to-teal-950 rounded-[32px] p-8 sm:p-12 text-white grid lg:grid-cols-2 gap-12 items-center relative overflow-hidden shadow-xl">
            {/* Background elements */}
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-emerald-500/20 rounded-full blur-2xl" />
            
            <div className="space-y-6">
              <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-305 border border-emerald-500/30 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                <Smartphone className="w-3.5 h-3.5" /> Mobile Native Experience
              </div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
                Fresh Groceries in Your Pocket
              </h2>
              <p className="text-xs sm:text-sm leading-relaxed text-slate-300 font-semibold">
                Download the Sbjiwala mobile application for iOS and Android. Unlock live GPS courier map coordinates, secure checkout options, and automatic alerts directly in the background without browser stalls.
              </p>
              
              <div className="flex flex-wrap gap-4 pt-2">
                <button className="flex items-center gap-3 bg-white text-slate-900 px-5 py-3 rounded-2xl font-black text-xs hover:bg-slate-100 transition-all uppercase tracking-wider hover:scale-[1.02] active:scale-95 shadow-md">
                  <Download className="w-4.5 h-4.5 text-emerald-600" /> Google Play Store
                </button>
                <button className="flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-2xl font-black text-xs hover:bg-slate-850 transition-all uppercase tracking-wider hover:scale-[1.02] active:scale-95 shadow-md border border-slate-800">
                  <Download className="w-4.5 h-4.5 text-white animate-pulse" /> Apple App Store
                </button>
              </div>
            </div>

            <div className="flex justify-center items-center relative">
              {/* Mock QR Code Card */}
              <div className="bg-white/10 dark:bg-black/20 border border-white/15 p-6.5 rounded-3xl shadow-2xl backdrop-blur-md flex flex-col items-center gap-4 text-center max-w-sm w-full">
                <div className="w-32 h-32 bg-white rounded-2xl p-2.5 flex items-center justify-center shadow-lg">
                  {/* Clean SVG QR mockup representation */}
                  <svg className="w-full h-full text-slate-900" viewBox="0 0 100 100" fill="currentColor">
                    <rect x="0" y="0" width="20" height="20" />
                    <rect x="25" y="0" width="10" height="20" />
                    <rect x="40" y="0" width="20" height="10" />
                    <rect x="80" y="0" width="20" height="20" />
                    
                    <rect x="0" y="25" width="10" height="10" />
                    <rect x="20" y="25" width="20" height="15" />
                    <rect x="60" y="25" width="15" height="20" />
                    <rect x="80" y="25" width="20" height="10" />

                    <rect x="0" y="45" width="20" height="10" />
                    <rect x="30" y="45" width="10" height="30" />
                    <rect x="50" y="45" width="20" height="20" />
                    <rect x="80" y="45" width="10" height="15" />

                    <rect x="0" y="80" width="20" height="20" />
                    <rect x="30" y="85" width="20" height="15" />
                    <rect x="60" y="80" width="10" height="10" />
                    <rect x="80" y="80" width="20" height="20" />

                    {/* QR Finder squares */}
                    <rect x="3" y="3" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" />
                    <rect x="5" y="5" width="10" height="10" />

                    <rect x="83" y="3" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" />
                    <rect x="85" y="5" width="10" height="10" />

                    <rect x="3" y="83" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" />
                    <rect x="5" y="85" width="10" height="10" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-wider">Scan to Download</p>
                  <p className="text-[10px] text-slate-350 leading-relaxed font-semibold">
                    Aim your mobile camera at this QR code to load links instantly on your browser.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: FAQ Accordion */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
            <h2 className="text-xs uppercase tracking-widest font-black text-emerald-600 dark:text-emerald-455">Frequently Asked</h2>
            <p className="text-3xl font-black text-slate-900 dark:text-white">
              Questions & Answers
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-all shadow-sm"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left font-black text-slate-850 dark:text-slate-105 text-sm outline-none focus:text-emerald-600 transition-colors"
                >
                  <span>{faq.question}</span>
                  <span className={`text-xs text-slate-400 transition-transform duration-300 ${activeFaq === index ? "rotate-180 text-emerald-500" : ""}`}>
                    ▼
                  </span>
                </button>
                <div
                  className={`transition-all duration-300 overflow-hidden ${activeFaq === index ? "max-h-48 border-t border-slate-100 dark:border-slate-850" : "max-h-0"}`}
                >
                  <p className="p-6 text-xs leading-relaxed text-slate-500 dark:text-slate-405 font-semibold">
                    {faq.answer}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 amoled:bg-black py-12 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-12 gap-8 mb-8">
          {/* Logo & description column */}
          <div className="md:col-span-5 space-y-4 text-center md:text-left">
            <img src="/logo_horizontal.png" alt="Sbjiwala Logo" className="h-10 w-auto object-contain dark:brightness-110 mx-auto md:mx-0" />
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold max-w-sm mx-auto md:mx-0">
              Procuring certified organic produce directly from family farms, cleaned in 3-stage ozone rinses, and delivered to your doorstep in Navi Mumbai in 10 minutes flat.
            </p>
            <div className="flex justify-center md:justify-start gap-4">
              <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-xl text-slate-550 dark:text-slate-400">
                <Phone className="w-4 h-4" />
              </div>
              <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-xl text-slate-550 dark:text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-xl text-slate-550 dark:text-slate-400">
                <MapPin className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Links column 1 */}
          <div className="md:col-span-3 text-center md:text-left space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Workspaces</h4>
            <div className="flex flex-col gap-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Link href="/app" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Customer App</Link>
              <Link href="/vendor" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Vendor Dashboard</Link>
              <Link href="/delivery" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Courier Console</Link>
              <Link href="/admin" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">System Oversight</Link>
            </div>
          </div>

          {/* Links column 2 */}
          <div className="md:col-span-4 text-center md:text-left space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Company & Support</h4>
            <div className="flex flex-col gap-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Link href="/about" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">About Our Sourcing</Link>
              <Link href="/contact" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Contact Support Desk</Link>
              <Link href="/terms" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Terms of Service</Link>
              <Link href="/privacy-policy" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Privacy Policy</Link>
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
            <Link href="/privacy-policy" className="hover:underline">Privacy</Link>
            <Link href="/contact" className="hover:underline">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
