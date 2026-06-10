"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Star, Plus, Minus, Heart, Share2, ChevronLeft, ShoppingCart, Truck, Leaf, ShieldCheck, ArrowRight, Tag } from "lucide-react";
import { Button, Badge, Skeleton, EmptyState } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange?.(s)}
          className={`transition-transform hover:scale-110 ${onChange ? "cursor-pointer" : "cursor-default"}`}
        >
          <Star className={`w-5 h-5 ${s <= value ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600"}`} />
        </button>
      ))}
    </div>
  );
}

export default function ProductDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();

  const isGuest = typeof window !== "undefined" && !localStorage.getItem("sw_access_token");

  const { data: product, isLoading } = useQuery<any>({
    queryKey: ["product", id],
    queryFn: async () => { const r = await api.get(`/catalog/products/${id}`); return r.data; },
  });

  // Read backend cart
  const { data: cartData } = useQuery<any>({
    queryKey: ["cart"],
    queryFn: async () => { const r = await api.get("/cart"); return r.data; },
    enabled: typeof window !== "undefined" && !isGuest,
  });

  // Track guest cart local state
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

  const [localCart, setLocalCart] = useState<any>(getLocalGuestCart());

  useEffect(() => {
    const handleUpdate = () => setLocalCart(getLocalGuestCart());
    window.addEventListener("sw_cart_updated", handleUpdate);
    return () => window.removeEventListener("sw_cart_updated", handleUpdate);
  }, []);

  const cartItem = isGuest
    ? localCart?.items?.find((i: any) => i.product_id === id)
    : cartData?.items?.find((i: any) => i.product_id === id);

  // Dynamic 4.5% product price customer markup
  const price = product ? Math.round((product.attributes?.price ?? 30) * 1.045 * 100) / 100 : 30;
  const rawMrp = product?.attributes?.mrp;
  const mrp = rawMrp ? Math.round(rawMrp * 1.045 * 100) / 100 : undefined;
  const emoji = product?.attributes?.image_emoji || "🥬";
  const hasDiscount = mrp && mrp > price;
  const discountPct = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const rating = product?.attributes?.rating ?? 4.7;
  const reviewCount = product?.attributes?.review_count ?? 128;

  // Guest actions
  const handleGuestAdd = () => {
    const current = getLocalGuestCart();
    const existing = current.items.find((i: any) => i.product_id === id);
    const vendorId = product?.attributes?.vendor_id || product?.vendor_id;

    if (existing) {
      existing.quantity += 1;
    } else {
      current.items.push({
        id: `guest-${id}`,
        product_id: id,
        product_name: product.name,
        quantity: 1,
        unit: product.unit || "500g",
        price: price,
        vendor_id: vendorId,
        attributes: { image_emoji: emoji }
      });
    }

    current.subtotal = current.items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
    saveLocalGuestCart(current);
    success("Added to cart! 🛒");

    // Trigger contextual notification alert benefit on first guest item added
    if (current.items.length === 1) {
      window.dispatchEvent(new Event("trigger-notification-benefit"));
    }
  };

  const handleGuestUpdateQty = (newQty: number) => {
    const current = getLocalGuestCart();
    const idx = current.items.findIndex((i: any) => i.product_id === id);
    if (idx === -1) return;

    if (newQty <= 0) {
      current.items.splice(idx, 1);
    } else {
      current.items[idx].quantity = newQty;
    }

    current.subtotal = current.items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
    saveLocalGuestCart(current);
  };

  const addToCart = useMutation({
    mutationFn: async () => api.post("/cart/items", { product_id: id, vendor_id: product?.attributes?.vendor_id, quantity: 1 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      success("Added to cart! 🛒");
      // Trigger contextual notification alert benefit on first backend item added
      const currentItems = queryClient.getQueryData<any>(["cart"])?.items || [];
      if (currentItems.length === 0) {
        window.dispatchEvent(new Event("trigger-notification-benefit"));
      }
    },
    onError: (err: any) => showError("Couldn't add", err.response?.data?.detail || err.message),
  });

  const updateQty = useMutation({
    mutationFn: ({ itemId, qty }: { itemId: string; qty: number }) =>
      qty <= 0 ? api.delete(`/cart/items/${itemId}`) : api.patch(`/cart/items/${itemId}`, { quantity: qty }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-72 w-full rounded-3xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!product) return <EmptyState emoji="😕" title="Product not found" action={<Button onClick={() => router.back()}>Go Back</Button>} />;

  const features = [
    { icon: Leaf, label: "Farm Fresh", desc: "Directly sourced" },
    { icon: ShieldCheck, label: "Quality Assured", desc: "Hand-picked" },
    { icon: Truck, label: "Fast Delivery", desc: "10 minutes" },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back button */}
      <div className="sticky top-16 z-20 bg-transparent px-4 pt-4 pb-2">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-400 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <div className="px-4 pb-32 space-y-4">
        {/* Product Hero */}
        <div className="relative bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-slate-800/50 dark:to-slate-900 rounded-3xl p-8 flex items-center justify-center overflow-hidden" style={{ minHeight: "240px" }}>
          {hasDiscount && (
            <span className="absolute top-4 left-4 bg-rose-500 text-white text-xs font-black px-2.5 py-1 rounded-full">
              -{discountPct}% OFF
            </span>
          )}
          <span className="text-[110px] leading-none drop-shadow-lg">{emoji}</span>
          <button className="absolute top-4 right-4 p-2.5 bg-white dark:bg-slate-900 rounded-full shadow-md hover:scale-110 transition-transform">
            <Heart className="w-4 h-4 text-slate-400 hover:text-rose-500 transition-colors" />
          </button>
          <button className="absolute top-14 right-4 p-2.5 bg-white dark:bg-slate-900 rounded-full shadow-md hover:scale-110 transition-transform">
            <Share2 className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Info */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">{product.name}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{product.unit || "500g"}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-black text-slate-900 dark:text-white">₹{price}</p>
              {hasDiscount && <p className="text-sm text-slate-400 line-through">₹{mrp}</p>}
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-2">
            <StarRating value={Math.round(rating)} />
            <span className="text-sm font-bold text-amber-600">{rating}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">({reviewCount} reviews)</span>
          </div>

          {/* Stock badge */}
          {product.stock !== undefined && (
            <Badge variant={product.stock > 10 ? "success" : product.stock > 0 ? "warning" : "danger"}>
              {product.stock > 10 ? "In Stock" : product.stock > 0 ? `Only ${product.stock} left` : "Out of Stock"}
            </Badge>
          )}
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.label} className="card p-3 text-center space-y-1">
                <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <p className="text-xs font-black text-slate-800 dark:text-slate-200">{f.label}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{f.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Description */}
        {product.description && (
          <div className="card p-5 space-y-2">
            <h2 className="font-black text-slate-900 dark:text-white">About this product</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{product.description}</p>
          </div>
        )}

        {/* Nutritional Info */}
        {product.attributes?.nutritional_info && (
          <div className="card p-5 space-y-3">
            <h2 className="font-black text-slate-900 dark:text-white">Nutritional Info</h2>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(product.attributes.nutritional_info).map(([key, val]) => (
                <div key={key} className="flex justify-between text-xs bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2">
                  <span className="font-semibold text-slate-600 dark:text-slate-400 capitalize">{key.replace(/_/g, " ")}</span>
                  <span className="font-black text-slate-900 dark:text-white">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Offers */}
        <div className="card p-4 flex items-center gap-3">
          <Tag className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Available Offers</p>
            <Link href="/coupons" className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">View coupons →</Link>
          </div>
        </div>
      </div>

      {/* Sticky Add to Cart */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 md:left-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 px-4 py-3 z-30">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <div>
            <p className="text-xl font-black text-slate-900 dark:text-white">₹{price}</p>
            {hasDiscount && <p className="text-xs text-slate-400 line-through">₹{mrp}</p>}
          </div>
          <div className="flex-1">
            {cartItem ? (
              <div className="flex items-center justify-center gap-4 bg-emerald-600 text-white rounded-2xl py-3 px-6 shadow-lg">
                <button
                  onClick={() => isGuest ? handleGuestUpdateQty(cartItem.quantity - 1) : updateQty.mutate({ itemId: cartItem.id, qty: cartItem.quantity - 1 })}
                  className="w-8 h-8 flex items-center justify-center bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-lg font-black">{cartItem.quantity}</span>
                <button
                  onClick={() => isGuest ? handleGuestUpdateQty(cartItem.quantity + 1) : updateQty.mutate({ itemId: cartItem.id, qty: cartItem.quantity + 1 })}
                  className="w-8 h-8 flex items-center justify-center bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Button
                fullWidth
                size="lg"
                loading={!isGuest && addToCart.isPending}
                onClick={() => isGuest ? handleGuestAdd() : addToCart.mutate()}
                leftIcon={<ShoppingCart className="w-5 h-5" />}
                className="rounded-2xl shadow-lg cursor-pointer"
              >
                Add to Cart
              </Button>
            )}
          </div>
          {cartItem && (
            <Link href="/cart">
              <Button variant="secondary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />} className="rounded-2xl flex-shrink-0 cursor-pointer">
                Go to Cart
              </Button>
            </Link>
          )}
        </div>
      </div>

    </div>
  );
}
