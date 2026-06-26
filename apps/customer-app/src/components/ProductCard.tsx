"use client";

import React, { useState, useEffect } from "react";
import { Heart, Star, Plus, Minus, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, resolveImageUrl } from "@sbjiwala/shared";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";
import { resolveLink } from "@/components/AppShell";

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

export default function ProductCard({ product }: { product: any }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const { success: showSuccess, error: showError } = useToast();

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

  // Fetch wishlist
  const { data: wishlist = [] } = useQuery<any[]>({
    queryKey: ["wishlist"],
    queryFn: async () => {
      const res = await api.get("/wishlist");
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !isGuest,
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

  const wishlistItem = wishlist.find((w: any) => w.product_id === product.id);
  const isWishlisted = !!wishlistItem;

  // Dynamic 4.5% product price customer markup
  const price = Math.round((product.attributes?.price ?? product.price ?? 30) * 1.045 * 100) / 100;
  const rawMrp = product.attributes?.mrp ?? product.mrp;
  const mrp = rawMrp ? Math.round(rawMrp * 1.045 * 100) / 100 : undefined;
  const emoji = product.attributes?.image_emoji || "🥬";
  const hasDiscount = mrp && mrp > price;
  const discountPct = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const ratingVal = product.attributes?.rating;
  const rating = ratingVal && ratingVal > 0 ? Number(ratingVal).toFixed(1) : "New";
  
  const stock = product.stock ?? product.attributes?.quantity ?? 0;
  const isUnlimited = product.attributes?.is_unlimited ?? false;
  const isOutOfStock = !isUnlimited && stock <= 0;

  const targetVendorId = product.attributes?.vendor_id || product.vendor_id || product.vendor?.id;

  // Wishlist Mutation
  const toggleWishlist = useMutation({
    mutationFn: async () => {
      if (isGuest) {
        router.push(`${resolveLink("/login")}?redirect=${encodeURIComponent(pathname)}`);
        return;
      }
      if (isWishlisted) {
        await api.delete(`/wishlist/${wishlistItem.id}`);
      } else {
        await api.post("/wishlist", { product_id: product.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      showSuccess(isWishlisted ? "Removed from wishlist" : "Added to wishlist");
    },
    onError: (err: any) => showError("Failed to update wishlist", err.response?.data?.detail || err.message),
  });

  // Guest Add to Cart
  const handleGuestAdd = () => {
    const current = getLocalGuestCart();
    const existing = current.items.find((i: any) => i.product_id === product.id);
    const vendorId = targetVendorId;

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
    
    current.subtotal = current.items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
    saveLocalGuestCart(current);

    if (current.items.length === 1) {
      window.dispatchEvent(new Event("trigger-notification-benefit"));
    }
  };

  const handleGuestUpdateQty = (newQty: number) => {
    const current = getLocalGuestCart();
    const idx = current.items.findIndex((i: any) => i.product_id === product.id);
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
      const stock = product.stock ?? product.attributes?.quantity ?? 0;
      const isUnlimited = product.attributes?.is_unlimited ?? false;
      const existingItem = currentItems?.find((i: any) => i.product_id === product.id);
      const existingQty = existingItem ? existingItem.quantity : 0;
      if (!isUnlimited && existingQty + 1 > stock) {
        showError("Insufficient stock", `Only ${stock} items available in stock.`);
        return;
      }

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
    <div className="perspective-container h-full">
      <div className="glass-ios dark:bg-slate-900/50 rounded-[24px] border border-slate-100/40 dark:border-slate-800/80 hover:border-emerald-300 dark:hover:border-emerald-700/50 hover:shadow-2xl transition-all duration-400 group overflow-hidden product-card card-3d glass-sheen flex flex-col relative shadow-sm h-full">
        
        {/* Wishlist Button (iOS style) */}
        <button
          onClick={() => toggleWishlist.mutate()}
          disabled={toggleWishlist.isPending}
          className="absolute top-3 right-3 z-10 p-2 bg-white/70 dark:bg-slate-900/70 hover:bg-white dark:hover:bg-slate-800 backdrop-blur-md rounded-full shadow-md hover:scale-110 active:scale-95 transition-all text-slate-400 hover:text-rose-500 cursor-pointer card-3d-floating"
          aria-label={isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
        >
          <Heart
            className={`w-3.5 h-3.5 transition-colors ${
              isWishlisted ? "fill-rose-500 text-rose-500" : "text-slate-450 dark:text-slate-400"
            }`}
          />
        </button>

        {/* Image & Discount Display */}
        <Link href={resolveLink(`/products/${product.id}`)} className="block card-3d-image">
          <div className="relative bg-gradient-to-br from-slate-50/50 to-emerald-50/10 dark:from-slate-800/20 dark:to-slate-900/30 h-32 flex items-center justify-center overflow-hidden rounded-t-[24px]">
            {product.primary_image_url || product.attributes?.image_url ? (
              <img
                src={resolveImageUrl(product.primary_image_url || product.attributes?.image_url)}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500 ease-out"
              />
            ) : (
              <span className="text-5xl group-hover:scale-115 transition-transform duration-500 ease-out select-none drop-shadow-lg">{emoji}</span>
            )}
            {hasDiscount && (
              <span className="absolute top-3 left-3 bg-gradient-to-r from-rose-500 to-red-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full shadow-md card-3d-floating">
                -{discountPct}% OFF
              </span>
            )}
            {isOutOfStock && (
              <span className="absolute inset-0 bg-slate-950/70 flex items-center justify-center text-white text-[10px] font-black uppercase tracking-widest card-3d-floating select-none">
                Out of Stock
              </span>
            )}
          </div>
        </Link>

        {/* Info Container */}
        <div className="p-4 flex flex-col flex-1 gap-2 justify-between card-3d-floating">
          <div>
            {/* Rating */}
            <div className="flex items-center gap-1 mb-0.5">
              <Star className="w-3 h-3 text-amber-500 fill-current animate-pulse" />
              <span className="text-[10px] font-black text-amber-600 dark:text-amber-400">{rating}</span>
            </div>

            {/* Product Name */}
            <Link href={resolveLink(`/products/${product.id}`)}>
              <h3 className="font-extrabold text-[12px] sm:text-xs text-slate-850 dark:text-slate-100 line-clamp-2 leading-tight hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                {product.name}
              </h3>
            </Link>
            
            {/* Unit / Weight */}
            <p className="text-[10px] text-slate-400 dark:text-slate-450 font-bold mt-0.5">{product.unit || "1 kg"}</p>
          </div>

          {/* Pricing & Cart controls */}
          <div className="flex items-center justify-between pt-1 gap-1 mt-auto">
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-none">
                ₹{price.toFixed(2)}
              </span>
              {hasDiscount && (
                <span className="text-[10px] text-slate-450 line-through">
                  ₹{mrp?.toFixed(2)}
                </span>
              )}
            </div>

            {cartItem ? (
              <div className="flex items-center gap-1 bg-emerald-600 dark:bg-emerald-500 text-white rounded-xl p-1 shadow-lg animate-scale-in card-3d-button">
                <button
                  onClick={() =>
                    isGuest
                      ? handleGuestUpdateQty(cartItem.quantity - 1)
                      : updateQty.mutate({ itemId: cartItem.id, qty: cartItem.quantity - 1 })
                  }
                  className="w-5.5 h-5.5 flex items-center justify-center rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-650 active:scale-90 transition-transform cursor-pointer"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="px-1 text-xs font-black min-w-[16px] text-center select-none">{cartItem.quantity}</span>
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
                  className="w-5.5 h-5.5 flex items-center justify-center rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-650 active:scale-90 transition-transform cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            ) : isOutOfStock ? (
              <button
                disabled
                className="bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 text-[9px] font-black px-3 py-2 rounded-xl border border-slate-250/50 dark:border-slate-800 uppercase tracking-widest cursor-not-allowed select-none"
              >
                OUT OF STOCK
              </button>
            ) : (
              <button
                onClick={handleAddToCartAttempt}
                disabled={!isGuest && addToCart.isPending}
                className="bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-950/20 dark:hover:bg-emerald-500 dark:text-emerald-400 dark:hover:text-white text-[10px] font-black px-4 py-2 rounded-xl border border-emerald-250 dark:border-emerald-900/40 transition-all shadow-sm active:scale-95 cursor-pointer uppercase tracking-widest card-3d-button btn-spring"
              >
                {addToCart.isPending ? "..." : "ADD"}
              </button>
            )}
          </div>
        </div>

        {/* Clear Cart Modal */}
        {showClearCartModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowClearCartModal(false)} />
            <div
              className="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-in text-center shadow-2xl text-slate-805 dark:text-white"
              style={{ zIndex: 1000 }}
            >
              <h3 className="text-base font-black uppercase tracking-wider">Replace cart items?</h3>
              <p className="text-xs text-slate-550 dark:text-slate-400 leading-normal">
                Your cart has items from another store. Do you want to discard them and add this item instead?
              </p>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="danger"
                  onClick={handleConfirmClearCart}
                  loading={!isGuest && addToCartWithClear.isPending}
                  className="flex-1 py-3 text-xs font-bold cursor-pointer rounded-xl btn-spring"
                >
                  Yes, Replace
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowClearCartModal(false)}
                  className="flex-1 py-3 text-xs font-bold cursor-pointer rounded-xl btn-spring"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
