"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Home, Search, ShoppingCart, Heart, User, Bell, Wallet,
  MapPin, Tag, Gift, HelpCircle, LogOut, ChevronRight,
  Moon, Sun, Zap, Menu, X, Package, Settings, Star,
  MessageSquare, FileText, Shield, RotateCcw, ShieldCheck, Check,
  Leaf,
  RefreshCw,
  WifiOff,
  Camera,
  Smartphone
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";

// ==================== ROUTE PROTECTION helper ====================
export const isProtectedRoute = (path: string) => {
  const protectedPrefixes = [
    "/profile",
    "/orders",
    "/wishlist",
    "/wallet",
    "/referrals",
    "/addresses",
    "/reviews",
    "/settings",
    "/checkout"
  ];
  return protectedPrefixes.some(prefix => path === prefix || path.startsWith(prefix + "/"));
};

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
            <img src="/logo_horizontal.png" alt="Sbjiwala" className="h-8 w-auto object-contain" />
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
  const router = useRouter();
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
          <img src="/logo_horizontal.png" alt="Sbjiwala" className="h-7 w-auto object-contain brightness-0 invert" />
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
                      onClick={(e) => {
                        if (isProtectedRoute(item.href) && !localStorage.getItem("sw_access_token")) {
                          e.preventDefault();
                          router.push(`/login?redirect=${encodeURIComponent(item.href)}`);
                        }
                        if (onClose) onClose();
                      }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${active
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
  const router = useRouter();

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
              onClick={(e) => {
                if (isProtectedRoute(item.href) && !localStorage.getItem("sw_access_token")) {
                  e.preventDefault();
                  router.push(`/login?redirect=${encodeURIComponent(item.href)}`);
                }
              }}
              className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all ${isActive
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

// ==================== GEOLOCATION FALLBACK PICKER ====================
interface LocationSelectDrawerProps {
  onSelect: (lat: number, lon: number, name: string) => void;
  onClose: () => void;
}

const DEFAULT_CITIES = [
  { name: "Vashi, Navi Mumbai", lat: 19.0330, lon: 73.0297 },
  { name: "Bandra West, Mumbai", lat: 19.0596, lon: 72.8295 },
  { name: "Andheri East, Mumbai", lat: 19.1176, lon: 72.8631 },
  { name: "Thane West, Maharashtra", lat: 19.2183, lon: 72.9781 },
  { name: "Powai, Mumbai", lat: 19.1176, lon: 72.9060 },
];

function LocationSelectDrawer({ onSelect, onClose }: LocationSelectDrawerProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 animate-scale-in text-white">
      <h3 className="font-black text-sm uppercase tracking-wider text-slate-400">Select Neighborhood</h3>
      <p className="text-xs text-slate-400">Since precise geolocation was denied, select a nearby delivery hub:</p>
      <div className="space-y-2 mt-2 max-h-48 overflow-y-auto pr-1">
        {DEFAULT_CITIES.map((city) => (
          <button
            key={city.name}
            onClick={() => onSelect(city.lat, city.lon, city.name)}
            className="w-full text-left px-4 py-3 rounded-xl bg-slate-800 hover:bg-emerald-600 hover:text-white transition-all text-xs font-bold flex items-center justify-between border border-slate-700 hover:border-emerald-500"
          >
            <span>{city.name}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="w-full text-center text-xs font-black text-slate-500 hover:text-slate-400 tracking-wider uppercase pt-2"
      >
        Close
      </button>
    </div>
  );
}

// ==================== SPLASH & MULTI-SLIDE ONBOARDING ====================
function SplashPermissionsScreen({ onComplete }: { onComplete: () => void }) {
  const [loading, setLoading] = useState(true);
  const [slide, setSlide] = useState(1);
  const [locPermission, setLocPermission] = useState<"default" | "granted" | "denied">("default");
  const [showManualPicker, setShowManualPicker] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        setLocPermission(result.state as any);
        result.onchange = () => setLocPermission(result.state as any);
      }).catch(() => { });
    }
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const requestLocation = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocPermission("denied");
      setShowManualPicker(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocPermission("granted");
        localStorage.setItem("sw_latitude", String(pos.coords.latitude));
        localStorage.setItem("sw_longitude", String(pos.coords.longitude));
        localStorage.setItem("sw_location_name", "My Precise Location");
        localStorage.setItem("sw_perm_location", "granted");
        localStorage.setItem("sw_splash_onboarding", "completed");
        onComplete();
      },
      () => {
        setLocPermission("denied");
        localStorage.setItem("sw_perm_location", "denied");
        setShowManualPicker(true);
      }
    );
  };

  const handleManualLocation = (lat: number, lon: number, name: string) => {
    localStorage.setItem("sw_latitude", String(lat));
    localStorage.setItem("sw_longitude", String(lon));
    localStorage.setItem("sw_location_name", name);
    localStorage.setItem("sw_splash_onboarding", "completed");
    onComplete();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-[#090d10] flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center p-3 animate-pulse shadow-[0_0_50px_rgba(16,185,129,0.3)]">
            <img src="/icon.png" alt="Sbjiwala" className="w-full h-full object-contain" />
          </div>
          <div className="absolute inset-0 w-24 h-24 rounded-3xl border-4 border-emerald-500 border-t-transparent animate-spin" style={{ animationDuration: '1.5s' }} />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black tracking-wider text-white">Sbjiwala</h2>
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest animate-pulse">Freshness Loading</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#090d10] flex flex-col justify-between px-6 py-12 text-white font-sans overflow-y-auto">
      {/* Onboarding Header */}
      <div className="flex flex-col items-center text-center mt-6 space-y-4">
        <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-3 shadow-lg flex items-center justify-center">
          <img src="/icon.png" alt="Sbjiwala" className="w-full h-full object-contain" />
        </div>
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-white">Sbjiwala</h1>
          <span className="inline-flex bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Step {slide} of 4
          </span>
        </div>
      </div>

      {/* Onboarding Dynamic Slides */}
      <div className="max-w-md w-full mx-auto my-8 min-h-[220px] flex items-center">
        {slide === 1 && (
          <div className="w-full text-center space-y-4 animate-fade-in">
            <h2 className="text-xl font-black text-white">Welcome to Sbjiwala</h2>
            <p className="text-sm text-slate-400 leading-relaxed px-4">
              Your ultimate farm-to-fork express grocery app. Discover and shop crisp, premium vegetables and fruits directly from local farms.
            </p>
          </div>
        )}

        {slide === 2 && (
          <div className="w-full text-center space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <MapPin className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white">Why We Need Location</h2>
            <p className="text-sm text-slate-400 leading-relaxed px-4">
              We detect nearby store radiuses to show available items in your service area, match local couriers, and calculate exact delivery fees.
            </p>
          </div>
        )}

        {slide === 3 && (
          <div className="w-full text-center space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <Leaf className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white">10-Minute Freshness</h2>
            <p className="text-sm text-slate-400 leading-relaxed px-4">
              Our products are washed, hygienically packed, and delivered to your doorstep in 10 minutes flat with guaranteed safety.
            </p>
          </div>
        )}

        {slide === 4 && (
          <div className="w-full space-y-5 animate-fade-in">
            {showManualPicker ? (
              <LocationSelectDrawer
                onSelect={handleManualLocation}
                onClose={() => setShowManualPicker(false)}
              />
            ) : (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-5 text-center">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">Geolocation Setup</h3>
                <p className="text-xs text-slate-400 px-2 leading-relaxed">
                  Provide precise location permissions for live courier updates and accurate mapping.
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={requestLocation}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-6 py-3 rounded-xl text-xs transition-all flex items-center gap-2 border border-emerald-500 mx-auto"
                  >
                    <MapPin className="w-4 h-4" /> Enable Geolocation
                  </button>
                </div>
                {locPermission === "denied" && (
                  <div className="space-y-2 pt-2">
                    <p className="text-[10px] text-rose-400 font-bold">Location access blocked by browser.</p>
                    <button
                      onClick={() => setShowManualPicker(true)}
                      className="text-xs text-emerald-400 hover:underline font-bold"
                    >
                      Choose Manual Location instead →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Onboarding Bottom Controls */}
      <div className="max-w-md w-full mx-auto space-y-4">
        {/* Navigation Dot controls */}
        <div className="flex justify-center gap-2 mb-2">
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === slide ? "bg-emerald-500 w-6" : "bg-slate-700 w-1.5"}`}
            />
          ))}
        </div>

        {slide < 4 ? (
          <div className="flex gap-3">
            <button
              onClick={() => setSlide(4)}
              className="flex-1 text-center text-xs font-black text-slate-500 hover:text-slate-400 tracking-wider uppercase py-3.5"
            >
              Skip
            </button>
            <button
              onClick={() => setSlide((s) => s + 1)}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-3.5 rounded-2xl text-xs transition-all text-center border border-slate-700"
            >
              Next
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => {
                localStorage.setItem("sw_splash_onboarding", "completed");
                localStorage.setItem("sw_latitude", "19.0760");
                localStorage.setItem("sw_longitude", "72.8777");
                localStorage.setItem("sw_location_name", "Mumbai Center (Default)");
                onComplete();
              }}
              className="w-full text-center text-xs font-black text-slate-550 hover:text-slate-400 tracking-wider uppercase py-2"
            >
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== CONTEXTUAL NOTIFICATION PERMISSION BENEFIT MODAL ====================
interface NotificationModalProps {
  onClose: () => void;
  onGrant: () => void;
}

function NotificationBenefitModal({ onClose, onGrant }: NotificationModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full animate-scale-in text-slate-800 dark:text-white space-y-4">
        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <Bell className="w-6 h-6 animate-bounce" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-black tracking-tight">Enable Live Alerts? 🔔</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Get instant courier status mappings and special platform coupons delivered contextually:
          </p>
        </div>
        <ul className="space-y-2 text-xs font-semibold text-slate-650 dark:text-slate-300">
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500" />
            <span>Real-time Courier ETA & Live Map tracking</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500" />
            <span>Order Packed & Dispatch warnings</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500" />
            <span>Exclusive flash coupon updates & wallet bonuses</span>
          </li>
        </ul>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-xs font-black text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 text-center uppercase tracking-wider"
          >
            Later
          </button>
          <button
            onClick={onGrant}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 rounded-xl text-xs transition-all shadow-md shadow-emerald-900/20"
          >
            Allow Alerts
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== APP SHELL ====================
// ==================== STARTUP PERMISSIONS MODAL ====================
interface UnifiedPermissionsModalProps {
  onClose: () => void;
  onPermissionGranted: () => void;
}

function UnifiedPermissionsModal({ onClose, onPermissionGranted }: UnifiedPermissionsModalProps) {
  const [geoState, setGeoState] = useState<"default" | "granted" | "denied">("default");
  const [notifState, setNotifState] = useState<"default" | "granted" | "denied">("default");
  const [cameraState, setCameraState] = useState<"default" | "granted" | "denied">("default");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkStates = async () => {
      if (navigator.permissions) {
        try {
          const geo = await navigator.permissions.query({ name: "geolocation" as any });
          setGeoState(geo.state as any);
          geo.onchange = () => setGeoState(geo.state as any);
        } catch {}

        try {
          const notif = await navigator.permissions.query({ name: "notifications" as any });
          setNotifState(notif.state as any);
          notif.onchange = () => setNotifState(notif.state as any);
        } catch {}

        try {
          const cam = await navigator.permissions.query({ name: "camera" as any });
          setCameraState(cam.state as any);
          cam.onchange = () => setCameraState(cam.state as any);
        } catch {}
      } else {
        setNotifState(Notification.permission as any);
      }
    };

    checkStates();
  }, []);

  const requestGeo = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoState("granted");
        localStorage.setItem("sw_latitude", String(pos.coords.latitude));
        localStorage.setItem("sw_longitude", String(pos.coords.longitude));
        localStorage.setItem("sw_location_name", "My Precise Location");
      },
      () => setGeoState("denied")
    );
  };

  const requestNotif = () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    Notification.requestPermission().then((permission) => {
      setNotifState(permission as any);
      localStorage.setItem("sw_perm_notifications", permission);
    });
  };

  const requestCamera = async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraState("granted");
      stream.getTracks().forEach(t => t.stop());
    } catch {
      setCameraState("denied");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full animate-scale-in text-slate-800 dark:text-white space-y-4 shadow-2xl">
        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-6 h-6 animate-pulse" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-black tracking-tight">Essential App Permissions 🛡️</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Sbjiwala requires location, alerts, and camera/file permissions to provide a seamless 10-minute shopping and support experience.
          </p>
        </div>

        <div className="space-y-3">
          {/* Geolocation */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-start gap-2.5 min-w-0">
              <MapPin className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Location Services</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">For routing & delivery rules</p>
              </div>
            </div>
            {geoState === "granted" ? (
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-black">ACTIVE</span>
            ) : (
              <button onClick={requestGeo} className="text-[10px] bg-emerald-600 text-white font-extrabold px-3 py-1.5 rounded-lg hover:bg-emerald-500 transition-all">ENABLE</button>
            )}
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-start gap-2.5 min-w-0">
              <Bell className="w-4.5 h-4.5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Order Alerts & Sound</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Live maps & delivery status</p>
              </div>
            </div>
            {notifState === "granted" ? (
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-black">ACTIVE</span>
            ) : (
              <button onClick={requestNotif} className="text-[10px] bg-emerald-600 text-white font-extrabold px-3 py-1.5 rounded-lg hover:bg-emerald-500 transition-all">ALLOW</button>
            )}
          </div>

          {/* Camera/File Upload */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-start gap-2.5 min-w-0">
              <Camera className="w-4.5 h-4.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Camera & Storage</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">For photos & profile pictures</p>
              </div>
            </div>
            {cameraState === "granted" ? (
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-black">ACTIVE</span>
            ) : (
              <button onClick={requestCamera} className="text-[10px] bg-emerald-600 text-white font-extrabold px-3 py-1.5 rounded-lg hover:bg-emerald-500 transition-all">ALLOW</button>
            )}
          </div>

          {/* Network & Background Connection status */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-start gap-2.5 min-w-0">
              <Smartphone className="w-4.5 h-4.5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Background Connection</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Auto-connect WebSockets & internet</p>
              </div>
            </div>
            <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full font-black">ENABLED</span>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-xs font-black text-slate-500 hover:text-slate-650 dark:hover:text-slate-400 text-center uppercase tracking-wider"
          >
            Skip for now
          </button>
          <button
            onClick={() => {
              onPermissionGranted();
              onClose();
            }}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 rounded-xl text-xs transition-all shadow-md shadow-emerald-900/20"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== APP SHELL ====================
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);

  // Network State
  const [isOnline, setIsOnline] = useState(true);
  const [serverAvailable, setServerAvailable] = useState(true);

  const pathname = usePathname();
  const router = useRouter();

  // Guard check for unauthenticated users
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isProtected = isProtectedRoute(pathname);
    const hasToken = !!localStorage.getItem("sw_access_token");
    if (isProtected && !hasToken) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router]);

  // Network offline listener + server reachability check
  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial onboarding splash check
    if (localStorage.getItem("sw_splash_onboarding") === "completed") {
      setShowSplash(false);
    }

    // Check notifications prompt request event
    const handleNotifPrompt = () => {
      if ("Notification" in window && Notification.permission === "default") {
        setShowNotifModal(true);
      }
    };
    window.addEventListener("trigger-notification-benefit", handleNotifPrompt);

    // Poll server health status every 30 seconds
    const checkServerHealth = async () => {
      try {
        const res = await api.get("/health");
        if (res.success || res.data) {
          setServerAvailable(true);
        }
      } catch (err) {
        // Fallback check catalog
        try {
          await api.get("/catalog/categories");
          setServerAvailable(true);
        } catch {
          setServerAvailable(false);
        }
      }
    };

    checkServerHealth();
    const interval = setInterval(checkServerHealth, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("trigger-notification-benefit", handleNotifPrompt);
      clearInterval(interval);
    };
  }, []);

  // Check permissions on app start if onboarding is completed
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    if (localStorage.getItem("sw_splash_onboarding") === "completed") {
      if (navigator.permissions) {
        navigator.permissions.query({ name: "geolocation" }).then((result) => {
          if (result.state !== "granted") {
            setShowPermissionsModal(true);
          }
        }).catch(() => {});
      }
    }
  }, [showSplash]);

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Request alert permission inside browser dialogue
  const handleRequestNotif = () => {
    setShowNotifModal(false);
    if ("Notification" in window) {
      Notification.requestPermission().then((permission) => {
        localStorage.setItem("sw_perm_notifications", permission);
      });
    }
  };

  // Public routes that don't need app shell (full screen)
  const isAuthRoute = ["/login", "/register"].some(r => pathname?.startsWith(r));
  if (isAuthRoute) return <>{children}</>;

  if (showSplash) {
    return <SplashPermissionsScreen onComplete={() => setShowSplash(false)} />;
  }

  // Server Offline / Maintenance Overlay
  if (!serverAvailable) {
    return (
      <div className="fixed inset-0 z-50 bg-[#090d10] text-white flex flex-col items-center justify-center p-6 text-center space-y-6 font-sans">
        <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/30 rounded-3xl p-4 flex items-center justify-center text-amber-500 animate-pulse">
          <RefreshCw className="w-10 h-10 animate-spin" style={{ animationDuration: '3s' }} />
        </div>
        <div className="space-y-2 max-w-sm">
          <h2 className="text-xl font-black text-white">Sbjiwala Restocking</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Our farm servers are undergoing cleaning, sorting, and organic updates. We will be fresh and online in a few minutes.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-6 py-3 rounded-xl text-xs transition-all shadow-md"
        >
          Check Connectivity
        </button>
      </div>
    );
  }

  // Network Offline Overlay
  if (!isOnline) {
    return (
      <div className="fixed inset-0 z-50 bg-[#090d10] text-white flex flex-col items-center justify-center p-6 text-center space-y-6 font-sans">
        <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/30 rounded-3xl p-4 flex items-center justify-center text-rose-500 animate-bounce">
          <WifiOff className="w-10 h-10" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h2 className="text-xl font-black text-white">No Internet Connection</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Please check your device parameters, mobile data, or Wi-Fi connectivity and try again.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-6 py-3 rounded-xl text-xs transition-all shadow-md"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex max-w-full overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col md:ml-64 min-w-0 max-w-full overflow-x-hidden pt-[env(safe-area-inset-top)]">
        <Header onMenuOpen={() => setSidebarOpen(true)} />

        {/* Page content */}
        <main className="flex-1 pb-20 md:pb-0 page-enter max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>

      <BottomNav />

      {/* Startup Permissions Modal */}
      {showPermissionsModal && (
        <UnifiedPermissionsModal
          onClose={() => setShowPermissionsModal(false)}
          onPermissionGranted={() => {
            // refresh page state/items
            window.location.reload();
          }}
        />
      )}

      {/* Contextual Notification Modal Overlay */}
      {showNotifModal && (
        <NotificationBenefitModal
          onClose={() => setShowNotifModal(false)}
          onGrant={handleRequestNotif}
        />
      )}
    </div>
  );
}
