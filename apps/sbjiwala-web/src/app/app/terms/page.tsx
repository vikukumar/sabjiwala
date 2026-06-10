"use client";

import React, { useEffect } from "react";
import { FileText, Award, UserCheck, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/index";
import { useQuery } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";

export default function TermsPage() {
  const { data: publicSettings } = useQuery<any>({
    queryKey: ["publicSettings"],
    queryFn: async () => {
      const res = await api.get("/installation/public-settings");
      return res.data || {};
    }
  });

  useEffect(() => {
    const brandName = publicSettings?.app_name || "Sbjiwala";
    document.title = `Terms of Service — User Agreement | ${brandName}`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        "content",
        publicSettings?.seo_description || "Read Sbjiwala's terms of service and billing guidelines. Learn about order cancellations, user accounts, and digital wallet terms."
      );
    }
  }, [publicSettings]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Terms of Service
        </h1>
        <p className="text-xs text-slate-555 dark:text-slate-400 font-semibold uppercase tracking-wider">
          Last Updated: June 10, 2026
        </p>
      </div>

      {/* Intro Card */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3 text-emerald-655 dark:text-emerald-400">
          <FileText className="w-6 h-6" />
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Acceptance of Terms</h2>
        </div>
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
          {publicSettings?.policy_terms || "Welcome to Sbjiwala - Kisan ke Ghar Se Apke Ghar tak. These Terms of Service govern your use of the Sbjiwala web portals, mobile applications, and local 10-minute fresh delivery services. By accessing, browsing, or placing an order, you agree to comply with and be bound by these Terms. If you do not agree, please discontinue use immediately."}
        </p>
      </Card>

      {/* Sections */}
      <div className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-450" />
            1. User Registration & Accounts
          </h3>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium pl-6">
            To place vegetable or fruit orders, you must create a verified account linked to your mobile phone number. You are solely responsible for maintaining the confidentiality of your credentials and agree to take full responsibility for all transactions logged under your profile.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-450" />
            2. 10-Minute Sourcing & Availability
          </h3>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium pl-6">
            We target 10-minute deliveries based on the physical distance from our nearest dark stores. However, extreme traffic, severe weather storms, or sudden local road blockades may cause delays. Catalog item availability is seasonal, and we reserve the right to modify prices or mark items as out of stock based on agricultural supply limits.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-450" />
            3. Digital Wallets & Settlements
          </h3>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium pl-6">
            Balances loaded into your Sbjiwala digital wallet can only be utilized to place orders on our platform. Refund credits, refer-and-earn bonuses, and cashback awards will be posted directly to your local wallet balance. Wallet funds are non-transferable to outside banking channels unless explicitly approved for exceptional disputes.
          </p>
        </section>
      </div>

      {/* Compliance Note */}
      <div className="bg-slate-55 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-850 rounded-2xl p-5 text-center">
        <p className="text-[11px] leading-relaxed text-slate-550 dark:text-slate-450 font-semibold">
          For formal legal inquiries, partnership terms, or compliance disputes, please write directly to our counsel at <span className="text-emerald-600 dark:text-emerald-400">legal@sbjiwala.qzz.io</span>.
        </p>
      </div>
    </div>
  );
}
