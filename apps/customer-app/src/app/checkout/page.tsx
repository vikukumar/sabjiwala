"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useRouter } from "next/navigation";
import { MapPin, Plus, Edit2, Trash2, CheckCircle2, CreditCard, Wallet, Banknote, ArrowRight, Loader2, ChevronRight, Home, Briefcase } from "lucide-react";
import { Button, Badge, Spinner, EmptyState } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";
import { useForm } from "react-hook-form";

// ==================== ADDRESS FORM ====================
function AddressForm({ onSave, onCancel, existing }: {
  onSave: (data: any) => void;
  onCancel: () => void;
  existing?: any;
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
        res = await api.put(`/users/addresses/${existing.id}`, data);
      } else {
        res = await api.post("/users/addresses", { ...data, latitude: 19.076, longitude: 72.877 });
      }
      onSave(res.data);
    } catch (err: any) {
      showError("Failed to save address", err.response?.data?.detail || err.message);
    } finally { setLoading(false); }
  };

  const labelOptions = ["Home", "Work", "Other"];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-4 animate-slide-down">
      <h3 className="font-black text-slate-900 dark:text-white">{existing ? "Edit Address" : "Add New Address"}</h3>
      <div className="flex gap-2">
        {labelOptions.map(l => (
          <label key={l} className="flex-1">
            <input type="radio" value={l} {...register("label")} className="sr-only peer" />
            <div className="text-center py-2 rounded-xl border-2 text-sm font-bold cursor-pointer transition-all peer-checked:border-emerald-500 peer-checked:bg-emerald-50 dark:peer-checked:bg-emerald-950/30 peer-checked:text-emerald-700 dark:peer-checked:text-emerald-400 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
              {l === "Home" ? "🏠" : l === "Work" ? "💼" : "📍"} {l}
            </div>
          </label>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Full Name *</label>
          <input {...register("full_name", { required: true })} className="input-base px-3 py-2.5 text-sm" placeholder="Rahul Sharma" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Phone *</label>
          <input {...register("phone", { required: true })} className="input-base px-3 py-2.5 text-sm" placeholder="9876543210" type="tel" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Address Line 1 *</label>
        <input {...register("address_line_1", { required: true })} className="input-base px-3 py-2.5 text-sm" placeholder="Flat/House No, Street Name" />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Address Line 2</label>
        <input {...register("address_line_2")} className="input-base px-3 py-2.5 text-sm" placeholder="Landmark, Area (Optional)" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">City *</label>
          <input {...register("city", { required: true })} className="input-base px-3 py-2.5 text-sm" placeholder="Mumbai" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">State</label>
          <input {...register("state")} className="input-base px-3 py-2.5 text-sm" defaultValue="Maharashtra" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">PIN Code *</label>
          <input {...register("postal_code", { required: true })} className="input-base px-3 py-2.5 text-sm" placeholder="400001" maxLength={6} />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" {...register("is_default")} className="w-4 h-4 rounded" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Set as default address</span>
      </label>
      <div className="flex gap-3">
        <Button type="submit" loading={loading} className="flex-1">Save Address</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
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
  const queryClient = useQueryClient();

  const { data: addresses = [], isLoading: addrLoading, refetch: refetchAddr } = useQuery<any[]>({
    queryKey: ["addresses"],
    queryFn: async () => { const r = await api.get("/users/addresses"); return r.data || []; },
  });

  const { data: cartData } = useQuery<any>({
    queryKey: ["cart"],
    queryFn: async () => { const r = await api.get("/cart"); return r.data || {}; },
  });

  const { data: walletData } = useQuery<any>({
    queryKey: ["wallet"],
    queryFn: async () => { const r = await api.get("/wallets/me"); return r.data || {}; },
  });

  React.useEffect(() => {
    if (addresses.length > 0 && !selectedAddress) {
      const def = addresses.find((a: any) => a.is_default) || addresses[0];
      setSelectedAddress(def.id);
    }
  }, [addresses, selectedAddress]);

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!selectedAddress) throw new Error("Please select a delivery address");
      const items = cartData?.items || [];
      if (!items.length) throw new Error("Cart is empty");
      const vendorId = items[0]?.vendor_id;
      return api.post("/orders", {
        address_id: selectedAddress,
        payment_method: paymentMethod,
        use_wallet: useWallet,
      }, { params: { vendor_id: vendorId } });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      success("Order Placed! 🎉", `Order #${res.data?.order_number} confirmed`);
      router.push(`/orders/${res.data?.id}?new=1`);
    },
    onError: (err: any) => showError("Order failed", err.response?.data?.detail || err.message),
  });

  const subtotal = cartData?.subtotal || 0;
  const deliveryFee = subtotal >= 199 ? 0 : 20;
  const walletBalance = walletData?.balance || 0;
  const walletDeduction = useWallet ? Math.min(walletBalance, subtotal + deliveryFee) : 0;
  const finalTotal = Math.max(0, subtotal + deliveryFee - walletDeduction);

  const payMethods = [
    { id: "cod", icon: Banknote, label: "Cash on Delivery", desc: "Pay when you receive" },
    { id: "online", icon: CreditCard, label: "Online Payment", desc: "UPI, Cards, Net Banking" },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left */}
        <div className="lg:col-span-3 space-y-4">
          {/* Delivery Address */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="font-black text-slate-900 dark:text-white">Delivery Address</h2>
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
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : addresses.length === 0 && !showAddForm ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">No saved addresses</p>
                <Button variant="secondary" size="sm" onClick={() => setShowAddForm(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>
                  Add Address
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {addresses.map((addr: any) => (
                  <label key={addr.id} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="address"
                      checked={selectedAddress === addr.id}
                      onChange={() => setSelectedAddress(addr.id)}
                      className="mt-1 flex-shrink-0"
                    />
                    <div className={`flex-1 p-3 rounded-xl border-2 transition-all ${selectedAddress === addr.id ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-slate-200 dark:border-slate-700"}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={addr.label === "Home" ? "success" : "info"} size="sm">{addr.label}</Badge>
                        {addr.is_default && <Badge variant="outline" size="sm">Default</Badge>}
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{addr.full_name}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {addr.address_line_1}{addr.address_line_2 ? `, ${addr.address_line_2}` : ""}, {addr.city} — {addr.postal_code}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">📞 {addr.phone}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div className="card p-6 space-y-4">
            <h2 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Payment Method
            </h2>
            <div className="space-y-2">
              {payMethods.map((pm) => {
                const Icon = pm.icon;
                return (
                  <label key={pm.id} className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" name="payment" checked={paymentMethod === pm.id} onChange={() => setPaymentMethod(pm.id as any)} />
                    <div className={`flex-1 flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${paymentMethod === pm.id ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-slate-200 dark:border-slate-700"}`}>
                      <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <Icon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{pm.label}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{pm.desc}</p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Wallet Toggle */}
            {walletBalance > 0 && (
              <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                <div className="flex items-center gap-3">
                  <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Use Wallet Balance</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Available: ₹{walletBalance.toFixed(2)}</p>
                  </div>
                </div>
                <input type="checkbox" checked={useWallet} onChange={e => setUseWallet(e.target.checked)} className="w-4 h-4" />
              </label>
            )}
          </div>
        </div>

        {/* Right: Summary */}
        <div className="lg:col-span-2">
          <div className="card p-6 space-y-4 lg:sticky lg:top-24">
            <h2 className="font-black text-slate-900 dark:text-white">Order Summary</h2>
            <div className="space-y-2.5 text-sm">
              {(cartData?.items || []).map((item: any) => (
                <div key={item.id} className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400 truncate mr-2">{item.product_name || item.name} ×{item.quantity}</span>
                  <span className="font-semibold flex-shrink-0">₹{((item.price || 30) * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <hr className="border-slate-200 dark:border-slate-800" />
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Delivery</span><span className={deliveryFee === 0 ? "text-emerald-600 font-bold" : ""}>{deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}</span></div>
              {walletDeduction > 0 && <div className="flex justify-between"><span className="text-emerald-600 dark:text-emerald-400">Wallet</span><span className="text-emerald-600 dark:text-emerald-400 font-bold">-₹{walletDeduction.toFixed(2)}</span></div>}
              <hr className="border-slate-200 dark:border-slate-800" />
              <div className="flex justify-between">
                <span className="font-black text-slate-900 dark:text-white">Total</span>
                <span className="font-black text-xl text-slate-900 dark:text-white">₹{finalTotal.toFixed(2)}</span>
              </div>
            </div>
            <Button
              fullWidth size="lg"
              onClick={() => placeOrder.mutate()}
              loading={placeOrder.isPending}
              disabled={!selectedAddress || !(cartData?.items?.length)}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {paymentMethod === "cod" ? "Place Order" : "Pay Now"}
            </Button>
            <p className="text-xs text-center text-slate-500 dark:text-slate-400">
              By placing this order you agree to our <a href="/terms" className="text-emerald-600 hover:underline">Terms</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
