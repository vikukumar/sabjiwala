"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Star, Send, Package } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}
          className="transition-transform hover:scale-110"
        >
          <Star className={`w-8 h-8 transition-colors ${s <= (hover || value) ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600"}`} />
        </button>
      ))}
    </div>
  );
}

function ReviewForm({ order, onSubmitted }: { order: any; onSubmitted: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const { success, error: showError } = useToast();

  const submitReview = useMutation({
    mutationFn: async () => {
      const reviews = (order.items || []).map((item: any) => ({
        product_id: item.product_id || item.id,
        order_id: order.id,
        rating,
        comment,
      }));
      await Promise.all(reviews.map((r: any) => api.post("/reviews", r)));
    },
    onSuccess: () => { success("Thank you for your review! ⭐"); onSubmitted(); },
    onError: (err: any) => showError("Failed to submit", err.response?.data?.detail || err.message),
  });

  const ratingLabels = ["", "Poor", "Below Average", "Average", "Good", "Excellent"];

  return (
    <div className="card p-6 space-y-5">
      <h3 className="font-black text-slate-900 dark:text-white">Rate Order #{order.order_number}</h3>
      <div className="flex gap-2 flex-wrap">
        {(order.items || []).slice(0, 4).map((item: any, i: number) => (
          <div key={i} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl px-2.5 py-1.5">
            <span className="text-sm">{item.attributes?.image_emoji || "🥬"}</span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.name}</span>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Overall Rating *</p>
        <StarPicker value={rating} onChange={setRating} />
        {rating > 0 && <p className="text-sm font-bold text-amber-600">{ratingLabels[rating]}</p>}
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Your Review (Optional)</label>
        <textarea
          rows={4}
          value={comment}
          onChange={e => setComment(e.target.value)}
          className="input-base px-3 py-3 text-sm resize-none"
          placeholder="Tell us about the freshness, quality, and packaging..."
        />
      </div>
      <Button
        fullWidth
        loading={submitReview.isPending}
        disabled={rating === 0}
        onClick={() => submitReview.mutate()}
        leftIcon={<Send className="w-4 h-4" />}
      >
        Submit Review
      </Button>
    </div>
  );
}

function ReviewsContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams?.get("order");
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});

  const { data: orders = [], isLoading } = useQuery<any[]>({
    queryKey: ["deliveredOrders"],
    queryFn: async () => {
      const r = await api.get("/orders", { params: { status: "delivered" } });
      return r.data || [];
    },
  });

  const { data: myReviews = [] } = useQuery<any[]>({
    queryKey: ["myReviews"],
    queryFn: async () => { const r = await api.get("/reviews/me"); return r.data || []; },
  });

  const reviewedOrderIds = new Set(myReviews.map((r: any) => r.order_id));
  const pendingOrders = orders.filter((o: any) => !reviewedOrderIds.has(o.id) && !submitted[o.id]);
  const targetOrders = orderId ? pendingOrders.filter(o => o.id === orderId) : pendingOrders;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white">Rate Your Orders</h1>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}</div>
      ) : targetOrders.length === 0 ? (
        <EmptyState
          emoji="⭐"
          title="No orders to review"
          description={myReviews.length > 0 ? "You've reviewed all your recent orders. Thank you!" : "Place an order and rate your experience!"}
          action={<Link href="/orders"><Button variant="secondary"><Package className="w-4 h-4 mr-1.5" /> View Orders</Button></Link>}
        />
      ) : (
        <div className="space-y-4">
          {targetOrders.map((order: any) => (
            <ReviewForm
              key={order.id}
              order={order}
              onSubmitted={() => setSubmitted(s => ({ ...s, [order.id]: true }))}
            />
          ))}
        </div>
      )}

      {myReviews.length > 0 && (
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3">Your Reviews ({myReviews.length})</h2>
          <div className="space-y-3">
            {myReviews.map((rev: any) => (
              <div key={rev.id} className="card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-black text-sm text-slate-900 dark:text-white">{rev.product_name || "Product"}</p>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={`w-4 h-4 ${s <= rev.rating ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600"}`} />
                    ))}
                  </div>
                </div>
                {rev.comment && <p className="text-sm text-slate-600 dark:text-slate-400">{rev.comment}</p>}
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {new Date(rev.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <React.Suspense fallback={
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    }>
      <ReviewsContent />
    </React.Suspense>
  );
}
