"use client";

import React, { useEffect } from "react";
import { RotateCcw, AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/index";
import { useQuery } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import PublicPageWrapper from "@/components/PublicPageWrapper";

export default function RefundPolicyPage() {
  const { data: publicSettings } = useQuery<any>({
    queryKey: ["publicSettings"],
    queryFn: async () => {
      const res = await api.get("/installation/public-settings");
      return res.data || {};
    }
  });

  useEffect(() => {
    const brandName = publicSettings?.app_name || "Sbjiwala";
    document.title = `Refund & Replacement Policy | ${brandName}`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        "content",
        publicSettings?.seo_description || "Learn about Sbjiwala's doorstep quality check. Inspect and reject fresh produce at delivery time."
      );
    }
  }, [publicSettings]);

  return (
    <PublicPageWrapper>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8 font-sans">
        {/* Header */}
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Refund & Rejection Policy
          </h1>
          <p className="text-xs text-slate-555 dark:text-slate-400 font-semibold uppercase tracking-wider">
            Last Updated: June 20, 2026
          </p>
        </div>

        {/* Intro Card */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3 text-emerald-655 dark:text-emerald-400">
            <RotateCcw className="w-6 h-6" />
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Doorstep Quality Inspection</h2>
          </div>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
            Since vegetables and fruits are highly perishable, they are **not eligible for refunds or replacements once the delivery is completed and accepted**. We require all customers to inspect their items at the time of delivery. Any unsatisfactory items must be rejected at the doorstep.
          </p>
        </Card>

        {/* Steps to Claim */}
        <div className="space-y-4">
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-450" />
            Doorstep Rejection Process
          </h3>

          <div className="grid md:grid-cols-3 gap-4">
            <Card className="p-4 space-y-2 border-dashed">
              <span className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white text-xs font-black px-2.5 py-1 rounded-lg">
                Step 1
              </span>
              <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">Inspect Freshness</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-450 leading-relaxed font-medium">
                When our delivery partner arrives, check all vegetables and fruits in your order immediately.
              </p>
            </Card>

            <Card className="p-4 space-y-2 border-dashed">
              <span className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white text-xs font-black px-2.5 py-1 rounded-lg">
                Step 2
              </span>
              <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">Reject at Doorstep</h4>
              <p className="text-[10px] text-slate-550 dark:text-slate-450 leading-relaxed font-medium">
                Hand back any damaged, bruised, or unwanted items to the delivery boy, indicating the reason.
              </p>
            </Card>

            <Card className="p-4 space-y-2 border-dashed">
              <span className="inline-block bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-400 text-xs font-black px-2.5 py-1 rounded-lg">
                Step 3
              </span>
              <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">Instant Price Adjust</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-455 leading-relaxed font-medium">
                The rider updates the order. COD totals decrease instantly, and prepaid differences refund to your wallet immediately.
              </p>
            </Card>
          </div>
        </div>

        {/* Conditions */}
        <div className="space-y-4">
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Key Policy Terms
          </h3>
          <ul className="space-y-3 pl-5 list-disc text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
            <li>
              **Perishable Produce Rule**: No return request or refund claim will be accepted after the delivery agent departs from your location. All quality checks must happen at delivery time.
            </li>
            <li>
              **Cash Collection**: If you selected Cash on Delivery, the delivery boy will update the order, and you only need to pay the modified subtotal.
            </li>
            <li>
              **Online Prepayments**: For prepaid card or UPI orders, the difference for any rejected item is credited back to your digital wallet immediately upon doorstep update.
            </li>
          </ul>
        </div>

        {/* Contact Note */}
        <div className="bg-slate-55 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-850 rounded-2xl p-5 text-center">
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-455 font-semibold flex items-center justify-center gap-2">
            <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-450 flex-shrink-0" />
            <span>Need assistance? You can chat with our support team or mail <span className="text-emerald-600 dark:text-emerald-400">support@sbjiwala.qzz.io</span>.</span>
          </p>
        </div>
      </div>
    </PublicPageWrapper>
  );
}
