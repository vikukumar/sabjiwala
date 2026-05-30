"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Plus, Minus, ShoppingCart, ArrowRight, Tag, AlertCircle, ChevronRight, Truck } from "lucide-react";
import { Button, EmptyState, Spinner, Badge, Skeleton } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";
import { useForm } from "react-hook-form";

// ==================== CART ITEM ROW ====================
function CartItemRow({ item }: { item: any }) {
  const queryClient = useQueryClient();
  const { error: showError } = useToast();

  const updateQty = useMutation({
    mutationFn: async (qty: number) =>
      qty <= 0 ? api.delete(`/cart/items/${item.id}`) : api.patch(`/cart/items/${item.id}`, { quantity: qty }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
    onError: (err: any) => showError("Update failed", err.response?.data?.detail || err.message),
  });

  const emoji = item.attributes?.image_emoji || item.product?.attributes?.image_emoji || "🥬";
  const price = item.price || item.product?.attributes?.price || 30;

  return (
    <div className="flex items-center gap-4 py-4 border-b border-slate-100 dark:border-slate-800 last:border-none">
      <div className="w-16 h-16 bg-gradient-to-br from-slate-50 to-emerald-50/20 dark:from-slate-800/50 dark:to-slate-900 rounded-xl flex items-center justify-center text-3xl flex-shrink-0">
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-black text-sm text-slate-900 dark:text-white line-clamp-1">{item.product_name || item.name}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.unit || "1 kg"}</p>
        <p className="text-sm font-black text-emerald-700 dark:text-emerald-400 mt-1">₹{(price * item.quantity).toFixed(2)}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 bg-emerald-600 text-white rounded-xl px-2 py-1.5 shadow-sm">
          <button
            onClick={() => updateQty.mutate(item.quantity - 1)}
            disabled={updateQty.isPending}
            className="w-6 h-6 flex items-center justify-center hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {item.quantity === 1 ? <Trash2 className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          </button>
          <span className="px-1 text-sm font-black min-w-[20px] text-center">{item.quantity}</span>
          <button
            onClick={() => updateQty.mutate(item.quantity + 1)}
            disabled={updateQty.isPending}
            className="w-6 h-6 flex items-center justify-center hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== COUPON SECTION ====================
function CouponSection({ onApply, appliedCoupon, onRemove }: {
  onApply: (code: string, discount: number) => void;
  appliedCoupon: { code: string; discount: number } | null;
  onRemove: () => void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { success, error: showError } = useToast();

  const apply = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await api.post("/coupons/validate", { code: code.trim().toUpperCase() });
      onApply(code.trim().toUpperCase(), res.data?.discount_amount || 0);
      success("Coupon applied! 🎉", `You save ₹${res.data?.discount_amount}`);
    } catch (err: any) {
      showError("Invalid coupon", err.response?.data?.detail || "This coupon cannot be applied");
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
        <button onClick={onRemove} className="text-xs font-bold text-rose-500 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20">
          Remove
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
        placeholder="Enter coupon code"
        className="input-base px-3 py-2.5 text-sm flex-1"
        onKeyDown={e => e.key === "Enter" && apply()}
      />
      <Button onClick={apply} loading={loading} variant="secondary" size="md">Apply</Button>
    </div>
  );
}

// ==================== PAGE ====================
export default function CartPage() {
  const router = useRouter();
  const { error: showError } = useToast();
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);

  const { data: cartData, isLoading } = useQuery<any>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await api.get("/cart");
      return res.data || { items: [], subtotal: 0, item_count: 0 };
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
  });

  const items = cartData?.items || [];
  const subtotal = cartData?.subtotal || 0;
  const deliveryFee = subtotal >= 199 ? 0 : 20;
  const discount = appliedCoupon?.discount || 0;
  const total = Math.max(0, subtotal + deliveryFee - discount);

  if (isLoading) {
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
        action={<Button onClick={() => router.push("/")}>Start Shopping</Button>}
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
              {items.map((item: any) => <CartItemRow key={item.id} item={item} />)}
            </div>
          </div>

          {/* Delivery info */}
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <Truck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {deliveryFee === 0 ? "🎉 Free Delivery!" : `Add ₹${199 - subtotal} more for free delivery`}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Estimated delivery in 10–15 minutes</p>
              </div>
            </div>
            {deliveryFee > 0 && (
              <div className="mt-3 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${Math.min(100, (subtotal / 199) * 100)}%` }} />
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
            />
            <Link href="/coupons" className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
              View all coupons <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-2">
          <div className="card p-6 space-y-4 lg:sticky lg:top-24">
            <h2 className="font-black text-slate-900 dark:text-white">Bill Summary</h2>
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Subtotal</span>
                <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Delivery fee</span>
                <span className={`font-semibold ${deliveryFee === 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                  {deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-600 dark:text-emerald-400">Coupon discount</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">-₹{discount.toFixed(2)}</span>
                </div>
              )}
              <hr className="border-slate-200 dark:border-slate-800" />
              <div className="flex justify-between">
                <span className="font-black text-slate-900 dark:text-white">Total</span>
                <span className="font-black text-xl text-slate-900 dark:text-white">₹{total.toFixed(2)}</span>
              </div>
            </div>
            {total >= 1 && (
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold text-center">
                You save ₹{(subtotal + deliveryFee - total).toFixed(2)} on this order!
              </div>
            )}
            <Button
              fullWidth
              size="lg"
              onClick={() => router.push("/checkout")}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Proceed to Checkout
            </Button>
            <Link href="/" className="text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline block">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
