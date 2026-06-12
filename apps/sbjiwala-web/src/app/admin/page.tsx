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

type AdminTab = "overview" | "users" | "vendors" | "delivery" | "pricing" | "config" | "categories" | "coupons" | "banners" | "orders" | "liveops" | "cms" | "templates";

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

  // ordersRes is the Axios response; actual PaginatedResponse body is at .data
  const orders = ordersRes?.data?.data || [];
  const pagination = ordersRes?.data?.pagination || { page: 1, total_pages: 1, has_next: false, has_previous: false };

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
                        <div className="font-bold text-slate-950 dark:text-white">
                          {order.delivery_address?.full_name || `User #${order.user_id ? order.user_id.slice(0, 6) : "N/A"}`}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {order.delivery_address?.city || order.delivery_address?.phone || "—"}
                        </div>
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

function AdminLiveOpsPanel() {
  const { error: showError } = useToast();
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const [mapObj, setMapObj] = React.useState<any>(null);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1. Fetch Vendors
  const { data: vendors = [], refetch: refetchVendors } = useQuery<any[]>({
    queryKey: ["adminLiveOpsVendors"],
    queryFn: async () => {
      const res = await api.get("/admin/vendors");
      return res.data || [];
    },
    refetchInterval: 15000,
  });

  // 2. Fetch Delivery Boys
  const { data: deliveryBoys = [], refetch: refetchDeliveryBoys } = useQuery<any[]>({
    queryKey: ["adminLiveOpsDeliveryBoys"],
    queryFn: async () => {
      const res = await api.get("/admin/delivery-boys");
      return res.data || [];
    },
    refetchInterval: 15000,
  });

  // 3. Fetch Orders
  const { data: ordersRes, refetch: refetchOrders } = useQuery<any>({
    queryKey: ["adminLiveOpsOrders"],
    queryFn: async () => {
      return api.get("/orders", { params: { page_size: 100 } });
    },
    refetchInterval: 15000,
  });

  // ordersRes is the Axios response; actual PaginatedResponse body is at .data
  const orders = ordersRes?.data?.data || [];
  const activeOrders = (Array.isArray(orders) ? orders : []).filter((o: any) =>
    ["pending", "confirmed", "accepted", "assigned", "picked", "out_for_delivery"].includes(o.status)
  );

  React.useEffect(() => {
    if (!isMounted || typeof window === "undefined" || !mapContainerRef.current) return;

    let map: any = null;
    let active = true;

    import("leaflet").then((L) => {
      if (!active || !mapContainerRef.current) return;

      if ((mapContainerRef.current as any)._leaflet_id) {
        return;
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      map = L.map(mapContainerRef.current!).setView([19.0760, 72.9977], 12);
      
      const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
      const tileUrl = isDark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
      const tiles = L.tileLayer(tileUrl, {
        attribution: "&copy; OpenStreetMap &copy; CARTO",
        subdomains: "abcd",
        maxZoom: 20
      }).addTo(map);
      tiles.on("tileerror", () => {
        tiles.setUrl("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
      });

      setMapObj(map);
    });

    return () => {
      active = false;
      if (map) map.remove();
    };
  }, [isMounted]);

  React.useEffect(() => {
    if (!mapObj || typeof window === "undefined") return;

    import("leaflet").then((L) => {
      mapObj.eachLayer((layer: any) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.Circle) {
          mapObj.removeLayer(layer);
        }
      });

      const bounds: any[] = [];

      vendors.forEach((v: any) => {
        if (v.latitude && v.longitude) {
          const lat = parseFloat(v.latitude);
          const lng = parseFloat(v.longitude);
          bounds.push([lat, lng]);

          const storeIcon = L.divIcon({
            html: `<div style="background:#3b82f6;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🏪</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });

          L.marker([lat, lng], { icon: storeIcon })
            .addTo(mapObj)
            .bindPopup(`
              <div class="text-xs p-1 space-y-1 text-slate-800">
                <p class="font-bold text-slate-900">${v.business_name}</p>
                <p class="text-[10px] text-slate-500">${v.contact_phone || ""}</p>
                <p class="font-semibold text-emerald-600">Commission: ${(v.commission_rate * 100).toFixed(1)}%</p>
                <p class="font-semibold">Rating: ⭐ ${v.average_rating.toFixed(1)}</p>
              </div>
            `);
            
          if (v.max_delivery_distance_km) {
            L.circle([lat, lng], {
              color: "#3b82f6",
              fillColor: "#3b82f6",
              fillOpacity: 0.05,
              radius: v.max_delivery_distance_km * 1000,
              weight: 1,
              dashArray: "3 3"
            }).addTo(mapObj);
          }
        }
      });

      activeOrders.forEach((o: any) => {
        if (o.delivery_latitude && o.delivery_longitude) {
          const lat = parseFloat(o.delivery_latitude);
          const lng = parseFloat(o.delivery_longitude);
          bounds.push([lat, lng]);

          const orderIcon = L.divIcon({
            html: `<div style="background:#f43f5e;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">📦</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });

          L.marker([lat, lng], { icon: orderIcon })
            .addTo(mapObj)
            .bindPopup(`
              <div class="text-xs p-1 space-y-1 text-slate-800">
                <p class="font-bold text-slate-900">Order #${o.order_number}</p>
                <p class="font-semibold text-rose-500 uppercase tracking-wider text-[9px]">Status: ${o.status}</p>
                <p>Value: ₹${o.total_amount}</p>
                <p class="text-[10px] text-slate-500">${o.payment_method.toUpperCase()} • ${o.payment_status}</p>
              </div>
            `);

          const vendor = vendors.find((v: any) => v.id === o.vendor_id || String(v.id) === String(o.vendor_id));
          if (vendor && vendor.latitude && vendor.longitude) {
            L.polyline([[parseFloat(vendor.latitude), parseFloat(vendor.longitude)], [lat, lng]], {
              color: "#f43f5e",
              weight: 1.5,
              dashArray: "5 5",
              opacity: 0.7
            }).addTo(mapObj);
          }
        }
      });

      deliveryBoys.forEach((b: any) => {
        if (b.latitude && b.longitude) {
          const lat = parseFloat(b.latitude);
          const lng = parseFloat(b.longitude);
          bounds.push([lat, lng]);

          const emoji = b.vehicle_type === "bicycle" ? "🚲" : "🛵";
          const color = b.availability === "available" ? "#10b981" : b.availability === "busy" ? "#f59e0b" : "#ef4444";

          const driverIcon = L.divIcon({
            html: `<div style="background:${color};width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:17px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${emoji}</div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
          });

          L.marker([lat, lng], { icon: driverIcon })
            .addTo(mapObj)
            .bindPopup(`
              <div class="text-xs p-1 space-y-1 text-slate-800">
                <p class="font-bold text-slate-900">${b.name}</p>
                <p class="text-[10px] text-slate-500">${b.phone || ""}</p>
                <p class="font-semibold uppercase tracking-wider text-[9px]" style="color: ${color}">
                  ${b.availability.replace("_", " ")} (${b.status})
                </p>
                <p class="text-[10px]">Deliveries: ${b.total_deliveries} • Rating: ⭐ ${b.average_rating.toFixed(1)}</p>
              </div>
            `);
        }
      });

      if (bounds.length > 0) {
        mapObj.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    });
  }, [mapObj, vendors, deliveryBoys, orders]);

  const handleRefreshAll = () => {
    refetchVendors();
    refetchDeliveryBoys();
    refetchOrders();
  };

  const activeRiders = deliveryBoys.filter((b: any) => b.status === "active");
  const onlineRiders = activeRiders.filter((b: any) => b.availability !== "offline");

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 font-sans">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Live Operational Control Map</h3>
          <p className="text-xs text-slate-550 mt-1">Visualize and trace all partners, stores, and active shipping orders in real time.</p>
        </div>
        <button
          onClick={handleRefreshAll}
          className="bg-emerald-600 hover:bg-emerald-550 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer self-start md:self-auto"
        >
          <span>🔄 Sync Live Status</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden relative shadow-sm h-[500px]">
          <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-black uppercase text-slate-450 tracking-wider">Active Shipping Orders</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-550">Live active orders:</span>
                <span className="font-black text-rose-500">{activeOrders.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-555 font-semibold">Pending confirmation:</span>
                <span className="font-bold">{orders.filter((o: any) => o.status === "pending").length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-555 font-semibold">Assigned / Out:</span>
                <span className="font-bold">{orders.filter((o: any) => ["assigned", "picked", "out_for_delivery"].includes(o.status)).length}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-black uppercase text-slate-450 tracking-wider">Delivery Squad Status</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-550">Total active riders:</span>
                <span className="font-black text-emerald-600">{activeRiders.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-555 font-semibold">Online & ready:</span>
                <span className="font-bold text-emerald-555">{onlineRiders.filter((b: any) => b.availability === "available").length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-555 font-semibold">Busy on dispatch:</span>
                <span className="font-bold text-amber-500">{onlineRiders.filter((b: any) => ["busy", "on_delivery"].includes(b.availability)).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-555 font-semibold">Offline:</span>
                <span className="font-bold text-slate-400">{activeRiders.filter((b: any) => b.availability === "offline").length}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-black uppercase text-slate-450 tracking-wider">Vendor Stores</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-550">Approved stores:</span>
                <span className="font-black text-blue-600">{vendors.filter((v: any) => v.status === "approved").length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-555 font-semibold">Pending KYC check:</span>
                <span className="font-bold text-amber-500">{vendors.filter((v: any) => v.status === "pending").length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== ADMIN CMS PANEL ====================
function AdminCmsPanel() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Record<string, string>>({
    app_name: "",
    app_logo_url: "",
    app_primary_color: "",
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
    policy_privacy: "",
    policy_terms: "",
    policy_refund: "",
    about_us: "",
    how_it_works: ""
  });

  const { data: settings = [], isLoading } = useQuery<any[]>({
    queryKey: ["adminAllSettings"],
    queryFn: async () => {
      const res = await api.get("/admin/settings");
      return res.data || [];
    }
  });

  useEffect(() => {
    if (settings.length > 0) {
      const data: Record<string, string> = {};
      settings.forEach((s: any) => {
        data[s.key] = s.value || "";
      });
      setFormData(prev => ({ ...prev, ...data }));
    }
  }, [settings]);

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return api.patch(`/admin/settings/${key}`, { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAllSettings"] });
    }
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      for (const [key, value] of Object.entries(formData)) {
        await updateSettingMutation.mutateAsync({ key, value });
      }
      success("CMS and branding settings saved successfully!");
    } catch (err: any) {
      showError("Save Failed", err.message || "Failed to update branding settings");
    }
  };

  if (isLoading) {
    return <div className="py-12 text-center text-slate-400 font-bold animate-pulse text-xs">Loading CMS configuration...</div>;
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6 text-slate-800 dark:text-slate-100 font-sans">
      <div>
        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Branding & Policies (CMS)</h3>
        <p className="text-xs text-slate-500 mt-1">Manage public branding assets, SEO headers, and legal policy pages dynamically.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Branding Section */}
        <div className="space-y-4">
          <h4 className="font-bold text-xs text-emerald-605 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">Visual Branding</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase">App Name</label>
              <input
                type="text"
                value={formData.app_name}
                onChange={e => setFormData(p => ({ ...p, app_name: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase">Logo URL</label>
              <input
                type="text"
                value={formData.app_logo_url}
                onChange={e => setFormData(p => ({ ...p, app_logo_url: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase">Primary Brand Color (Hex)</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={formData.app_primary_color.startsWith("#") && formData.app_primary_color.length === 7 ? formData.app_primary_color : "#059669"}
                  onChange={e => setFormData(p => ({ ...p, app_primary_color: e.target.value }))}
                  className="w-10 h-10 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.app_primary_color}
                  onChange={e => setFormData(p => ({ ...p, app_primary_color: e.target.value }))}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm font-mono focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SEO Metadata */}
        <div className="space-y-4">
          <h4 className="font-bold text-xs text-blue-600 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">Global SEO Configuration</h4>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase">Meta Title</label>
              <input
                type="text"
                value={formData.seo_title}
                onChange={e => setFormData(p => ({ ...p, seo_title: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase">Meta Description</label>
              <textarea
                value={formData.seo_description}
                onChange={e => setFormData(p => ({ ...p, seo_description: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white h-20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase">Meta Keywords (Comma separated)</label>
              <input
                type="text"
                value={formData.seo_keywords}
                onChange={e => setFormData(p => ({ ...p, seo_keywords: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Policies */}
        <div className="space-y-4">
          <h4 className="font-bold text-xs text-amber-600 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">User Policies & Legal Clauses</h4>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase">About Us Content</label>
              <textarea
                value={formData.about_us}
                onChange={e => setFormData(p => ({ ...p, about_us: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white h-24"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase">How It Works Content</label>
              <textarea
                value={formData.how_it_works}
                onChange={e => setFormData(p => ({ ...p, how_it_works: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white h-24"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase">Privacy Policy</label>
              <textarea
                value={formData.policy_privacy}
                onChange={e => setFormData(p => ({ ...p, policy_privacy: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white h-32"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase">Terms & Conditions</label>
              <textarea
                value={formData.policy_terms}
                onChange={e => setFormData(p => ({ ...p, policy_terms: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white h-32"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase">Refund & Cancellation Policy</label>
              <textarea
                value={formData.policy_refund}
                onChange={e => setFormData(p => ({ ...p, policy_refund: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white h-32"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={updateSettingMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-550 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" /> Save CMS Configurations
          </button>
        </div>
      </form>
    </div>
  );
}

// ==================== ADMIN TEMPLATES PANEL ====================
function AdminTemplatesPanel() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  
  const [templateForm, setTemplateForm] = useState({
    name: "",
    in_app_title: "",
    in_app_body: "",
    email_subject: "",
    email_body: "",
    sms_body: "",
    push_title: "",
    push_body: "",
    channels: [] as string[],
    is_active: true
  });

  const { data: templates = [], isLoading } = useQuery<any[]>({
    queryKey: ["adminNotificationTemplates"],
    queryFn: async () => {
      const res = await api.get("/admin/notification-templates");
      return res.data || [];
    }
  });

  const selectedTemplate = templates.find((t: any) => t.id === selectedTemplateId);

  useEffect(() => {
    if (selectedTemplate) {
      setTemplateForm({
        name: selectedTemplate.name || "",
        in_app_title: selectedTemplate.in_app_title || "",
        in_app_body: selectedTemplate.in_app_body || "",
        email_subject: selectedTemplate.email_subject || "",
        email_body: selectedTemplate.email_body || "",
        sms_body: selectedTemplate.sms_body || "",
        push_title: selectedTemplate.push_title || "",
        push_body: selectedTemplate.push_body || "",
        channels: selectedTemplate.channels || [],
        is_active: selectedTemplate.is_active ?? true
      });
    } else if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [selectedTemplate, templates, selectedTemplateId]);

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: typeof templateForm }) => {
      return api.put(`/admin/notification-templates/${id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminNotificationTemplates"] });
      success("Notification template updated successfully!");
    },
    onError: (err: any) => {
      showError("Update Failed", err.response?.data?.detail || err.message);
    }
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateId) return;
    updateTemplateMutation.mutate({ id: selectedTemplateId, body: templateForm });
  };

  const handleChannelToggle = (channel: string) => {
    setTemplateForm(prev => {
      const channels = prev.channels.includes(channel)
        ? prev.channels.filter(c => c !== channel)
        : [...prev.channels, channel];
      return { ...prev, channels };
    });
  };

  if (isLoading) {
    return <div className="py-12 text-center text-slate-400 font-bold animate-pulse text-xs">Loading templates...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-slate-800 dark:text-slate-100 font-sans">
      {/* Sidebar - List of Templates */}
      <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Templates Registry</h3>
          <p className="text-xs text-slate-500 mt-1">Select a notification or transactional email script to edit.</p>
        </div>

        <div className="space-y-2">
          {templates.map((t: any) => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplateId(t.id)}
              className={`w-full text-left p-3.5 rounded-xl border transition-all text-xs font-bold flex flex-col gap-1.5 cursor-pointer ${
                selectedTemplateId === t.id
                  ? "bg-slate-900 dark:bg-slate-850 text-white border-transparent"
                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100 hover:dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              }`}
            >
              <div className="flex justify-between items-center w-full">
                <span className="truncate">{t.name}</span>
                <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-black ${
                  t.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/20 text-slate-500"
                }`}>
                  {t.is_active ? "Active" : "Disabled"}
                </span>
              </div>
              <span className="font-mono text-[9px] text-slate-400 font-normal">Key: {t.event_key}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Editor Form */}
      <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        {selectedTemplate ? (
          <form onSubmit={handleSave} className="space-y-6 text-xs">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Edit: {templateForm.name}</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">Event Code: {selectedTemplate.event_key}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 uppercase">Active Status</span>
                <button
                  type="button"
                  onClick={() => setTemplateForm(p => ({ ...p, is_active: !p.is_active }))}
                  className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase border transition-all ${
                    templateForm.is_active
                      ? "bg-emerald-650 text-white border-transparent"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                  }`}
                >
                  {templateForm.is_active ? "Active" : "Disabled"}
                </button>
              </div>
            </div>

            {/* Template Name */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase">Template Name *</label>
              <input
                type="text"
                required
                value={templateForm.name}
                onChange={e => setTemplateForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white font-bold"
              />
            </div>

            {/* Channels Checklist */}
            <div className="space-y-2">
              <label className="font-bold text-slate-500 uppercase">Active dispatch channels</label>
              <div className="flex flex-wrap gap-3">
                {["email", "sms", "push", "in_app"].map(ch => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => handleChannelToggle(ch)}
                    className={`px-3 py-2 rounded-xl font-bold uppercase text-[9px] tracking-wider border cursor-pointer transition-all ${
                      templateForm.channels.includes(ch)
                        ? "bg-slate-900 dark:bg-slate-850 text-white border-transparent shadow-sm"
                        : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-450 hover:bg-slate-100"
                    }`}
                  >
                    {ch.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Fields based on selected channels */}
            <div className="space-y-5">
              {templateForm.channels.includes("email") && (
                <div className="space-y-4 bg-slate-50/55 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-wider">Email template settings</h4>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-500 uppercase">Email Subject</label>
                      <input
                        type="text"
                        value={templateForm.email_subject}
                        onChange={e => setTemplateForm(p => ({ ...p, email_subject: e.target.value }))}
                        placeholder="e.g. Order #{{order_id}} confirmed!"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-500 uppercase">Email HTML/Plain Body</label>
                      <textarea
                        value={templateForm.email_body}
                        onChange={e => setTemplateForm(p => ({ ...p, email_body: e.target.value }))}
                        placeholder="Write email contents. You can use variables like {{first_name}}, {{order_id}}, {{total_amount}}."
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white h-44 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {templateForm.channels.includes("push") && (
                <div className="space-y-4 bg-slate-50/55 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-wider">Mobile push settings</h4>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-500 uppercase">Push Title</label>
                      <input
                        type="text"
                        value={templateForm.push_title}
                        onChange={e => setTemplateForm(p => ({ ...p, push_title: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-500 uppercase">Push message body</label>
                      <textarea
                        value={templateForm.push_body}
                        onChange={e => setTemplateForm(p => ({ ...p, push_body: e.target.value }))}
                        className="w-full px-4 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white h-20"
                      />
                    </div>
                  </div>
                </div>
              )}

              {templateForm.channels.includes("sms") && (
                <div className="space-y-4 bg-slate-50/55 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-wider">SMS text message settings</h4>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-500 uppercase">SMS Text Content</label>
                    <textarea
                      value={templateForm.sms_body}
                      onChange={e => setTemplateForm(p => ({ ...p, sms_body: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white h-24"
                    />
                  </div>
                </div>
              )}

              {templateForm.channels.includes("in_app") && (
                <div className="space-y-4 bg-slate-50/55 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-wider">In-App notifications panel settings</h4>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-500 uppercase">Panel notification title</label>
                      <input
                        type="text"
                        value={templateForm.in_app_title}
                        onChange={e => setTemplateForm(p => ({ ...p, in_app_title: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-500 uppercase">Panel notification body</label>
                      <textarea
                        value={templateForm.in_app_body}
                        onChange={e => setTemplateForm(p => ({ ...p, in_app_body: e.target.value }))}
                        className="w-full px-4 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white h-20"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={updateTemplateMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-555 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" /> {updateTemplateMutation.isPending ? "Saving Template..." : "Save Template Updates"}
              </button>
            </div>
          </form>
        ) : (
          <div className="py-24 text-center text-slate-400 text-xs font-semibold">Select a notification template from the list.</div>
        )}
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
                  { id: "liveops", label: "Live Operations Map", icon: Globe },
                  { id: "users", label: "User Accounts", icon: Users },
                  { id: "vendors", label: "Vendor Partners", icon: Building2 },
                  { id: "delivery", label: "Delivery Squad", icon: Truck },
                  { id: "pricing", label: "Fees & Pricing", icon: Coins },
                  { id: "config", label: "Global Settings", icon: Settings },
                  { id: "cms", label: "Branding & Policies (CMS)", icon: Globe },
                  { id: "templates", label: "Notification Templates", icon: Sparkles },
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
              { id: "liveops", label: "Live Operations Map", icon: Globe },
              { id: "users", label: "User Accounts", icon: Users },
              { id: "vendors", label: "Vendor Partners", icon: Building2 },
              { id: "delivery", label: "Delivery Squad", icon: Truck },
              { id: "pricing", label: "Fees & Pricing", icon: Coins },
              { id: "config", label: "Global Settings", icon: Settings },
              { id: "cms", label: "Branding & Policies (CMS)", icon: Globe },
              { id: "templates", label: "Notification Templates", icon: Sparkles },
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
              {activeTab === "liveops" && "Live Operations Control Map"}
              {activeTab === "users" && "User Accounts Database"}
              {activeTab === "vendors" && "Vendor Partners Directory"}
              {activeTab === "delivery" && "Delivery Partner Registrations"}
              {activeTab === "pricing" && "Platform Fees & Commission Rules"}
              {activeTab === "config" && "Application-wide Global Settings"}
              {activeTab === "cms" && "Branding, Policies & SEO (CMS)"}
              {activeTab === "templates" && "Notification & Email Templates"}
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
          {activeTab === "liveops" && (
            <AdminLiveOpsPanel />
          )}
          {activeTab === "cms" && (
            <AdminCmsPanel />
          )}
          {activeTab === "templates" && (
            <AdminTemplatesPanel />
          )}
        </main>
      </div>
    </div>
  );
}
