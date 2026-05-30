"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home, Search, ShoppingCart, Heart, User, Bell, Wallet,
  MapPin, Tag, Gift, HelpCircle, LogOut, ChevronRight,
  Moon, Sun, Zap, Menu, X, Package, Settings, Star,
  MessageSquare, FileText, Shield, RotateCcw
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@sabjiwala/shared";

// ==================== NAV ITEMS ====================
const mainNavItems = [
  { href: "/", icon: Home, label: "Home", exact: true },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/cart", icon: ShoppingCart, label: "Cart", cartBadge: true },
  { href: "/wishlist", icon: Heart, label: "Wishlist" },
  { href: "/profile", icon: User, label: "Profile" },
];

const sidebarSections = [
  {
    title: "Shop",
    items: [
      { href: "/", icon: Home, label: "Home" },
      { href: "/categories", icon: Tag, label: "Categories" },
      { href: "/search", icon: Search, label: "Search" },
      { href: "/offers", icon: Gift, label: "Offers & Deals" },
      { href: "/coupons", icon: Tag, label: "Coupons" },
    ],
  },
  {
    title: "My Account",
    items: [
      { href: "/orders", icon: Package, label: "My Orders" },
      { href: "/wishlist", icon: Heart, label: "Wishlist" },
      { href: "/cart", icon: ShoppingCart, label: "Cart" },
      { href: "/wallet", icon: Wallet, label: "Wallet" },
      { href: "/referrals", icon: Gift, label: "Referrals" },
      { href: "/addresses", icon: MapPin, label: "Saved Addresses" },
      { href: "/reviews", icon: Star, label: "My Reviews" },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/notifications", icon: Bell, label: "Notifications" },
      { href: "/support", icon: HelpCircle, label: "Help & Support" },
      { href: "/support/tickets", icon: MessageSquare, label: "My Tickets" },
      { href: "/faq", icon: FileText, label: "FAQ" },
    ],
  },
  {
    title: "More",
    items: [
      { href: "/about", icon: Shield, label: "About Us" },
      { href: "/how-it-works", icon: Zap, label: "How It Works" },
      { href: "/privacy", icon: FileText, label: "Privacy Policy" },
      { href: "/terms", icon: FileText, label: "Terms of Service" },
      { href: "/refund-policy", icon: RotateCcw, label: "Refund Policy" },
      { href: "/settings", icon: Settings, label: "Settings" },
    ],
  },
];

// ==================== THEME HOOK ====================
export function useTheme() {
  const [theme, setThemeState] = useState<"light" | "dark" | "amoled">("light");

  useEffect(() => {
    const stored = localStorage.getItem("sw_theme") as "light" | "dark" | "amoled" | null;
    if (stored) setThemeState(stored);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setThemeState("dark");
  }, []);

  const setTheme = (t: "light" | "dark" | "amoled") => {
    setThemeState(t);
    localStorage.setItem("sw_theme", t);
    document.documentElement.classList.remove("dark", "amoled");
    if (t === "dark") document.documentElement.classList.add("dark");
    if (t === "amoled") document.documentElement.classList.add("dark", "amoled");
  };

  return { theme, setTheme };
}

// ==================== THEME CYCLE BUTTON ====================
function ThemeCycleButton() {
  const { theme, setTheme } = useTheme();
  const themes: ("light" | "dark" | "amoled")[] = ["light", "dark", "amoled"];
  const cycle = () => {
    const idx = themes.indexOf(theme);
    setTheme(themes[(idx + 1) % themes.length]);
  };
  const icons = { light: { icon: Sun, label: "Light", emoji: "☀️" }, dark: { icon: Moon, label: "Dark", emoji: "🌙" }, amoled: { icon: Zap, label: "AMOLED", emoji: "⚡" } };
  const cfg = icons[theme];
  return (
    <button
      onClick={cycle}
      title={`Current: ${cfg.label} — Click to cycle theme`}
      className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 text-sm"
    >
      {cfg.emoji}
    </button>
  );
}

