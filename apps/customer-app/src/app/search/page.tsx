"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, X, Filter, SlidersHorizontal, Star, Plus, Minus, ChevronDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import Link from "next/link";
import { Button, Badge, EmptyState, Spinner, Skeleton } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";

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

function ProductCard({ product }: { product: any }) {
  const queryClient = useQueryClient();
  const { error: showError } = useToast();
  const { data: cartData } = useQuery<any>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await api.get("/cart");
      return res.data || { items: [], item_count: 0 };
    },
    staleTime: 0,
  });
  const cartItem = cartData?.items?.find((i: any) => i.product_id === product.id);

  const addToCart = useMutation({
    mutationFn: async () => api.post("/cart/items", { product_id: product.id, vendor_id: product.attributes?.vendor_id, quantity: 1 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
    onError: (err: any) => showError("Couldn't add to cart", err.response?.data?.detail || err.message),
  });
  const updateQty = useMutation({
    mutationFn: async ({ itemId, qty }: { itemId: string; qty: number }) =>
      qty <= 0 ? api.delete(`/cart/items/${itemId}`) : api.patch(`/cart/items/${itemId}`, { quantity: qty }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const price = product.attributes?.price ?? 30;
  const mrp = product.attributes?.mrp;
  const emoji = product.attributes?.image_emoji || "🥬";
  const hasDiscount = mrp && mrp > price;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700/50 hover:shadow-lg transition-all group overflow-hidden flex">
      <Link href={`/products/${product.id}`} className="flex-shrink-0 w-24 h-24 bg-gradient-to-br from-slate-50 to-emerald-50/20 dark:from-slate-800/50 dark:to-slate-900 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
        {emoji}
      </Link>
      <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
        <div>
          <Link href={`/products/${product.id}`}>
            <h3 className="font-black text-sm text-slate-900 dark:text-slate-50 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors line-clamp-1">{product.name}</h3>
          </Link>
          <p className="text-xs text-slate-500 dark:text-slate-400">{product.unit || "1 kg"}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Star className="w-3 h-3 text-amber-500 fill-current" />
            <span className="text-[10px] font-bold text-amber-600">4.7</span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <div>
            <span className="font-black text-slate-900 dark:text-white">₹{price}</span>
            {hasDiscount && <span className="text-xs text-slate-400 line-through ml-1">₹{mrp}</span>}
          </div>
          {cartItem ? (
            <div className="flex items-center gap-1 bg-emerald-600 text-white rounded-xl px-1.5 py-0.5">
              <button onClick={() => updateQty.mutate({ itemId: cartItem.id, qty: cartItem.quantity - 1 })} className="w-5 h-5 flex items-center justify-center hover:bg-emerald-700 rounded-lg">
                <Minus className="w-2.5 h-2.5" />
              </button>
              <span className="px-1 text-xs font-black">{cartItem.quantity}</span>
              <button onClick={() => updateQty.mutate({ itemId: cartItem.id, qty: cartItem.quantity + 1 })} className="w-5 h-5 flex items-center justify-center hover:bg-emerald-700 rounded-lg">
                <Plus className="w-2.5 h-2.5" />
              </button>
            </div>
          ) : (
            <button onClick={() => addToCart.mutate()} disabled={addToCart.isPending}
              className="bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white text-xs font-black px-3 py-1.5 rounded-xl border border-emerald-200 transition-all disabled:opacity-50">
              {addToCart.isPending ? "..." : "ADD"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

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
    if (!coords) return results;

    return results.filter((p: any) => {
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
              {categories.slice(0, 6).map((cat: any) => (
                <Link key={cat.id} href={`/search?category=${cat.id}`}
                  className="card p-4 flex items-center gap-3 hover:border-emerald-400 transition-colors">
                  <span className="text-2xl">{["🥦", "🍎", "🥬", "🥕", "🌿", "🧅"][categories.indexOf(cat) % 6]}</span>
                  <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{cat.name}</span>
                </Link>
              ))}
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
          <div className="grid grid-cols-1 gap-3">
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
