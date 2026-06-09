"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useRouter } from "next/navigation";
import {
  MapPin, Plus, CheckCircle2, CreditCard, Wallet, Banknote, ArrowRight,
  Loader2, Home, Briefcase, Star, Package, Truck, Shield, X, ChevronDown
} from "lucide-react";
import { Button, Badge, Spinner, EmptyState } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";
import { useForm } from "react-hook-form";

// ==================== CONFIG CHECK ====================
// Cashfree is enabled only when NEXT_PUBLIC_CASHFREE_APP_ID is set in env
const CASHFREE_APP_ID = process.env.NEXT_PUBLIC_CASHFREE_APP_ID || "";
const CASHFREE_ENABLED = Boolean(CASHFREE_APP_ID);

// ==================== ADDRESS FORM ====================
function AddressForm({ onSave, onCancel, existing }: {
  onSave: (data: any) => void; onCancel: () => void; existing?: any;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: existing || { label: "Home", full_name: "", phone: "", address_line_1: "", address_line_2: "", city: "", state: "Maharashtra", postal_code: "", is_default: false },
  });
  const [loading, setLoading] = useState(false);
  const { error: showError } = useToast();

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      let res;
      if (existing?.id) {
        res = await api.put(`/users/me/addresses/${existing.id}`, data);
      } else {
        res = await api.post("/users/me/addresses", { ...data, latitude: 19.076, longitude: 72.877 });
      }
      onSave(res.data);
    } catch (err: any) {
      showError("Failed to save address", err.response?.data?.detail || err.message);
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 animate-slide-down">
      <h3 className="font-black text-slate-900 dark:text-white text-sm">{existing ? "Edit Address" : "Add New Address"}</h3>
      <div className="flex gap-2">
        {["Home", "Work", "Other"].map(l => (
          <label key={l} className="flex-1">
            <input type="radio" value={l} {...register("label")} className="sr-only peer" />
            <div className="text-center py-2 rounded-xl border-2 text-xs font-bold cursor-pointer transition-all peer-checked:border-emerald-500 peer-checked:bg-emerald-50 dark:peer-checked:bg-emerald-950/30 peer-checked:text-emerald-700 dark:peer-checked:text-emerald-400 border-slate-200 dark:border-slate-700 text-slate-500">
              {l === "Home" ? "🏠" : l === "Work" ? "💼" : "📍"} {l}
            </div>
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Full Name *</label>
          <input {...register("full_name", { required: true })} className="input-base px-3 py-2 text-sm" placeholder="Rahul Sharma" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Phone *</label>
          <input {...register("phone", { required: true })} className="input-base px-3 py-2 text-sm" placeholder="9876543210" type="tel" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 mb-1">Address Line 1 *</label>
        <input {...register("address_line_1", { required: true })} className="input-base px-3 py-2 text-sm" placeholder="Flat/House No, Street Name" />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 mb-1">Landmark (Optional)</label>
        <input {...register("address_line_2")} className="input-base px-3 py-2 text-sm" placeholder="Near landmark..." />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">City *</label>
          <input {...register("city", { required: true })} className="input-base px-3 py-2 text-sm" placeholder="Mumbai" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">State</label>
          <input {...register("state")} className="input-base px-3 py-2 text-sm" defaultValue="Maharashtra" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">PIN *</label>
          <input {...register("postal_code", { required: true })} className="input-base px-3 py-2 text-sm" placeholder="400001" maxLength={6} />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" {...register("is_default")} className="w-4 h-4 rounded accent-emerald-500" />
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Set as default address</span>
      </label>
      <div className="flex gap-3">
        <Button type="submit" loading={loading} className="flex-1 text-sm">Save Address</Button>
        <Button type="button" variant="outline" onClick={onCancel} className="text-sm">Cancel</Button>
      </div>
    </form>
  );
}

// ==================== PAYMENT METHOD CARD ====================
function PaymentMethodCard({ selected, id, icon: Icon, label, desc, badge, onClick }: {
  selected: boolean; id: string; icon: any; label: string; desc: string; badge?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left cursor-pointer ${
      selected ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
    }`}>
      <div className={`p-2.5 rounded-xl ${selected ? "bg-emerald-100 dark:bg-emerald-950/40" : "bg-slate-100 dark:bg-slate-800"}`}>
        <Icon className={`w-5 h-5 ${selected ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-slate-900 dark:text-white">{label}</p>
          {badge && <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">{badge}</span>}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
      </div>
      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${selected ? "border-emerald-500 bg-emerald-500" : "border-slate-300 dark:border-slate-600"}`}>
        {selected && <div className="w-full h-full rounded-full flex items-center justify-center"><div className="w-2 h-2 bg-white rounded-full" /></div>}
      </div>
    </button>
  );
}

// ==================== PAGE ====================
export default function CheckoutPage() {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online" | "wallet">("cod");
  const [useWallet, setUseWallet] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any>(null);
  const [cashfreeLoading, setCashfreeLoading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sw_access_token") : null;
    if (!token) router.replace("/login?redirect=/checkout");
  }, [router]);

  // Load Cashfree SDK if enabled
  useEffect(() => {
    if (!CASHFREE_ENABLED || typeof window === "undefined") return;
    if ((window as any).Cashfree) return;
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    document.body.appendChild(script);
    return () => { try { document.body.removeChild(script); } catch { } };
  }, []);

  const { data: addresses = [], isLoading: addrLoading, refetch: refetchAddr } = useQuery<any[]>({
    queryKey: ["addresses"],
    queryFn: async () => { const r = await api.get("/users/me/addresses"); return r.data || []; },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
  });

  const { data: cartData } = useQuery<any>({
    queryKey: ["cart"],
    queryFn: async () => {
      const r = await api.get("/cart");
      if (Array.isArray(r.data)) return r.data[0] || { items: [], subtotal: 0, item_count: 0 };
      return r.data || { items: [], subtotal: 0, item_count: 0 };
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
  });

  const { data: walletData } = useQuery<any>({
    queryKey: ["wallet"],
    queryFn: async () => { const r = await api.get("/wallets/me"); return r.data || {}; },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
  });

  const { data: previewData } = useQuery<any>({
    queryKey: ["orderPreview", selectedAddress, paymentMethod, useWallet, cartData?.items],
    queryFn: async () => {
      if (!selectedAddress || !cartData?.items?.length) return null;
      const vendorId = cartData.items[0]?.vendor_id;
      const res = await api.post("/orders/preview", {
        address_id: selectedAddress, payment_method: paymentMethod, use_wallet: useWallet,
      }, { params: { vendor_id: vendorId } });
      return res.data;
    },
    enabled: typeof window !== "undefined" && !!selectedAddress && !!cartData?.items?.length,
  });

  useEffect(() => {
    if (addresses.length > 0 && !selectedAddress) {
      const def = addresses.find((a: any) => a.is_default) || addresses[0];
      setSelectedAddress(def.id);
    }
  }, [addresses, selectedAddress]);

  const subtotal = previewData ? previewData.subtotal : (cartData?.subtotal || 0);
  const deliveryFee = previewData ? previewData.delivery_charge : (subtotal >= 199 ? 0 : 20);
  const taxAmount = previewData ? previewData.tax_amount : (subtotal * 0.05);
  const packagingCharge = previewData ? previewData.packaging_charge : 5.0;
  const couponDiscount = previewData ? previewData.coupon_discount : 0.0;
  const walletBalance = walletData?.balance || 0;
  const walletDeduction = previewData ? previewData.wallet_deduction : (useWallet ? Math.min(walletBalance, subtotal + deliveryFee) : 0);
  const finalTotal = previewData ? previewData.total_amount : Math.max(0, subtotal + deliveryFee + taxAmount + packagingCharge - couponDiscount - walletDeduction);

  const launchCashfree = async (orderData: any) => {
    const { payment_session_id, cashfree_order_id } = orderData;
    if (!payment_session_id) { showError("Payment Error", "Payment session not created. Try COD instead."); return; }
    setCashfreeLoading(true);
    try {
      const cashfree = new (window as any).Cashfree({ mode: process.env.NEXT_PUBLIC_CASHFREE_ENV === "production" ? "production" : "sandbox" });
      const checkoutOptions = {
        paymentSessionId: payment_session_id,
        returnUrl: `${window.location.origin}/orders/${orderData.id}?payment=success`,
      };
      await cashfree.checkout(checkoutOptions);
      success("Payment Successful! 🎉", "Your order has been confirmed.");
      router.push(`/orders/${orderData.id}?new=1`);
    } catch (err: any) {
      showError("Payment Failed", "Cashfree payment could not be completed. Try Cash on Delivery.");
    } finally {
      setCashfreeLoading(false);
    }
  };

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!selectedAddress) throw new Error("Please select a delivery address");
      const items = cartData?.items || [];
      if (!items.length) throw new Error("Cart is empty");
      const vendorId = items[0]?.vendor_id;
      // For online via Cashfree, send "cashfree" as payment_method
      const backendPaymentMethod = paymentMethod === "online" && CASHFREE_ENABLED ? "cashfree" : paymentMethod;
      return api.post("/orders", {
        address_id: selectedAddress,
        payment_method: backendPaymentMethod,
        use_wallet: useWallet,
      }, { params: { vendor_id: vendorId } });
    },
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });

      const orderData = res.data;

      if (paymentMethod === "cod" || finalTotal <= 0) {
        success("Order Placed! 🎉", `Order #${orderData?.order_number} confirmed. Pay on delivery.`);
        router.push(`/orders/${orderData?.id}?new=1`);
      } else if (paymentMethod === "wallet" && walletDeduction >= finalTotal) {
        success("Paid via Wallet! 🎉", `₹${walletDeduction.toFixed(2)} deducted from wallet.`);
        router.push(`/orders/${orderData?.id}?new=1`);
      } else if (paymentMethod === "online" && CASHFREE_ENABLED) {
        await launchCashfree(orderData);
      } else {
        // Fallback: COD
        success("Order Placed! 🎉", `Order #${orderData?.order_number} confirmed.`);
        router.push(`/orders/${orderData?.id}?new=1`);
      }
    },
    onError: (err: any) => showError("Order failed", err.response?.data?.detail || err.message),
  });

  const payMethods = [
    { id: "cod", icon: Banknote, label: "Cash on Delivery", desc: "Pay when your order arrives", badge: "Always Available" },
    ...(CASHFREE_ENABLED ? [{ id: "online", icon: CreditCard, label: "Online Payment", desc: "UPI, Cards, Netbanking via Cashfree" }] : []),
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Checkout</h1>
        <p className="text-xs text-slate-500 mt-0.5">Review your order and choose payment</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left Panel */}
        <div className="lg:col-span-3 space-y-4">
          {/* Delivery Address */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="font-black text-slate-900 dark:text-white text-sm">Delivery Address</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowAddForm(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>
                Add New
              </Button>
            </div>

            {showAddForm && (
              <AddressForm
                existing={editingAddress}
                onSave={() => { refetchAddr(); setShowAddForm(false); setEditingAddress(null); }}
                onCancel={() => { setShowAddForm(false); setEditingAddress(null); }}
              />
            )}

            {addrLoading ? (
              <div className="flex justify-center py-6"><Spinner /></div>
            ) : addresses.length === 0 && !showAddForm ? (
              <div className="text-center py-6 space-y-3">
                <MapPin className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-sm text-slate-500">No saved addresses</p>
                <Button variant="secondary" size="sm" onClick={() => setShowAddForm(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>
                  Add Address
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {addresses.map((addr: any) => (
                  <button
                    key={addr.id}
                    onClick={() => setSelectedAddress(addr.id)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left cursor-pointer ${
                      selectedAddress === addr.id ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 ${selectedAddress === addr.id ? "border-emerald-500 bg-emerald-500" : "border-slate-300"}`}>
                      {selectedAddress === addr.id && <div className="w-full h-full flex items-center justify-center"><div className="w-2.5 h-2.5 bg-white rounded-full" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-black text-slate-800 dark:text-white">
                          {addr.label === "Home" ? "🏠" : addr.label === "Work" ? "💼" : "📍"} {addr.label}
                        </span>
                        {addr.is_default && <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">Default</span>}
                      </div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{addr.full_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                        {addr.address_line_1}{addr.address_line_2 ? `, ${addr.address_line_2}` : ""}, {addr.city} – {addr.postal_code}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">📞 {addr.phone}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="font-black text-slate-900 dark:text-white text-sm">Payment Method</h2>
            </div>

            <div className="space-y-2">
              {payMethods.map((pm) => (
                <PaymentMethodCard
                  key={pm.id}
                  selected={paymentMethod === pm.id}
                  id={pm.id}
                  icon={pm.icon}
                  label={pm.label}
                  desc={pm.desc}
                  badge={(pm as any).badge}
                  onClick={() => setPaymentMethod(pm.id as any)}
                />
              ))}
              {!CASHFREE_ENABLED && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-xl">
                  <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">Online payments via Cashfree will be available soon. Use COD for now.</p>
                </div>
              )}
            </div>

            {/* Wallet Toggle */}
            {walletBalance > 0 && paymentMethod !== "wallet" && (
              <label className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-xl cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-950/40 rounded-lg flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Use Wallet Balance</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Available: ₹{walletBalance.toFixed(2)}</p>
                  </div>
                </div>
                <input type="checkbox" checked={useWallet} onChange={e => setUseWallet(e.target.checked)} className="w-4 h-4 accent-emerald-500 rounded" />
              </label>
            )}
          </div>

          {/* Delivery Promise */}
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-2xl p-4 flex items-center gap-3">
            <Truck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-black text-emerald-900 dark:text-emerald-100">10-Minute Delivery Guarantee</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">Fresh vegetables delivered in 10 mins or free!</p>
            </div>
          </div>
        </div>

        {/* Right: Order Summary */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 lg:sticky lg:top-24">
            <h2 className="font-black text-slate-900 dark:text-white">Order Summary</h2>

            {/* Cart Items */}
            <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-hide">
              {(cartData?.items || []).map((item: any) => (
                <div key={item.id} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{item.attributes?.image_emoji || "🥬"}</span>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-white line-clamp-1">{item.product_name || item.name}</p>
                      <p className="text-[10px] text-slate-400">×{item.quantity}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-white flex-shrink-0">₹{((item.price || 30) * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* Price Breakdown */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Delivery</span>
                <span className={deliveryFee === 0 ? "text-emerald-600 font-bold" : ""}>{deliveryFee === 0 ? "FREE 🎉" : `₹${deliveryFee}`}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Packaging</span><span>₹{packagingCharge.toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Taxes (5%)</span><span>₹{taxAmount.toFixed(2)}</span></div>
              {couponDiscount > 0 && <div className="flex justify-between text-emerald-600"><span className="font-semibold">Coupon</span><span className="font-bold">-₹{couponDiscount.toFixed(2)}</span></div>}
              {walletDeduction > 0 && <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><span className="font-bold">Wallet</span><span className="font-bold">-₹{walletDeduction.toFixed(2)}</span></div>}
              <hr className="border-slate-200 dark:border-slate-800" />
              <div className="flex justify-between">
                <span className="font-black text-slate-900 dark:text-white text-sm">Total</span>
                <span className="font-black text-xl text-slate-900 dark:text-white">₹{finalTotal.toFixed(2)}</span>
              </div>
              {paymentMethod === "cod" && (
                <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] font-bold text-orange-700 dark:text-orange-400">💵 Pay ₹{finalTotal.toFixed(2)} on delivery</p>
                </div>
              )}
            </div>

            <Button
              fullWidth size="lg"
              onClick={() => placeOrder.mutate()}
              loading={placeOrder.isPending || cashfreeLoading}
              disabled={!selectedAddress || !(cartData?.items?.length) || placeOrder.isPending || cashfreeLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {paymentMethod === "cod" ? "Place Order (COD)" : paymentMethod === "wallet" ? "Pay with Wallet" : "Pay Now"}
            </Button>

            <p className="text-[10px] text-center text-slate-400">
              By placing this order you agree to our <a href="/terms" className="text-emerald-600 hover:underline">Terms</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
