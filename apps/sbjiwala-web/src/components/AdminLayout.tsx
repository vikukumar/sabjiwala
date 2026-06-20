"use client";

import React, { useState, useEffect } from "react";
import {
  LayoutDashboard, Building2, Users, ShoppingBag, Truck,
  Map, BarChart3, Settings, Tag, Image, MessageSquare,
  LogOut, Menu, X, Loader2, ChevronRight, Bell, Shield,
  Activity, FileText, Megaphone
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import versionInfo from "../app/version.json";

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { id: "orders", label: "Orders", icon: ShoppingBag, href: "/orders" },
  { id: "vendors", label: "Vendors", icon: Building2, href: "/vendors" },
  { id: "delivery", label: "Delivery Boys", icon: Truck, href: "/delivery" },
  { id: "maps", label: "Live Map", icon: Map, href: "/maps", badge: "LIVE" },
  { id: "analytics", label: "Analytics", icon: BarChart3, href: "/analytics" },
  { id: "users", label: "Users", icon: Users, href: "/users" },
  { id: "categories", label: "Categories", icon: Tag, href: "/categories" },
  { id: "coupons", label: "Coupons", icon: Tag, href: "/coupons" },
  { id: "banners", label: "Banners", icon: Image, href: "/banners" },
  { id: "ads", label: "Ads & Popups", icon: Megaphone, href: "/ads" },
  { id: "support", label: "Support", icon: MessageSquare, href: "/support" },
  { id: "support_agents", label: "Support Agents", icon: Shield, href: "/support-agents" },
  { id: "returns", label: "Returns", icon: FileText, href: "/returns" },
  { id: "settings", label: "Settings", icon: Settings, href: "/settings" },
];

export default function AdminLayout({ children, title = "Admin Panel" }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { success } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sw_access_token") : null;
    if (!token) {
      router.replace("/login");
      return;
    }
    // Verify it's an admin token
    try {
      const base64Url = token.split(".")[1];
      const payload = JSON.parse(atob(base64Url));
      if (!["admin", "super_admin"].includes(payload.user_type)) {
        router.replace("/login");
        return;
      }
    } catch {
      router.replace("/login");
      return;
    }
    setIsAuthed(true);
  }, [router]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDark = document.documentElement.classList.contains("dark") || localStorage.getItem("sw_theme") !== "light";
      setTheme(isDark ? "dark" : "light");
      document.documentElement.classList.toggle("dark", isDark);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("sw_theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const handleLogout = () => {
    localStorage.removeItem("sw_access_token");
    localStorage.removeItem("sw_refresh_token");
    queryClient.clear();
    router.replace("/login");
  };

  const { data: metricsData } = useQuery<any>({
    queryKey: ["adminMetrics"],
    queryFn: async () => {
      const res = await api.get("/admin/metrics");
      return res.data;
    },
    enabled: !!isAuthed,
    refetchInterval: 30000,
  });

  const pendingOrders = metricsData?.pending_orders || 0;
  const pendingKyc = metricsData?.pending_kyc || 0;

  if (isAuthed === null) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between">
      <div className="space-y-6 flex flex-col h-[calc(100%-120px)]">
        {/* Logo */}
        <div className="flex items-center gap-2 px-2 flex-shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg">
            S
          </div>
          <div>
            <p className="text-white font-black text-sm tracking-tight leading-none">Sbjiwala</p>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Admin Portal</span>
          </div>
        </div>

        {/* Alert badges */}
        {(pendingOrders > 0 || pendingKyc > 0) && (
          <div className="space-y-1.5 flex-shrink-0">
            {pendingOrders > 0 && (
              <Link href="/orders?status=pending" className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl px-3 py-2 text-[10px] font-bold hover:bg-amber-500/20 transition-all">
                <Bell className="w-3 h-3 animate-pulse" />
                {pendingOrders} pending orders
              </Link>
            )}
            {pendingKyc > 0 && (
              <Link href="/vendors?kyc=pending" className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl px-3 py-2 text-[10px] font-bold hover:bg-blue-500/20 transition-all">
                <Shield className="w-3 h-3 animate-pulse" />
                {pendingKyc} KYC pending
              </Link>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto space-y-0.5 pr-1 custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left font-medium text-sm transition-all cursor-pointer ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-md"
                    : "hover:bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="text-[8px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-full animate-pulse">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="space-y-3 flex-shrink-0 pt-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:bg-rose-950/20 text-rose-400 hover:text-rose-300 font-bold transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
        <p className="text-center text-[9px] text-slate-600 font-mono">
          Sbjiwala Admin v{versionInfo.version}
        </p>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 flex transition-colors duration-200">
      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="relative w-64 bg-slate-900 flex flex-col p-5 border-r border-slate-800 h-full">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="h-full mt-8">{sidebarContent}</div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="w-60 bg-slate-900 hidden md:flex flex-col p-5 border-r border-slate-800 flex-shrink-0 h-full">
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 flex items-center justify-between shadow-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500 animate-pulse hidden md:block" />
              <h1 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:scale-105 transition-all border border-slate-200 dark:border-slate-700"
            >
              {theme === "light" ? "🍆" : "🍋"}
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          {children}
        </main>
      </div>
    </div>
  );
}