// ==================== HEADER ====================
function Header({ onMenuOpen }: { onMenuOpen: () => void }) {
  const queryClient = useQueryClient();

  const { data: cartData } = useQuery<any>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await api.get("/cart");
      return res.data || { items: [], item_count: 0 };
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
    staleTime: 30_000,
  });

  const cartCount = cartData?.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0;

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
      <div className="flex items-center justify-between h-16 px-4 md:px-6 max-w-7xl mx-auto">
        {/* Left: menu (mobile) + logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuOpen}
            className="md:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo_horizontal.png" alt="SabjiWala" className="h-8 w-auto object-contain" />
            <span className="hidden sm:inline-flex bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
              Express
            </span>
          </Link>
        </div>

        {/* Center: search (md+) */}
        <Link
          href="/search"
          className="hidden md:flex flex-1 max-w-sm mx-6 items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors text-slate-400 dark:text-slate-500 text-sm cursor-text"
        >
          <Search className="w-4 h-4 flex-shrink-0" />
          <span>Search fresh vegetables & fruits...</span>
        </Link>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <ThemeCycleButton />
          <Link href="/notifications" className="relative p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </Link>
          <Link
            href="/cart"
            className="relative p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label={`Cart with ${cartCount} items`}
          >
            <ShoppingCart className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-emerald-600 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 animate-bounce-in">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

// ==================== SIDEBAR ====================
function Sidebar({ onClose, isOpen }: { onClose: () => void; isOpen?: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const handleLogout = () => {
    localStorage.removeItem("sw_access_token");
    localStorage.removeItem("sw_refresh_token");
    window.location.href = "/login";
  };

  const content = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between p-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <img src="/logo_horizontal.png" alt="SabjiWala" className="h-7 w-auto object-contain brightness-0 invert" />
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Location Bar */}
      <div className="mx-4 mt-4 flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5 border border-white/10">
        <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] text-slate-500 font-medium">Delivering to</p>
          <p className="text-sm font-bold text-white truncate">Mumbai, Maharashtra</p>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-slate-500 ml-auto flex-shrink-0" />
      </div>

      {/* Nav Sections */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-4 space-y-6">
        {sidebarSections.map((section) => (
          <div key={section.title}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 px-3 mb-2">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href, item.href === "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        active
                          ? "bg-emerald-600 text-white shadow-sm shadow-emerald-900/30"
                          : "text-slate-400 hover:text-white hover:bg-white/8"
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: logout */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
        >
          <LogOut className="w-4.5 h-4.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 bg-[var(--sidebar-bg)] border-r border-white/8 fixed left-0 top-0 h-full z-30">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-[var(--sidebar-bg)] animate-slide-right overflow-hidden">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}

// ==================== BOTTOM NAV (Mobile) ====================
function BottomNav() {
  const pathname = usePathname();

  const { data: cartData } = useQuery<any>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await api.get("/cart");
      return res.data || { items: [] };
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
    staleTime: 30_000,
  });

  const cartCount = cartData?.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 bottom-nav-safe">
      <div className="flex items-center justify-around px-1 h-16">
        {mainNavItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all ${
                isActive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-400 dark:text-slate-500"
              }`}
              aria-label={item.label}
            >
              <div className={`relative p-1.5 rounded-xl transition-all ${isActive ? "bg-emerald-50 dark:bg-emerald-950/40" : ""}`}>
                <Icon className="w-5 h-5" />
                {item.cartBadge && cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-emerald-600 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold transition-all ${isActive ? "opacity-100" : "opacity-70"}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ==================== APP SHELL ====================
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Public routes that don't need app shell (full screen)
  const isAuthRoute = ["/login", "/register"].some(r => pathname?.startsWith(r));
  if (isAuthRoute) return <>{children}</>;

  return (
    <div className="min-h-screen flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col md:ml-64 min-w-0">
        <Header onMenuOpen={() => setSidebarOpen(true)} />

        {/* Page content */}
        <main className="flex-1 pb-20 md:pb-0 page-enter">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
