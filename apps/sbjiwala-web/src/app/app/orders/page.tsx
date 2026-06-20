"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import Link from "next/link";
import { Package, ChevronRight, MapPin, Clock, CheckCircle2, Truck, XCircle, Star, RefreshCcw, Loader2, Copy } from "lucide-react";
import { Badge, Button, EmptyState, Skeleton, Tabs } from "@/components/ui/index";
import { resolveLink } from "@/components/AppShell";
import { useToast } from "@/components/ui/Toast";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "warning", icon: Clock },
  confirmed: { label: "Confirmed", color: "info", icon: CheckCircle2 },
  accepted: { label: "Accepted", color: "info", icon: CheckCircle2 },
  packed: { label: "Packed", color: "info", icon: Package },
  out_for_delivery: { label: "Out for Delivery", color: "warning", icon: Truck },
  delivered: { label: "Delivered", color: "success", icon: CheckCircle2 },
  returned: { label: "Returned", color: "danger", icon: RefreshCcw },
  cancelled: { label: "Cancelled", color: "danger", icon: XCircle },
};

function OrderCard({ order, myReviews, onCancel, success }: { order: any; myReviews: any[]; onCancel: (id: string) => void; success: any }) {
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;
  const canCancel = ["pending", "confirmed"].includes(order.status);
  const canTrack = ["out_for_delivery", "packed"].includes(order.status);

  // Review calculations
  const orderReviews = myReviews.filter((r: any) => r.order_id === order.id);
  const avgRating = orderReviews.length > 0 ? orderReviews.reduce((sum, r) => sum + r.rating, 0) / orderReviews.length : 0;

  // Split preview and remaining items
  const previewCount = 3;
  const previewItems = order.items?.slice(0, previewCount) || [];
  const remainingItems = order.items?.slice(previewCount) || [];

  return (
    <div className="card p-5 space-y-4 hover:shadow-md transition-shadow bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Order ID in single line, smaller, with copy button */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono font-black truncate">ID: {order.order_number}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(order.order_number);
                success("Copied!", "Order ID copied to clipboard");
              }}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Copy Order ID"
            >
              <Copy className="w-3 h-3 text-slate-400" />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            {" · "}
            {new Date(order.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <Badge variant={cfg.color as any} size="sm">{cfg.label}</Badge>
      </div>

      {/* Items preview with overlapping bubbles for remaining */}
      {order.items && order.items.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          {previewItems.map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl px-2.5 py-1.5 border border-slate-100 dark:border-slate-800/40">
              <span className="text-sm select-none">{item.attributes?.image_emoji || "🥬"}</span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.name || item.product_name} ×{item.quantity}</span>
            </div>
          ))}
          {remainingItems.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-xl px-2.5 py-1 border border-slate-100 dark:border-slate-800/40">
              <div className="flex -space-x-1.5 overflow-hidden">
                {remainingItems.slice(0, 4).map((item: any, idx: number) => (
                  <span key={idx} className="inline-block text-base bg-white dark:bg-slate-900 w-6 h-6 rounded-full border border-slate-200 dark:border-slate-750 flex items-center justify-center select-none shadow-sm">
                    {item.attributes?.image_emoji || "🥬"}
                  </span>
                ))}
              </div>
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-450 ml-1">+{remainingItems.length} more</span>
            </div>
          )}
        </div>
      )}

      {/* Stars & rating prompt card below */}
      {order.status === "delivered" && (
        <div className="pt-1">
          {avgRating > 0 ? (
            <div className="flex items-center gap-1.5 bg-slate-55/40 dark:bg-slate-800/50 rounded-xl px-3 py-1.5 w-fit border border-slate-100 dark:border-slate-800">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star key={s} className={`w-3.5 h-3.5 ${s <= avgRating ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-650"}`} />
                ))}
              </div>
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400">Rated {avgRating.toFixed(1)}</span>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-amber-500/5 to-teal-500/5 border border-amber-500/10 dark:border-amber-950/20 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-350">How was the quality? Rate this order:</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Link key={s} href={resolveLink(`/reviews?order=${order.id}`)}>
                      <Star className="w-4 h-4 text-slate-300 dark:text-slate-600 hover:text-amber-400 hover:fill-amber-400 cursor-pointer transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{order.payment_method?.toUpperCase()} · {order.payment_status}</p>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">₹{order.total_amount}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {canCancel && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => onCancel(order.id)}
              leftIcon={<XCircle className="w-3.5 h-3.5" />}
            >
              Cancel
            </Button>
          )}
          {canTrack && (
            <Link href={resolveLink(`/orders/detail?id=${order.id}&track=1`)}>
              <Button variant="secondary" size="sm" leftIcon={<MapPin className="w-3.5 h-3.5" />}>Track</Button>
            </Link>
          )}
          <Link href={resolveLink(`/orders/detail?id=${order.id}`)}>
            <Button variant="outline" size="sm" rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>Details</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-in text-center shadow-2xl">
        <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">{title}</h3>
        <p className="text-xs text-slate-550 dark:text-slate-400 leading-normal">{message}</p>
        <div className="flex gap-3 pt-2">
          <Button
            variant="danger"
            onClick={onConfirm}
            className="flex-1 py-3 text-xs cursor-pointer font-bold"
          >
            Yes, Cancel
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 py-3 text-xs cursor-pointer font-bold"
          >
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [cancelId, setCancelId] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery<any[]>({
    queryKey: ["orders", activeTab],
    queryFn: async () => {
      const res = await api.get("/orders", {
        params: activeTab !== "all" ? { status: activeTab } : {},
      });
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
  });

  const { data: myReviews = [] } = useQuery<any[]>({
    queryKey: ["myReviews"],
    queryFn: async () => { const r = await api.get("/reviews/me"); return r.data || []; },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
  });

  const cancelOrder = useMutation({
    mutationFn: (id: string) => api.post(`/orders/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      success("Order cancelled", "Your order has been cancelled successfully");
    },
    onError: (err: any) => showError("Cancel failed", err.response?.data?.detail || err.message),
  });

  const tabs = [
    { id: "all", label: "All" },
    { id: "pending", label: "Active" },
    { id: "delivered", label: "Delivered" },
    { id: "cancelled", label: "Cancelled" },
  ];

  const handleCancel = (id: string) => {
    setCancelId(id);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">My Orders</h1>
        <Button variant="ghost" size="sm" onClick={() => { queryClient.invalidateQueries({ queryKey: ["orders"] }); queryClient.invalidateQueries({ queryKey: ["myReviews"] }); }} leftIcon={<RefreshCcw className="w-3.5 h-3.5" />}>
          Refresh
        </Button>
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} className="mb-5" />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          emoji="📦"
          title="No orders yet"
          description={activeTab === "all" ? "Your order history will appear here once you place an order." : `No ${activeTab} orders.`}
          action={<Link href="/"><Button>Start Shopping</Button></Link>}
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order: any) => (
            <OrderCard key={order.id} order={order} myReviews={myReviews} onCancel={handleCancel} success={success} />
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={!!cancelId}
        title="Cancel Order?"
        message="Are you sure you want to cancel this order? This action cannot be undone."
        onConfirm={() => {
          if (cancelId) {
            cancelOrder.mutate(cancelId);
            setCancelId(null);
          }
        }}
        onCancel={() => setCancelId(null)}
      />
    </div>
  );
}
