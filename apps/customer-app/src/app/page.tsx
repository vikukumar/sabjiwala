"use client";

import React, { useState, useEffect } from "react";
import { Search, ArrowRight, Star, Plus, Minus, ChevronRight, Zap, Truck, Leaf, ShieldCheck, Clock, TrendingUp, Loader2, Bell, X, Navigation } from "lucide-react";
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

// ==================== PRODUCT CARD ====================
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
    staleTime: 30_000,
  });

  // Track guest cart local state
  const [localCart, setLocalCart] = useState<any>(getLocalGuestCart());

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
  const discountPct = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const rating = product.attributes?.rating ?? (4 + Math.random() * 0.9).toFixed(1);

  // Guest Add to Cart
  const handleGuestAdd = () => {
    const current = getLocalGuestCart();
    const existing = current.items.find((i: any) => i.product_id === product.id);
    const vendorId = product.attributes?.vendor_id || product.vendor_id;

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
      const vendorId = product.attributes?.vendor_id || product.vendor_id;
      return api.post("/cart/items", {
        product_id: product.id,
        vendor_id: vendorId,
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

  const updateQty = useMutation({
    mutationFn: async ({ itemId, qty }: { itemId: string; qty: number }) => {
      if (qty <= 0) return api.delete(`/cart/items/${itemId}`);
      return api.patch(`/cart/items/${itemId}`, { quantity: qty });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

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
                onClick={() => isGuest ? handleGuestUpdateQty(cartItem.quantity - 1) : updateQty.mutate({ itemId: cartItem.id, qty: cartItem.quantity - 1 })}
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="px-2 text-sm font-black min-w-[20px] text-center">{cartItem.quantity}</span>
              <button
                onClick={() => isGuest ? handleGuestUpdateQty(cartItem.quantity + 1) : updateQty.mutate({ itemId: cartItem.id, qty: cartItem.quantity + 1 })}
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => isGuest ? handleGuestAdd() : addToCart.mutate()}
              disabled={!isGuest && addToCart.isPending}
              className="bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-950/30 dark:hover:bg-emerald-600 dark:text-emerald-400 dark:hover:text-white text-xs font-black px-3.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
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
  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.get("/catalog/categories");
      return res.data || [];
    },
    staleTime: 5 * 60_000,
  });
  const catObj = categories.find((c: any) => c.name === categoryFilter);

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

  // Calculate distances and filter within 10 km radius, nearest first
  const products = React.useMemo(() => {
    if (typeof window === "undefined" || !rawProducts.length) return rawProducts;

    const latRaw = localStorage.getItem("sw_latitude");
    const lonRaw = localStorage.getItem("sw_longitude");
    if (!latRaw || !lonRaw) return rawProducts.slice(0, 20);

    const uLat = parseFloat(latRaw);
    const uLon = parseFloat(lonRaw);

    return rawProducts
      .map((p: any) => {
        // Find vendor coords
        const vLat = p.attributes?.vendor_latitude || p.vendor?.store?.latitude || 19.0760;
        const vLon = p.attributes?.vendor_longitude || p.vendor?.store?.longitude || 72.8777;
        const distance = getHaversineDistance(uLat, uLon, vLat, vLon);
        return { ...p, distance };
      })
      .filter((p: any) => p.distance <= 10.0) // 10 km radius filter!
      .sort((a: any, b: any) => a.distance - b.distance) // Nearest first!
      .slice(0, 30);
  }, [rawProducts]);

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
        title="No fresh products nearby"
        description="We couldn't find active vendors within a 10 km radius of your location."
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
  const isGuest = typeof window !== "undefined" && !localStorage.getItem("sw_access_token");

  // Server cart state
  const { data: serverCart } = useQuery<any>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await api.get("/cart");
      return res.data || { items: [], item_count: 0 };
    },
    enabled: typeof window !== "undefined" && !isGuest,
    staleTime: 30_000,
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
    <div className="fixed bottom-16 md:bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-30 animate-slide-up">
      <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl shadow-2xl p-4 flex items-center justify-between border border-slate-800">
        <div>
          <p className="text-xs text-slate-400 font-medium">{count} item{count !== 1 ? "s" : ""} in cart</p>
          <p className="text-lg font-black text-white">₹{total.toFixed(2)}</p>
        </div>
        <button
          onClick={() => router.push("/cart")}
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
  // Guard disabled for home page to support Swiggy guest browsing onboarding patterns
}

// ==================== PAGE ====================
export default function HomePage() {
  useAuthGuard();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [notificationBanner, setNotificationBanner] = useState<{ title: string; body: string } | null>(null);

  // WebSocket for real-time notifications on the customer homepage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("sw_access_token");
    if (!token) return;

    let ws: WebSocket;
    let reconnectTimeout: any;

    const connectWS = () => {
      const apiBase = api.client.defaults.baseURL || "/api/v1";
      let baseHost = "";
      let protocol = "ws:";

      if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
        const url = new URL(apiBase);
        baseHost = url.host;
        protocol = url.protocol === "https:" ? "wss:" : "ws:";
      } else {
        baseHost = window.location.host;
        protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      }
      
      ws = new WebSocket(`${protocol}//${baseHost}/ws?token=${token}`);

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { type, data } = message;

          if (type === "notification") {
            setNotificationBanner({ title: data.title, body: data.body });
            if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
              new Notification(data.title, { body: data.body, icon: "/icon.png" });
            }
            setTimeout(() => {
              setNotificationBanner(null);
            }, 6000);
          }
        } catch (err) {
          console.error("Error parsing WS message:", err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWS, 5000);
      };

      ws.onerror = (err) => {
        console.warn("WS connection offline or closed:", err);
        ws.close();
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  return (
    <div className="space-y-8 pb-4 relative">
      {/* Push Notification Toast Banner */}
      {notificationBanner && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] w-[90%] max-w-md bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl shadow-2xl p-4 flex items-start gap-3 border-l-4 border-l-emerald-500 animate-slide-down">
          <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl flex-shrink-0">
            <Bell className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
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

      <Hero />
      <TrustBadges />
      <OffersBanner />
      
      <CategoriesStrip active={selectedCategory} setActive={setSelectedCategory} />
      
      {/* Products Grid filtered by category selection */}
      <div className="px-4 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-50 tracking-tight">
            {selectedCategory === "All" ? "Trending Nearby" : `Fresh ${selectedCategory}`}
          </h2>
        </div>
        <ProductsGrid categoryFilter={selectedCategory === "All" ? undefined : selectedCategory} />
      </div>

      <CartFooter />
    </div>
  );
}
