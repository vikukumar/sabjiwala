"use client";

import React, { useState, useEffect } from "react";
import { Search, ArrowRight, Star, Plus, Minus, ChevronRight, Zap, Truck, Leaf, ShieldCheck, Clock, TrendingUp, Loader2, Bell, X, Navigation, Volume2, VolumeX } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useWebSocket, resolveImageUrl } from "@sbjiwala/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Badge, Skeleton, EmptyState, SectionHeader } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";
import { resolveLink } from "@/components/AppShell";
import ProductCard from "@/components/ProductCard";

const HERO_MESSAGES = [
  { en: "Farm Fresh Vegetables & Fruits", hi: "सीधे खेतों से ताज़ा सब्ज़ी और फल" },
  { en: "Delivered to Your Doorstep", hi: "आपके घर तक सुरक्षित डिलीवरी" },
  { en: "Express Faster Delivery", hi: "सुपरफास्ट डिलीवरी सीधे आपके घर" },
  { en: "Hygienically Washed & Packed", hi: "साफ-सफाई से धुली और पैक की गई" }
];

// ==================== HERO ====================
function Hero({ onSelectCategory }: { onSelectCategory: (cat: string) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setMsgIdx((prev) => (prev + 1) % HERO_MESSAGES.length);
        setLang((prev) => (prev === "en" ? "hi" : "en"));
        setFade(true);
      }, 300);
    }, 3800);
    return () => clearInterval(t);
  }, []);

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.get("/catalog/categories");
      return res.data || [];
    },
    staleTime: 5 * 60_000,
  });

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<any[]>({
    queryKey: ["homeSearch", query],
    queryFn: async () => {
      if (query.trim().length < 2) return [];
      const res = await api.get("/catalog/products", { params: { search: query.trim(), limit: 12 } });
      return res.data || [];
    },
    enabled: query.trim().length >= 2,
    staleTime: 10_000,
  });

  const matchingCategories = React.useMemo(() => {
    if (!query.trim()) return [];
    return categories.filter((c: any) =>
      c.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [categories, query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setIsFocused(true);
    }
  };

  const handleBlur = () => {
    setTimeout(() => setIsFocused(false), 250);
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-tr from-emerald-600 via-emerald-650 to-teal-700 py-16 md:py-24 px-4 shadow-xl">
      {/* Decorative grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-xl pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10 text-center space-y-7">
        <div className="inline-flex items-center gap-2 bg-white/10 dark:bg-black/20 rounded-full px-4.5 py-2 text-white text-xs font-black border border-white/10 backdrop-blur-md shadow-inner animate-fade-in">
          <Zap className="w-4 h-4 text-yellow-300 fill-current animate-bounce" />
          <span>⚡ EXPRESS FASTER DELIVERY — FRESHNESS GUARANTEE</span>
        </div>

        <h1 className={`text-4xl sm:text-6xl font-black text-white leading-none tracking-tight transition-all duration-300 min-h-[120px] sm:min-h-[140px] flex flex-col justify-center ${fade ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}>
          {lang === "en" ? (
            <>
              {HERO_MESSAGES[msgIdx].en.split(" & ")[0]}
              {HERO_MESSAGES[msgIdx].en.includes(" & ") ? (
                <>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-200 mt-1">
                    & {HERO_MESSAGES[msgIdx].en.split(" & ")[1]}
                  </span>
                </>
              ) : (
                ""
              )}
            </>
          ) : (
            <span>{HERO_MESSAGES[msgIdx].hi}</span>
          )}
        </h1>

        <p className="text-emerald-100 text-sm sm:text-base max-w-lg mx-auto font-medium leading-relaxed">
          Cleaned, sorted, and hygienically packed with care. Direct from local farms to your home.
        </p>

        {/* Search */}
        <div className="max-w-lg mx-auto relative">
          <form onSubmit={handleSearch} className="transform hover:scale-[1.01] transition-all duration-300 relative z-20">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-2xl border border-white/20 focus-within:ring-2 focus-within:ring-emerald-450/40">
              <Search className="w-5 h-5 text-slate-400 ml-2.5 flex-shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsFocused(true);
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={handleBlur}
                placeholder="Search tomatoes, spinach, fruits, mangoes..."
                className="flex-1 bg-transparent outline-none text-slate-805 dark:text-slate-100 placeholder-slate-400 text-xs sm:text-sm font-semibold"
              />
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-black text-xs sm:text-sm transition-all shadow-md cursor-pointer"
              >
                Search
              </button>
            </div>
          </form>

          {/* Autocomplete dropdown dropdown */}
          {isFocused && query.trim().length >= 2 && (
            <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 text-left z-50 max-h-[350px] overflow-y-auto space-y-4 animate-scale-in">
              {searchLoading ? (
                <div className="flex items-center justify-center py-6 gap-2 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <span className="text-xs font-semibold">Searching items...</span>
                </div>
              ) : (
                <>
                  {/* Matching Categories */}
                  {matchingCategories.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Categories</p>
                      <div className="flex flex-wrap gap-1.5">
                        {matchingCategories.map((cat: any) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              onSelectCategory(cat.name);
                              setQuery("");
                              setIsFocused(false);
                            }}
                            className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 rounded-lg text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching Products */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Products</p>
                    {searchResults.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 py-2">No matching products found.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {searchResults.map((prod: any) => {
                          const price = Math.round((prod.attributes?.price ?? prod.price ?? 30) * 1.045 * 100) / 100;
                          return (
                            <div key={prod.id} className="flex items-center justify-between py-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 rounded-xl px-1.5 transition-colors">
                              <Link
                                href={resolveLink(`/products/${prod.id}`)}
                                className="flex items-center gap-2.5 flex-1 min-w-0"
                                onClick={() => setIsFocused(false)}
                              >
                                {prod.primary_image_url || prod.attributes?.image_url ? (
                                  <img
                                    src={resolveImageUrl(prod.primary_image_url || prod.attributes?.image_url)}
                                    alt={prod.name}
                                    className="w-10 h-10 object-cover rounded-lg flex-shrink-0"
                                  />
                                ) : (
                                  <span className="text-2xl p-1 bg-slate-100 dark:bg-slate-900 rounded-lg select-none flex-shrink-0">
                                    {prod.attributes?.image_emoji || "🥬"}
                                  </span>
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-black text-slate-900 dark:text-white truncate">{prod.name}</p>
                                  <p className="text-[10px] text-slate-400 font-bold">{prod.unit || "1 kg"}</p>
                                </div>
                              </Link>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-slate-900 dark:text-white">₹{price.toFixed(2)}</span>
                                <Link
                                  href={resolveLink(`/products/${prod.id}`)}
                                  className="bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-950/20 dark:hover:bg-emerald-500 dark:text-emerald-400 dark:hover:text-white text-[9px] font-black px-2.5 py-1.5 rounded-lg border border-emerald-250 dark:border-emerald-900/40 transition-all uppercase tracking-wider"
                                  onClick={() => setIsFocused(false)}
                                >
                                  View
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Quick chips */}
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          {["Tomatoes", "Onions", "Spinach", "Mangoes", "Potatoes", "Carrots"].map((item) => (
            <button
              key={item}
              onClick={() => {
                setQuery(item);
                setIsFocused(true);
              }}
              className="bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-all backdrop-blur-sm shadow-sm hover:scale-105 cursor-pointer"
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ==================== TRUST BADGES ====================
function TrustBadges() {
  const badges = [
    { icon: Clock, label: "Faster Delivery", sub: "Express service" },
    { icon: Leaf, label: "Farm Fresh", sub: "Direct from farms" },
    { icon: ShieldCheck, label: "Hygienic Packing", sub: "Quality assured" },
    { icon: Truck, label: "Instant Delivery", sub: "On orders ₹199+" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-6xl mx-auto px-4 -mt-6 relative z-10">
      {badges.map((b) => {
        const Icon = b.icon;
        return (
          <div key={b.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3 shadow-md hover:shadow-lg transition-shadow">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl flex-shrink-0">
              <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">{b.label}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{b.sub}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const categoryDetails: Record<string, { title: string; subtitle: string; emoji: string; gradient: string; textDark: string; textLight: string }> = {
  All: {
    title: "All Items",
    subtitle: "Browse everything",
    emoji: "🛒",
    gradient: "from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20",
    textDark: "text-emerald-800 dark:text-emerald-300",
    textLight: "text-emerald-600 dark:text-emerald-400"
  },
  Vegetables: {
    title: "Fresh Vegetables",
    subtitle: "Direct from farms",
    emoji: "🥦",
    gradient: "from-green-50 to-emerald-100 dark:from-green-950/20 dark:to-emerald-950/20",
    textDark: "text-green-800 dark:text-green-300",
    textLight: "text-green-600 dark:text-green-400"
  },
  "Leafy Greens": {
    title: "Leafy Greens",
    subtitle: "Crisp & hygienic",
    emoji: "🥬",
    gradient: "from-lime-50 to-green-100 dark:from-lime-950/20 dark:to-green-950/20",
    textDark: "text-lime-800 dark:text-lime-300",
    textLight: "text-lime-600 dark:text-lime-450"
  },
  Exotics: {
    title: "Exotic Produce",
    subtitle: "Premium selections",
    emoji: "🥑",
    gradient: "from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20",
    textDark: "text-purple-800 dark:text-purple-300",
    textLight: "text-purple-600 dark:text-purple-400"
  },
  Herbs: {
    title: "Fresh Herbs",
    subtitle: "Aromatic & clean",
    emoji: "🌿",
    gradient: "from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20",
    textDark: "text-teal-800 dark:text-teal-300",
    textLight: "text-teal-600 dark:text-teal-400"
  }
};

// ==================== CATEGORIES STRIP ====================
function CategoriesStrip({ active, setActive }: { active: string; setActive: (val: string) => void }) {
  const { data: categories = [], isLoading } = useQuery<any[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.get("/catalog/categories");
      return res.data || [];
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 px-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-3xl animate-pulse bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4">
      <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight animate-fade-in">Shop by Category</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {[{ id: "all", name: "All" }, ...categories].map((cat: any) => {
          const details = (categoryDetails as any)[cat.name] || {
            title: cat.name,
            subtitle: "Fresh produce",
            emoji: "🥗",
            gradient: "from-slate-50 to-slate-100 dark:from-slate-900/40 dark:to-slate-800/40",
            textDark: "text-slate-800 dark:text-slate-300",
            textLight: "text-slate-600 dark:text-slate-400"
          };
          const isSelected = active === cat.name;

          return (
            <button
              key={cat.id}
              onClick={() => setActive(cat.name)}
              className={`relative overflow-hidden rounded-3xl p-5 text-left border transition-all duration-300 hover:scale-[1.03] hover:-translate-y-0.5 group active:scale-95 cursor-pointer ${
                isSelected
                  ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-md bg-white dark:bg-slate-900"
                  : "border-slate-200 dark:border-slate-800/80 shadow-sm bg-gradient-to-br " + details.gradient
              }`}
            >
              {/* Floating Large background emoji */}
              <span className="absolute -right-2 -bottom-2 text-6xl opacity-10 group-hover:scale-125 group-hover:rotate-12 transition-transform duration-300 pointer-events-none select-none">
                {details.emoji}
              </span>

              <div className="relative z-10 flex flex-col justify-between h-full min-h-[80px]">
                <span className="text-3xl mb-3 block transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
                  {details.emoji}
                </span>
                <div>
                  <h4 className={`font-black text-sm tracking-tight ${details.textDark}`}>
                    {details.title}
                  </h4>
                  <p className={`text-[11px] font-medium leading-none mt-0.5 ${details.textLight}`}>
                    {details.subtitle}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ==================== OFFERS BANNER ====================
function OffersBanner() {
  const { data: banners = [], isLoading } = useQuery<any[]>({
    queryKey: ["activeBanners"],
    queryFn: async () => {
      const res = await api.get("/catalog/banners", { params: { position: "home_top" } });
      return res.data || [];
    },
    staleTime: 5 * 60_000,
  });

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!banners.length) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % banners.length), 4000);
    return () => clearInterval(t);
  }, [banners]);

  if (isLoading) {
    return <div className="h-44 rounded-2xl mx-4 animate-pulse bg-slate-100 dark:bg-slate-800" />;
  }

  if (!banners.length) {
    return (
      <div className="mx-4 rounded-2xl p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 text-7xl opacity-20 -translate-y-2 translate-x-2 pointer-events-none">🥬</div>
        <div className="relative z-10">
          <Badge variant="outline" size="sm" className="border-white/30 text-white mb-2">Welcome Offer</Badge>
          <p className="text-2xl font-black tracking-tight">Farm-Fresh Delivery</p>
          <p className="text-sm text-white/80 mt-0.5">Crisp, premium vegetables directly from local farms with faster delivery.</p>
        </div>
      </div>
    );
  }

  const banner = banners[idx];
  const gradients = [
    "from-violet-650 to-purple-750",
    "from-emerald-600 to-teal-700",
    "from-orange-500 to-amber-600",
    "from-blue-600 to-indigo-700"
  ];
  const color = gradients[idx % gradients.length];

  return (
    <Link href={banner.action_url || "/offers"} className={`block mx-4 rounded-2xl p-5 bg-gradient-to-r ${color} text-white transition-all animate-fade-in relative overflow-hidden`}>
      {banner.image_url && (
        <img src={banner.image_url} alt={banner.title} className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay pointer-events-none" />
      )}
      <div className="relative z-10">
        <Badge variant="outline" size="sm" className="border-white/30 text-white mb-2">{banner.subtitle || "Exclusive Deal"}</Badge>
        <p className="text-2xl font-black tracking-tight">{banner.title}</p>
        {banner.subtitle && <p className="text-sm text-white/85 mt-0.5">{banner.subtitle}</p>}
        <div className="flex items-center gap-1 mt-3 text-xs font-bold">
          Shop Now <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
      {/* Dots */}
      <div className="absolute bottom-3 right-4 flex gap-1.5">
        {banners.map((_, i) => (
          <span key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? "bg-white w-4" : "bg-white/40"}`} />
        ))}
      </div>
    </Link>
  );
}

// ==================== HAVERSINE DISTANCE CALCULATOR ====================
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// ==================== LOCAL GUEST CART GETTER/SETTER ====================
const getLocalGuestCart = () => {
  if (typeof window === "undefined") return { items: [], subtotal: 0 };
  try {
    const raw = localStorage.getItem("sw_guest_cart");
    return raw ? JSON.parse(raw) : { items: [], subtotal: 0 };
  } catch {
    return { items: [], subtotal: 0 };
  }
};

const saveLocalGuestCart = (cart: any) => {
  if (typeof window === "undefined") return;
  localStorage.setItem("sw_guest_cart", JSON.stringify(cart));
  window.dispatchEvent(new Event("sw_cart_updated"));
};

// ==================== PRODUCTS GRID ====================
function ProductsGrid({ categoryFilter }: { categoryFilter?: string }) {
  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.get("/catalog/categories");
      return res.data || [];
    },
    staleTime: 5 * 60_000,
  });
  const catObj = categories.find((c: any) => c.name === categoryFilter);

  // Track coordinates locally so changes trigger react rerender and refilter
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateLoc = () => {
      const latRaw = localStorage.getItem("sw_latitude");
      const lonRaw = localStorage.getItem("sw_longitude");
      if (latRaw && lonRaw) {
        setCoords({ lat: parseFloat(latRaw), lon: parseFloat(lonRaw) });
      } else {
        setCoords(null);
      }
    };
    updateLoc();
    window.addEventListener("sw_location_updated", updateLoc);
    return () => window.removeEventListener("sw_location_updated", updateLoc);
  }, []);

  // Fetch all products
  const { data: rawProducts = [], isLoading } = useQuery<any[]>({
    queryKey: ["products", categoryFilter],
    queryFn: async () => {
      const res = await api.get("/catalog/products", {
        params: { category_id: catObj?.id || undefined, limit: 100 },
      });
      return res.data || [];
    },
    staleTime: 60_000,
  });

  // Calculate distances and filter to the NEAREST VENDOR only
  const { products, nearestVendorDistance, isOutofRange } = React.useMemo(() => {
    if (!rawProducts.length) return { products: [], nearestVendorDistance: null, isOutofRange: false };

    // Map all products to their distance from the user
    const mapped = rawProducts.map((p: any) => {
      const vLat = p.attributes?.vendor_latitude
        || p.attributes?.store_latitude
        || p.vendor?.store?.latitude
        || p.vendor_latitude
        || null;
      const vLon = p.attributes?.vendor_longitude
        || p.attributes?.store_longitude
        || p.vendor?.store?.longitude
        || p.vendor_longitude
        || null;
      const vRad = p.attributes?.vendor_radius_km || 10.0;
      
      const distance = (coords && vLat && vLon)
        ? getHaversineDistance(coords.lat, coords.lon, parseFloat(vLat), parseFloat(vLon))
        : 0;
      return { ...p, distance, vendor_radius: vRad };
    });

    // Check products in delivery radius
    const inRangeProducts = mapped.filter((p: any) => p.distance <= p.vendor_radius);
    
    let isOutofRange = false;
    let targetProducts = inRangeProducts;

    // If no products are in range but we have coordinates, check nearest overall
    if (inRangeProducts.length === 0 && mapped.length > 0 && coords) {
      isOutofRange = true;
      targetProducts = mapped;
    }

    if (targetProducts.length === 0) {
      // If still empty (e.g. no coords or no vendor info), just show first 30 products directly
      return { products: mapped.slice(0, 30), nearestVendorDistance: null, isOutofRange: false };
    }

    // Find the closest vendor among target products
    let minDistance = Infinity;
    let nearestVendor: any = null;
    targetProducts.forEach((p: any) => {
      const vId = p.attributes?.vendor_id || p.vendor_id || p.vendor?.id;
      if (vId && p.distance < minDistance) {
        minDistance = p.distance;
        nearestVendor = vId;
      }
    });

    if (!nearestVendor) {
      return { products: targetProducts.slice(0, 30), nearestVendorDistance: null, isOutofRange };
    }

    // Save nearest vendor ID for restriction
    localStorage.setItem("sw_nearest_vendor_id", String(nearestVendor));

    // Filter to ONLY show products from this single nearest vendor
    const filtered = targetProducts
      .filter((p: any) => {
        const vId = p.attributes?.vendor_id || p.vendor_id || p.vendor?.id;
        return vId === nearestVendor;
      })
      .sort((a: any, b: any) => a.distance - b.distance)
      .slice(0, 30);

    return { products: filtered, nearestVendorDistance: minDistance === Infinity ? null : minDistance, isOutofRange };
  }, [rawProducts, coords]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="skeleton h-56 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <EmptyState
        emoji="🧺"
        title="No fresh products nearby"
        description="We couldn't find active vendors within range of your location."
      />
    );
  }

  return (
    <div className="space-y-4">
      {isOutofRange && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 text-amber-800 dark:text-amber-400 text-xs font-semibold flex items-center gap-2">
          <Navigation className="w-4 h-4 text-amber-500 animate-pulse flex-shrink-0" />
          <span>Showing preview catalog (Delivery currently unavailable to your location as nearest store is {(nearestVendorDistance ?? 0).toFixed(1)} km away).</span>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
        {products.map((p: any) => <ProductCard key={p.id} product={p} />)}
      </div>
    </div>
  );
}

// ==================== CART FOOTER ====================
function CartFooter() {
  const router = useRouter();
  const isGuest = typeof window !== "undefined" && !localStorage.getItem("sw_access_token");

  // Server cart state
  const { data: serverCart } = useQuery<any>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await api.get("/cart");
      return res.data || { items: [], item_count: 0 };
    },
    enabled: typeof window !== "undefined" && !isGuest,
    staleTime: 0,
  });

  // Guest cart state
  const [localCart, setLocalCart] = useState<any>(getLocalGuestCart());

  useEffect(() => {
    const handleUpdate = () => setLocalCart(getLocalGuestCart());
    window.addEventListener("sw_cart_updated", handleUpdate);
    return () => window.removeEventListener("sw_cart_updated", handleUpdate);
  }, []);

  const count = isGuest
    ? localCart?.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0
    : serverCart?.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0;

  const total = isGuest ? localCart?.subtotal || 0 : serverCart?.subtotal || 0;

  if (count === 0) return null;

  return (
    <div className="fixed bottom-16 md:bottom-6 left-1/2 md:left-[calc(50%+8rem)] -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-30 animate-slide-up">
      <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl shadow-2xl p-4 flex items-center justify-between border border-slate-800">
        <div>
          <p className="text-xs text-slate-400 font-medium">{count} item{count !== 1 ? "s" : ""} in cart</p>
          <p className="text-lg font-black text-white">₹{total.toFixed(2)}</p>
        </div>
        <button
          onClick={() => router.push(resolveLink("/cart"))}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl transition-all text-sm flex items-center gap-2 shadow-lg shadow-emerald-900/30 cursor-pointer"
        >
          View Cart <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ==================== ROUTE GUARD ====================
function useAuthGuard() {
  // Guard disabled for home page to support guest browsing onboarding patterns
}

// ==================== COMING SOON AREA OVERRIDE ====================
function ComingSoonArea({ currentAddress, onOpenLocation }: { currentAddress: string; onOpenLocation: () => void }) {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail("");
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 text-center space-y-8 animate-fade-in">
      <div className="relative inline-block">
        <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full scale-125 animate-pulse" />
        <div className="relative w-20 h-20 bg-gradient-to-tr from-emerald-500 to-teal-600 rounded-3xl flex items-center justify-center text-4xl shadow-xl border border-white/20">
          📍
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-3xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
          Coming Soon in<br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-350">
            Your Area! 🚀
          </span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
          Sbjiwala isn&apos;t delivering at <b>{currentAddress || "your location"}</b> yet. We are expanding rapidly!
        </p>
      </div>

      <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4">
        {!subscribed ? (
          <form onSubmit={handleSubscribe} className="space-y-3">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-350">
              Notify me when delivery starts:
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-emerald-505 text-slate-800 dark:text-white"
              />
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all flex-shrink-0 cursor-pointer"
              >
                Notify Me
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-2 space-y-1 animate-scale-in">
            <span className="text-2xl">🎉</span>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Aapki request record ho gayi hai!</p>
            <p className="text-[10px] text-slate-400">We will notify you immediately once we launch here.</p>
          </div>
        )}

        <div className="border-t border-slate-200 dark:border-slate-800/80 my-2" />

        <div className="space-y-2">
          <p className="text-[11px] text-slate-405">Want to order somewhere else?</p>
          <button
            onClick={onOpenLocation}
            className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-white font-black text-xs py-3 rounded-xl transition-all border border-slate-205 dark:border-slate-700 cursor-pointer flex items-center justify-center gap-1.5"
          >
            Change Location Pin
          </button>
        </div>
      </div>

      <div className="text-[10px] text-slate-400/85 font-black uppercase tracking-wider flex items-center justify-center gap-4 mt-6">
        <span>⚡ Faster Delivery</span>
        <span>•</span>
        <span>🥬 Farm Fresh</span>
      </div>
    </div>
  );
}

// ==================== HOME SKELETON ====================
function HomeSkeleton() {
  return (
    <div className="space-y-8 pb-32 animate-pulse px-4 w-full max-w-7xl mx-auto">
      {/* Hero skeleton */}
      <div className="h-64 sm:h-80 bg-slate-200 dark:bg-slate-800 rounded-3xl mt-4" />
      
      {/* Trust Badges skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-6xl mx-auto -mt-12 relative z-10">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" />
        ))}
      </div>

      {/* Banner skeleton */}
      <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />

      {/* Categories skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-36 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
          ))}
        </div>
      </div>

      {/* Products skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-56 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== PROMO POPUP MODAL ====================
function PromoPopupModal({ ad, onClose }: { ad: any; onClose: () => void }) {
  if (!ad) return null;
  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/85 flex items-center justify-center p-4 z-[999] animate-fade-in backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl max-w-sm w-full border border-slate-100 dark:border-slate-800 relative animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 hover:bg-black/65 text-white z-10 transition-colors cursor-pointer"
          aria-label="Close offer modal"
        >
          <X className="w-4 h-4" />
        </button>
        <img
          src={resolveImageUrl(ad.image_url)}
          alt={ad.name}
          className="w-full h-48 object-cover"
        />
        <div className="p-6 text-center space-y-4">
          <div className="space-y-1.5">
            <h3 className="font-black text-lg text-slate-900 dark:text-white leading-snug">
              {ad.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              {ad.description}
            </p>
          </div>
          {ad.click_url && (
            <Link href={resolveLink(ad.click_url)} onClick={onClose} className="block">
              <Button fullWidth size="lg" className="rounded-2xl shadow-md">
                Claim Offer Now
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== FLOATING PIP VIDEO AD ====================
function PipVideoAd({ ad }: { ad: any }) {
  const [closed, setClosed] = useState(false);
  const [muted, setMuted] = useState(true);
  
  if (!ad || closed) return null;

  return (
    <div className="fixed bottom-24 right-4 z-40 w-40 sm:w-48 aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 bg-black animate-slide-in flex flex-col justify-end">
      {/* Floating video */}
      <video
        src={ad.video_url}
        autoPlay
        loop
        muted={muted}
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

      {/* Header controls */}
      <div className="absolute top-2 left-2 right-2 flex justify-between items-center z-10">
        <span className="text-[9px] bg-black/40 text-white/95 px-1.5 py-0.5 rounded font-black uppercase tracking-wider backdrop-blur-sm">
          Ad
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={() => setMuted(!muted)}
            className="p-1 rounded-full bg-black/50 text-white hover:bg-black/70 cursor-pointer backdrop-blur-sm transition-colors border border-white/10"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          </button>
          <button
            onClick={() => setClosed(true)}
            className="p-1 rounded-full bg-black/50 text-white hover:bg-black/70 cursor-pointer backdrop-blur-sm transition-colors border border-white/10"
            title="Close Ad"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Description overlay */}
      <div className="relative p-3 z-10 space-y-1.5 text-white text-left">
        <p className="text-[10px] font-black leading-tight drop-shadow-sm truncate">{ad.name}</p>
        <p className="text-[8px] text-white/80 leading-snug line-clamp-2 drop-shadow-sm font-medium">
          {ad.description}
        </p>
        {ad.click_url && (
          <Link href={resolveLink(ad.click_url)} className="block mt-1">
            <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black py-1.5 rounded-lg transition-all text-center shadow-md cursor-pointer">
              Shop Now
            </button>
          </Link>
        )}
      </div>
    </div>
  );
}

// ==================== PAGE ====================
export default function HomePage() {
  useAuthGuard();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [notificationBanner, setNotificationBanner] = useState<{ title: string; body: string } | null>(null);

  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locationName, setLocationName] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateLoc = () => {
      const latRaw = localStorage.getItem("sw_latitude");
      const lonRaw = localStorage.getItem("sw_longitude");
      setLocationName(localStorage.getItem("sw_location_name") || "");
      if (latRaw && lonRaw) {
        setCoords({ lat: parseFloat(latRaw), lon: parseFloat(lonRaw) });
      }
    };
    updateLoc();
    window.addEventListener("sw_location_updated", updateLoc);
    return () => window.removeEventListener("sw_location_updated", updateLoc);
  }, []);

  // Ads Query for Home Page
  const { data: ads = [] } = useQuery<any[]>({
    queryKey: ["ads", "home"],
    queryFn: async () => {
      const res = await api.get("/catalog/ads?page_target=home");
      return res.data || [];
    },
  });

  const [activePopup, setActivePopup] = useState<any>(null);

  useEffect(() => {
    if (ads.length > 0) {
      const popupAd = ads.find((a: any) => a.placement === "popup");
      if (popupAd && typeof window !== "undefined") {
        const shown = sessionStorage.getItem("sw_promo_modal_shown");
        if (!shown) {
          setActivePopup(popupAd);
          sessionStorage.setItem("sw_promo_modal_shown", "true");
        }
      }
    }
  }, [ads]);

  const videoPipAd = ads.find((a: any) => a.placement === "pip" && a.video_url);

  // Range Check Query
  const { data: rangeCheck, isLoading: checkingRange } = useQuery({
    queryKey: ["rangeCheck", coords],
    queryFn: async () => {
      if (!coords) return { in_range: true, covered_vendor_ids: [] };
      const res = await api.get("/catalog/vendors/range-check", {
        params: { latitude: coords.lat, longitude: coords.lon }
      });
      return res.data;
    },
    enabled: !!coords,
  });

  // WebSocket for real-time notifications on the customer homepage
  useWebSocket((message) => {
    if (message.type === "notification") {
      setNotificationBanner({ title: message.data.title, body: message.data.body });
      if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
        new Notification(message.data.title, { body: message.data.body, icon: "/icon.png" });
      }
      setTimeout(() => {
        setNotificationBanner(null);
      }, 6000);
    }
  });

  const handleOpenLocationModal = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("sw_open_location_modal"));
    }
  };

  const isInRange = rangeCheck ? rangeCheck.in_range : true;

  return (
    <div className="space-y-8 pb-32 md:pb-28 relative">
      {/* Push Notification Toast Banner */}
      {notificationBanner && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] w-[90%] max-w-md bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl shadow-2xl p-4 flex items-start gap-3 border-l-4 border-l-emerald-500 animate-slide-down">
          <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl flex-shrink-0">
            <Bell className="w-5 h-5 text-emerald-600 dark:text-emerald-450" />
          </div>
          <div className="flex-1 space-y-0.5">
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              {notificationBanner.title}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
              {notificationBanner.body}
            </p>
          </div>
          <button
            onClick={() => setNotificationBanner(null)}
            className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {checkingRange ? (
        <HomeSkeleton />
      ) : (
        <>
          {!isInRange && (
            <div className="mx-4 mt-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 text-amber-800 dark:text-amber-400 text-xs font-semibold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-amber-500 animate-pulse flex-shrink-0" />
                <span>We are not delivering to your location yet. Showing products from the nearest vendor.</span>
              </div>
              <button onClick={handleOpenLocationModal} className="text-xs text-emerald-600 dark:text-emerald-400 font-extrabold hover:underline flex-shrink-0">
                Change Location
              </button>
            </div>
          )}
          <Hero onSelectCategory={setSelectedCategory} />
          <TrustBadges />
          <OffersBanner />
          
          <CategoriesStrip active={selectedCategory} setActive={setSelectedCategory} />
          
          {/* Products Grid filtered by category selection */}
          <div className="px-4 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-55 tracking-tight">
                {selectedCategory === "All" ? "Trending Nearby" : `Fresh ${selectedCategory}`}
              </h2>
            </div>
            <ProductsGrid categoryFilter={selectedCategory === "All" ? undefined : selectedCategory} />
          </div>
        </>
      )}

      <CartFooter />

      {/* Offer Promo Popup Activity Modal */}
      {activePopup && (
        <PromoPopupModal ad={activePopup} onClose={() => setActivePopup(null)} />
      )}

      {/* Floating Video PIP Ad player */}
      {videoPipAd && <PipVideoAd ad={videoPipAd} />}
    </div>
  );
}
