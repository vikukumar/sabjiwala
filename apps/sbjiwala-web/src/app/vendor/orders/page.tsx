"use client";

import React, { useState } from "react";
import { Clock, Loader2, Star, ShoppingBag } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useWebSocket } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import VendorLayout from "@/components/VendorLayout";

export default function VendorOrdersPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");

  const { data: ordersData, isLoading: ordersLoading } = useQuery<any>({
    queryKey: ["vendorOrders", activeTab],
    queryFn: async () => {
      const res = await api.get("/orders", {
        params: {
          status: activeTab !== "all" ? activeTab : undefined
        }
      });
      return res.data || [];
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status, notes }: { orderId: string; status: string; notes: string }) => {
      return api.patch(`/orders/${orderId}/status`, {
        status,
        notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorOrders"] });
      queryClient.invalidateQueries({ queryKey: ["vendorMetrics"] });
      success("Order status updated successfully!");
    },
    onError: (err: any) => {
      showError("Update Failed", "Failed to update order: " + (err.response?.data?.detail || err.message));
    }
  });

  const orders = ordersData || [];

  return (
    <VendorLayout title="Order Management Board">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Customer Requests</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Accept incoming customer orders, pack items, and track dispatch.</p>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-full border border-slate-205 dark:border-slate-700 text-xs font-semibold self-stretch md:self-auto justify-between sm:justify-start">
            {["all", "pending", "confirmed", "accepted", "packed", "delivered", "cancelled"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-full capitalize text-[10px] sm:text-xs transition-all ${
                  activeTab === tab
                    ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm font-bold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-205"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {ordersLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
              <span className="text-xs text-slate-500 dark:text-slate-400">Fetching store orders...</span>
            </div>
          ) : orders.length > 0 ? (
            orders.map((order: any) => (
              <div key={order.id} className="p-6 flex flex-col gap-4 hover:bg-slate-50 dark:hover:bg-slate-850/10 transition-all">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">#Order {order.order_number}</span>
                      <span className="text-slate-400 dark:text-slate-550 text-xs">•</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-450">
                        {new Date(order.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-450">
                      Payment: <span className="font-bold text-slate-700 dark:text-slate-300">{order.payment_method.toUpperCase()}</span> ({order.payment_status})
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`inline-block text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                      order.status === "pending"
                        ? "bg-amber-100 dark:bg-amber-955/40 text-amber-800 dark:text-amber-400"
                        : order.status === "confirmed"
                          ? "bg-purple-100 dark:bg-purple-955/40 text-purple-800 dark:text-purple-400"
                          : order.status === "accepted"
                            ? "bg-teal-100 dark:bg-teal-955/40 text-teal-800 dark:text-teal-400"
                            : order.status === "packed"
                              ? "bg-blue-100 dark:bg-blue-955/40 text-blue-800 dark:text-blue-400"
                              : order.status === "assigned"
                                ? "bg-indigo-105 dark:bg-indigo-955/40 text-indigo-800 dark:text-indigo-400"
                                : "bg-emerald-100 dark:bg-emerald-955/40 text-emerald-800 dark:text-emerald-400"
                    }`}>
                      {order.status}
                    </span>

                    {order.status === "pending" && (
                      <button
                        disabled
                        className="bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-xl cursor-not-allowed"
                      >
                        Awaiting Payment/Confirmation
                      </button>
                    )}
                    {(order.status === "confirmed" || order.status === "assigned") && (
                      <button
                        onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: "accepted", notes: "Order accepted by vendor" })}
                        disabled={updateStatusMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white text-[10px] sm:text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {updateStatusMutation.isPending ? "Accepting..." : "Accept Order"}
                      </button>
                    )}
                    {order.status === "accepted" && (
                      <button
                        onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: "packed", notes: "Order packed by vendor" })}
                        disabled={updateStatusMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400 text-white text-[10px] sm:text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {updateStatusMutation.isPending ? "Packing..." : "Mark as Packed"}
                      </button>
                    )}
                    {order.status === "packed" && (
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl">Ready for Courier Pickup</span>
                    )}
                  </div>
                </div>

                {/* Items in the Order */}
                {order.items && order.items.length > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-2">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Items to Pack ({order.items.length})</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {order.items.map((item: any) => (
                        <div key={item.id} className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800/80">
                          <span className="text-2xl">{item.attributes?.image_emoji || "🥬"}</span>
                          <div className="min-w-0 flex-1">
                            <h6 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 truncate">{item.product_name || item.name}</h6>
                            <p className="text-[10px] text-slate-500">{item.unit || "kg"}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-xs font-black text-slate-900 dark:text-white">Qty: {item.quantity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shipping details if delivery boy is assigned */}
                {order.delivery_boy_id && (
                  <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/50 dark:bg-indigo-950/10 px-3 py-2 rounded-xl border border-indigo-100/50 dark:border-indigo-900/20 flex items-center justify-between">
                    <span>Delivery Partner Assigned</span>
                    <span>OTP: {order.delivery_otp || "Awaiting"}</span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="py-20 text-center text-slate-400 dark:text-slate-500 text-xs">
              No orders found matching status "{activeTab}".
            </div>
          )}
        </div>
      </div>
    </VendorLayout>
  );
}
