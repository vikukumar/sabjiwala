"use client";

import React, { useState, useEffect } from "react";
import {
  ShoppingBag, TrendingUp, MapPin, Settings, LogOut,
  Clock, Menu, X, Loader2
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, useWebSocket } from "@sbjiwala/shared";
import versionInfo from "../app/version.json";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import Link from "next/link";

export const resolveVendorLink = (href: string) => {
  const isUnified = process.env.NEXT_PUBLIC_APP_MODE === "unified";
  if (isUnified) {
    if (href === "/") return "/vendor";
    if (href.startsWith("/vendor")) return href;
    return `/vendor${href}`;
  } else {
    if (href === "/vendor") return "/";
    if (href.startsWith("/vendor/")) return href.substring(7);
  }
  return href;
};

interface VendorLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function VendorLayout({ children, title = "Vendor Portal" }: VendorLayoutProps) {
  const { success } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sw_access_token") : null;
    if (!token) {
      router.replace(resolveVendorLink("/login"));
      return;
    }
    setIsAuthed(true);
  }, [router]);

  useWebSocket((message) => {
    if (message.type === "order_status_update") {
      queryClient.invalidateQueries({ queryKey: ["vendorOrders"] });
      queryClient.invalidateQueries({ queryKey: ["vendorMetrics"] });
      if (message.data?.status === "confirmed" || message.data?.status === "assigned") {
        success("New Order! 🔔", `Order #${message.data?.order_number || ""} received. Click to Accept.`);
      }
    }
  }, !!isAuthed);

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
    router.replace(resolveVendorLink("/login"));
  };

  const { data: vendorProfileData } = useQuery<any>({
    queryKey: ["vendorProfile"],
    queryFn: async () => {
      const res = await api.get("/vendors/me");
      return res.data;
    },
    enabled: !!isAuthed
  });

  const vendorProfile = vendorProfileData || null;
  const businessName = vendorProfile?.business_name || "Green Grocers Ltd";
  const vendorStatus = vendorProfile?.status || "pending";

  const getActiveTab = () => {
    if (typeof window === "undefined") return "dashboard";
    const path = window.location.pathname;
    if (path.includes("/orders")) return "orders";
    if (path.includes("/inventory")) return "inventory";
    if (path.includes("/profile")) return "profile";
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
    { id: "dashboard", label: "Overview", icon: ShoppingBag, href: resolveVendorLink("/") },
    { id: "orders", label: "Orders Board", icon: Clock, href: resolveVendorLink("/orders") },
    { id: "inventory", label: "Inventory", icon: TrendingUp, href: resolveVendorLink("/inventory") },
    { id: "profile", label: "My Profile", icon: Settings, href: resolveVendorLink("/profile") },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between font-sans">
      <div className="space-y-6 flex flex-col h-[calc(100%-150px)]">
        <div className="flex items-center gap-2 flex-shrink-0">
          <img src="/logo_horizontal.png" alt="Sbjiwala Logo" className="h-6 w-auto object-contain brightness-0 invert" />
          <span className="text-[10px] uppercase tracking-wider bg-slate-800 text-slate-450 font-bold px-2 py-0.5 rounded">
            Vendor
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
        <div className="bg-slate-850 rounded-xl p-4 space-y-1 border border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase font-black">Logged in as</p>
          <h4 className="text-xs font-bold text-white truncate">{businessName}</h4>
          <span
            className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded cursor-pointer ${
              vendorStatus === "approved"
                ? "bg-emerald-500/10 text-emerald-400"
                : vendorStatus === "documents_submitted" || vendorStatus === "under_review"
                ? "bg-blue-500/10 text-blue-400"
                : "bg-rose-500/10 text-rose-400 hover:underline"
            }`}
            onClick={() => {
              if (vendorStatus !== "approved") router.push(resolveVendorLink("/kyc"));
            }}
          >
            {vendorStatus.toUpperCase()}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-xs hover:bg-rose-950/20 text-rose-400 hover:text-rose-300 font-bold transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
        <div className="text-center">
          <span className="text-[9px] text-slate-600 font-mono tracking-wider">
            Sbjiwala v{versionInfo.version}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 antialiased font-sans flex transition-colors duration-200">
      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden font-sans">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          {/* Drawer Content */}
          <aside className="relative w-64 max-w-xs bg-slate-900 text-slate-350 flex flex-col p-6 border-r border-slate-800 h-full">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="h-full">
              {sidebarContent}
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar (Not Scrollable, but Menu can scroll inside) */}
      <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col p-6 border-r border-slate-800 flex-shrink-0 h-full">
        {sidebarContent}
      </aside>

      {/* Main Layout (Only Inner Content Scrolls) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between shadow-sm transition-colors duration-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-2 md:hidden">
              <img src="/logo_horizontal.png" alt="Sbjiwala Logo" className="h-7 w-auto object-contain" />
              <span className="text-[9px] uppercase bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold px-1.5 py-0.5 rounded-full">
                Vendor
              </span>
            </div>

            <h2 className="text-base md:text-lg font-black text-slate-800 dark:text-slate-100 hidden md:block">
              {title}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-450 bg-slate-105 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
              <span>Timings: 09:00 AM - 09:00 PM</span>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-655 dark:text-slate-350 hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-500/30"
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
          {vendorStatus !== "approved" && (
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-amber-500/10 dark:from-amber-955/20 dark:to-amber-955/20 border border-amber-300 dark:border-amber-900/60 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm backdrop-blur-sm">
              <div className="space-y-0.5">
                <h4 className="text-xs font-black text-amber-800 dark:text-amber-350 flex items-center gap-1.5">
                  ⚠️ Action Required: KYC Pending
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-amber-400/80 leading-normal">
                  {vendorStatus === "rejected"
                    ? `Verification rejected: "${vendorProfile?.rejection_reason || 'Please upload valid documents'}"`
                    : vendorStatus === "documents_submitted" || vendorStatus === "under_review"
                    ? "Your verification documents are currently being reviewed by admin officers."
                    : "Your store profile is pending document verification. Please complete KYC."}
                </p>
              </div>
              {vendorStatus !== "documents_submitted" && vendorStatus !== "under_review" && (
                <Link
                  href={resolveVendorLink("/kyc")}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black px-4 py-2 rounded-xl transition-all shadow-sm flex-shrink-0"
                >
                  Verify Documents
                </Link>
              )}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
