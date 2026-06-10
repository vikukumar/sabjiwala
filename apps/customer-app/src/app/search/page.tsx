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

function ProductCard({ product }: { product: any }) {
  const queryClient = useQueryClient();
  const { error: showError } = useToast();

  const isGuest = typeof window !== "undefined" && !localStorage.getItem("sw_access_token");

  // Read backend cart
  const { data: serverCart } = useQuery<any>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await api.get("/cart");
      return res.data || { items: [], item_count: 0 };
    },
    enabled: typeof window !== "undefined" && !isGuest,
    staleTime: 0,
  });

  // Track guest cart local state
  const [localCart, setLocalCart] = useState<any>(getLocalGuestCart());
  const [showClearCartModal, setShowClearCartModal] = useState(false);

  useEffect(() => {
    const handleUpdate = () => setLocalCart(getLocalGuestCart());
    window.addEventListener("sw_cart_updated", handleUpdate);
    return () => window.removeEventListener("sw_cart_updated", handleUpdate);
  }, []);

  const cartItem = isGuest
    ? localCart?.items?.find((i: any) => i.product_id === product.id)
    : serverCart?.items?.find((i: any) => i.product_id === product.id);

  // Dynamic 4.5% product price customer markup
  const price = Math.round((product.attributes?.price ?? product.price ?? 30) * 1.045 * 100) / 100;
  const rawMrp = product.attributes?.mrp ?? product.mrp;
  const mrp = rawMrp ? Math.round(rawMrp * 1.045 * 100) / 100 : undefined;
  const emoji = product.attributes?.image_emoji || "🥬";
  const hasDiscount = mrp && mrp > price;
  const rating = product.attributes?.rating ?? (4 + Math.random() * 0.9).toFixed(1);

  const targetVendorId = product.attributes?.vendor_id || product.vendor_id || product.vendor?.id;

  // Guest Add to Cart
  const handleGuestAdd = () => {
    const current = getLocalGuestCart();
    const existing = current.items.find((i: any) => i.product_id === product.id);
    const vendorId = targetVendorId;

    if (existing) {
      existing.quantity += 1;
    } else {
      current.items.push({
        id: `guest-${product.id}`,
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit: product.unit || "1 kg",
        price: price,
        vendor_id: vendorId,
        attributes: { image_emoji: emoji }
      });
    }
    
    // Recalculate guest subtotal
    current.subtotal = current.items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
    saveLocalGuestCart(current);

    // Trigger contextual notification alert benefit on first guest item added
    if (current.items.length === 1) {
      window.dispatchEvent(new Event("trigger-notification-benefit"));
    }
  };

  const handleGuestUpdateQty = (newQty: number) => {
    const current = getLocalGuestCart();
    const idx = current.items.findIndex((i: any) => i.product_id === product.id);
    if (idx === -1) return;

    if (newQty <= 0) {
      current.items.splice(idx, 1);
    } else {
      current.items[idx].quantity = newQty;
    }

    current.subtotal = current.items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
    saveLocalGuestCart(current);
  };

  // Backend mutations
  const addToCart = useMutation({
    mutationFn: async () => {
      const vendorId = targetVendorId;
      return api.post("/cart/items", {
        product_id: product.id,
        ...(vendorId ? { vendor_id: vendorId } : {}),
        quantity: 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      // Trigger contextual notification alert benefit on first backend item added
      const currentItems = queryClient.getQueryData<any>(["cart"])?.items || [];
      if (currentItems.length === 0) {
        window.dispatchEvent(new Event("trigger-notification-benefit"));
      }
    },
    onError: (err: any) => showError("Failed to add", err.response?.data?.detail || err.message),
  });

  const addToCartWithClear = useMutation({
    mutationFn: async () => {
      const vendorId = targetVendorId;
      return api.post("/cart/items", {
        product_id: product.id,
        ...(vendorId ? { vendor_id: vendorId } : {}),
        quantity: 1,
        clear_other_carts: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      setShowClearCartModal(false);
    },
    onError: (err: any) => showError("Failed to add", err.response?.data?.detail || err.message),
  });

  const handleAddToCartAttempt = () => {
    const currentItems = isGuest ? localCart?.items : serverCart?.items;
    const differentVendor = currentItems?.length > 0 && currentItems.some((i: any) => i.vendor_id && String(i.vendor_id) !== String(targetVendorId));

    if (differentVendor) {
      setShowClearCartModal(true);
    } else {
      if (isGuest) {
        handleGuestAdd();
      } else {
        addToCart.mutate();
      }
    }
  };

  const handleConfirmClearCart = () => {
    if (isGuest) {
      const emptyCart = { items: [], subtotal: 0 };
      saveLocalGuestCart(emptyCart);
      handleGuestAdd();
      setShowClearCartModal(false);
    } else {
      addToCartWithClear.mutate();
    }
  };

  const updateQty = useMutation({
    mutationFn: async ({ itemId, qty }: { itemId: string; qty: number }) => {
      if (qty <= 0) return api.delete(`/cart/items/${itemId}`);
      return api.patch(`/cart/items/${itemId}`, { quantity: qty });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700/50 hover:shadow-lg transition-all group overflow-hidden flex relative">
      <Link href={`/products/${product.id}`} className="flex-shrink-0 w-24 h-24 bg-gradient-to-br from-slate-50 to-emerald-50/20 dark:from-slate-800/50 dark:to-slate-900 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
        {emoji}
      </Link>
      <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
        <div>
          <Link href={`/products/${product.id}`}>
            <h3 className="font-black text-sm text-slate-900 dark:text-slate-50 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors line-clamp-1">{product.name}</h3>
          </Link>
          <p className="text-xs text-slate-550 dark:text-slate-400">{product.unit || "1 kg"}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Star className="w-3 h-3 text-amber-500 fill-current" />
            <span className="text-[10px] font-bold text-amber-600">{rating}</span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <div>
            <span className="font-black text-slate-900 dark:text-white">₹{price}</span>
            {hasDiscount && <span className="text-xs text-slate-405 line-through ml-1.5 font-semibold">₹{mrp}</span>}
          </div>
          {cartItem ? (
            <div className="flex items-center gap-1 bg-emerald-600 text-white rounded-xl px-1.5 py-0.5">
              <button onClick={() => isGuest ? handleGuestUpdateQty(cartItem.quantity - 1) : updateQty.mutate({ itemId: cartItem.id, qty: cartItem.quantity - 1 })} className="w-5 h-5 flex items-center justify-center hover:bg-emerald-700 rounded-lg">
                <Minus className="w-2.5 h-2.5" />
              </button>
              <span className="px-1 text-xs font-black min-w-[16px] text-center">{cartItem.quantity}</span>
              <button onClick={() => isGuest ? handleGuestUpdateQty(cartItem.quantity + 1) : updateQty.mutate({ itemId: cartItem.id, qty: cartItem.quantity + 1 })} className="w-5 h-5 flex items-center justify-center hover:bg-emerald-700 rounded-lg">
                <Plus className="w-2.5 h-2.5" />
              </button>
            </div>
          ) : (
            <button onClick={handleAddToCartAttempt} disabled={!isGuest && addToCart.isPending}
              className="bg-emerald-55 hover:bg-emerald-600 text-emerald-700 hover:text-white text-xs font-black px-3.5 py-1.5 rounded-xl border border-emerald-250 transition-all disabled:opacity-50 cursor-pointer">
              {addToCart.isPending ? "..." : "ADD"}
            </button>
          )}
        </div>
      </div>

      {showClearCartModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowClearCartModal(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-in text-center shadow-2xl text-slate-800 dark:text-white" style={{ zIndex: 1000 }}>
            <h3 className="text-base font-black uppercase tracking-wider">Replace cart items?</h3>
            <p className="text-xs text-slate-550 dark:text-slate-400 leading-normal">
              Your cart has items from another store. Do you want to discard them and add this item instead?
            </p>
            <div className="flex gap-3 pt-2">
              <Button
                variant="danger"
                onClick={handleConfirmClearCart}
                loading={!isGuest && addToCartWithClear.isPending}
                className="flex-1 py-3 text-xs font-bold cursor-pointer"
              >
                Yes, Replace
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowClearCartModal(false)}
                className="flex-1 py-3 text-xs font-bold cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
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
