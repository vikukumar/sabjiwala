"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sabjiwala/shared";
import Link from "next/link";
import { Tag, Copy, CheckCircle2, Clock, Percent, ArrowRight } from "lucide-react";
import { Badge, Button, EmptyState, Skeleton } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";

function CouponCard({ coupon }: { coupon: any }) {
  const { success } = useToast();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(coupon.code);
    setCopied(true);
    success("Coupon copied!", `Code "${coupon.code}" is ready to use`);
    setTimeout(() => setCopied(false), 2000);
  };

  const isExpired = coupon.valid_until && new Date(coupon.valid_until) < new Date();
  const discountLabel = coupon.discount_type === "percentage"
    ? `${coupon.discount_value}% Off`
    : `₹${coupon.discount_value} Off`;

  return (
    <div className={`card overflow-hidden ${isExpired ? "opacity-60" : ""}`}>
      <div className="flex">
        {/* Left accent */}
        <div className="w-2 gradient-brand flex-shrink-0" />
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-black text-slate-900 dark:text-white tracking-wider font-mono">{coupon.code}</span>
                {isExpired && <Badge variant="danger" size="sm">Expired</Badge>}
              </div>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{discountLabel}</p>
              {coupon.min_order_amount > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Min. order: ₹{coupon.min_order_amount}</p>
              )}
              {coupon.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{coupon.description}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl flex items-center justify-center">
                {coupon.discount_type === "percentage"
                  ? <Percent className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  : <Tag className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700">
            {coupon.valid_until && !isExpired ? (
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                Expires {new Date(coupon.valid_until).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </div>
            ) : <div />}
            {!isExpired && (
              <button
                onClick={copy}
                className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl transition-all ${
                  copied
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700"
                }`}
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy Code"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CouponsPage() {
  const { data: coupons = [], isLoading } = useQuery<any[]>({
    queryKey: ["coupons"],
    queryFn: async () => { const r = await api.get("/coupons/available"); return r.data || []; },
  });

  const activeCoupons = coupons.filter((c: any) => !c.valid_until || new Date(c.valid_until) >= new Date());
  const expiredCoupons = coupons.filter((c: any) => c.valid_until && new Date(c.valid_until) < new Date());

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Available Coupons</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Apply these codes at checkout to save money</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : coupons.length === 0 ? (
        <EmptyState
          emoji="🏷️"
          title="No coupons available"
          description="Check back later for exciting offers and discounts!"
          action={<Link href="/offers"><Button variant="secondary">View Offers <ArrowRight className="w-4 h-4" /></Button></Link>}
        />
      ) : (
        <div className="space-y-4">
          {activeCoupons.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Active Coupons ({activeCoupons.length})</h2>
              {activeCoupons.map((c: any) => <CouponCard key={c.id} coupon={c} />)}
            </div>
          )}
          {expiredCoupons.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Expired</h2>
              {expiredCoupons.map((c: any) => <CouponCard key={c.id} coupon={c} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
