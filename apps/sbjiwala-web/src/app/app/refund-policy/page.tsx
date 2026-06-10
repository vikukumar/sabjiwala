"use client";

import React, { useEffect } from "react";
import { RotateCcw, AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/index";

export default function RefundPolicyPage() {
  useEffect(() => {
    document.title = "Refund & Replacement Policy | Sbjiwala - Kisan ke Ghar Se Apke Ghar tak";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        "content",
        "Learn about Sbjiwala's 100% replacement guarantee. Instant wallet refunds or direct produce replacement within 24 hours of delivery."
      );
    }
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Refund & Replacement
        </h1>
        <p className="text-xs text-slate-550 dark:text-slate-400 font-semibold uppercase tracking-wider">
          Last Updated: May 30, 2026
        </p>
      </div>

      {/* Intro Card */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3 text-emerald-650 dark:text-emerald-400">
          <RotateCcw className="w-6 h-6" />
          <h2 className="text-lg font-black text-slate-900 dark:text-white">100% No-Questions-Asked Policy</h2>
        </div>
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
          Since vegetables and fruits are perishable, we stand behind their quality. If you receive any produce that is bruised, damaged, under-ripe, or missing from your bag, we offer a hassle-free, no-questions-asked replacement or an instant wallet refund.
        </p>
      </Card>

      {/* Steps to Claim */}
      <div className="space-y-4">
        <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-450" />
          How to Request a Refund
        </h3>

        <div className="grid md:grid-cols-3 gap-4">
          <Card className="p-4 space-y-2 border-dashed">
            <span className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white text-xs font-black px-2.5 py-1 rounded-lg">
              Step 1
            </span>
            <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">Open My Orders</h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-450 leading-relaxed font-medium">
              Navigate to the 'My Orders' section in your account, select the item, and click 'Raise Issue'.
            </p>
          </Card>

          <Card className="p-4 space-y-2 border-dashed">
            <span className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white text-xs font-black px-2.5 py-1 rounded-lg">
              Step 2
            </span>
            <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">Upload a Photo</h4>
            <p className="text-[10px] text-slate-550 dark:text-slate-450 leading-relaxed font-medium">
              Snap and upload a clear picture of the damaged or bruised vegetable directly on the support panel.
            </p>
          </Card>

          <Card className="p-4 space-y-2 border-dashed">
            <span className="inline-block bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-400 text-xs font-black px-2.5 py-1 rounded-lg">
              Step 3
            </span>
            <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">Instant Credit</h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-450 leading-relaxed font-medium">
              Our audit system instantly credits the refund back to your local wallet or dispatches a free replacement.
            </p>
          </Card>
        </div>
      </div>

      {/* Conditions */}
      <div className="space-y-4">
        <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          Key Guidelines
        </h3>
        <ul className="space-y-3 pl-5 list-disc text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
          <li>
            Claims for physical damage, decay, or missing items must be raised within **24 hours** of order delivery to prevent seasonal spoilage disputes.
          </li>
          <li>
            Cash on Delivery (COD) refunds will be posted directly to your digital wallet balance to avoid manual transaction delays.
          </li>
          <li>
            Online payment refunds (Card/UPI) can be refunded directly to your original bank account or your local wallet, based on your preference. Bank transfers may take 3-5 business days.
          </li>
        </ul>
      </div>

      {/* Contact Note */}
      <div className="bg-slate-55 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-850 rounded-2xl p-5 text-center">
        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-450 font-semibold flex items-center justify-center gap-2">
          <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>Need direct assistance? You can chat with our support team or mail <span className="text-emerald-600 dark:text-emerald-400">refunds@sbjiwala.qzz.io</span>.</span>
        </p>
      </div>
    </div>
  );
}
