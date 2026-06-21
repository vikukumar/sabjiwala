"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, resolveImageUrl } from "@sbjiwala/shared";
import Link from "next/link";
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation";
import { resolveLink } from "@/components/AppShell";
import { Star, Plus, Minus, Heart, Share2, ChevronLeft, ShoppingCart, Truck, Leaf, ShieldCheck, ArrowRight, Tag, Menu } from "lucide-react";
import { Button, Badge, Skeleton, EmptyState } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";
import ProductCard from "@/components/ProductCard";

export default function ProductDetailClient() {
  const params = useParams<{ id?: string }>();
  const searchParams = useSearchParams();
  const id = params?.id || searchParams?.get("id") || "";
  const router = useRouter();
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();

  const isGuest = typeof window !== "undefined" && !localStorage.getItem("sw_access_token");

  // Main Product Query
  const { data: product, isLoading } = useQuery<any>({
    queryKey: ["product", id],
    queryFn: async () => {
      const r = await api.get(`/catalog/products/${id}`);
      return r.data;
    },
    enabled: !!id,
  });

  // Database Reviews Query
  const { data: reviews = [] } = useQuery<any[]>({
    queryKey: ["reviews", id],
    queryFn: async () => {
      const r = await api.get(`/catalog/products/${id}/reviews`);
      return r.data || [];
    },
    enabled: !!id,
  });

  // Ads Query (Target page: product_detail)
  const { data: ads = [] } = useQuery<any[]>({
    queryKey: ["ads", "product_detail"],
    queryFn: async () => {
      const r = await api.get(`/catalog/ads?page_target=product_detail`);
      return r.data || [];
    },
  });

  // Similar Products Query
  const categoryId = product?.category_id;
  const { data: similarRes } = useQuery<any>({
    queryKey: ["similar-products", categoryId],
    queryFn: async () => {
      const r = await api.get(`/catalog/products?category_id=${categoryId}&page_size=10`);
      return r.data;
    },
    enabled: !!categoryId,
  });
  const similarProducts = (similarRes?.data || []).filter((p: any) => p.id !== id);

  // Recommended Products Query
  const { data: recommendedRes } = useQuery<any>({
    queryKey: ["recommended-products"],
    queryFn: async () => {
      const r = await api.get(`/catalog/products?is_featured=true&page_size=10`);
      return r.data;
    },
  });
  const recommendedProducts = (recommendedRes?.data || []).filter((p: any) => p.id !== id);

  const pathname = usePathname();

  // Wishlist Query
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

  // Toggle Wishlist Mutation
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

  // Cart Query
  const { data: cartData } = useQuery<any>({
    queryKey: ["cart"],
    queryFn: async () => {
      const r = await api.get("/cart");
      return r.data;
    },
    enabled: typeof window !== "undefined" && !isGuest,
    staleTime: 0,
  });

  // Guest Cart Helpers
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

  const minOrderQty = product?.attributes?.min_order_quantity ?? 1;
  const maxOrderQty = product?.attributes?.max_order_quantity ?? 10;

  const freeDeliveryAbove = product?.attributes?.free_delivery_above ?? 199;
  const minOrderAmount = product?.attributes?.min_order_amount ?? 99;

  // Find Inline Ads (Middle / Bottom)
  const middleAd = ads.find((a: any) => a.placement === "inline" && a.position === "middle");
  const bottomAd = ads.find((a: any) => a.placement === "inline" && a.position === "bottom");

  // Guest actions
  const handleGuestAdd = () => {
    const current = getLocalGuestCart();
    const existing = current.items.find((i: any) => i.product_id === id);
    const vendorId = product?.attributes?.vendor_id || product?.vendor_id;

    const existingQty = existing ? existing.quantity : 0;
    if (!isUnlimited && existingQty + minOrderQty > stock) {
      showError("Out of stock", `Only ${stock} items available`);
      return;
    }

    if (existing) {
      existing.quantity += minOrderQty;
    } else {
      current.items.push({
        id: `guest-${id}`,
        product_id: id,
        product_name: product.name,
        quantity: minOrderQty,
        unit: product.unit || "500g",
        price: price,
        vendor_id: vendorId,
        attributes: { image_emoji: emoji }
      });
    }

    current.subtotal = current.items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
    saveLocalGuestCart(current);
    success("Added to cart! 🛒");

    if (current.items.length === 1) {
      window.dispatchEvent(new Event("trigger-notification-benefit"));
    }
  };

  const handleGuestUpdateQty = (newQty: number) => {
    const current = getLocalGuestCart();
    const idx = current.items.findIndex((i: any) => i.product_id === id);
    if (idx === -1) return;

    if (newQty < minOrderQty && newQty > 0) {
      showError("Minimum Quantity Limit", `Minimum order quantity is ${minOrderQty}`);
      return;
    }

    if (newQty > maxOrderQty) {
      showError("Maximum Quantity Limit", `Maximum order quantity is ${maxOrderQty}`);
      return;
    }

    if (!isUnlimited && newQty > stock) {
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
    mutationFn: async () =>
      api.post("/cart/items", {
        product_id: id,
        vendor_id: product?.attributes?.vendor_id,
        quantity: minOrderQty
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      success("Added to cart! 🛒");
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
    { icon: Truck, label: "Fast Delivery", desc: "Instant" },
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
    <div className="max-w-2xl mx-auto font-sans pt-2">
      {/* Sleek Top Header Bar */}
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between gap-4 rounded-b-2xl shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
          aria-label="Go Back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">
          {product.name}
        </span>
        <button
          onClick={() => window.dispatchEvent(new Event("sw_open_sidebar"))}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
          aria-label="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 pb-32 mt-4 space-y-4">
        {/* Image Gallery */}
        <div className="relative bg-gradient-to-br from-emerald-50 to-teal-50/20 dark:from-slate-800/50 dark:to-slate-900 rounded-3xl p-8 flex flex-col items-center justify-center overflow-hidden" style={{ minHeight: "280px" }}>
          {hasDiscount && (
            <span className="absolute top-4 left-4 bg-rose-500 text-white text-xs font-black px-2.5 py-1 rounded-full z-10 shadow-sm">
              -{discountPct}% OFF
            </span>
          )}

          <div className="flex-1 w-full flex items-center justify-center h-48">
            {urls.length > 0 ? (
              <img
                src={urls[activeImageIndex]}
                alt={product.name}
                className="max-h-full max-w-full object-contain rounded-2xl transition-all duration-300 transform hover:scale-105"
              />
            ) : (
              <span className="text-[110px] leading-none drop-shadow-lg select-none">{emoji}</span>
            )}
          </div>

          {/* Dot Page Indicators Overlay */}
          {urls.length > 1 && (
            <div className="absolute bottom-4 flex gap-1.5 justify-center z-10 bg-black/20 dark:bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
              {urls.map((_, idx) => (
                <span
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    activeImageIndex === idx ? "bg-white scale-125 w-2" : "bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Share & Heart Action Buttons */}
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <button
              onClick={() => toggleWishlist.mutate()}
              disabled={toggleWishlist.isPending}
              className="p-2.5 bg-white dark:bg-slate-900 rounded-full shadow-md hover:scale-110 active:scale-95 transition-all text-slate-500 hover:text-rose-500 cursor-pointer border border-slate-100 dark:border-slate-800"
              aria-label={isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
            >
              <Heart className={`w-4 h-4 transition-colors ${isWishlisted ? "fill-rose-500 text-rose-500" : "text-slate-400"}`} />
            </button>
            <button className="p-2.5 bg-white dark:bg-slate-900 rounded-full shadow-md hover:scale-110 transition-transform cursor-pointer border border-slate-100 dark:border-slate-800">
              <Share2 className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Thumbnail Row */}
        {urls.length > 1 && (
          <div className="flex gap-2 justify-center py-1 overflow-x-auto">
            {urls.map((url, idx) => (
              <button
                key={url}
                onClick={() => setActiveImageIndex(idx)}
                className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                  activeImageIndex === idx ? "border-emerald-500 scale-105 shadow-md bg-white dark:bg-slate-800" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <img src={url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Product Details Section */}
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{product.name}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{product.unit || "500g"}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xl font-bold text-slate-900 dark:text-white">₹{price.toFixed(2)}</p>
              {hasDiscount && <p className="text-xs text-slate-450 line-through">₹{mrp?.toFixed(2)}</p>}
            </div>
          </div>

          {/* Chips style Category & Sub-category */}
          <div className="flex flex-wrap gap-1.5 mt-1">
            {product.category?.name && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30">
                {product.category.name}
              </span>
            )}
            {product.attributes?.subcategory && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350">
                {product.attributes.subcategory}
              </span>
            )}
          </div>

          {/* Quantity Limits & Stock Status */}
          <div className="flex items-center justify-between border-t border-b border-slate-100 dark:border-slate-800 py-2 text-xs">
            <div className="flex gap-4 text-slate-550 dark:text-slate-405">
              <span>Min Order Qty: <strong className="font-bold text-slate-800 dark:text-slate-205">{minOrderQty}</strong></span>
              <span>Max Order Qty: <strong className="font-bold text-slate-800 dark:text-slate-205">{maxOrderQty}</strong></span>
            </div>
            <div>
              {isOutOfStock ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
                  Out of Stock
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                  In Stock
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Instant Delivery Promo Card */}
        <div className="card p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3">
          <Truck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Instant Delivery on orders above ₹{freeDeliveryAbove}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Minimum order requirement is ₹{minOrderAmount}. 🥬 Fresh vegetables harvested daily. ⚡ Direct from kisan to your kitchen.
            </p>
          </div>
        </div>

        {/* Description Section */}
        {product.description && (
          <div className="card p-5 space-y-2">
            <h2 className="font-bold text-sm text-slate-900 dark:text-white">Product Description</h2>
            <p className="text-xs text-slate-650 dark:text-slate-400 leading-relaxed font-normal">{product.description}</p>
          </div>
        )}

        {/* Nutritional Info */}
        {product.attributes?.nutritional_info && (
          <div className="card p-5 space-y-3">
            <h2 className="font-bold text-sm text-slate-900 dark:text-white">Nutritional Information</h2>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(product.attributes.nutritional_info).map(([key, val]) => (
                <div key={key} className="flex justify-between text-[11px] bg-slate-50 dark:bg-slate-850 rounded-xl px-3 py-2 border border-slate-100 dark:border-slate-800">
                  <span className="font-medium text-slate-500 dark:text-slate-400 capitalize">{key.replace(/_/g, " ")}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Middle Inline Ad Banner */}
        {middleAd && (
          <a href={middleAd.click_url || "#"} className="block rounded-2xl overflow-hidden shadow-sm hover:opacity-95 transition-opacity my-4">
            <img src={resolveImageUrl(middleAd.image_url)} alt={middleAd.name} className="w-full h-auto object-cover max-h-32 rounded-2xl" />
          </a>
        )}

        {/* Real Product Reviews Section */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="font-bold text-sm text-slate-900 dark:text-white">Ratings & Reviews</h2>
            <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-lg text-xs font-bold">
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              {rating > 0 ? rating.toFixed(1) : "New"}
            </div>
          </div>
          
          {reviews.length > 0 ? (
            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              {reviews.map((r: any) => (
                <div key={r.id} className="space-y-1.5 pb-3 border-b border-slate-100 dark:border-slate-805 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-205">
                      {r.user_name || "Verified Customer"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3 h-3 ${
                            star <= r.rating ? "fill-amber-450 text-amber-450" : "text-slate-200 dark:text-slate-700"
                          }`}
                        />
                      ))}
                    </div>
                    {r.is_verified_purchase && (
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 rounded font-bold">
                        Verified Purchase
                      </span>
                    )}
                  </div>
                  {r.comment && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                      {r.comment}
                    </p>
                  )}
                  {r.vendor_reply && (
                    <div className="mt-2 pl-3 border-l-2 border-emerald-500/30 text-[10px] text-slate-500 dark:text-slate-400 italic bg-slate-50/50 dark:bg-slate-900/50 p-1.5 rounded-r-lg">
                      <strong className="text-slate-700 dark:text-slate-300 font-bold not-italic">Vendor Response: </strong>
                      {r.vendor_reply}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-4">No reviews yet. Be the first to write a review!</p>
          )}
        </div>

        {/* Similar Products (2-Row Horizontal Scroll Grid) */}
        {similarProducts.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white px-1">Similar Products</h3>
            <div className="flex overflow-x-auto gap-4 pb-4 snap-x scrollbar-thin">
              <div className="grid grid-rows-2 grid-flow-col gap-4">
                {similarProducts.map((p: any) => (
                  <div key={p.id} className="w-[180px] snap-start">
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recommended Products (2-Row Horizontal Scroll Grid) */}
        {recommendedProducts.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white px-1">Recommended Products</h3>
            <div className="flex overflow-x-auto gap-4 pb-4 snap-x scrollbar-thin">
              <div className="grid grid-rows-2 grid-flow-col gap-4">
                {recommendedProducts.map((p: any) => (
                  <div key={p.id} className="w-[180px] snap-start">
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Inline Ad Banner */}
        {bottomAd && (
          <a href={bottomAd.click_url || "#"} className="block rounded-2xl overflow-hidden shadow-sm hover:opacity-95 transition-opacity my-4">
            <img src={resolveImageUrl(bottomAd.image_url)} alt={bottomAd.name} className="w-full h-auto object-cover max-h-32 rounded-2xl" />
          </a>
        )}
      </div>

      {/* Sticky Bottom Add to Cart Bar */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 md:left-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 px-4 py-3 z-30">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <div>
            <p className="text-lg font-bold text-slate-900 dark:text-white">₹{price.toFixed(2)}</p>
            {hasDiscount && <p className="text-xs text-slate-400 line-through">₹{mrp?.toFixed(2)}</p>}
          </div>
          <div className="flex-1">
            {cartItem ? (
              <div className="flex items-center justify-center gap-4 bg-emerald-600 text-white rounded-2xl py-2.5 px-6 shadow-md">
                <button
                  onClick={() => isGuest ? handleGuestUpdateQty(cartItem.quantity - 1) : updateQty.mutate({ itemId: cartItem.id, qty: cartItem.quantity - 1 })}
                  className="w-8 h-8 flex items-center justify-center bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-base font-bold">{cartItem.quantity}</span>
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
                className="rounded-2xl shadow-md cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
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
                  if (!isUnlimited && existingQty + minOrderQty > stock) {
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
                className="rounded-2xl shadow-md cursor-pointer"
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
