"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import Link from "next/link";
import { Package, ChevronRight, MapPin, Clock, CheckCircle2, Truck, XCircle, Star, RefreshCcw, Loader2 } from "lucide-react";
import { Badge, Button, EmptyState, Skeleton, Tabs } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "warning", icon: Clock },
  confirmed: { label: "Confirmed", color: "info", icon: CheckCircle2 },
  accepted: { label: "Accepted", color: "info", icon: CheckCircle2 },
  packed: { label: "Packed", color: "info", icon: Package },
  out_for_delivery: { label: "Out for Delivery", color: "warning", icon: Truck },
  delivered: { label: "Delivered", color: "success", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "danger", icon: XCircle },
};

function OrderCard({ order, onCancel }: { order: any; onCancel: (id: string) => void }) {
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;
  const canCancel = ["pending", "confirmed"].includes(order.status);
  const canReorder = order.status === "delivered";
  const canTrack = ["out_for_delivery", "packed"].includes(order.status);

  return (
    <div className="card p-5 space-y-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-900 dark:text-white">#{order.order_number}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            {" · "}
            {new Date(order.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <Badge variant={cfg.color as any} size="sm">{cfg.label}</Badge>
      </div>

      {/* Items preview */}
      {order.items && order.items.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {order.items.slice(0, 3).map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl px-2.5 py-1.5">
              <span className="text-sm">{item.attributes?.image_emoji || "🥬"}</span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.name} ×{item.quantity}</span>
            </div>
          ))}
          {order.items.length > 3 && (
            <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-xl px-2.5 py-1.5">
              <span className="text-xs font-semibold text-slate-500">+{order.items.length - 3} more</span>
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
            <Link href={`/orders/${order.id}/track`}>
              <Button variant="secondary" size="sm" leftIcon={<MapPin className="w-3.5 h-3.5" />}>Track</Button>
            </Link>
          )}
          <Link href={`/orders/${order.id}`}>
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
        <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["orders"] })} leftIcon={<RefreshCcw className="w-3.5 h-3.5" />}>
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
            <OrderCard key={order.id} order={order} onCancel={handleCancel} />
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
