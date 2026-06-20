"use client";

import React, { useEffect } from "react";
import { ShieldCheck, Lock, Eye, Key } from "lucide-react";
import { Card } from "@/components/ui/index";
import { useQuery } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";

import PublicPageWrapper from "@/components/PublicPageWrapper";

export default function PrivacyPage() {
  const { data: publicSettings } = useQuery<any>({
    queryKey: ["publicSettings"],
    queryFn: async () => {
      const res = await api.get("/installation/public-settings");
      return res.data || {};
    }
  });

  useEffect(() => {
    const brandName = publicSettings?.app_name || "Sbjiwala";
    document.title = `Privacy Policy — Geolocation & Data | ${brandName}`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        "content",
        publicSettings?.seo_description || "Read Sbjiwala's user data policy. Learn about precise GPS coordinate encryption, secure tokenized checkouts, and your personal data rights."
      );
    }
  }, [publicSettings]);

  return (
    <PublicPageWrapper>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-xs text-slate-555 dark:text-slate-400 font-semibold uppercase tracking-wider">
            Last Updated: June 10, 2026
          </p>
        </div>

        {/* Intro Card */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3 text-emerald-655 dark:text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Your Privacy Matters</h2>
          </div>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
            {publicSettings?.policy_privacy || "At Sbjiwala, we prioritize the protection of your personal information. This Privacy Policy details how we collect, process, and secure your geolocation details, registration credentials, and purchase history. By using our applications, you consent to the practices described below."}
          </p>
        </Card>

        {/* Main sections */}
        <div className="space-y-6">
          <section className="space-y-2">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-455" />
              1. Information We Collect
            </h3>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium pl-6">
              We collect basic contact information (phone number, OTP registration, and optionally name and email) to set up your verified profile. We also capture precise geolocation coordinates via GPS to determine store delivery eligibility, calculate transit distances, and coordinate live courier drop-offs.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-455" />
              2. How We Use Your Data
            </h3>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium pl-6">
              Your data is primarily used to fulfill your vegetable orders. Location coordinates help dispatch the closest available delivery rider and compute exact transit routes. Push notification triggers are utilized to send automated pack alerts, OTP codes, and dispatch timelines. We do not sell or lease your personal information to third-party marketing companies.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-600 dark:text-emerald-455" />
              3. Secure Payments & Security
            </h3>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium pl-6">
              All digital transactions are routed through certified, PCI-DSS compliant payment gateways (such as Razorpay). We do not collect or store credit/debit card numbers or net banking credentials on our database. All data communications utilize standard SSL/TLS encryption.
            </p>
          </section>
        </div>

        {/* Consent Notice */}
        <div className="bg-slate-55 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-850 rounded-2xl p-5 text-center">
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-450 font-semibold">
            For any data deletion requests, profile access queries, or specific privacy feedback, please submit a support ticket via the help center or email our data protection officer directly at <span className="text-emerald-600 dark:text-emerald-400">privacy@sbjiwala.qzz.io</span>.
          </p>
        </div>
      </div>
    </PublicPageWrapper>
  );
}
