"use client";

import React, { useState, useEffect } from "react";
import {
  Building2, Users, Receipt, Settings,
  CheckCircle2, XCircle, Database, ShieldAlert, Sparkles,
  ChevronRight, Loader2, Menu, X, Truck, UserCheck, Sliders,
  Globe, Coins, LogOut, DollarSign, AlertTriangle, ShieldCheck,
  Search, Edit, Save, Lock, Unlock, Eye, HelpCircle, ShoppingBag
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import versionInfo from "./version.json";
import { useToast } from "@/components/ui/Toast";

type AdminTab = "overview" | "users" | "vendors" | "delivery" | "pricing" | "config" | "categories" | "coupons" | "banners" | "orders";

function AdminOrdersPanel() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data: ordersRes, isLoading } = useQuery<any>({
    queryKey: ["adminOrders", statusFilter, page],
    queryFn: async () => {
      return api.get("/orders", {
        params: {
          page,
          page_size: 20,
          status: statusFilter || undefined
        }
      });
    }
  });

  const confirmOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return api.patch(`/orders/${orderId}/status`, {
        status: "confirmed",
        notes: "Confirmed by system administrator"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminOrders"] });
      queryClient.invalidateQueries({ queryKey: ["adminMetrics"] });
      success("Order confirmed successfully!");
    },
    onError: (err: any) => {
      showError("Confirmation Failed", err.response?.data?.detail || err.message);
    }
  });

  const orders = ordersRes?.data || [];
  const pagination = ordersRes?.pagination || { page: 1, total_pages: 1, has_next: false, has_previous: false };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse";
      case "confirmed":
        return "bg-blue-500/10 text-blue-500 border border-blue-500/20";
      case "accepted":
      case "packed":
      case "assigned":
        return "bg-indigo-500/10 text-indigo-555 border border-indigo-500/20";
      case "picked":
      case "out_for_delivery":
        return "bg-cyan-500/10 text-cyan-600 border border-cyan-500/20";
      case "delivered":
        return "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
      case "cancelled":
      case "failed":
        return "bg-rose-500/10 text-rose-500 border border-rose-500/20";
      default:
        return "bg-slate-500/10 text-slate-500 border border-slate-500/20";
    }
  };

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 font-sans">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">All System Orders</h3>
            <p className="text-xs text-slate-500 mt-1">Review orders and confirm pending ones to initiate vendor fulfillment.</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {[
            { id: "", label: "All Orders" },
            { id: "pending", label: "Pending Confirmation" },
            { id: "confirmed", label: "Confirmed" },
            { id: "assigned", label: "Assigned" },
            { id: "out_for_delivery", label: "Out for Delivery" },
            { id: "delivered", label: "Delivered" },
            { id: "cancelled", label: "Cancelled" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setStatusFilter(tab.id); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all border ${
                statusFilter === tab.id
                  ? "bg-slate-900 dark:bg-slate-850 text-white border-transparent"
                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 font-semibold text-xs animate-pulse">Loading orders...</div>
        ) : orders.length > 0 ? (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-850 font-black text-slate-450 uppercase tracking-wider">
                    <th className="py-3 px-2">Order ID</th>
                    <th className="py-3 px-2">Date / Time</th>
                    <th className="py-3 px-2">Customer info</th>
                    <th className="py-3 px-2">Vendor / Store</th>
                    <th className="py-3 px-2 text-right">Order Value</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2">Payment</th>
                    <th className="py-3 px-2 text-center">Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {orders.map((order: any) => (
                    <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                      <td className="py-4 px-2 font-mono font-bold text-slate-900 dark:text-white">
                        #{order.id ? order.id.slice(0, 8) : "N/A"}
                      </td>
                      <td className="py-4 px-2 text-slate-500">
                        {new Date(order.created_at).toLocaleString()}
                      </td>
                      <td className="py-4 px-2">
                        <div className="font-bold text-slate-950 dark:text-white">User #{order.user_id ? order.user_id.slice(0, 6) : "N/A"}</div>
                        <div className="text-[10px] text-slate-400">{order.phone || "No Phone"}</div>
                      </td>
                      <td className="py-4 px-2 font-semibold">
                        {order.vendor_store?.name || "N/A"}
                      </td>
                      <td className="py-4 px-2 text-right font-black text-slate-900 dark:text-white">
                        ₹{parseFloat(order.total_amount || 0).toFixed(2)}
                      </td>
                      <td className="py-4 px-2">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[9px] ${getStatusBadgeClass(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-4 px-2">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[9px] ${
                          order.payment_status === "paid"
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                        }`}>
                          {order.payment_method === "cod" ? `COD (${order.payment_status})` : `Online (${order.payment_status})`}
                        </span>
                      </td>
                      <td className="py-4 px-2 text-center">
                        {order.status === "pending" ? (
                          <button
                            onClick={() => confirmOrderMutation.mutate(order.id)}
                            disabled={confirmOrderMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all shadow-sm cursor-pointer disabled:opacity-50"
                          >
                            {confirmOrderMutation.isPending ? "Confirming..." : "Confirm Order"}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Confirmed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.total_pages > 1 && (
              <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-850">
                <span className="text-xs text-slate-500">
                  Page {pagination.page} of {pagination.total_pages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={!pagination.has_previous}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold disabled:opacity-50 cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))}
                    disabled={!pagination.has_next}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold disabled:opacity-50 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 text-xs">No orders found.</div>
        )}
      </div>
    </div>
  );
}

function AdminCategoriesPanel() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newCatParentId, setNewCatParentId] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("");

  const { data: categories = [], isLoading } = useQuery<any[]>({
    queryKey: ["adminCategories"],
    queryFn: async () => {
      const res = await api.get("/catalog/categories", {
        params: { all_levels: true }
      });
      return res.data || [];
    }
  });

  const addCategoryMutation = useMutation({
    mutationFn: async () => {
      return api.post("/products/categories", {
        name: newCatName,
        description: newCatDesc || null,
        parent_id: newCatParentId || null,
        icon: newCatIcon || null,
        is_active: true,
        sort_order: 0
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCategories"] });
      success("Category / Subcategory added to global catalog successfully!");
      setNewCatName("");
      setNewCatDesc("");
      setNewCatParentId("");
      setNewCatIcon("");
    },
    onError: (err: any) => {
      showError("Creation Failed", "Failed to create category: " + (err.response?.data?.detail || err.message));
    }
  });

  const filteredCategories = categories.filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in text-slate-800 dark:text-slate-100 font-sans">
      {/* Create Category Form */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Create Catalog Category</h3>
          <p className="text-xs text-slate-505 mt-1">Add a new category or subcategory to the database catalog.</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newCatName.trim()) return;
            addCategoryMutation.mutate();
          }}
          className="space-y-4 text-xs"
        >
          <div className="space-y-1.5">
            <label className="font-bold text-slate-500 uppercase">Category Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Root Vegetables, Fresh Exotics"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-550 uppercase">Parent Category (Optional)</label>
            <select
              value={newCatParentId}
              onChange={e => setNewCatParentId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
            >
              <option value="">None (Top-level Category)</option>
              {categories.filter((c: any) => c.parent_id === null).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400">Select a parent category if you want to create a subcategory.</p>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-500 uppercase">Description</label>
            <textarea
              placeholder="Describe the items in this category..."
              value={newCatDesc}
              onChange={e => setNewCatDesc(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-24 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-500 uppercase">Icon/Emoji (Optional)</label>
            <input
              type="text"
              placeholder="e.g. 🥦, 🥕, 🍇"
              value={newCatIcon}
              onChange={e => setNewCatIcon(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={addCategoryMutation.isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-505 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {addCategoryMutation.isPending ? "Creating Category..." : "Save Category / Subcategory"}
          </button>
        </form>
      </div>

      {/* Categories Hierarchy / List */}
      <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Active Category Hierarchy</h3>
            <p className="text-xs text-slate-550 mt-1">Browse and filter active parent categories and subcategories.</p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <input
              type="text"
              placeholder="Filter categories..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-850">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 font-semibold text-xs animate-pulse">Loading categories...</div>
          ) : filteredCategories.length > 0 ? (
            filteredCategories.map((cat: any) => (
              <div key={cat.id} className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 px-2 rounded-xl">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{cat.icon || "🥗"}</span>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {cat.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono">Slug: {cat.slug}</p>
                    </div>
                  </div>
                  {cat.description && (
                    <p className="text-xs text-slate-500 mt-1 pl-8 leading-tight">{cat.description}</p>
                  )}
                </div>
                <div>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[9px] ${
                    cat.parent_id 
                      ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
                      : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                  }`}>
                    {cat.parent_id ? "Subcategory" : "Parent"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">No categories found in the catalog.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== ADMIN COUPONS PANEL ====================
function AdminCouponsPanel() {
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in text-slate-805 dark:text-slate-100 font-sans">
      <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Create Coupon</h3>
          <p className="text-xs text-slate-550 mt-1">Configure discount values and eligibility criteria.</p>
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
              <label className="font-bold text-slate-550 uppercase">Max Cap</label>
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
              <label className="font-bold text-slate-550 uppercase">Min Order</label>
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
              <label className="font-bold text-slate-550 uppercase">Starts At</label>
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
            <label className="font-bold text-slate-550 uppercase">Description</label>
            <textarea
              placeholder="e.g. Valid on order value above ₹199..."
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-16 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={createCouponMutation.isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-505 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {createCouponMutation.isPending ? "Creating..." : "Save Coupon"}
          </button>
        </form>
      </div>

      <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Active Promo Coupons</h3>
          <p className="text-xs text-slate-550 mt-1">Manage active codes and discount rules.</p>
        </div>

        <div className="overflow-x-auto border border-slate-150 dark:border-slate-800 rounded-2xl">
          {isLoading ? (
            <div className="py-12 text-center text-slate-405 font-bold animate-pulse text-xs">Loading coupons...</div>
          ) : coupons.length > 0 ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-55 dark:bg-slate-850/50 text-slate-400 font-black border-b border-slate-200 dark:border-slate-800 uppercase">
                  <th className="p-3">Code</th>
                  <th className="p-3">Discount</th>
                  <th className="p-3">Usage</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {coupons.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                    <td className="p-3">
                      <div className="font-extrabold text-slate-900 dark:text-white">{c.code}</div>
                      <div className="text-[10px] text-slate-400">{c.name}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold">
                        {c.coupon_type === "percentage" ? `${c.discount_value}%` : `₹${c.discount_value}`}
                      </div>
                      <div className="text-[9px] text-slate-450">Min: ₹{c.min_order_amount}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-mono">{c.current_uses} uses</div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                        c.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40" : "bg-slate-100 text-slate-500 dark:bg-slate-800/40"
                      }`}>
                        {c.is_active ? "Active" : "Expired"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {c.is_active && (
                        <button
                          onClick={() => deleteCouponMutation.mutate(c.id)}
                          className="px-2.5 py-1 text-[10px] font-black text-rose-500 border border-rose-200 dark:border-rose-900 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">No active coupons created.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== ADMIN BANNERS PANEL ====================
function AdminBannersPanel() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [position, setPosition] = useState("home_top");
  const [sortOrder, setSortOrder] = useState("0");
  const [actionUrl, setActionUrl] = useState("");

  const { data: banners = [], isLoading } = useQuery<any[]>({
    queryKey: ["adminBanners"],
    queryFn: async () => {
      const res = await api.get("/admin/banners");
      return res.data || [];
    }
  });

  const createBannerMutation = useMutation({
    mutationFn: async () => {
      const body = {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        image_url: imageUrl.trim(),
        mobile_image_url: imageUrl.trim() || null,
        action_url: actionUrl.trim() || null,
        action_type: actionUrl.trim() ? "link" : "none",
        position: position,
        sort_order: parseInt(sortOrder) || 0,
      };
      return api.post("/admin/banners", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminBanners"] });
      success("Banner created successfully!");
      setTitle("");
      setSubtitle("");
      setImageUrl("");
      setActionUrl("");
      setSortOrder("0");
    },
    onError: (err: any) => {
      showError("Creation Failed", "Failed to create banner: " + (err.response?.data?.detail || err.message));
    }
  });

  const deleteBannerMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/admin/banners/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminBanners"] });
      success("Banner deleted successfully!");
    },
    onError: (err: any) => {
      showError("Deletion Failed", "Failed to delete banner: " + (err.response?.data?.detail || err.message));
    }
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in text-slate-805 dark:text-slate-100 font-sans">
      <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Add Banner Ad</h3>
          <p className="text-xs text-slate-500 mt-1">Configure layout banners for express home slide display.</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim() || !imageUrl.trim()) return;
            createBannerMutation.mutate();
          }}
          className="space-y-4 text-xs"
        >
          <div className="space-y-1.5">
            <label className="font-bold text-slate-550 uppercase">Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Monsoon Fruits Sale"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-550 uppercase">Subtitle</label>
            <input
              type="text"
              placeholder="e.g. Flat 15% off on organic apples"
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-550 uppercase">Banner Image URL *</label>
            <input
              type="text"
              required
              placeholder="e.g. /banners/monsoon_fruits.png"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-550 uppercase">Layout Position</label>
              <select
                value={position}
                onChange={e => setPosition(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              >
                <option value="home_top">Home Carousel (Top)</option>
                <option value="home_middle">Home Banner (Middle)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-slate-550 uppercase">Sort Order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-550 uppercase">Redirect Action URL</label>
            <input
              type="text"
              placeholder="e.g. /search?q=organic"
              value={actionUrl}
              onChange={e => setActionUrl(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={createBannerMutation.isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-555 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {createBannerMutation.isPending ? "Creating..." : "Save Banner"}
          </button>
        </form>
      </div>

      <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Active Promotional Banners</h3>
          <p className="text-xs text-slate-550 mt-1">Manage carousel sequence and visual banners.</p>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 font-bold animate-pulse text-xs">Loading banners...</div>
          ) : banners.length > 0 ? (
            banners.map((b: any) => (
              <div key={b.id} className="p-4 border border-slate-150 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-14 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200/50 dark:border-slate-700 flex-shrink-0 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                    {b.image_url.startsWith("http") || b.image_url.startsWith("/") ? (
                      <img src={b.image_url} alt={b.title} className="w-full h-full object-cover" />
                    ) : (
                      "Image"
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">{b.title}</h4>
                    <p className="text-[10px] text-slate-400 truncate">{b.subtitle || "No subtitle"}</p>
                    <div className="flex gap-2 text-[9px] font-mono text-slate-450 mt-1">
                      <span>Pos: <span className="font-bold text-slate-755 dark:text-slate-350">{b.position}</span></span>
                      <span>Order: <span className="font-bold text-slate-755 dark:text-slate-350">{b.sort_order}</span></span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteBannerMutation.mutate(b.id)}
                  className="px-2.5 py-1 text-[10px] font-black text-rose-500 border border-rose-200 dark:border-rose-900 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 flex-shrink-0"
                >
                  Delete
                </button>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">No banners registered. Add top home carousels above.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Search & Filter state
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [deliverySearch, setDeliverySearch] = useState("");

  // Edit Modals / Forms state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserRole, setEditUserRole] = useState("customer");

  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [editVendorData, setEditVendorData] = useState({
    commission_rate: 0.0,
    business_name: "",
    business_type: "individual",
    description: "",
    gst_number: "",
    pan_number: "",
    fssai_number: "",
    min_order_amount: 0.0,
    free_delivery_above: 0.0,
    base_delivery_charge: 0.0,
    per_km_charge: 0.0,
    max_delivery_distance_km: 10.0,
    packaging_fee: 0.0,
    free_platform_fee_above: 0.0
  });

  // Global settings state
  const [globalConfig, setGlobalConfig] = useState({
    app_name: "Sbjiwala",
    maintenance_mode: "false",
    platform_handling_fee: "5.00",
    free_platform_fee_above: "199.00",
    delivery_boy_rate_per_km: "10.00",
    subscription_bronze_price: "199",
    subscription_silver_price: "499",
    subscription_gold_price: "999",
    inventory_max_limit: "500"
  });

  useEffect(() => {
    setMounted(true);
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("sw_theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const [checkingSetup, setCheckingSetup] = useState(true);

  // Route Protection & Installation Check
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkInstallationAndToken = async () => {
      try {
        const res = await api.get("/installation/status");
        if (res.success && res.data) {
          const adminAccount = res.data.admin_account;
          if (adminAccount && !adminAccount.is_completed) {
            window.location.href = "/admin/setup";
            return;
          }
        }
      } catch (err) {
        console.error("Failed to check installation status", err);
      }

      if (!localStorage.getItem("sw_access_token")) {
        window.location.href = "/admin/login";
      } else {
        setCheckingSetup(false);
      }
    };

    checkInstallationAndToken();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("sw_access_token");
    localStorage.removeItem("sw_refresh_token");
    window.location.href = "/admin/login";
  };

  // ==================== QUERIES ====================

  // Platform metrics
  const { data: metricsData } = useQuery<any>({
    queryKey: ["adminMetrics"],
    queryFn: async () => {
      const res = await api.get("/admin/metrics");
      return res.data;
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // Pending KYC applications
  const { data: pendingVendors = [], isLoading: pendingVendorsLoading } = useQuery<any[]>({
    queryKey: ["pendingVendors"],
    queryFn: async () => {
      const res = await api.get("/admin/vendors/pending");
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // DB schema evolution logs
  const { data: schemaLogs = [], isLoading: logsLoading } = useQuery<any[]>({
    queryKey: ["schemaLogs"],
    queryFn: async () => {
      const res = await api.get("/admin/schema-logs");
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // Users List
  const { data: usersData = {}, isLoading: usersLoading } = useQuery<any>({
    queryKey: ["adminUsers", userRoleFilter, userSearch],
    queryFn: async () => {
      const res = await api.get("/admin/users", {
        params: {
          role: userRoleFilter || undefined,
          search: userSearch || undefined
        }
      });
      return res;
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // Vendors List
  const { data: vendorsData = [], isLoading: vendorsLoading } = useQuery<any[]>({
    queryKey: ["adminVendors", vendorSearch],
    queryFn: async () => {
      const res = await api.get("/admin/vendors", {
        params: { search: vendorSearch || undefined }
      });
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // Delivery Boys List
  const { data: deliveryBoysData = [], isLoading: deliveryBoysLoading } = useQuery<any[]>({
    queryKey: ["adminDeliveryBoys", deliverySearch],
    queryFn: async () => {
      const res = await api.get("/admin/delivery-boys", {
        params: { search: deliverySearch || undefined }
      });
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // Global system settings
  const { data: systemSettings } = useQuery<any>({
    queryKey: ["systemSettings"],
    queryFn: async () => {
      const res = await api.get("/admin/settings");
      if (res.data) {
        setGlobalConfig({
          app_name: res.data.app_name || "Sbjiwala",
          maintenance_mode: String(res.data.maintenance_mode || "false"),
          platform_handling_fee: String(res.data.platform_handling_fee || "5.00"),
          free_platform_fee_above: String(res.data.free_platform_fee_above || "199.00"),
          delivery_boy_rate_per_km: String(res.data.delivery_boy_rate_per_km || "10.00"),
          subscription_bronze_price: String(res.data.subscription_bronze_price || "199"),
          subscription_silver_price: String(res.data.subscription_silver_price || "499"),
          subscription_gold_price: String(res.data.subscription_gold_price || "999"),
          inventory_max_limit: String(res.data.inventory_max_limit || "500")
        });
      }
      return res.data;
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // ==================== MUTATIONS ====================

  // Vendor verification (Approve/Reject)
  const verifyVendorMutation = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const status = approve ? "approved" : "rejected";
      return api.post(`/admin/vendors/${id}/verify`, null, {
        params: { status }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingVendors"] });
      queryClient.invalidateQueries({ queryKey: ["adminMetrics"] });
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      success("Vendor KYC status updated successfully!");
    },
    onError: (err: any) => {
      showError("KYC Action Failed", err.response?.data?.detail || err.message);
    }
  });

  // Toggle User Status
  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      return api.patch(`/admin/users/${id}/status`, { is_active: active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      success("User access status updated successfully!");
    },
    onError: (err: any) => {
      showError("Status Update Failed", err.response?.data?.detail || err.message);
    }
  });

  // Change User Role
  const changeUserRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      return api.patch(`/admin/users/${id}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      setEditingUserId(null);
      success("User role updated and profile initialized!");
    },
    onError: (err: any) => {
      showError("Role Change Failed", err.response?.data?.detail || err.message);
    }
  });

  // Edit Vendor Settings (Commission / Details / Custom Rules)
  const updateVendorSettingsMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof editVendorData }) => {
      return api.patch(`/admin/vendors/${id}/commission`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      setEditingVendorId(null);
      success("Vendor configurations updated successfully!");
    },
    onError: (err: any) => {
      showError("Update Failed", err.response?.data?.detail || err.message);
    }
  });

  // Update Delivery Boy Status
  const updateDeliveryBoyStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return api.patch(`/admin/delivery-boys/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminDeliveryBoys"] });
      success("Delivery partner status updated!");
    },
    onError: (err: any) => {
      showError("Update Failed", err.response?.data?.detail || err.message);
    }
  });

  // Update System Settings
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return api.patch(`/admin/settings/${key}`, { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systemSettings"] });
    },
    onError: (err: any) => {
      showError("Failed to save system setting", err.message);
    }
  });

  const saveAllGlobalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      for (const [key, val] of Object.entries(globalConfig)) {
        await updateSettingMutation.mutateAsync({ key, value: val });
      }
      success("Global application configurations saved successfully!");
    } catch (err) {
      // already handles in mutation
    }
  };

  const metrics = metricsData || {
    total_revenue: 0,
    total_orders: 0,
    estimated_commission: 0,
    active_users: 0,
    active_vendors: 0
  };

  const usersList = usersData.data || [];

  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-slate-55 dark:bg-[#090d10] flex items-center justify-center font-sans">
        <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 antialiased font-sans flex transition-colors duration-200">
      
      {/* Mobile Drawer Navigation */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden font-sans">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <aside className="relative w-64 max-w-xs bg-slate-900 text-slate-350 flex flex-col justify-between p-6 border-r border-slate-850 h-full">
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="/logo_horizontal.png" alt="Logo" className="h-6 w-auto brightness-0 invert" />
                  <span className="text-[9px] uppercase tracking-wider bg-slate-800 text-slate-400 font-bold px-1.5 py-0.5 rounded">
                    Admin
                  </span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1">
                {[
                  { id: "overview", label: "Overview", icon: Sliders },
                  { id: "orders", label: "Orders Board", icon: ShoppingBag },
                  { id: "users", label: "User Accounts", icon: Users },
                  { id: "vendors", label: "Vendor Partners", icon: Building2 },
                  { id: "delivery", label: "Delivery Squad", icon: Truck },
                  { id: "pricing", label: "Fees & Pricing", icon: Coins },
                  { id: "config", label: "Global Settings", icon: Settings },
                  { id: "categories", label: "Product Categories", icon: Database },
                  { id: "coupons", label: "Discounts & Coupons", icon: Receipt },
                  { id: "banners", label: "Promotions & Banners", icon: Sparkles }
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id as AdminTab); setIsMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        activeTab === item.id 
                          ? "bg-emerald-600 text-white" 
                          : "hover:bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="space-y-4">
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-red-950/20 text-red-400 transition-all">
                <LogOut className="w-5 h-5" />
                <span>Logout Session</span>
              </button>
              <div className="bg-slate-850 rounded-xl p-4 border border-slate-800 text-xs">
                <p className="text-slate-500">Logged in as</p>
                <h4 className="font-bold text-white">System Executive</h4>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-slate-350 hidden md:flex flex-col justify-between p-6 border-r border-slate-850 flex-shrink-0">
        <div className="space-y-8">
          <div className="flex items-center gap-2">
            <img src="/logo_horizontal.png" alt="Logo" className="h-6 w-auto brightness-0 invert" />
            <span className="text-[10px] uppercase tracking-wider bg-slate-800 text-slate-400 font-bold px-2 py-0.5 rounded">
              Super Control
            </span>
          </div>

          <nav className="space-y-1">
            {[
              { id: "overview", label: "Overview Dashboard", icon: Sliders },
              { id: "orders", label: "Orders Board", icon: ShoppingBag },
              { id: "users", label: "User Accounts", icon: Users },
              { id: "vendors", label: "Vendor Partners", icon: Building2 },
              { id: "delivery", label: "Delivery Squad", icon: Truck },
              { id: "pricing", label: "Fees & Pricing", icon: Coins },
              { id: "config", label: "Global Settings", icon: Settings },
              { id: "categories", label: "Product Categories", icon: Database },
              { id: "coupons", label: "Discounts & Coupons", icon: Receipt },
              { id: "banners", label: "Promotions & Banners", icon: Sparkles }
            ].map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as AdminTab)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    activeTab === item.id 
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/10" 
                      : "hover:bg-slate-800 text-slate-450 hover:text-white"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-4">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-red-950/20 hover:text-red-300 text-red-400 transition-all">
            <LogOut className="w-5 h-5" />
            <span>Logout Session</span>
          </button>
          <div className="bg-slate-850 rounded-xl p-4 border border-slate-800 text-xs">
            <p className="text-slate-500">Logged in as</p>
            <h4 className="font-bold text-white">System Executive</h4>
            <span className="inline-block bg-emerald-500/10 text-emerald-400 text-[10px] font-extrabold px-2 py-0.5 rounded mt-1.5">
              SUPER_ADMIN
            </span>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-slate-600 font-mono">
              Sbjiwala v{versionInfo.version}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-h-screen">
        
        {/* Header bar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between shadow-sm sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 rounded-lg text-slate-500">
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
              {activeTab === "overview" && "Platform Metrics & Overview"}
              {activeTab === "orders" && "Order Management Board"}
              {activeTab === "users" && "User Accounts Database"}
              {activeTab === "vendors" && "Vendor Partners Directory"}
              {activeTab === "delivery" && "Delivery Partner Registrations"}
              {activeTab === "pricing" && "Platform Fees & Commission Rules"}
              {activeTab === "config" && "Application-wide Global Settings"}
              {activeTab === "categories" && "Product Catalog Categories"}
              {activeTab === "coupons" && "Platform Discount Coupons"}
              {activeTab === "banners" && "Layout Promotional Banners"}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 px-3 py-1.5 rounded-full">
              <ShieldCheck className="w-4 h-4" />
              <span>Operational Mode: Secure</span>
            </div>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:scale-105 transition-all border border-slate-200 dark:border-slate-700"
              title="Toggle theme mode"
            >
              {theme === "light" ? "🍋" : "🍆"}
            </button>
          </div>
        </header>

        {/* Content main */}
        <main className="flex-1 p-6 space-y-6 max-w-6xl w-full mx-auto overflow-x-hidden">

          {/* ==================== 1. TAB: OVERVIEW ==================== */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Active Vendors", value: metrics.active_vendors, icon: Building2, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20" },
                  { label: "Registered Users", value: metrics.active_users, icon: Users, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/20" },
                  { label: "Commission Collected", value: `₹${metrics.estimated_commission.toFixed(2)}`, icon: DollarSign, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20" },
                  { label: "Processed Orders", value: metrics.total_orders, icon: Receipt, color: "text-rose-600 bg-rose-50 dark:bg-rose-950/20" }
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-450 dark:text-slate-500 tracking-wider">{stat.label}</span>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">{stat.value}</h3>
                      </div>
                      <div className={`p-3 rounded-xl ${stat.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pending Vendor Verifications */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">KYC Registration Queue</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Unverified Vendor partner documents pending review</p>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-850 flex-1 overflow-y-auto max-h-[350px]">
                    {pendingVendorsLoading ? (
                      <div className="p-12 text-center text-slate-400">Loading registrations...</div>
                    ) : pendingVendors.length > 0 ? (
                      pendingVendors.map((vendor) => (
                        <div key={vendor.id} className="p-4 flex justify-between items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/10">
                          <div>
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white">{vendor.name}</h4>
                            <p className="text-xs text-slate-500">{vendor.contact}</p>
                            <span className="text-[10px] text-slate-400">Registered: {new Date(vendor.time).toLocaleDateString()}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => verifyVendorMutation.mutate({ id: vendor.id, approve: false })}
                              className="p-2 border border-slate-200 dark:border-slate-800 text-red-500 rounded-lg hover:bg-red-55/10"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => verifyVendorMutation.mutate({ id: vendor.id, approve: true })}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3.5 py-1.5 rounded-lg font-bold shadow-sm"
                            >
                              Approve
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-12 text-center text-slate-400 dark:text-slate-550 text-xs">
                        All registrations verified. Queue empty!
                      </div>
                    )}
                  </div>
                </div>

                {/* DB Evolution Logs */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Schema evolution logs</h3>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Database mutations updated automatically</p>
                    </div>
                    <Database className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-850 flex-1 overflow-y-auto max-h-[350px]">
                    {logsLoading ? (
                      <div className="p-12 text-center text-slate-400">Loading schemas...</div>
                    ) : schemaLogs.length > 0 ? (
                      schemaLogs.map((log) => (
                        <div key={log.id} className="p-4 space-y-1 hover:bg-slate-50 dark:hover:bg-slate-800/10">
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                            <span>{log.table || "SYSTEM"}</span>
                            <span>{new Date(log.date).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-xs font-mono bg-slate-50 dark:bg-slate-950 p-2 rounded-lg">
                            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold mr-1.5">[{log.type}]</span>
                            {log.desc}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="p-12 text-center text-slate-400 dark:text-slate-550 text-xs">No migration logs present.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 2. TAB: USERS ==================== */}
          {activeTab === "users" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name, phone, email..."
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <select
                    value={userRoleFilter}
                    onChange={e => setUserRoleFilter(e.target.value)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  >
                    <option value="">All Roles</option>
                    <option value="customer">Customer</option>
                    <option value="vendor">Vendor</option>
                    <option value="delivery_boy">Delivery Boy</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              {/* Users Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
                {usersLoading ? (
                  <div className="p-16 text-center text-slate-400">Loading user table...</div>
                ) : usersList.length > 0 ? (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-850/50 text-slate-400 uppercase font-black tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <th className="p-4">Name</th>
                        <th className="p-4">Contact</th>
                        <th className="p-4">Username</th>
                        <th className="p-4">Role</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                      {usersList.map((user: any) => (
                        <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                          <td className="p-4 font-bold text-slate-900 dark:text-white">
                            {user.first_name} {user.last_name}
                          </td>
                          <td className="p-4">
                            <p>{user.email || "No Email"}</p>
                            <p className="text-slate-450 dark:text-slate-500 font-semibold mt-0.5">{user.phone || "No Phone"}</p>
                          </td>
                          <td className="p-4 font-mono text-slate-500">{user.username || "—"}</td>
                          <td className="p-4">
                            {editingUserId === user.id ? (
                              <div className="flex items-center gap-1">
                                <select
                                  value={editUserRole}
                                  onChange={e => setEditUserRole(e.target.value)}
                                  className="px-2 py-1 rounded border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                >
                                  <option value="customer">Customer</option>
                                  <option value="vendor">Vendor</option>
                                  <option value="delivery_boy">Delivery Boy</option>
                                  <option value="admin">Admin</option>
                                </select>
                                <button
                                  onClick={() => changeUserRoleMutation.mutate({ id: user.id, role: editUserRole })}
                                  className="p-1 text-emerald-600 hover:text-emerald-500"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingUserId(null)}
                                  className="p-1 text-red-500"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className={`inline-block px-2.5 py-1 rounded-full font-bold uppercase tracking-wider text-[9px] ${
                                  user.user_type === "admin" || user.user_type === "super_admin"
                                    ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                                    : user.user_type === "vendor"
                                    ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                    : user.user_type === "delivery_boy"
                                    ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                    : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                                }`}>
                                  {user.user_type.replace("_", " ")}
                                </span>
                                <button
                                  onClick={() => { setEditingUserId(user.id); setEditUserRole(user.user_type); }}
                                  className="p-1 text-slate-400 hover:text-slate-650"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded font-extrabold ${
                              user.is_active ? "bg-emerald-500/10 text-emerald-650" : "bg-red-500/10 text-red-500"
                            }`}>
                              {user.is_active ? "ACTIVE" : "BLOCKED"}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => toggleUserStatusMutation.mutate({ id: user.id, active: !user.is_active })}
                              className={`px-3 py-1.5 rounded-lg border font-bold ${
                                user.is_active
                                  ? "border-red-200/50 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500"
                                  : "border-emerald-200/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-600"
                              }`}
                            >
                              {user.is_active ? "Block User" : "Activate"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-16 text-center text-slate-400 dark:text-slate-550">No users found matching search criteria.</div>
                )}
              </div>
            </div>
          )}

          {/* ==================== 3. TAB: VENDORS ==================== */}
          {activeTab === "vendors" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by store name..."
                    value={vendorSearch}
                    onChange={e => setVendorSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Vendors List Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
                {vendorsLoading ? (
                  <div className="p-16 text-center text-slate-400 font-semibold">Loading vendors directory...</div>
                ) : vendorsData.length > 0 ? (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-850/50 text-slate-400 uppercase font-black border-b border-slate-200 dark:border-slate-800">
                        <th className="p-4">Store / Business Details</th>
                        <th className="p-4">Regulatory Codes</th>
                        <th className="p-4">Commission Fee</th>
                        <th className="p-4">Store Rules</th>
                        <th className="p-4 text-center">KYC Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                      {vendorsData.map((vendor: any) => (
                        <React.Fragment key={vendor.id}>
                          <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                            <td className="p-4">
                              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">{vendor.business_name}</h4>
                              <p className="text-[10px] text-slate-450 uppercase font-black tracking-wider mt-0.5">{vendor.business_type}</p>
                              <p className="text-slate-500 mt-1">{vendor.contact_email} • {vendor.contact_phone}</p>
                            </td>
                            <td className="p-4 font-mono text-[10px] space-y-0.5">
                              <p><span className="text-slate-400 font-bold uppercase mr-1">PAN:</span> {vendor.pan_number || "—"}</p>
                              <p><span className="text-slate-400 font-bold uppercase mr-1">GST:</span> {vendor.gst_number || "—"}</p>
                              <p><span className="text-slate-400 font-bold uppercase mr-1">FSSAI:</span> {vendor.fssai_number || "—"}</p>
                            </td>
                            <td className="p-4">
                              <span className="font-bold text-sm text-slate-900 dark:text-white">{(vendor.commission_rate * 100).toFixed(1)}%</span>
                              <p className="text-[10px] text-slate-400">applied per order</p>
                            </td>
                            <td className="p-4 space-y-1">
                              <p><span className="text-slate-400">Min Order:</span> ₹{vendor.min_order_amount}</p>
                              <p><span className="text-slate-400">Base Deliv.:</span> ₹{vendor.base_delivery_charge}</p>
                              <p><span className="text-slate-400">Per-KM:</span> ₹{vendor.per_km_charge}</p>
                              <p><span className="text-slate-400">Packaging:</span> ₹{vendor.packaging_fee || 0.0}</p>
                            </td>
                            <td className="p-4 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-full font-bold uppercase text-[9px] tracking-wider ${
                                vendor.status === "approved"
                                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                  : vendor.status === "suspended"
                                  ? "bg-red-500/10 text-red-500 border border-red-500/20"
                                  : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                              }`}>
                                {vendor.status}
                              </span>
                            </td>
                            <td className="p-4 text-right space-x-1.5">
                              <button
                                onClick={() => {
                                  setEditingVendorId(vendor.id);
                                  setEditVendorData({
                                    commission_rate: vendor.commission_rate,
                                    business_name: vendor.business_name,
                                    business_type: vendor.business_type,
                                    description: vendor.description || "",
                                    gst_number: vendor.gst_number || "",
                                    pan_number: vendor.pan_number || "",
                                    fssai_number: vendor.fssai_number || "",
                                    min_order_amount: vendor.min_order_amount,
                                    free_delivery_above: vendor.free_delivery_above || 0.0,
                                    base_delivery_charge: vendor.base_delivery_charge,
                                    per_km_charge: vendor.per_km_charge,
                                    max_delivery_distance_km: vendor.max_delivery_distance_km,
                                    packaging_fee: vendor.packaging_fee || 0.0,
                                    free_platform_fee_above: vendor.free_platform_fee_above || 0.0
                                  });
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 font-bold"
                              >
                                Edit Settings
                              </button>
                            </td>
                          </tr>

                          {/* Editable Settings Inline Area */}
                          {editingVendorId === vendor.id && (
                            <tr>
                              <td colSpan={6} className="bg-slate-50 dark:bg-slate-850/30 p-6">
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    updateVendorSettingsMutation.mutate({ id: vendor.id, data: editVendorData });
                                  }}
                                  className="space-y-4"
                                >
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">Business Name</label>
                                      <input
                                        type="text"
                                        value={editVendorData.business_name}
                                        onChange={e => setEditVendorData(p => ({ ...p, business_name: e.target.value }))}
                                        className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">Commission Rate (e.g. 0.05 for 5%)</label>
                                      <input
                                        type="number"
                                        step="0.001"
                                        value={editVendorData.commission_rate}
                                        onChange={e => setEditVendorData(p => ({ ...p, commission_rate: parseFloat(e.target.value) }))}
                                        className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">PAN Number</label>
                                      <input
                                        type="text"
                                        value={editVendorData.pan_number}
                                        onChange={e => setEditVendorData(p => ({ ...p, pan_number: e.target.value }))}
                                        className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 font-mono"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">GST Number</label>
                                      <input
                                        type="text"
                                        value={editVendorData.gst_number}
                                        onChange={e => setEditVendorData(p => ({ ...p, gst_number: e.target.value }))}
                                        className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 font-mono"
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">Min. Order Amount (₹)</label>
                                      <input
                                        type="number"
                                        value={editVendorData.min_order_amount}
                                        onChange={e => setEditVendorData(p => ({ ...p, min_order_amount: parseFloat(e.target.value) }))}
                                        className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">Base Deliv. Fee (₹)</label>
                                      <input
                                        type="number"
                                        value={editVendorData.base_delivery_charge}
                                        onChange={e => setEditVendorData(p => ({ ...p, base_delivery_charge: parseFloat(e.target.value) }))}
                                        className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">Per-KM Charge (₹)</label>
                                      <input
                                        type="number"
                                        value={editVendorData.per_km_charge}
                                        onChange={e => setEditVendorData(p => ({ ...p, per_km_charge: parseFloat(e.target.value) }))}
                                        className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">Free Delivery Threshold (₹)</label>
                                      <input
                                        type="number"
                                        value={editVendorData.free_delivery_above}
                                        onChange={e => setEditVendorData(p => ({ ...p, free_delivery_above: parseFloat(e.target.value) }))}
                                        className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">Max Delivery Dist (KM)</label>
                                      <input
                                        type="number"
                                        value={editVendorData.max_delivery_distance_km}
                                        onChange={e => setEditVendorData(p => ({ ...p, max_delivery_distance_km: parseFloat(e.target.value) }))}
                                        className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">Packaging Fee (₹)</label>
                                      <input
                                        type="number"
                                        value={editVendorData.packaging_fee}
                                        onChange={e => setEditVendorData(p => ({ ...p, packaging_fee: parseFloat(e.target.value) }))}
                                        className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">Free Platform Fee Above (₹)</label>
                                      <input
                                        type="number"
                                        value={editVendorData.free_platform_fee_above}
                                        onChange={e => setEditVendorData(p => ({ ...p, free_platform_fee_above: parseFloat(e.target.value) }))}
                                        className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setEditingVendorId(null)}
                                      className="px-4 py-2 border rounded-xl bg-white dark:bg-slate-900 text-xs font-bold"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="submit"
                                      disabled={updateVendorSettingsMutation.isPending}
                                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow"
                                    >
                                      {updateVendorSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                                    </button>
                                  </div>
                                </form>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-16 text-center text-slate-400">No vendors found.</div>
                )}
              </div>
            </div>
          )}

          {/* ==================== 4. TAB: DELIVERY ==================== */}
          {activeTab === "delivery" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search couriers, license..."
                    value={deliverySearch}
                    onChange={e => setDeliverySearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Delivery Boy Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
                {deliveryBoysLoading ? (
                  <div className="p-16 text-center text-slate-400">Loading delivery squad...</div>
                ) : deliveryBoysData.length > 0 ? (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-850/50 text-slate-400 uppercase font-black border-b border-slate-200 dark:border-slate-800">
                        <th className="p-4">Rider Info</th>
                        <th className="p-4">Vehicle Specs</th>
                        <th className="p-4">License Code</th>
                        <th className="p-4">Squad Stats</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                      {deliveryBoysData.map((boy: any) => (
                        <tr key={boy.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                          <td className="p-4">
                            <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">{boy.name}</h4>
                            <p className="text-slate-500 mt-0.5">{boy.email} • {boy.phone}</p>
                          </td>
                          <td className="p-4 font-bold text-slate-700 dark:text-slate-300">
                            <p className="capitalize">{boy.vehicle_type}</p>
                            <p className="text-[10px] text-slate-400 font-mono tracking-wider">{boy.vehicle_number || "No Vehicle Plate"}</p>
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-650 dark:text-slate-400">
                            {boy.license_number || "—"}
                          </td>
                          <td className="p-4 space-y-0.5">
                            <p><span className="text-slate-400">Deliveries:</span> {boy.total_deliveries}</p>
                            <p><span className="text-slate-400">Rating:</span> ⭐ {boy.average_rating.toFixed(1)}</p>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-full font-bold uppercase text-[9px] ${
                              boy.status === "active"
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                : boy.status === "suspended"
                                ? "bg-red-500/10 text-red-500 border border-red-500/20"
                                : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                            }`}>
                              {boy.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <select
                              value={boy.status}
                              onChange={e => updateDeliveryBoyStatusMutation.mutate({ id: boy.id, status: e.target.value })}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                              <option value="suspended">Suspended</option>
                              <option value="on_leave">On Leave</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-16 text-center text-slate-400">No riders found.</div>
                )}
              </div>
            </div>
          )}

          {/* ==================== 5. TAB: PRICING & FEES ==================== */}
          {activeTab === "pricing" && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-850 pb-4">
                <h3 className="text-sm font-black uppercase text-slate-450 dark:text-slate-550 tracking-wider">Global pricing and charges configuration</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Configure global application commissions, packaging, and shipping rules</p>
              </div>

              <form onSubmit={saveAllGlobalSettings} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Packaging & Handling Fee (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={globalConfig.platform_handling_fee}
                      onChange={e => setGlobalConfig(p => ({ ...p, platform_handling_fee: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm"
                    />
                    <p className="text-[10px] text-slate-400">Flat packaging surcharge applied on all checkout customer orders.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Global Free Platform Fee Above (₹)</label>
                    <input
                      type="number"
                      step="0.01;0.1"
                      value={globalConfig.free_platform_fee_above}
                      onChange={e => setGlobalConfig(p => ({ ...p, free_platform_fee_above: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm"
                    />
                    <p className="text-[10px] text-slate-400">Order subtotal above which packaging fee is exempted globally.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Delivery Boy Rate (₹ per KM)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={globalConfig.delivery_boy_rate_per_km}
                      onChange={e => setGlobalConfig(p => ({ ...p, delivery_boy_rate_per_km: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm"
                    />
                    <p className="text-[10px] text-slate-400">Rate paid automatically to public courier agents per delivered KM.</p>
                  </div>
                </div>

                <div className="border-b border-slate-100 dark:border-slate-850 pb-4 pt-2">
                  <h3 className="text-xs font-black uppercase text-slate-450 dark:text-slate-550 tracking-wider">Subscription Tier Packages</h3>
                  <p className="text-[10px] text-slate-400">Configure month-to-month pricing packages for VIP consumers offering free shipping rules</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Bronze Package Pricing (₹)</label>
                    <input
                      type="number"
                      value={globalConfig.subscription_bronze_price}
                      onChange={e => setGlobalConfig(p => ({ ...p, subscription_bronze_price: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Silver Package Pricing (₹)</label>
                    <input
                      type="number"
                      value={globalConfig.subscription_silver_price}
                      onChange={e => setGlobalConfig(p => ({ ...p, subscription_silver_price: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Gold Package Pricing (₹)</label>
                    <input
                      type="number"
                      value={globalConfig.subscription_gold_price}
                      onChange={e => setGlobalConfig(p => ({ ...p, subscription_gold_price: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-md flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Save Pricing Settings
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ==================== 6. TAB: GLOBAL CONFIG ==================== */}
          {activeTab === "config" && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-850 pb-4">
                <h3 className="text-sm font-black uppercase text-slate-450 dark:text-slate-550 tracking-wider">Global Application Preferences</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Configure site name, debug options, catalog rules, and maintenance windows</p>
              </div>

              <form onSubmit={saveAllGlobalSettings} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Application Brand Name</label>
                    <input
                      type="text"
                      value={globalConfig.app_name}
                      onChange={e => setGlobalConfig(p => ({ ...p, app_name: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Inventory Sourcing Max Limit (Items)</label>
                    <input
                      type="number"
                      value={globalConfig.inventory_max_limit}
                      onChange={e => setGlobalConfig(p => ({ ...p, inventory_max_limit: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-bold text-slate-900 dark:text-white"
                    />
                    <p className="text-[10px] text-slate-400">Limits catalog stock entry volumes vendors can register.</p>
                  </div>
                </div>

                <div className="space-y-3 bg-red-50/20 dark:bg-red-950/10 p-5 rounded-2xl border border-red-500/10">
                  <div className="flex gap-3 items-center">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Emergency Maintenance Mode</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Toggle this setting to block customer and partner operations during backend upgrades.</p>
                    </div>
                  </div>
                  <div className="pt-2 flex gap-4">
                    <button
                      type="button"
                      onClick={() => setGlobalConfig(p => ({ ...p, maintenance_mode: "true" }))}
                      className={`px-4 py-2 text-xs font-black rounded-lg border transition-all ${
                        globalConfig.maintenance_mode === "true"
                          ? "bg-red-650 text-white border-red-700 shadow"
                          : "border-slate-200 bg-white dark:bg-slate-900"
                      }`}
                    >
                      Enable Maintenance
                    </button>
                    <button
                      type="button"
                      onClick={() => setGlobalConfig(p => ({ ...p, maintenance_mode: "false" }))}
                      className={`px-4 py-2 text-xs font-black rounded-lg border transition-all ${
                        globalConfig.maintenance_mode === "false"
                          ? "bg-emerald-650 text-white border-emerald-700 shadow"
                          : "border-slate-200 bg-white dark:bg-slate-900"
                      }`}
                    >
                      Disable Mode (Live App)
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-md flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Save Application Preferences
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === "orders" && (
            <AdminOrdersPanel />
          )}
          {activeTab === "categories" && (
            <AdminCategoriesPanel />
          )}
          {activeTab === "coupons" && (
            <AdminCouponsPanel />
          )}
          {activeTab === "banners" && (
            <AdminBannersPanel />
          )}
        </main>
      </div>
    </div>
  );
}
