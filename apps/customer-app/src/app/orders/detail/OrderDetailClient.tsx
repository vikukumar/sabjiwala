"use client";

import React from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import Link from "next/link";
import {
  Package, MapPin, Clock, CheckCircle2, Truck, XCircle,
  CreditCard, Star, ChevronLeft, Phone, Copy, MessageSquare, ArrowRight
} from "lucide-react";
import { Button, Badge, Skeleton } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";
import { resolveLink } from "@/components/AppShell";

const TIMELINE_STEPS = [
  { status: "pending", label: "Order Placed", icon: Package },
  { status: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { status: "packed", label: "Packed & Ready", icon: Package },
  { status: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { status: "delivered", label: "Delivered", icon: CheckCircle2 },
];

const STATUS_ORDER = ["pending", "confirmed", "accepted", "packed", "out_for_delivery", "delivered"];

function OrderTimeline({ status }: { status: string }) {
  const currentIdx = STATUS_ORDER.indexOf(status);
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900/50">
        <XCircle className="w-6 h-6 text-rose-500 flex-shrink-0" />
        <div>
          <p className="font-bold text-rose-700 dark:text-rose-400">Order Cancelled</p>
          <p className="text-xs text-rose-500 dark:text-rose-500">This order was cancelled</p>
        </div>
      </div>
    );
  }
  return (
    <div className="relative">
      <div className="space-y-0">
        {TIMELINE_STEPS.map((step, i) => {
          const stepIdx = STATUS_ORDER.indexOf(step.status);
          const isDone = currentIdx >= stepIdx;
          const isCurrent = STATUS_ORDER[currentIdx] === step.status ||
            (step.status === "confirmed" && (status === "confirmed" || status === "accepted"));
          const Icon = step.icon;
          const isLast = i === TIMELINE_STEPS.length - 1;
          return (
            <div key={step.status} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${isDone
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-200 dark:shadow-emerald-900/30"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                  }`}>
                  <Icon className="w-4 h-4" />
                </div>
                {!isLast && (
                  <div className={`w-0.5 h-8 mt-1 rounded-full ${isDone ? "bg-emerald-400" : "bg-slate-200 dark:bg-slate-700"}`} />
                )}
              </div>
              <div className="pb-8 pt-1 flex-1 min-w-0">
                <p className={`text-sm font-bold ${isDone ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}`}>
                  {step.label}
                </p>
                {isCurrent && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">In Progress</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  loading
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
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
            loading={loading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold"
          >
            Yes, Cancel
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold"
          >
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailClient() {
  const params = useParams<{ id?: string }>();
  const searchParams = useSearchParams();
  const id = params?.id || searchParams?.get("id") || "";
  const router = useRouter();
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const isNew = searchParams?.get("new") === "1";
  const [showCancelModal, setShowCancelModal] = React.useState(false);

  const { data: order, isLoading } = useQuery<any>({
    queryKey: ["order", id],
    queryFn: async () => {
      const r = await api.get(`/orders/${id}`);
      // APIResponse wrapper: { success, data: { ...order } }
      return r.data?.data || r.data;
    },
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return ["pending", "confirmed", "accepted", "packed", "out_for_delivery"].includes(s) ? 30_000 : false;
    },
    enabled: !!id,
  });

  const cancelOrder = useMutation({
    mutationFn: () => api.post(`/orders/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      success("Order cancelled");
    },
    onError: (err: any) => showError("Cancel failed", err.response?.data?.detail || err.message),
  });

  const copyOrderNum = () => {
    navigator.clipboard.writeText(order?.order_number || "").then(() => success("Copied!", "Order number copied"));
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!id) return <div className="text-center py-20 text-slate-500">Order ID is missing</div>;
  if (!order) return <div className="text-center py-20 text-slate-500">Order not found</div>;

  const canCancel = ["pending", "confirmed"].includes(order.status);
  const canTrack = ["packed", "out_for_delivery"].includes(order.status);
  const isDelivered = order.status === "delivered";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 font-sans">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white">#{order.order_number}</h1>
            <button onClick={copyOrderNum} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
          <p className="text-xs text-slate-550 dark:text-slate-400">
            {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <Badge variant={order.status === "delivered" ? "success" : order.status === "cancelled" ? "danger" : "warning"}>
          {order.status?.replace(/_/g, " ").toUpperCase()}
        </Badge>
      </div>

      {/* Success Banner */}
      {isNew && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl flex items-center gap-3 animate-slide-down">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <div>
            <p className="font-bold text-emerald-800 dark:text-emerald-300">Order Placed Successfully! 🎉</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500">We&apos;ll start preparing your order shortly.</p>
          </div>
        </div>
      )}

      {/* Delivery OTP Card */}
      {!["delivered", "cancelled", "returned", "refunded"].includes(order.status) && order.delivery_otp && (
        <div className="card p-4 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Delivery OTP</p>
            <p className="text-xs text-slate-550 dark:text-slate-400 mt-0.5">Share with partner only at delivery time.</p>
          </div>
          <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-emerald-500/30">
            <span className="font-mono text-lg font-black tracking-widest text-emerald-600 dark:text-emerald-400">
              {order.delivery_otp}
            </span>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="card p-6">
        <h2 className="font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Order Progress
        </h2>
        <OrderTimeline status={order.status} />
      </div>

      {/* Actions */}
      {(canCancel || canTrack || isDelivered) && (
        <div className="flex gap-3">
          {canTrack && (
            <Link href={resolveLink(`/orders/track?id=${id}`)} className="flex-1">
              <Button fullWidth variant="secondary" leftIcon={<MapPin className="w-4 h-4" />}>Live Track</Button>
            </Link>
          )}
          {isDelivered && (
            <Link href={resolveLink(`/reviews?order=${id}`)} className="flex-1">
              <Button fullWidth variant="secondary" leftIcon={<Star className="w-4 h-4" />}>Rate Order</Button>
            </Link>
          )}
          {canCancel && (
            <Button variant="danger" onClick={() => setShowCancelModal(true)} leftIcon={<XCircle className="w-4 h-4" />}>
              Cancel Order
            </Button>
          )}
        </div>
      )}

      {/* Items */}
      <div className="card p-6 space-y-3">
        <h2 className="font-black text-slate-900 dark:text-white">Items Ordered</h2>
        {(order.items || []).map((item: any, i: number) => (
          <div key={i} className="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-none">
            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-2xl">
              {item.attributes?.image_emoji || "🥬"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{item.name}</p>
              <p className="text-xs text-slate-550 dark:text-slate-400">₹{Number(item.unit_price).toFixed(2)} × {item.quantity}</p>
            </div>
            <p className="font-black text-slate-900 dark:text-white">₹{(item.unit_price * item.quantity).toFixed(2)}</p>
          </div>
        ))}
      </div>

      {/* Delivery Address */}
      {order.delivery_address && (
        <div className="card p-5 flex items-start gap-3">
          <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 tracking-wider">Delivery Address</p>
            <p className="font-bold text-sm text-slate-900 dark:text-white">{order.delivery_address.full_name}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {order.delivery_address.address_line_1}
              {order.delivery_address.address_line_2 && `, ${order.delivery_address.address_line_2}`}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {order.delivery_address.city}, {order.delivery_address.postal_code}
            </p>
            <p className="text-xs text-slate-550 dark:text-slate-400 mt-1">📞 {order.delivery_address.phone}</p>
          </div>
        </div>
      )}

      {/* Bill Summary */}
      <div className="card p-5 space-y-3">
        <h2 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Bill Details
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Item Total</span><span>₹{Number(order.subtotal || 0).toFixed(2)}</span>
          </div>
          {Number(order.packaging_charge || 0) > 0 && (
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Packaging & Handling</span><span>₹{Number(order.packaging_charge).toFixed(2)}</span>
            </div>
          )}
          {Number(order.tax_amount || 0) > 0 && (
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Taxes (5%)</span><span>₹{Number(order.tax_amount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Delivery Partner Fee</span>
            <span className={Number(order.delivery_charge || 0) === 0 ? "text-emerald-600 font-bold" : ""}>
              {Number(order.delivery_charge || 0) === 0 ? "FREE" : `₹${Number(order.delivery_charge).toFixed(2)}`}
            </span>
          </div>
          {Number(order.discount_amount || 0) > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Discount</span><span>-₹{Number(order.discount_amount).toFixed(2)}</span>
            </div>
          )}
          <hr className="border-slate-200 dark:border-slate-800" />
          <div className="flex justify-between font-black text-slate-900 dark:text-white text-base">
            <span>Total Paid</span><span>₹{Number(order.total_amount || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-550 dark:text-slate-400">
            <span>Payment</span><span className="uppercase">{order.payment_method} · {order.payment_status}</span>
          </div>
        </div>
      </div>

      {/* Support */}
      <Link href={resolveLink(`/support?order=${id}`)}>
        <div className="card p-4 flex items-center gap-3 hover:border-emerald-400 transition-colors cursor-pointer">
          <MessageSquare className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Need Help with this Order?</p>
            <p className="text-xs text-slate-550 dark:text-slate-400">Contact our support team</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </div>
      </Link>

      <ConfirmModal
        isOpen={showCancelModal}
        title="Cancel Order?"
        message="Are you sure you want to cancel this order? This action cannot be undone."
        loading={cancelOrder.isPending}
        onConfirm={async () => {
          await cancelOrder.mutateAsync();
          setShowCancelModal(false);
        }}
        onCancel={() => setShowCancelModal(false)}
      />
    </div>
  );
}
