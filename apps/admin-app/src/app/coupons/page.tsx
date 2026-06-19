"use client";

import React, { useState } from "react";
import { Ticket, Search, Loader2, Plus, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import AdminLayout from "@/components/AdminLayout";

export default function AdminCouponsPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState("percentage");
  const [value, setValue] = useState("10.00");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [minOrder, setMinOrder] = useState("0.00");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const { data: coupons = [], isLoading } = useQuery<any[]>({
    queryKey: ["adminCoupons"],
    queryFn: async () => {
      const res = await api.get("/admin/coupons");
      return res.data || [];
    }
  });

  const createCouponMutation = useMutation({
    mutationFn: async () => {
      const nowStr = new Date().toISOString();
      const body = {
        code: code.toUpperCase().trim(),
        name: name.trim(),
        description: desc.trim() || null,
        coupon_type: type,
        discount_value: parseFloat(value) || 0.0,
        max_discount_amount: maxDiscount ? parseFloat(maxDiscount) : null,
        min_order_amount: parseFloat(minOrder) || 0.0,
        starts_at: startsAt ? new Date(startsAt).toISOString() : nowStr,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        max_uses_per_user: 1,
      };
      return api.post("/admin/coupons", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCoupons"] });
      success("Coupon created successfully!");
      setCode("");
      setName("");
      setDesc("");
      setValue("10.00");
      setMaxDiscount("");
      setMinOrder("0.00");
      setStartsAt("");
      setExpiresAt("");
    },
    onError: (err: any) => {
      showError("Creation Failed", "Failed to create coupon: " + (err.response?.data?.detail || err.message));
    }
  });

  const deleteCouponMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/admin/coupons/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCoupons"] });
      success("Coupon deactivated!");
    },
    onError: (err: any) => {
      showError("Action Failed", "Failed to deactivate coupon: " + (err.response?.data?.detail || err.message));
    }
  });

  return (
    <AdminLayout title="Discount Coupons">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-slate-800 dark:text-slate-100 font-sans">
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Create Coupon</h3>
            <p className="text-xs text-slate-500 mt-1">Configure discount values and eligibility criteria.</p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!code.trim() || !name.trim()) return;
              createCouponMutation.mutate();
            }}
            className="space-y-4 text-xs"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase">Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MONSOON30"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase">Type *</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (₹)</option>
                  <option value="free_delivery">Free Delivery</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase">Coupon Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Special Season Discount"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase">Value *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase">Max Cap</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Optional"
                  value={maxDiscount}
                  onChange={e => setMaxDiscount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase">Min Order</label>
                <input
                  type="number"
                  step="0.01"
                  value={minOrder}
                  onChange={e => setMinOrder(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase">Starts At</label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={e => setStartsAt(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Expires At</label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={e => setExpiresAt(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase">Description</label>
              <textarea
                placeholder="e.g. Valid on order value above ₹199..."
                value={desc}
                onChange={e => setDesc(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-16 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={createCouponMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer text-xs uppercase tracking-wider"
            >
              {createCouponMutation.isPending ? "Creating..." : "Save Coupon"}
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Active Promotional Coupons</h3>
            <p className="text-xs text-slate-500 mt-1">Manage active discount codes and rules.</p>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 text-emerald-500 animate-spin" /></div>
            ) : coupons.length > 0 ? (
              coupons.map((c: any) => (
                <div key={c.id} className="p-4 border border-slate-150 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-250/30">
                        {c.code}
                      </span>
                      <span className="text-[10px] text-slate-400">{c.coupon_type}</span>
                    </div>
                    <h4 className="font-extrabold text-xs text-slate-900 dark:text-white mt-1.5">{c.name}</h4>
                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{c.description || "No description"}</p>
                    <div className="flex gap-2 text-[9px] font-mono text-slate-400 mt-1.5">
                      <span>Value: <span className="font-bold text-slate-700 dark:text-slate-300">{c.coupon_type === "percentage" ? `${c.discount_value}%` : `₹${c.discount_value}`}</span></span>
                      <span>Min Order: <span className="font-bold text-slate-700 dark:text-slate-300">₹{c.min_order_amount}</span></span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteCouponMutation.mutate(c.id)}
                    className="px-2.5 py-1 text-[10px] font-black text-rose-500 border border-rose-200 dark:border-rose-900 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 flex-shrink-0 cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">No coupons registered. Add one above.</div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
