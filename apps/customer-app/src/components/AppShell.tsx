"use client";

import React, { useState, useEffect, useRef, createContext, useContext, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Home, Search, ShoppingCart, Heart, User, Bell, Wallet,
  MapPin, Tag, Gift, HelpCircle, LogOut, LogIn, ChevronRight,
  Moon, Sun, Zap, Menu, X, Package, Settings, Star,
  MessageSquare, FileText, Shield, RotateCcw, ShieldCheck, Check,
  Leaf,
  RefreshCw,
  WifiOff,
  Camera,
  Smartphone,
  Building2,
  Truck
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";

// Default is false, meaning no AppShell is currently active
const AppShellContext = createContext(false);
// ==================== ROUTE PROTECTION helper ====================
export const resolveLink = (href: string) => {
  const isUnified = process.env.NEXT_PUBLIC_APP_MODE === "unified";
  
  let formattedHref = href;
  if (href.startsWith("/orders/detail") || href.startsWith("/orders/track")) {
    // Already query-param formatted, do nothing
  } else if (href.startsWith("/orders/")) {
    const segments = href.split("/");
    const id = segments[2];
    const isTrack = segments[3] === "track";
    const searchPart = id.split("?")[1] ? `&${id.split("?")[1]}` : "";
    const cleanId = id.split("?")[0];
    if (isTrack) {
      formattedHref = `/orders/track?id=${cleanId}${searchPart}`;
    } else {
      formattedHref = `/orders/detail?id=${cleanId}${searchPart}`;
    }
  } else if (href.startsWith("/products/detail")) {
    // Already formatted
  } else if (href.startsWith("/products/")) {
    const segments = href.split("/");
    const id = segments[2];
    const searchPart = id.split("?")[1] ? `&${id.split("?")[1]}` : "";
    const cleanId = id.split("?")[0];
    formattedHref = `/products/detail?id=${cleanId}${searchPart}`;
  } else if (href.startsWith("/support/tickets/detail")) {
    // Already formatted
  } else if (href.startsWith("/support/tickets/")) {
    const segments = href.split("/");
    const id = segments[3];
    if (id && id !== "detail") {
      const searchPart = id.split("?")[1] ? `&${id.split("?")[1]}` : "";
      const cleanId = id.split("?")[0];
      formattedHref = `/support/tickets/detail?id=${cleanId}${searchPart}`;
    }
  }

  if (isUnified) {
    if (
      formattedHref.startsWith("/vendor") ||
      formattedHref.startsWith("/delivery") ||
      formattedHref.startsWith("/admin") ||
      formattedHref.startsWith("/kyc") ||
      formattedHref.startsWith("/users")
    ) {
      return formattedHref;
    }
    if (formattedHref === "/") return "/app";
    return `/app${formattedHref}`;
  } else {
    if (
      formattedHref.startsWith("/vendor") ||
      formattedHref.startsWith("/delivery") ||
      formattedHref.startsWith("/admin") ||
      formattedHref.startsWith("/kyc")
    ) {
      return `https://sbjiwala.qzz.io${formattedHref}`;
    }
    return formattedHref;
  }
};

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
    "/checkout",
    "/app/profile",
    "/app/orders",
    "/app/wishlist",
    "/app/wallet",
    "/app/referrals",
    "/app/addresses",
    "/app/reviews",
    "/app/settings",
    "/app/checkout"
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
function Header({ onMenuOpen, onOpenLocation, onOpenSearch }: { onMenuOpen: () => void; onOpenLocation: () => void; onOpenSearch: () => void }) {
  const { data: publicSettings } = useQuery<any>({
    queryKey: ["publicSettings"],
    queryFn: async () => {
      const res = await api.get("/installation/public-settings");
      return res.data || {};
    }
  });
  const queryClient = useQueryClient();

  const { data: cartData } = useQuery<any>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await api.get("/cart");
      return res.data || { items: [], item_count: 0 };
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
    staleTime: 0,
  });

  const cartCount = cartData?.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0;

  return (
    <header className="sticky top-0 z-40 glass-ios-header shadow-sm transition-all duration-300">
      <div className="flex items-center justify-between h-16 px-4 md:px-6 max-w-7xl mx-auto">
        {/* Left: menu (mobile) + logo */}
        <div className="flex items-center gap-2 min-w-0 flex-1 md:flex-initial">
          <button
            onClick={onMenuOpen}
            className="md:hidden p-2 rounded-xl hover:bg-slate-105 dark:hover:bg-slate-800 text-slate-605 dark:text-slate-300 transition-colors flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href={resolveLink("/")} className="flex items-center gap-2 flex-shrink-0">
            <img src={publicSettings?.app_logo_url || "/logo_horizontal.png"} alt={publicSettings?.app_name || "Sbjiwala"} className="h-8 w-auto object-contain" />
            <span className="hidden sm:inline-flex bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
              {publicSettings?.app_name || "Sbjiwala"} Express
            </span>
          </Link>
        </div>

        {/* Center: Empty spacer (Search removed from header) */}
        <div className="hidden md:flex flex-1" />

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <ThemeCycleButton />
          <Link href={resolveLink("/notifications")} className="relative p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </Link>
          <Link
            href={resolveLink("/cart")}
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
function Sidebar({ onClose, isOpen, onOpenLocation, locationName }: { onClose: () => void; isOpen?: boolean; onOpenLocation: () => void; locationName: string }) {
  const { data: publicSettings } = useQuery<any>({
    queryKey: ["publicSettings"],
    queryFn: async () => {
      const res = await api.get("/installation/public-settings");
      return res.data || {};
    }
  });
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("sw_access_token"));
  }, []);

  const isActive = (href: string, exact = false) => {
    const resolved = resolveLink(href);
    return exact ? pathname === resolved : pathname === resolved || pathname.startsWith(resolved + "/");
  };

  const handleLogout = () => {
    localStorage.removeItem("sw_access_token");
    localStorage.removeItem("sw_refresh_token");
    localStorage.removeItem("sw_location_manually_set");
    setIsLoggedIn(false);
    router.replace(resolveLink("/login"));
  };

  const content = (
    <div className="flex flex-col h-full bg-transparent">
      {/* Logo */}
      <div className="flex items-center justify-between p-6 border-b border-slate-200/40 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <img src={publicSettings?.app_logo_url || "/logo_horizontal.png"} alt={publicSettings?.app_name || "Sbjiwala"} className="h-7 w-auto object-contain dark:brightness-0 dark:invert" />
          <span className="text-slate-900 dark:text-white font-black text-sm">{publicSettings?.app_name || "Sbjiwala"}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Location Bar */}
      <div
        onClick={() => {
          onClose();
          onOpenLocation();
        }}
        className="mx-4 mt-4 flex items-center gap-2 bg-slate-200/40 dark:bg-white/5 rounded-xl px-3.5 py-2.5 border border-slate-200/50 dark:border-slate-800/80 cursor-pointer hover:bg-slate-200/70 dark:hover:bg-white/10 transition-all shadow-sm"
      >
        <MapPin className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0 animate-pulse" />
        <div className="min-w-0">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-none">Delivering to</p>
          <p className="text-xs font-black text-slate-805 dark:text-white truncate mt-1">{locationName.split(",")[0] || locationName}</p>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-505 ml-auto flex-shrink-0" />
      </div>

      {/* Nav Sections */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-4 space-y-6">
        {sidebarSections.map((section) => (
          <div key={section.title}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-450 dark:text-slate-650 px-3.5 mb-2">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href, item.href === "/");
                const Icon = item.icon;
                const resolvedHref = resolveLink(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={resolvedHref}
                      onClick={(e) => {
                        if (isProtectedRoute(resolvedHref) && !localStorage.getItem("sw_access_token")) {
                          e.preventDefault();
                          router.push(`${resolveLink("/login")}?redirect=${encodeURIComponent(resolvedHref)}`);
                        }
                        if (onClose) onClose();
                      }}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${active
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/15 dark:shadow-emerald-950/30"
                        : "text-slate-600 hover:text-slate-905 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5"
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

      {/* Footer: logout / signin */}
      <div className="p-4 border-t border-slate-200/40 dark:border-slate-800/80">
        {isLoggedIn ? (
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-650 dark:hover:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
          >
            <LogOut className="w-4.5 h-4.5" />
            <span>Sign Out</span>
          </button>
        ) : (
          <Link
            href={resolveLink("/login")}
            onClick={onClose}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-emerald-650 dark:hover:text-emerald-450 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer"
          >
            <LogIn className="w-4.5 h-4.5" />
            <span>Sign In / Login</span>
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 bg-slate-50/75 dark:bg-slate-950/75 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-800/80 fixed left-0 top-0 h-full z-30 shadow-sm">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-800/80 animate-slide-right overflow-hidden shadow-inner">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}

// ==================== BOTTOM NAV (Mobile) ====================
function BottomNav({ onOpenSearch }: { onOpenSearch: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const { data: cartData } = useQuery<any>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await api.get("/cart");
      return res.data || { items: [] };
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
    staleTime: 0,
  });

  const cartCount = cartData?.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-ios shadow-lg bottom-nav-safe rounded-t-[20px]">
      <div className="flex items-center justify-around px-1 h-16">
        {mainNavItems.map((item) => {
          const resolvedHref = resolveLink(item.href);
          const isActive = item.exact ? pathname === resolvedHref : pathname.startsWith(resolvedHref);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={resolvedHref}
              onClick={(e) => {
                if (item.label === "Search") {
                  e.preventDefault();
                  onOpenSearch();
                  return;
                }
                if (isProtectedRoute(resolvedHref) && !localStorage.getItem("sw_access_token")) {
                  e.preventDefault();
                  router.push(`${resolveLink("/login")}?redirect=${encodeURIComponent(resolvedHref)}`);
                }
              }}
              className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all btn-spring active:scale-95 ${isActive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-400 dark:text-slate-500"
                }`}
              aria-label={item.label}
            >
              <div className={isActive 
                ? "w-11 h-11 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-[0_8px_20px_rgba(16,185,129,0.3)] -translate-y-5 border-4 border-slate-50 dark:border-[#090d10] transition-all duration-300 scale-110 relative overflow-hidden active-nav-shine"
                : "relative p-1.5 rounded-xl transition-all"
              }>
                <Icon className="w-5 h-5" />
                {item.cartBadge && cartCount > 0 && (
                  <span className={`absolute ${isActive ? "-top-0.5 -right-0.5" : "-top-1 -right-1"} min-w-[16px] h-4 bg-emerald-600 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1`}>
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </div>
              {!isActive && (
                <span className="text-[10px] font-bold opacity-70">
                  {item.label}
                </span>
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
      async (pos) => {
        setLocPermission("granted");
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        localStorage.setItem("sw_latitude", String(lat));
        localStorage.setItem("sw_longitude", String(lon));

        let addressName = `Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        try {
          const res = await api.get("/maps/reverse-geocode", {
            params: { lat, lon }
          });
          if (res.success && res.data?.formatted_address) {
            addressName = res.data.formatted_address;
          }
        } catch (err) {
          console.error("Splash screen reverse geocoding failed:", err);
        }

        localStorage.setItem("sw_location_name", addressName);
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
              onClick={requestLocation}
              className="flex-1 text-center text-xs font-black text-slate-550 hover:text-slate-400 tracking-wider uppercase py-3.5"
            >
              Skip
            </button>
            <button
              onClick={() => {
                const isNative = typeof window !== "undefined" && !!(window as any).Capacitor;
                if (slide === 3 && isNative) {
                  setSlide(4);
                  requestLocation();
                } else {
                  setSlide((s) => s + 1);
                }
              }}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-3.5 rounded-2xl text-xs transition-all text-center border border-slate-700"
            >
              Next
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => {
                setShowManualPicker(true);
              }}
              className="w-full text-center text-xs font-black text-emerald-500 hover:text-emerald-450 tracking-wider uppercase py-2"
            >
              Choose Neighborhood
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

// ==================== INLINE SEARCH MODAL ====================
interface InlineSearchModalProps {
  onClose: () => void;
}

function InlineSearchModal({ onClose }: InlineSearchModalProps) {
  const [query, setQuery] = useState(() => {
    if (typeof window !== "undefined" && (window as any).__initial_search_query) {
      const q = (window as any).__initial_search_query;
      (window as any).__initial_search_query = "";
      return q;
    }
    return "";
  });

  useEffect(() => {
    const handleOpen = (e: any) => {
      if (e.detail?.query) setQuery(e.detail.query);
    };
    window.addEventListener("sw_open_search_modal", handleOpen as any);
    return () => window.removeEventListener("sw_open_search_modal", handleOpen as any);
  }, []);

  const router = useRouter();

  const { data: results = [], isLoading } = useQuery<any[]>({
    queryKey: ["inlineSearch", query],
    queryFn: async () => {
      if (query.trim().length < 2) return [];
      const res = await api.get("/catalog/products", { params: { limit: 50, search: query.trim() } });
      return res.data || [];
    },
    enabled: query.trim().length >= 2,
  });

  const filtered = useMemo(() => {
    if (!results.length) return [];
    const q = query.toLowerCase();

    let list = results.filter((p: any) =>
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );

    if (typeof window !== "undefined") {
      const nearestVendor = localStorage.getItem("sw_nearest_vendor_id");
      if (nearestVendor && nearestVendor !== "null") {
        list = list.filter((p: any) => {
          const vId = p.attributes?.vendor_id || p.vendor_id || p.vendor?.id;
          return String(vId) === String(nearestVendor);
        });
      }
    }

    return list.slice(0, 8);
  }, [results, query]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-xl w-full shadow-2xl animate-scale-in flex flex-col max-h-[70vh]">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-5 h-5 text-emerald-500 animate-pulse flex-shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Type to search fresh vegetables & fruits..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm font-semibold focus:outline-none text-slate-850 dark:text-white"
          />
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-605 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-3 scrollbar-hide">
          {query.trim().length < 2 ? (
            <p className="text-xs text-slate-400 text-center py-8">Type at least 2 characters to search...</p>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-slate-450 text-center py-8">No items match your search.</p>
          ) : (
            <div className="grid grid-cols-1 gap-1.5">
              {filtered.map((prod: any) => {
                const price = Math.round((prod.attributes?.price ?? prod.price ?? 30) * 1.045 * 100) / 100;
                return (
                  <div key={prod.id} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-900/40 rounded-2xl transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800/50">
                    <Link href={resolveLink(`/products/${prod.id}`)} onClick={onClose} className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-3xl p-1 bg-slate-55 dark:bg-slate-900 rounded-xl select-none">{prod.attributes?.image_emoji || "🥬"}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">{prod.name}</p>
                        <p className="text-[10px] text-slate-550 dark:text-slate-450">{prod.unit || "1 kg"}</p>
                      </div>
                    </Link>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-slate-900 dark:text-white">₹{price.toFixed(2)}</span>
                      <button
                        onClick={() => {
                          router.push(resolveLink(`/products/${prod.id}`));
                          onClose();
                        }}
                        className="bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-950/30 dark:hover:bg-emerald-600 dark:text-emerald-400 dark:hover:text-white text-[10px] font-black px-3 py-1.5 rounded-xl border border-emerald-250 dark:border-emerald-900/40 transition-all uppercase tracking-wider"
                      >
                        View
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
        } catch { }

        try {
          const notif = await navigator.permissions.query({ name: "notifications" as any });
          setNotifState(notif.state as any);
          notif.onchange = () => setNotifState(notif.state as any);
        } catch { }

        try {
          const cam = await navigator.permissions.query({ name: "camera" as any });
          setCameraState(cam.state as any);
          cam.onchange = () => setCameraState(cam.state as any);
        } catch { }
      } else {
        setNotifState(Notification.permission as any);
      }
    };

    checkStates();
  }, []);

  const requestGeo = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGeoState("granted");
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        localStorage.setItem("sw_latitude", String(lat));
        localStorage.setItem("sw_longitude", String(lon));

        let addressName = `Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        try {
          const res = await api.get("/maps/reverse-geocode", {
            params: { lat, lon }
          });
          if (res.success && res.data?.formatted_address) {
            addressName = res.data.formatted_address;
          }
        } catch (err) {
          console.error("Unified permissions reverse geocoding failed:", err);
        }

        localStorage.setItem("sw_location_name", addressName);
        window.dispatchEvent(new Event("sw_location_updated"));
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

// ==================== LOCATION SELECTION MODAL ====================
interface LocationSelectionModalProps {
  onClose: () => void;
  onSelect: (lat: number, lon: number, name: string) => void;
}

function LocationSelectionModal({ onClose, onSelect }: LocationSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingGPS, setLoadingGPS] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  // Fetch saved addresses if logged in
  useEffect(() => {
    const fetchSavedAddresses = async () => {
      const token = localStorage.getItem("sw_access_token");
      if (!token) return;
      setLoadingAddresses(true);
      try {
        const res = await api.get("/users/me/addresses");
        if (res.success && Array.isArray(res.data)) {
          setSavedAddresses(res.data);
        }
      } catch (err) {
        console.error("Error fetching saved addresses:", err);
      } finally {
        setLoadingAddresses(false);
      }
    };
    fetchSavedAddresses();
  }, []);

  // Search geocoding
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchQuery.trim().length < 3) return;
    setLoadingSearch(true);
    try {
      const res = await api.get("/maps/geocode", { params: { q: searchQuery } });
      if (res.success && res.data) {
        const results = Array.isArray(res.data) ? res.data : [res.data];
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error("Geocoding search failed:", err);
      setSearchResults([]);
    } finally {
      setLoadingSearch(false);
    }
  };

  // Get current location via GPS
  const handleUseCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      setGpsError("Geolocation is not supported by your browser");
      return;
    }
    setLoadingGPS(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await api.get("/maps/reverse-geocode", {
            params: { lat: latitude, lon: longitude }
          });
          const addressName = res.success && res.data?.formatted_address
            ? res.data.formatted_address
            : `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

          onSelect(latitude, longitude, addressName);
        } catch (err) {
          console.error("Reverse geocoding failed, using coordinates as name:", err);
          onSelect(latitude, longitude, `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } finally {
          setLoadingGPS(false);
        }
      },
      (error) => {
        console.error("GPS error:", error);
        setGpsError("Permission denied or GPS signal lost");
        setLoadingGPS(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className="relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full animate-scale-in text-slate-800 dark:text-white space-y-4 shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-500 animate-pulse" />
            Select Delivery Location
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* GPS Locate Button */}
        <button
          onClick={handleUseCurrentLocation}
          disabled={loadingGPS}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-all font-black text-xs uppercase tracking-wider disabled:opacity-50"
        >
          {loadingGPS ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Locating via GPS...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 animate-bounce" />
              Use Current Location (GPS)
            </>
          )}
        </button>

        {gpsError && (
          <p className="text-[10px] text-rose-500 font-bold text-center -mt-2">{gpsError}</p>
        )}

        {/* Search Input */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search for area, street name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-slate-800 dark:text-slate-200"
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
          <button
            type="submit"
            disabled={loadingSearch || searchQuery.trim().length < 3}
            className="px-4 bg-emerald-600 hover:bg-emerald-505 text-white font-extrabold text-xs rounded-xl disabled:opacity-50 transition-all uppercase tracking-wider"
          >
            {loadingSearch ? "..." : "Search"}
          </button>
        </form>

        {/* Results / saved list scroll container */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
          {/* Geocoding Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Search Results</h4>
              <div className="space-y-1.5">
                {searchResults.map((res: any, idx: number) => {
                  const name = res.display_name || res.formatted_address || res.name || searchQuery;
                  const lat = parseFloat(res.lat);
                  const lon = parseFloat(res.lon);
                  return (
                    <button
                      key={idx}
                      onClick={() => onSelect(lat, lon, name)}
                      className="w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:border-emerald-200 dark:hover:border-emerald-900/50 transition-all flex items-start gap-2.5"
                    >
                      <MapPin className="w-4 h-4 text-emerald-505 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight">{name}</p>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">Lat: {lat.toFixed(4)}, Lon: {lon.toFixed(4)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Saved Addresses list */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Saved Addresses</h4>
            {loadingAddresses ? (
              <div className="text-center py-4">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-slate-400" />
              </div>
            ) : savedAddresses.length > 0 ? (
              <div className="space-y-1.5">
                {savedAddresses.map((addr: any) => {
                  const displayName = addr.name || addr.address_type || "Address";
                  const fullAddress = `${addr.street_address}, ${addr.city}, ${addr.state}`;
                  const lat = parseFloat(addr.latitude);
                  const lon = parseFloat(addr.longitude);
                  return (
                    <button
                      key={addr.id}
                      onClick={() => onSelect(lat, lon, fullAddress)}
                      className="w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:border-emerald-200 dark:hover:border-emerald-900/50 transition-all flex items-start gap-2.5"
                    >
                      <Home className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-900 dark:text-slate-100">{displayName}</span>
                          {addr.is_default && (
                            <span className="text-[8px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-extrabold px-1.5 py-0.5 rounded">DEFAULT</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate leading-snug">{fullAddress}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center py-4">No saved addresses found. Login to sync addresses.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== APP SHELL ====================
export default function AppShell({ children }: { children: React.ReactNode }) {
  // Check if we are already inside an AppShell
  const isInsideAppShell = useContext(AppShellContext);

  // If yes, ignore the shell and just render the children
  if (isInsideAppShell) {
    return <>{children}</>;
  }

  const isNative = typeof window !== "undefined" && !!(window as any).Capacitor;
  const pathname = usePathname();
  const router = useRouter();

  const { data: publicSettings } = useQuery<any>({
    queryKey: ["publicSettings"],
    queryFn: async () => {
      const res = await api.get("/installation/public-settings");
      return res.data || {};
    }
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const brandName = publicSettings?.app_name || "Sbjiwala";
    const title = publicSettings?.seo_title || `${brandName} - Kisan ke Ghar Se Apke Ghar tak`;
    const desc = publicSettings?.seo_description || "direct-to-home hyper-local quick commerce platform delivering fresh farm vegetables and fruits straight from local farms to your home in 10 minutes.";
    const keywords = publicSettings?.seo_keywords || "vegetables, fruits, organic, quick commerce, delivery";

    document.title = title;

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', desc);

    let metaKey = document.querySelector('meta[name="keywords"]');
    if (!metaKey) {
      metaKey = document.createElement('meta');
      metaKey.setAttribute('name', 'keywords');
      document.head.appendChild(metaKey);
    }
    metaKey.setAttribute('content', keywords);

  }, [publicSettings, pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const primaryColor = publicSettings?.app_primary_color || "#059669";

    let styleTag = document.getElementById("dynamic-brand-styles");
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "dynamic-brand-styles";
      document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = `
      :root {
        --primary-brand-color: ${primaryColor};
        --emerald-600: ${primaryColor};
        --emerald-500: ${primaryColor};
        --emerald-705: ${primaryColor};
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

  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOpenSidebar = () => {
      setSidebarOpen(true);
    };
    window.addEventListener("sw_open_sidebar", handleOpenSidebar);
    return () => {
      window.removeEventListener("sw_open_sidebar", handleOpenSidebar);
    };
  }, []);

  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === "undefined") return true;
    if (isNative) return false;
    return localStorage.getItem("sw_splash_onboarding") !== "completed";
  });
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [inlineSearchOpen, setInlineSearchOpen] = useState(false);

  // Load saved default address and set as active location on login
  const token = typeof window !== "undefined" ? localStorage.getItem("sw_access_token") : null;
  const { data: appAddresses } = useQuery<any[]>({
    queryKey: ["appAddresses"],
    queryFn: async () => {
      const r = await api.get("/users/me/addresses");
      return r.data || [];
    },
    enabled: typeof window !== "undefined" && !!token,
  });

  // Removed default address override to ensure it takes real-time user end coordinates
  useEffect(() => {
    // Geolocation is fetched real-time from user end
  }, []);

  // Initialize push notifications on authentication
  useEffect(() => {
    if (token) {
      import("@sbjiwala/shared").then(({ initPushNotifications }) => {
        initPushNotifications().catch(err => console.warn("Failed to init push notifications:", err));
      });
    }
  }, [token]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOpen = () => setShowLocationModal(true);
    const handleSearchOpen = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.query) {
        (window as any).__initial_search_query = customEvent.detail.query;
      }
      setInlineSearchOpen(true);
    };
    window.addEventListener("sw_open_location_modal", handleOpen);
    window.addEventListener("sw_open_search_modal", handleSearchOpen);
    return () => {
      window.removeEventListener("sw_open_location_modal", handleOpen);
      window.removeEventListener("sw_open_search_modal", handleSearchOpen);
    };
  }, []);

  // Network State
  const [isOnline, setIsOnline] = useState(true);
  const [serverAvailable, setServerAvailable] = useState(true);
  const [locationName, setLocationName] = useState("Mumbai, Maharashtra");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateLoc = () => {
      let name = localStorage.getItem("sw_location_name") || "Select Location";
      if (!name || name === "undefined" || name === "null" || name.startsWith("undefined") || name.includes("undefined, undefined")) {
        name = "Select Location";
      }
      setLocationName(name);
    };
    updateLoc();
    window.addEventListener("sw_location_updated", updateLoc);
    return () => window.removeEventListener("sw_location_updated", updateLoc);
  }, []);

  // pathname and router moved to top of component

  // Helper to get stored user type from token
  const getStoredUserType = () => {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem("sw_access_token");
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload).user_type;
    } catch (e) {
      return null;
    }
  };

  // Guard check for unauthenticated users & role restrictions
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isProtected = isProtectedRoute(pathname);
    const hasToken = !!localStorage.getItem("sw_access_token");
    const isUnified = process.env.NEXT_PUBLIC_APP_MODE === "unified";

    // Auto-prepend /app for customer routes in unified mode
    if (isUnified) {
      const customerPaths = [
        "/cart", "/checkout", "/orders", "/wishlist", "/profile", "/search",
        "/categories", "/offers", "/coupons", "/notifications", "/support",
        "/settings", "/about", "/faq", "/how-it-works", "/privacy", "/terms", "/refund-policy"
      ];
      const matchingPath = customerPaths.find(p => pathname === p || pathname.startsWith(p + "/"));
      if (matchingPath) {
        router.replace(`/app${pathname}`);
        return;
      }
    }

    const isVendorPath = pathname.startsWith("/vendor") || pathname.startsWith("/kyc");
    const isDeliveryPath = pathname.startsWith("/delivery");
    const isAdminPath = pathname.startsWith("/admin") || pathname.startsWith("/users");
    const isCustomerPath = pathname === "/app" || pathname.startsWith("/app/");

    const isVendorAuthPath = pathname === "/vendor/login" || pathname === "/vendor/register";
    const isDeliveryAuthPath = pathname === "/delivery/login" || pathname === "/delivery/register";
    const isAdminAuthPath = pathname === "/admin/login" || pathname === "/admin/setup";
    const isCustomerAuthPath = isUnified
      ? (pathname === "/app/login" || pathname === "/app/register")
      : (pathname === "/login" || pathname === "/register");

    // 1. Unauthenticated Route Guards
    if (!hasToken) {
      if (isVendorPath && !isVendorAuthPath) {
        router.replace(`/vendor/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }
      if (isDeliveryPath && !isDeliveryAuthPath) {
        router.replace(`/delivery/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }
      if (isAdminPath && !isAdminAuthPath) {
        router.replace(`/admin/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }
      if (isProtected) {
        const loginDest = isUnified ? "/app/login" : "/login";
        router.replace(`${loginDest}?redirect=${encodeURIComponent(pathname)}`);
        return;
      }
    } else {
      // 2. Authenticated Route Guards
      const role = getStoredUserType();

      // If already logged in, redirect away from auth routes
      if (isVendorAuthPath && (role === "vendor" || role === "vendor_manager")) {
        router.replace("/vendor");
        return;
      }
      if (isDeliveryAuthPath && role === "delivery_boy") {
        router.replace("/delivery");
        return;
      }
      if (isAdminAuthPath && (role === "admin" || role === "super_admin")) {
        router.replace("/admin");
        return;
      }
      if (isCustomerAuthPath && role === "customer") {
        router.replace(isUnified ? "/app" : "/");
        return;
      }

      // Role isolation paths
      if (isUnified) {
        if (isVendorPath && !isVendorAuthPath && role !== "vendor" && role !== "vendor_manager") {
          router.replace("/vendor/login?error=unauthorized");
          return;
        }
        if (isDeliveryPath && !isDeliveryAuthPath && role !== "delivery_boy") {
          router.replace("/delivery/login?error=unauthorized");
          return;
        }
        if (isAdminPath && !isAdminAuthPath && role !== "admin" && role !== "super_admin") {
          router.replace("/admin/login?error=unauthorized");
          return;
        }
        if (isCustomerPath && isProtected && role !== "customer") {
          if (role === "vendor" || role === "vendor_manager") router.replace("/vendor");
          else if (role === "delivery_boy") router.replace("/delivery");
          else if (role === "admin" || role === "super_admin") router.replace("/admin");
          return;
        }
      } else {
        // Standalone customer app - reject non-customer roles for protected pages only
        if (isProtected && role !== "customer") {
          router.replace(`/login?redirect=${encodeURIComponent(pathname)}&error=unauthorized_role`);
          return;
        }
        if (isVendorPath || isDeliveryPath || isAdminPath) {
          router.replace("/");
          return;
        }
      }
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
      const isNative = typeof window !== "undefined" && !!(window as any).Capacitor;
      if (isNative) return; // Native handles notifications prompt

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

  // On mount, if geolocation permission is granted, immediately call navigator.geolocation.getCurrentPosition
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return;
    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "granted") {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const lat = pos.coords.latitude;
              const lon = pos.coords.longitude;
              localStorage.setItem("sw_latitude", String(lat));
              localStorage.setItem("sw_longitude", String(lon));

              let addressName = `Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
              try {
                const res = await api.get("/maps/reverse-geocode", { params: { lat, lon } });
                if (res.success && res.data?.formatted_address) {
                  addressName = res.data.formatted_address;
                }
              } catch { }
              localStorage.setItem("sw_location_name", addressName);
              window.dispatchEvent(new Event("sw_location_updated"));
            },
            () => { }
          );
        }
      });
    }
  }, []);

  // Check permissions on app start if onboarding is completed
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isNative = !!(window as any).Capacitor;
    if (isNative) return;

    if (localStorage.getItem("sw_splash_onboarding") === "completed") {
      if (navigator.permissions) {
        navigator.permissions.query({ name: "geolocation" }).then((result) => {
          if (result.state !== "granted") {
            setShowPermissionsModal(true);
          }
        }).catch(() => { });
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

  // Click interceptor for unified routing and standalone portal containment
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isUnified = process.env.NEXT_PUBLIC_APP_MODE === "unified";

    const handleGlobalClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      if (isUnified) {
        if (
          href.startsWith("/") &&
          !href.startsWith("/app") &&
          !href.startsWith("/vendor") &&
          !href.startsWith("/delivery") &&
          !href.startsWith("/admin") &&
          !href.startsWith("/kyc") &&
          !href.startsWith("/users")
        ) {
          const isCustomerAppPath = pathname === "/app" || pathname.startsWith("/app/");
          if (isCustomerAppPath) {
            e.preventDefault();
            const targetPath = href === "/" ? "/app" : `/app${href}`;
            router.push(targetPath);
          }
        }
      } else {
        // Standalone app mode: prevent cross-portal or external URLs from hijacking active WebView
        const isExternal = href.startsWith("http://") || href.startsWith("https://");
        const isCrossPortal = href.startsWith("/vendor") || href.startsWith("/delivery") || href.startsWith("/admin") || href.startsWith("/kyc");
        if (isExternal || isCrossPortal) {
          e.preventDefault();
          let targetUrl = href;
          if (isCrossPortal) {
            targetUrl = `https://sbjiwala.qzz.io${href}`;
          }
          const isNative = !!(window as any).Capacitor;
          if (isNative) {
            window.open(targetUrl, "_system");
          } else {
            window.open(targetUrl, "_blank");
          }
        }
      }
    };

    document.addEventListener("click", handleGlobalClick, { capture: true });
    return () => document.removeEventListener("click", handleGlobalClick, { capture: true });
  }, [pathname, router]);

  // Public routes or sub-portals that don't need customer app shell (full screen / own layout)
  const isUnified = process.env.NEXT_PUBLIC_APP_MODE === "unified";
  const isCustomerAppPath = pathname === "/app" || pathname.startsWith("/app/");
  const isBypassRoute = isNative
    ? (pathname === "/login" || pathname === "/register" || pathname?.startsWith("/login/") || pathname?.startsWith("/register/"))
    : (isUnified
        ? (!isCustomerAppPath || pathname === "/app/login" || pathname === "/app/register")
        : ["/login", "/register", "/vendor", "/delivery", "/admin", "/kyc", "/users"].some(r => pathname?.startsWith(r)));
  if (isBypassRoute) return <>{children}</>;

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
    <AppShellContext.Provider value={true}>
      {/* 1. Force the app to match exact screen height and stop body scrolling */}
      <div className="h-screen md:h-[100dvh] w-full flex overflow-hidden">

        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onOpenLocation={() => setShowLocationModal(true)} locationName={locationName} />

        {/* Right Column Structure */}
        <div className="flex-1 flex flex-col h-full md:ml-64 min-w-0 max-w-full pt-[env(safe-area-inset-top)]">

          {/* Header sits naturally at the top, no absolute/fixed/sticky needed */}
          <Header onMenuOpen={() => setSidebarOpen(true)} onOpenLocation={() => setShowLocationModal(true)} onOpenSearch={() => setInlineSearchOpen(true)} />

          {/* Flipkart-Style Sub-Header Location Bar */}
          <div
            onClick={() => setShowLocationModal(true)}
            className="w-full bg-emerald-50/50 dark:bg-slate-900/60 backdrop-blur-md border-b border-slate-205 dark:border-slate-800/80 px-4 py-2 flex items-center gap-2 cursor-pointer hover:bg-emerald-55/60 dark:hover:bg-slate-800/80 transition-all flex-shrink-0"
          >
            <MapPin className="w-4 h-4 text-emerald-500 flex-shrink-0 animate-bounce" />
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-350 truncate">
              Deliver to: <span className="text-slate-900 dark:text-white font-extrabold">{locationName}</span>
            </span>
            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-extrabold ml-auto flex-shrink-0">Change ▼</span>
          </div>

          {/* 2. THE MAGIC IS HERE: Only this container is allowed to scroll */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-0 page-enter max-w-full">
            {children}
          </main>

        </div>

        <BottomNav onOpenSearch={() => setInlineSearchOpen(true)} />

        {/* Location Selection Modal */}
        {showLocationModal && (
          <LocationSelectionModal
            onClose={() => setShowLocationModal(false)}
            onSelect={(lat, lon, name) => {
              localStorage.setItem("sw_latitude", String(lat));
              localStorage.setItem("sw_longitude", String(lon));
              localStorage.setItem("sw_location_name", name);
              window.dispatchEvent(new Event("sw_location_updated"));
              setLocationName(name);
              setShowLocationModal(false);
            }}
          />
        )}

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

        {inlineSearchOpen && (
          <InlineSearchModal onClose={() => setInlineSearchOpen(false)} />
        )}
      </div>
    </AppShellContext.Provider>

  );
}
