"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Plus, Minus, ShoppingCart, ArrowRight, Tag, AlertCircle, ChevronRight, Truck } from "lucide-react";
import { resolveLink } from "@/components/AppShell";
import { Button, EmptyState, Spinner, Badge, Skeleton } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";

// ==================== LOCAL GUEST CART UTILS ====================
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

// ==================== CART ITEM ROW ====================
interface CartItemRowProps {
  item: any;
  isGuest: boolean;
  onUpdateGuestQty?: (productId: string, newQty: number) => void;
}

function CartItemRow({ item, isGuest, onUpdateGuestQty }: CartItemRowProps) {
  const queryClient = useQueryClient();
  const { error: showError } = useToast();

  const updateQty = useMutation({
    mutationFn: async (qty: number) =>
      qty <= 0 ? api.delete(`/cart/items/${item.id}`) : api.patch(`/cart/items/${item.id}`, { quantity: qty }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
    onError: (err: any) => showError("Update failed", err.response?.data?.detail || err.message),
  });

  const emoji = item.attributes?.image_emoji || item.product?.attributes?.image_emoji || "🥬";
  // Apply the dynamic 4.5% product price customer markup on item prices if they aren't pre-marked
  const rawPrice = item.price || item.product?.attributes?.price || 30;
  const price = isGuest ? rawPrice : Math.round(rawPrice * 1.045 * 100) / 100;

  const handleQtyChange = (newQty: number) => {
    const stock = item.stock ?? item.attributes?.stock ?? 0;
    const isUnlimited = item.is_unlimited ?? item.attributes?.is_unlimited ?? false;
    if (newQty > item.quantity && !isUnlimited && newQty > stock) {
      showError("Insufficient stock", `Only ${stock} items available in stock.`);
      return;
    }

    if (isGuest && onUpdateGuestQty) {
      onUpdateGuestQty(item.product_id, newQty);
    } else {
      updateQty.mutate(newQty);
    }
  };

  return (
    <div className="flex items-center gap-4 py-4 border-b border-slate-100 dark:border-slate-800 last:border-none">
      <div className="w-16 h-16 bg-gradient-to-br from-slate-50 to-emerald-50/20 dark:from-slate-800/50 dark:to-slate-900 rounded-xl flex items-center justify-center text-3xl flex-shrink-0">
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">{item.product_name || item.name}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.unit || "1 kg"}</p>
        <p className="text-sm font-black text-emerald-700 dark:text-emerald-400 mt-1">₹{(price * item.quantity).toFixed(2)}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 bg-emerald-600 text-white rounded-xl px-2 py-1.5 shadow-sm">
          <button
            onClick={() => handleQtyChange(item.quantity - 1)}
            disabled={!isGuest && updateQty.isPending}
            className="w-6 h-6 flex items-center justify-center hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {item.quantity === 1 ? <Trash2 className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          </button>
          <span className="px-1 text-sm font-black min-w-[20px] text-center">{item.quantity}</span>
          <button
            onClick={() => handleQtyChange(item.quantity + 1)}
            disabled={!isGuest && updateQty.isPending}
            className="w-6 h-6 flex items-center justify-center hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== COUPON SECTION ====================
function CouponSection({ onApply, appliedCoupon, onRemove, disabled, vendorId, subtotal }: {
  onApply: (code: string, discount: number) => void;
  appliedCoupon: { code: string; discount: number } | null;
  onRemove: () => void;
  disabled?: boolean;
  vendorId: string;
  subtotal: number;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { success, error: showError } = useToast();

  const apply = async () => {
    if (disabled) {
      showError("Guest Mode", "Please login to apply coupon discounts");
      return;
    }
    if (!code.trim() || !vendorId) return;
    setLoading(true);
    try {
      const res = await api.post("/coupons/validate", {
        code: code.trim().toUpperCase(),
        cart_total: subtotal,
        vendor_id: vendorId,
      });
      await api.post("/cart/apply-coupon", null, {
        params: { code: code.trim().toUpperCase(), vendor_id: vendorId }
      });
      onApply(code.trim().toUpperCase(), res.data?.discount || 0);
      success("Coupon applied! 🎉", `You save ₹${res.data?.discount}`);
    } catch (err: any) {
      showError("Invalid coupon", err.response?.data?.detail || "This coupon cannot be applied");
    } finally { setLoading(false); }
  };

  const remove = async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      await api.post("/cart/apply-coupon", null, {
        params: { code: "", vendor_id: vendorId }
      });
      onRemove();
      success("Coupon removed");
    } catch (err: any) {
      showError("Failed to remove coupon", err.response?.data?.detail || err.message);
    } finally { setLoading(false); }
  };

  if (appliedCoupon) {
    return (
      <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-black text-emerald-700 dark:text-emerald-400">{appliedCoupon.code}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500">You save ₹{appliedCoupon.discount}</p>
          </div>
        </div>
        <button onClick={remove} disabled={loading} className="text-xs font-bold text-rose-500 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:opacity-50 cursor-pointer">
          {loading ? "..." : "Remove"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase())}
        placeholder={disabled ? "Login to apply coupon" : "Enter coupon code"}
        disabled={disabled}
        className="input-base px-3 py-2.5 text-sm flex-1 disabled:opacity-50"
        onKeyDown={e => e.key === "Enter" && apply()}
      />
      <Button onClick={apply} loading={loading} disabled={disabled} variant="secondary" size="md">Apply</Button>
    </div>
  );
}

// ==================== CART PAGE ====================
export default function CartPage() {
  const router = useRouter();
  const { error: showError } = useToast();
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);

  const isGuest = typeof window !== "undefined" && !localStorage.getItem("sw_access_token");

  // Server cart state
  const { data: serverCart, isLoading } = useQuery<any>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await api.get("/cart");
      return res.data || { items: [], subtotal: 0, item_count: 0 };
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

  const items = isGuest ? localCart?.items || [] : serverCart?.items || [];
  const vendorId = items[0]?.vendor_id;

  const { data: previewData } = useQuery<any>({
    queryKey: ["cartPreview", items],
    queryFn: async () => {
      if (isGuest || !items.length) return null;
      const res = await api.post("/orders/preview", {
        address_id: null,
        payment_method: "cod",
        use_wallet: false,
      }, { params: { vendor_id: vendorId } });
      return res.data;
    },
    enabled: typeof window !== "undefined" && !isGuest && !!items.length,
  });

  useEffect(() => {
    if (serverCart?.coupon_code && previewData) {
      setAppliedCoupon({
        code: serverCart.coupon_code,
        discount: previewData.coupon_discount || 0
      });
    } else if (serverCart && !serverCart.coupon_code) {
      setAppliedCoupon(null);
    }
  }, [serverCart, previewData]);

  const localSubtotal = React.useMemo(() => {
    return items.reduce((acc: number, item: any) => {
      const p = item.product || item;
      const rawPrice = p.attributes?.price ?? p.price ?? 30;
      const markedUpPrice = isGuest ? rawPrice : Math.round(rawPrice * 1.045 * 100) / 100;
      return acc + (markedUpPrice * item.quantity);
    }, 0);
  }, [items, isGuest]);

  const subtotal = previewData ? previewData.subtotal : localSubtotal;
  const freeDeliveryAbove = previewData?.free_delivery_above ?? 199;
  const hasFreeDelivery = previewData ? (previewData.free_delivery_above !== null && previewData.free_delivery_above !== undefined) : true;
  const deliveryFee = previewData ? previewData.delivery_charge : (subtotal >= freeDeliveryAbove ? 0 : 20);
  const packagingCharge = previewData ? previewData.packaging_charge : 5.0;
  const taxAmount = previewData ? previewData.tax_amount : Math.round(subtotal * 0.05 * 100) / 100;
  const discount = previewData ? previewData.coupon_discount : (appliedCoupon?.discount || 0);
  const total = previewData ? previewData.total_amount : Math.round(Math.max(0, subtotal + deliveryFee + taxAmount + packagingCharge - discount) * 100) / 100;

  const savings = React.useMemo(() => {
    let itemSavings = 0;
    items.forEach((item: any) => {
      const p = item.product || item;
      const rawPrice = p.attributes?.price ?? p.price ?? 30;
      const rawMrp = p.attributes?.mrp ?? p.mrp;
      if (rawMrp && rawMrp > rawPrice) {
        const markedUpPrice = Math.round(rawPrice * 1.045 * 100) / 100;
        const markedUpMrp = Math.round(rawMrp * 1.045 * 100) / 100;
        itemSavings += (markedUpMrp - markedUpPrice) * item.quantity;
      }
    });
    itemSavings += discount;
    if (deliveryFee === 0 && subtotal >= freeDeliveryAbove) {
      itemSavings += parseFloat(previewData?.original_delivery_charge ?? 25.0);
    }
    if (packagingCharge === 0) {
      itemSavings += parseFloat(previewData?.original_packaging_charge ?? 10.0);
    }
    return Math.max(0, itemSavings);
  }, [items, discount, deliveryFee, packagingCharge, previewData, subtotal, freeDeliveryAbove]);

  const handleUpdateGuestQty = (productId: string, newQty: number) => {
    const current = getLocalGuestCart();
    const idx = current.items.findIndex((i: any) => i.product_id === productId);
    if (idx === -1) return;

    if (newQty <= 0) {
      current.items.splice(idx, 1);
    } else {
      current.items[idx].quantity = newQty;
    }

    current.subtotal = current.items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
    saveLocalGuestCart(current);
  };

  const isUnified = typeof window !== "undefined" && process.env.NEXT_PUBLIC_APP_MODE === "unified";

  const handleProceedCheckout = () => {
    if (isGuest) {
      router.push(resolveLink(`/login?redirect=${isUnified ? "/app/checkout" : "/checkout"}`));
    } else {
      router.push(resolveLink("/checkout"));
    }
  };

  if (!isGuest && isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        emoji="🛒"
        title="Your cart is empty"
        description="Add fresh vegetables and fruits to get started!"
        action={<Button onClick={() => router.push(resolveLink("/"))}>Start Shopping</Button>}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-6">My Cart</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Items */}
        <div className="lg:col-span-3 space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-black text-slate-900 dark:text-white">Items ({items.length})</h2>
              <Badge variant="success">{items.reduce((s: number, i: any) => s + i.quantity, 0)} units</Badge>
            </div>
            <div>
              {items.map((item: any) => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  isGuest={isGuest}
                  onUpdateGuestQty={handleUpdateGuestQty}
                />
              ))}
            </div>
          </div>

          {/* Delivery info */}
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <Truck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {deliveryFee === 0 
                    ? "🎉 Free Delivery!" 
                    : hasFreeDelivery 
                      ? `Add ₹${Math.max(0, freeDeliveryAbove - subtotal).toFixed(2)} more for free delivery`
                      : "Standard delivery charge is calculated based on distance"
                  }
                </p>
                <p className="text-xs text-slate-555 dark:text-slate-400">Estimated delivery in 10–15 minutes</p>
              </div>
            </div>
            {deliveryFee > 0 && hasFreeDelivery && (
              <div className="mt-3 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${Math.min(100, (subtotal / freeDeliveryAbove) * 100)}%` }} />
              </div>
            )}
          </div>

          {/* Coupon */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-black text-sm text-slate-900 dark:text-white">Apply Coupon</h3>
            </div>
            <CouponSection
              appliedCoupon={appliedCoupon}
              onApply={(code, disc) => setAppliedCoupon({ code, discount: disc })}
              onRemove={() => setAppliedCoupon(null)}
              disabled={isGuest}
              vendorId={vendorId}
              subtotal={subtotal}
            />
            {!isGuest && (
              <Link href={resolveLink("/coupons")} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
                View all coupons <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-2">
          <div className="card p-6 space-y-4 lg:sticky lg:top-24">
            <h2 className="font-black text-slate-900 dark:text-white">Bill Summary</h2>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-650 dark:text-slate-400">Subtotal</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-655 dark:text-slate-400">Delivery fee</span>
                <span className={`font-semibold ${deliveryFee === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-200"}`}>
                  {deliveryFee === 0 ? (
                    <>
                      {previewData?.original_delivery_charge && previewData.original_delivery_charge > 0 && (
                        <span className="line-through text-slate-400 mr-1.5 font-normal">
                          ₹{parseFloat(previewData.original_delivery_charge).toFixed(2)}
                        </span>
                      )}
                      FREE
                    </>
                  ) : `₹${deliveryFee.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-655 dark:text-slate-400">Packaging fee</span>
                <span className={`font-semibold ${packagingCharge === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-200"}`}>
                  {packagingCharge === 0 ? (
                    <>
                      {previewData?.original_packaging_charge && previewData.original_packaging_charge > 0 && (
                        <span className="line-through text-slate-400 mr-1.5 font-normal">
                          ₹{parseFloat(previewData.original_packaging_charge).toFixed(2)}
                        </span>
                      )}
                      FREE
                    </>
                  ) : `₹${packagingCharge.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-655 dark:text-slate-400">Taxes (5%)</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">₹{taxAmount.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-emerald-650 dark:text-emerald-400">Coupon discount</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">-₹{discount.toFixed(2)}</span>
                </div>
              )}
              <hr className="border-slate-200 dark:border-slate-800" />
              <div className="flex justify-between text-sm">
                <span className="font-black text-slate-900 dark:text-white">Total</span>
                <span className="font-black text-xl text-slate-900 dark:text-white">₹{total.toFixed(2)}</span>
              </div>
            </div>
            {savings > 0 && (
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold text-center">
                You save ₹{savings.toFixed(2)} on this order!
              </div>
            )}
            <Button
              fullWidth
              size="lg"
              onClick={handleProceedCheckout}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="cursor-pointer"
            >
              Proceed to Checkout
            </Button>
            <Link href={resolveLink("/")} className="text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline block">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
