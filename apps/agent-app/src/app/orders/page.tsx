"use client";

import React, { useState, useEffect } from "react";
import { ShoppingBag, Search, Loader2, ChevronDown, RefreshCw, CheckCircle2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import AgentLayout, { resolveAgentLink } from "@/components/AgentLayout";
import { useSearchParams } from "next/navigation";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border border-amber-500/20 animate-pulse",
  confirmed: "bg-blue-500/10 text-blue-600 border border-blue-500/20",
  accepted: "bg-teal-500/10 text-teal-600 border border-teal-500/20",
  packed: "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20",
  assigned: "bg-purple-500/10 text-purple-600 border border-purple-500/20",
  out_for_delivery: "bg-cyan-500/10 text-cyan-600 border border-cyan-500/20",
  picked: "bg-cyan-500/10 text-cyan-600 border border-cyan-500/20",
  delivered: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
  cancelled: "bg-rose-500/10 text-rose-600 border border-rose-500/20",
  failed: "bg-rose-500/10 text-rose-600 border border-rose-500/20",
};

function AgentOrdersPageContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams?.get("status") || "";
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const [isAvailable, setIsAvailable] = useState(true);

  // Initialize Support Agent Availability Profile
  useEffect(() => {
    api.get("/support/agent/profile").then(res => {
      if (res.data) {
        setIsAvailable(res.data.is_available);
      }
    }).catch(() => {});
  }, []);

  const toggleStatusMutation = useMutation({
    mutationFn: async (val: boolean) => {
      const res = await api.patch("/support/agent/profile", { is_available: val });
      return res.data;
    },
    onSuccess: (data) => {
      setIsAvailable(data.is_available);
      success("Status Updated", `Profile is now ${data.is_available ? "ONLINE" : "OFFLINE"}`);
    }
  });

  const { data: ordersRes, isLoading, refetch } = useQuery<any>({
    queryKey: ["agentOrders", statusFilter, search, page],
    queryFn: async () => api.get("/orders", {
      params: { page, page_size: 25, status: statusFilter || undefined, search: search || undefined },
    }),
  });

  const orders: any[] = ordersRes?.data?.data || [];
  const pagination = ordersRes?.data?.pagination || { page: 1, total_pages: 1, total: 0 };

  const confirmMutation = useMutation({
    mutationFn: async (orderId: string) => api.patch(`/orders/${orderId}/status`, { status: "confirmed", notes: "Confirmed by support agent" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["agentOrders"] }); success("Order confirmed!"); },
    onError: (err: any) => showError("Failed", err.response?.data?.detail || err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => api.patch(`/orders/${orderId}/status`, { status: "cancelled", notes: "Cancelled by support agent" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["agentOrders"] }); success("Order cancelled."); },
    onError: (err: any) => showError("Failed", err.response?.data?.detail || err.message),
  });

  const statusTabs = [
    { id: "", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "confirmed", label: "Confirmed" },
    { id: "accepted", label: "Accepted" },
    { id: "packed", label: "Packed" },
    { id: "assigned", label: "Assigned" },
    { id: "out_for_delivery", label: "Out for Delivery" },
    { id: "delivered", label: "Delivered" },
    { id: "cancelled", label: "Cancelled" },
  ];

  return (
    <AgentLayout
      title="Active Orders Monitor"
      isAvailable={isAvailable}
      onAvailabilityToggle={(val) => toggleStatusMutation.mutate(val)}
    >
      <div className="space-y-5">
        {/* Filters */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-sm">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by order number, customer name..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>
            <button onClick={() => refetch()} className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-105 dark:hover:bg-slate-800 cursor-pointer transition-all bg-transparent">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {statusTabs.map(tab => (
              <button key={tab.id} onClick={() => { setStatusFilter(tab.id); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all border ${statusFilter === tab.id ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 text-slate-800 dark:text-slate-100">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Orders</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{pagination.total || orders.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold text-amber-400 uppercase">Pending</p>
            <p className="text-2xl font-black text-amber-600">{orders.filter(o => o.status === "pending").length}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold text-emerald-400 uppercase">Delivered</p>
            <p className="text-2xl font-black text-emerald-600">{orders.filter(o => o.status === "delivered").length}</p>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden text-slate-850 dark:text-slate-200">
          {isLoading ? (
            <div className="py-20 flex items-center justify-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
          ) : orders.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-xs">No orders found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {orders.map((order: any) => (
                <div key={order.id}>
                  <div
                    className="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-all"
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  >
                    {/* Order Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-slate-900 dark:text-white">#{order.order_number}</span>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${STATUS_COLORS[order.status] || "bg-slate-100 text-slate-500"}`}>
                          {order.status}
                        </span>
                        {order.payment_method === "cod" && (
                          <span className="text-[9px] font-black bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full">COD</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {order.delivery_address?.full_name || "Customer"} • {order.vendor_store?.store_name || "Store"}
                      </p>
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-black text-slate-900 dark:text-white">₹{parseFloat(order.total_amount || 0).toFixed(2)}</p>
                      <p className="text-[10px] text-slate-400">{new Date(order.created_at).toLocaleDateString("en-IN")}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {order.status === "pending" && (
                        <button
                          onClick={e => { e.stopPropagation(); confirmMutation.mutate(order.id); }}
                          disabled={confirmMutation.isPending}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black px-3 py-1.5 rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1 border-0"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Confirm
                        </button>
                      )}
                      {["pending", "confirmed"].includes(order.status) && (
                        <button
                          onClick={e => { e.stopPropagation(); if (confirm("Cancel this order?")) cancelMutation.mutate(order.id); }}
                          className="bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-[10px] font-black px-3 py-1.5 rounded-xl cursor-pointer border border-rose-200 dark:border-rose-900"
                        >
                          Cancel
                        </button>
                      )}
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedOrder === order.id ? "rotate-180" : ""}`} />
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expandedOrder === order.id && (
                    <div className="px-4 pb-4 bg-slate-50/50 dark:bg-slate-950/30 space-y-3 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Delivery Address */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3 space-y-1">
                          <p className="font-black text-slate-400 uppercase text-[10px]">Delivery Address</p>
                          <p className="font-bold text-slate-800 dark:text-white">{order.delivery_address?.full_name}</p>
                          <p className="text-slate-500">{order.delivery_address?.address_line_1}</p>
                          <p className="text-slate-500">{order.delivery_address?.city} {order.delivery_address?.pincode}</p>
                          <p className="text-slate-500">📞 {order.delivery_address?.phone}</p>
                        </div>
                        {/* Order Items */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3 space-y-1">
                          <p className="font-black text-slate-400 uppercase text-[10px]">Items ({order.items?.length || 0})</p>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {order.items?.map((item: any) => (
                              <div key={item.id} className="flex justify-between items-center">
                                <span className="text-slate-700 dark:text-slate-300">{item.attributes?.image_emoji || ""} {item.product_name || item.name}</span>
                                <span className="font-bold text-slate-800 dark:text-white">×{item.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Financial summary */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
                        <div className="grid grid-cols-3 gap-3 text-[10px]">
                          {[
                            { label: "Subtotal", value: `₹${parseFloat(order.subtotal || 0).toFixed(2)}` },
                            { label: "Delivery", value: `₹${parseFloat(order.delivery_charge || 0).toFixed(2)}` },
                            { label: "Discount", value: `-₹${parseFloat(order.discount_amount || 0).toFixed(2)}` },
                          ].map(({ label, value }) => (
                            <div key={label}>
                              <p className="text-slate-400 font-bold uppercase">{label}</p>
                              <p className="font-black text-slate-800 dark:text-white">{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <span className="text-xs text-slate-500">Page {page} of {pagination.total_pages} ({pagination.total} total)</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-50 cursor-pointer bg-transparent">Prev</button>
              <button onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))} disabled={page === pagination.total_pages} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-50 cursor-pointer bg-transparent">Next</button>
            </div>
          </div>
        )}
      </div>
    </AgentLayout>
  );
}

export default function AgentOrdersPage() {
  return (
    <React.Suspense fallback={
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    }>
      <AgentOrdersPageContent />
    </React.Suspense>
  );
}
