"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, X, Filter, SlidersHorizontal, Star, Plus, Minus, ChevronDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import Link from "next/link";
import { Button, Badge, EmptyState, Spinner, Skeleton } from "@/components/ui/index";
import ProductCard from "@/components/ProductCard";
import { useToast } from "@/components/ui/Toast";

const CATEGORY_EMOJIS: Record<string, string> = {
  Vegetables: "🥦", Fruits: "🍎", "Leafy Greens": "🥬", "Root Vegetables": "🥕",
  Herbs: "🌿", Dairy: "🥛", Grains: "🌾", Spices: "🌶️", Exotics: "🥑",
  Onion: "🧅", Garlic: "🧄", Tomato: "🍅", Potato: "🥔", Mushroom: "🍄",
  Corn: "🌽", Pepper: "🫑", Brinjal: "🍆", Lemon: "🍋", Mango: "🥭",
  Banana: "🍌", Apple: "🍎", Grapes: "🍇", Watermelon: "🍉", Coconut: "🥥",
  "Dairy & Eggs": "🥛", "Herbs & Spices": "🌿", "Grains & Cereals": "🌾",
  "Organic & Natural": "🌱", "Flowers & Plants": "🌸", "Bakery & Snacks": "🍞",
  Beverages: "🧃",
};

function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams?.get("q") || "");
  const [sortBy, setSortBy] = useState("relevance");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["categories"],
    queryFn: async () => { const r = await api.get("/catalog/categories"); return r.data || []; },
    staleTime: 5 * 60_000,
  });

  const { data: results = [], isLoading, isFetching } = useQuery<any[]>({
    queryKey: ["search", query, sortBy],
    queryFn: async () => {
      if (!query.trim()) return [];
      const res = await api.get("/catalog/products", { params: { search: query.trim(), sort: sortBy } });
      return res.data || [];
    },
    enabled: query.trim().length > 1,
    staleTime: 30_000,
  });

  // Track coordinates for search range filtering
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const latRaw = localStorage.getItem("sw_latitude");
    const lonRaw = localStorage.getItem("sw_longitude");
    if (latRaw && lonRaw) {
      setCoords({ lat: parseFloat(latRaw), lon: parseFloat(lonRaw) });
    }
  }, []);

  const filteredResults = React.useMemo(() => {
    if (!results.length) return [];

    const nearestVendorId = typeof window !== "undefined" ? localStorage.getItem("sw_nearest_vendor_id") : null;

    return results.filter((p: any) => {
      const vId = p.attributes?.vendor_id || p.vendor_id || p.vendor?.id;
      if (nearestVendorId && vId && String(vId) !== String(nearestVendorId)) {
        return false;
      }

      if (!coords) return true;

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

      const distance = (vLat && vLon)
        ? getHaversineDistance(coords.lat, coords.lon, parseFloat(vLat), parseFloat(vLon))
        : 0;
      return distance <= vRad;
    });
  }, [results, coords]);

  const popularSearches = ["Tomato", "Onion", "Potato", "Spinach", "Brinjal", "Carrot", "Capsicum", "Mango", "Banana", "Apple"];

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      {/* Search Input */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 shadow-sm focus-within:border-emerald-500 transition-colors">
        <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search vegetables, fruits, herbs..."
          className="flex-1 bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm"
          autoFocus
        />
        {query && (
          <button onClick={() => setQuery("")} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
        {isFetching && <Spinner size="sm" />}
      </div>

      {/* Filters row */}
      {query.trim() && (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold flex-shrink-0 transition-all ${showFilters ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
              }`}
          >
            <Filter className="w-3.5 h-3.5" /> Filters
          </button>
          {[["Price: Low-High", "price_asc"], ["Price: High-Low", "price_desc"], ["Most Popular", "popularity"]].map(([label, val]) => (
            <button
              key={val}
              onClick={() => setSortBy(val)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold flex-shrink-0 transition-all ${sortBy === val ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {!query.trim() ? (
        <div className="space-y-6 pt-2">
          <div>
            <h2 className="text-sm font-black text-slate-700 dark:text-slate-300 mb-3">Popular Searches</h2>
            <div className="flex flex-wrap gap-2">
              {popularSearches.map(s => (
                <button key={s} onClick={() => setQuery(s)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full text-sm font-semibold text-slate-600 dark:text-slate-400 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-700 dark:text-slate-300 mb-3">Browse Categories</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {categories.slice(0, 6).map((cat: any) => {
                const emoji = cat.icon || CATEGORY_EMOJIS[cat.name] || "🥗";
                return (
                  <Link key={cat.id} href={`/search?category=${cat.id}`}
                    className="card p-4 flex items-center gap-3 hover:border-emerald-400 transition-colors">
                    <span className="text-2xl">{emoji}</span>
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{cat.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Searching for &quot;{query}&quot;...</p>
        </div>
      ) : filteredResults.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title={`No results for "${query}"`}
          description="Try different keywords or browse categories instead."
          action={<Button variant="secondary" onClick={() => setQuery("")}>Clear Search</Button>}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            {filteredResults.length} results
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredResults.map((p: any) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
