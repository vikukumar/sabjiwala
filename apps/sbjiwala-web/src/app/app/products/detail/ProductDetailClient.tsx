"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, resolveImageUrl } from "@sbjiwala/shared";
import Link from "next/link";
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation";
import { resolveLink } from "@/components/AppShell";
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
  const params = useParams<{ id?: string }>();
  const searchParams = useSearchParams();
  const id = params?.id || searchParams?.get("id") || "";
  const router = useRouter();
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();

  const isGuest = typeof window !== "undefined" && !localStorage.getItem("sw_access_token");

  const { data: product, isLoading } = useQuery<any>({
    queryKey: ["product", id],
    queryFn: async () => { const r = await api.get(`/catalog/products/${id}`); return r.data; },
    enabled: !!id,
  });

  const pathname = usePathname();

  // Fetch wishlist
  const { data: wishlist = [] } = useQuery<any[]>({
    queryKey: ["wishlist"],
    queryFn: async () => {
      const res = await api.get("/wishlist");
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !isGuest,
  });

  const wishlistItem = wishlist.find((w: any) => w.product_id === id);
  const isWishlisted = !!wishlistItem;

  // Toggle wishlist item
  const toggleWishlist = useMutation({
    mutationFn: async () => {
      if (isGuest) {
        router.push(`${resolveLink("/login")}?redirect=${encodeURIComponent(pathname)}`);
        return;
      }
      if (isWishlisted) {
        await api.delete(`/wishlist/${wishlistItem.id}`);
      } else {
        await api.post("/wishlist", { product_id: id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      success(isWishlisted ? "Removed from wishlist" : "Added to wishlist");
    },
    onError: (err: any) => showError("Failed to update wishlist", err.response?.data?.detail || err.message),
  });

  // Read backend cart
  const { data: cartData } = useQuery<any>({
    queryKey: ["cart"],
    queryFn: async () => { const r = await api.get("/cart"); return r.data; },
    enabled: typeof window !== "undefined" && !isGuest,
    staleTime: 0,
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
  const [activeImageIndex, setActiveImageIndex] = useState(0);

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
  const rating = product?.attributes?.rating ?? 0.0;
  const reviewCount = product?.attributes?.review_count ?? 0;

  const stock = product?.stock ?? product?.attributes?.quantity ?? 0;
  const isUnlimited = product?.attributes?.is_unlimited ?? false;
  const isOutOfStock = !isUnlimited && stock <= 0;

  // Guest actions
  const handleGuestAdd = () => {
    const current = getLocalGuestCart();
    const existing = current.items.find((i: any) => i.product_id === id);
    const vendorId = product?.attributes?.vendor_id || product?.vendor_id;

    const stock = product.stock ?? product.attributes?.quantity ?? 0;
    const isUnlimited = product.attributes?.is_unlimited ?? false;
    const existingQty = existing ? existing.quantity : 0;
    if (!isUnlimited && existingQty + 1 > stock) {
      showError("Out of stock", `Only ${stock} items available`);
      return;
    }

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

    const stock = product.stock ?? product.attributes?.quantity ?? 0;
    const isUnlimited = product.attributes?.is_unlimited ?? false;
    if (newQty > current.items[idx].quantity && !isUnlimited && newQty > stock) {
      showError("Insufficient stock", `Only ${stock} items available in stock.`);
      return;
    }

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

  if (!id) return <div className="text-center py-20 text-slate-500">Product ID is missing</div>;
  if (!product) return <EmptyState emoji="😕" title="Product not found" action={<Button onClick={() => router.back()}>Go Back</Button>} />;

  const features = [
    { icon: Leaf, label: "Farm Fresh", desc: "Directly sourced" },
    { icon: ShieldCheck, label: "Quality Assured", desc: "Hand-picked" },
    { icon: Truck, label: "Fast Delivery", desc: "10 minutes" },
  ];

  const imgs = product?.images || [];
  const urls: string[] = imgs.map((img: any) => resolveImageUrl(img.image_url));
  if (urls.length === 0 && product?.primary_image_url) {
    urls.push(resolveImageUrl(product.primary_image_url));
  }
  if (urls.length === 0 && product?.attributes?.image_url) {
    urls.push(resolveImageUrl(product.attributes.image_url));
  }

  return (
    <div className="max-w-2xl mx-auto font-sans">
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
        <div className="relative bg-gradient-to-br from-emerald-50 to-teal-50/20 dark:from-slate-800/50 dark:to-slate-900 rounded-3xl p-8 flex flex-col items-center justify-center overflow-hidden" style={{ minHeight: "280px" }}>
          {hasDiscount && (
            <span className="absolute top-4 left-4 bg-rose-500 text-white text-xs font-black px-2.5 py-1 rounded-full z-10">
              -{discountPct}% OFF
            </span>
          )}
          
          <div className="flex-1 w-full flex items-center justify-center h-48">
            {urls.length > 0 ? (
              <img
                src={urls[activeImageIndex]}
                alt={product.name}
                className="max-h-full max-w-full object-contain rounded-2xl transition-all duration-300"
              />
            ) : (
              <span className="text-[110px] leading-none drop-shadow-lg select-none">{emoji}</span>
            )}
          </div>

          <button
            onClick={() => toggleWishlist.mutate()}
            disabled={toggleWishlist.isPending}
            className="absolute top-4 right-4 p-2.5 bg-white dark:bg-slate-900 rounded-full shadow-md hover:scale-110 active:scale-95 transition-all text-slate-455 hover:text-rose-550 cursor-pointer z-10"
            aria-label={isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
          >
            <Heart className={`w-4 h-4 transition-colors ${isWishlisted ? "fill-rose-500 text-rose-500" : "text-slate-400"}`} />
          </button>
          <button className="absolute top-14 right-4 p-2.5 bg-white dark:bg-slate-900 rounded-full shadow-md hover:scale-110 transition-transform z-10">
            <Share2 className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Thumbnail Row */}
        {urls.length > 1 && (
          <div className="flex gap-2 justify-center py-2 overflow-x-auto">
            {urls.map((url, idx) => (
              <button
                key={url}
                onClick={() => setActiveImageIndex(idx)}
                className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                  activeImageIndex === idx ? "border-emerald-500 scale-105 shadow-md" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <img src={url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">{product.name}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{product.unit || "500g"}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-black text-slate-900 dark:text-white">₹{price.toFixed(2)}</p>
              {hasDiscount && <p className="text-sm text-slate-400 line-through">₹{mrp?.toFixed(2)}</p>}
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-2">
            <StarRating value={Math.round(rating)} />
            <span className="text-sm font-bold text-amber-600">{rating > 0 ? rating.toFixed(1) : "New"}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {reviewCount > 0 ? `(${reviewCount} reviews)` : "(No reviews yet)"}
            </span>
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
            <Link href={resolveLink("/coupons")} className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">View coupons →</Link>
          </div>
        </div>
      </div>

      {/* Sticky Add to Cart */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 md:left-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 px-4 py-3 z-30">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <div>
            <p className="text-xl font-black text-slate-900 dark:text-white">₹{price.toFixed(2)}</p>
            {hasDiscount && <p className="text-xs text-slate-400 line-through">₹{mrp?.toFixed(2)}</p>}
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
                  onClick={() => {
                    const targetQty = cartItem.quantity + 1;
                    const stock = product.stock ?? product.attributes?.quantity ?? 0;
                    const isUnlimited = product.attributes?.is_unlimited ?? false;
                    if (!isUnlimited && targetQty > stock) {
                      showError("Insufficient stock", `Only ${stock} items available in stock.`);
                      return;
                    }
                    if (isGuest) {
                      handleGuestUpdateQty(targetQty);
                    } else {
                      updateQty.mutate({ itemId: cartItem.id, qty: targetQty });
                    }
                  }}
                  className="w-8 h-8 flex items-center justify-center bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ) : isOutOfStock ? (
              <Button
                fullWidth
                size="lg"
                disabled
                className="rounded-2xl shadow-lg cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
              >
                Out of Stock
              </Button>
            ) : (
              <Button
                fullWidth
                size="lg"
                loading={!isGuest && addToCart.isPending}
                onClick={() => {
                  const stock = product.stock ?? product.attributes?.quantity ?? 0;
                  const isUnlimited = product.attributes?.is_unlimited ?? false;
                  const existingQty = cartItem ? cartItem.quantity : 0;
                  if (!isUnlimited && existingQty + 1 > stock) {
                    showError("Insufficient stock", `Only ${stock} items available in stock.`);
                    return;
                  }
                  if (isGuest) {
                    handleGuestAdd();
                  } else {
                    addToCart.mutate();
                  }
                }}
                leftIcon={<ShoppingCart className="w-5 h-5" />}
                className="rounded-2xl shadow-lg cursor-pointer"
              >
                Add to Cart
              </Button>
            )}
          </div>
          {cartItem && (
            <Link href={resolveLink("/cart")}>
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
