"use client";

import React, { useState, useEffect } from "react";
import { Search, ArrowRight, Star, Plus, Minus, ChevronRight, Zap, Truck, Leaf, ShieldCheck, Clock, TrendingUp, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Badge, Skeleton, EmptyState, SectionHeader } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";

// ==================== HERO ====================
function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <section className="relative overflow-hidden gradient-brand py-14 md:py-20 px-4">
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10 text-center space-y-6">
        <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-1.5 text-emerald-100 text-xs font-bold border border-white/20 backdrop-blur-sm">
          <Zap className="w-3.5 h-3.5 text-yellow-300" />
          Delivery in 10 minutes — Guaranteed Fresh
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white leading-tight tracking-tight">
          Farm Fresh Vegetables &<br className="hidden sm:block" />
          <span className="relative inline-block ml-2">
            Fruits
            <span className="absolute bottom-1 left-0 right-0 h-1.5 bg-yellow-400/70 -z-10 rounded" />
          </span>
          <br className="hidden sm:block" />
          at Your Doorstep
        </h1>

        <p className="text-emerald-100 text-base md:text-lg max-w-xl mx-auto">
          Directly from local farms — cleaned, sorted, and packed with hygienic care.
        </p>

        {/* Search */}
        <form onSubmit={handleSearch} className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-xl border border-white/20">
            <Search className="w-5 h-5 text-slate-400 ml-2 flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tomatoes, spinach, fruits..."
              className="flex-1 bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm"
            />
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex-shrink-0"
            >
              Search
            </button>
          </div>
        </form>

        {/* Quick chips */}
        <div className="flex flex-wrap justify-center gap-2">
          {["Tomatoes", "Onions", "Spinach", "Mangoes", "Potatoes", "Carrots"].map((item) => (
            <Link
              key={item}
              href={`/search?q=${item.toLowerCase()}`}
              className="bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-all backdrop-blur-sm"
            >
              {item}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ==================== TRUST BADGES ====================
function TrustBadges() {
  const badges = [
    { icon: Clock, label: "10 Min Delivery", sub: "Express service" },
    { icon: Leaf, label: "Farm Fresh", sub: "Direct from farms" },
    { icon: ShieldCheck, label: "Hygienic Packing", sub: "Quality assured" },
    { icon: Truck, label: "Free Delivery", sub: "On orders ₹199+" },
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

// ==================== CATEGORIES STRIP ====================
function CategoriesStrip() {
  const [active, setActive] = useState("All");
  const { data: categories = [], isLoading } = useQuery<any[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.get("/catalog/categories");
      return res.data || [];
    },
    staleTime: 5 * 60_000,
  });

  const categoryEmojis: Record<string, string> = {
    Vegetables: "🥦", Fruits: "🍎", Leafy: "🥬", "Leafy Greens": "🥬",
    "Root Vegetables": "🥕", Herbs: "🌿", Dairy: "🥛", Grains: "🌾",
    Spices: "🌶️", Exotics: "🥑", All: "🛒",
  };

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="skeleton h-20 w-20 rounded-2xl flex-shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-4">
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-50 tracking-tight">Shop by Category</h2>
        <Link href="/categories" className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline">
          View All <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-2">
        {[{ id: "all", name: "All" }, ...categories].map((cat: any) => {
          const isActive = active === cat.name;
          const emoji = categoryEmojis[cat.name] || "🥗";
          return (
            <button
              key={cat.id}
              onClick={() => setActive(cat.name)}
              className={`flex flex-col items-center gap-1.5 flex-shrink-0 w-[72px] transition-all ${isActive ? "scale-105" : "hover:scale-102"}`}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl border-2 transition-all ${isActive
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-md"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-emerald-300"
                }`}>
                {emoji}
              </div>
              <span className={`text-[11px] font-bold text-center leading-tight ${isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-400"
                }`}>
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ==================== OFFERS BANNER ====================
function OffersBanner() {
  const offers = [
    { label: "WELCOME20", desc: "20% off on first order", color: "from-violet-600 to-purple-700", emoji: "🎉" },
    { label: "FRESH10", desc: "10% off on vegetables", color: "from-emerald-600 to-teal-700", emoji: "🥦" },
    { label: "FRUIT15", desc: "15% off on fruits", color: "from-orange-500 to-amber-600", emoji: "🍊" },
  ];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % offers.length), 3000);
    return () => clearInterval(t);
  }, []);

  const offer = offers[idx];
  return (
    <Link href="/offers" className={`block mx-4 rounded-2xl p-5 bg-gradient-to-r ${offer.color} text-white transition-all animate-fade-in relative overflow-hidden`}>
      <div className="absolute top-0 right-0 text-7xl opacity-20 -translate-y-2 translate-x-2 pointer-events-none">{offer.emoji}</div>
      <div className="relative z-10">
        <Badge variant="outline" size="sm" className="border-white/30 text-white mb-2">Limited Time</Badge>
        <p className="text-2xl font-black tracking-tight">{offer.label}</p>
        <p className="text-sm text-white/80 mt-0.5">{offer.desc}</p>
        <div className="flex items-center gap-1 mt-3 text-xs font-bold">
          Apply now <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
      {/* Dots */}
      <div className="absolute bottom-3 right-4 flex gap-1.5">
        {offers.map((_, i) => (
          <span key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? "bg-white w-4" : "bg-white/40"}`} />
        ))}
      </div>
    </Link>
  );
}

// ==================== PRODUCT CARD ====================
function ProductCard({ product }: { product: any }) {
  const queryClient = useQueryClient();
  const { error: showError } = useToast();

  const cartItem = useQuery<any>({
    queryKey: ["cart"],
    enabled: false, // Already fetched in parent
  }).data?.items?.find((i: any) => i.product_id === product.id);

  const addToCart = useMutation({
    mutationFn: async () => {
      const vendorId = product.attributes?.vendor_id;
      return api.post("/cart/items", {
        product_id: product.id,
        vendor_id: vendorId,
        quantity: 1,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
    onError: (err: any) => showError("Failed to add", err.response?.data?.detail || err.message),
  });

  const updateQty = useMutation({
    mutationFn: async ({ itemId, qty }: { itemId: string; qty: number }) => {
      if (qty <= 0) return api.delete(`/cart/items/${itemId}`);
      return api.patch(`/cart/items/${itemId}`, { quantity: qty });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const price = product.attributes?.price ?? product.price ?? 30;
  const mrp = product.attributes?.mrp ?? product.mrp;
  const emoji = product.attributes?.image_emoji || "🥬";
  const hasDiscount = mrp && mrp > price;
  const discountPct = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const rating = product.attributes?.rating ?? (4 + Math.random() * 0.9).toFixed(1);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700/50 hover:shadow-lg transition-all group overflow-hidden product-card flex flex-col">
      {/* Image */}
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative bg-gradient-to-br from-slate-50 to-emerald-50/30 dark:from-slate-800/50 dark:to-slate-900 h-32 flex items-center justify-center">
          <span className="text-5xl group-hover:scale-110 transition-transform duration-300">{emoji}</span>
          {hasDiscount && (
            <span className="absolute top-2 left-2 bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
              -{discountPct}%
            </span>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1 gap-2">
        <div>
          <div className="flex items-center gap-1 mb-1">
            <Star className="w-3 h-3 text-amber-500 fill-current" />
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500">{rating}</span>
          </div>
          <Link href={`/products/${product.id}`}>
            <h3 className="font-black text-sm text-slate-900 dark:text-slate-50 line-clamp-1 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
              {product.name}
            </h3>
          </Link>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{product.unit || "1 kg"}</p>
        </div>

        <div className="flex items-center justify-between mt-auto pt-1">
          <div>
            <span className="text-base font-black text-slate-900 dark:text-white">₹{price}</span>
            {hasDiscount && (
              <span className="text-xs text-slate-400 line-through ml-1.5">₹{mrp}</span>
            )}
          </div>

          {cartItem ? (
            <div className="flex items-center gap-1 bg-emerald-600 text-white rounded-xl px-1.5 py-0.5 shadow-sm">
              <button
                onClick={() => updateQty.mutate({ itemId: cartItem.id, qty: cartItem.quantity - 1 })}
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="px-2 text-sm font-black min-w-[20px] text-center">{cartItem.quantity}</span>
              <button
                onClick={() => updateQty.mutate({ itemId: cartItem.id, qty: cartItem.quantity + 1 })}
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => addToCart.mutate()}
              disabled={addToCart.isPending}
              className="bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-950/30 dark:hover:bg-emerald-600 dark:text-emerald-400 dark:hover:text-white text-xs font-black px-3.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 transition-all disabled:opacity-50 active:scale-95"
            >
              {addToCart.isPending ? "..." : "ADD"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== PRODUCTS GRID ====================
function ProductsGrid({ categoryFilter }: { categoryFilter?: string }) {
  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["categories"], enabled: false });
  const catObj = categories.find((c: any) => c.name === categoryFilter);

  const { data: products = [], isLoading } = useQuery<any[]>({
    queryKey: ["products", categoryFilter],
    queryFn: async () => {
      const res = await api.get("/catalog/products", {
        params: { category_id: catObj?.id || undefined, limit: 20 },
      });
      return res.data || [];
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="skeleton h-56 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <EmptyState
        emoji="🧺"
        title="No products found"
        description="Try a different category or check back later."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
      {products.map((p: any) => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}

// ==================== CART FOOTER ====================
function CartFooter() {
  const router = useRouter();
  const { data: cartData } = useQuery<any>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await api.get("/cart");
      return res.data || { items: [], subtotal: 0 };
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
    staleTime: 30_000,
  });

  const count = cartData?.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0;
  const total = cartData?.subtotal || 0;

  if (count === 0) return null;

  return (
    <div className="fixed bottom-16 md:bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-30 animate-slide-up">
      <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl shadow-2xl p-4 flex items-center justify-between border border-slate-800">
        <div>
          <p className="text-xs text-slate-400 font-medium">{count} item{count !== 1 ? "s" : ""} in cart</p>
          <p className="text-lg font-black text-white">₹{total.toFixed(2)}</p>
        </div>
        <button
          onClick={() => router.push("/cart")}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl transition-all text-sm flex items-center gap-2 shadow-lg shadow-emerald-900/30"
        >
          View Cart <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ==================== TRENDING ====================
function TrendingSection() {
  return (
    <div className="px-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-50 tracking-tight">Trending Now</h2>
      </div>
      <ProductsGrid />
    </div>
  );
}

// ==================== ROUTE GUARD ====================
function useAuthGuard() {
  const router = useRouter();
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("sw_access_token")) {
      router.replace("/login");
    }
  }, [router]);
}

// ==================== PAGE ====================
export default function HomePage() {
  useAuthGuard();

  return (
    <div className="space-y-8 pb-4">
      <Hero />
      <TrustBadges />
      <OffersBanner />
      <CategoriesStrip />
      <TrendingSection />
      <CartFooter />
    </div>
  );
}
