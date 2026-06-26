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

  const { data: cmsPage } = useQuery<any>({
    queryKey: ["cmsPage", "refund-policy"],
    queryFn: async () => {
      try {
        const res = await api.get("/pages/refund-policy");
        return res.data || null;
      } catch {
        return null;
      }
    }
  });

  useEffect(() => {
    const brandName = publicSettings?.app_name || "Sbjiwala";
    document.title = `${cmsPage?.title || "Refund & Rejection Policy"} | ${brandName}`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        "content",
        cmsPage?.meta_description || publicSettings?.seo_description || "Learn about Sbjiwala's doorstep quality check."
      );
    }
  }, [publicSettings, cmsPage]);

  if (cmsPage) {
    return (
      <PublicPageWrapper>
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {cmsPage.title}
            </h1>
          </div>
          <Card className="p-6">
            <div
              className="prose dark:prose-invert max-w-none text-xs text-slate-700 dark:text-slate-350 font-medium"
              dangerouslySetInnerHTML={{ __html: cmsPage.content_html || cmsPage.content }}
            />
          </Card>
        </div>
      </PublicPageWrapper>
    );
  }

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
              <p className="text-[10px] text-slate-550 dark:text-slate-455 leading-relaxed font-medium">
                Hand back any damaged, bruised, or unwanted items to the delivery boy, indicating the reason.
              </p>
            </Card>

            <Card className="p-4 space-y-2 border-dashed">
              <span className="inline-block bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-400 text-xs font-black px-2.5 py-1 rounded-lg">
                Step 3
              </span>
              <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">Instant Adjust</h4>
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

          <ul className="space-y-3 pl-6 list-disc text-xs text-slate-500 dark:text-slate-450 leading-relaxed font-medium">
            <li>
              <strong>Vegetable & Fruit Shipments:</strong> Since fresh produce is short-lived, you must check everything at delivery time. No returns will be allowed once the agent departs.
            </li>
            <li>
              <strong>Wallet Refund Timing:</strong> Doorstep rejection differences for prepaid digital payments reflect in your Sbjiwala Wallet balance instantly.
            </li>
            <li>
              <strong>Cash on Delivery:</strong> For COD orders, the rider adjusts the total bill directly on their delivery boy app. You pay only for the accepted items.
            </li>
          </ul>
        </div>

        {/* Support Help */}
        <Card className="p-5 flex items-start gap-4 bg-emerald-50/50 dark:bg-emerald-950/10 border-dashed">
          <HelpCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-450 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-bold text-xs text-slate-900 dark:text-white">Need Post-Delivery Support?</h4>
            <p className="text-[10px] leading-relaxed text-slate-550 dark:text-slate-455 font-medium">
              If an item deteriorates unexpectedly post-delivery due to hidden internal decay, raise a support ticket under the "Orders" page within 2 hours of delivery with clear photographs. Our support agents will review and issue wallet adjustments where valid.
            </p>
          </div>
        </Card>
      </div>
    </PublicPageWrapper>
  );
}
