"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import Link from "next/link";
import { Gift, Copy, Share2, CheckCircle2, Users, TrendingUp, Wallet } from "lucide-react";
import { Button, Card, Badge, Skeleton, StatCard } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";

export default function ReferralsPage() {
  const { success } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: profile } = useQuery<any>({
    queryKey: ["profile"],
    queryFn: async () => { const r = await api.get("/users/me"); return r.data; },
  });

  const { data: referrals = [], isLoading } = useQuery<any[]>({
    queryKey: ["referrals"],
    queryFn: async () => { const r = await api.get("/referrals/me"); return r.data || []; },
  });

  const referralCode = profile?.referral_code || "SABJI" + (profile?.id || "").slice(-6).toUpperCase();
  const referralLink = `https://sbjiwala.qzz.ioz.io/register?ref=${referralCode}`;

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    success("Code copied!", "Share it with friends to earn ₹50");
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "Join Sbjiwala — Fresh Veggies in Instant!",
        text: `Use my code ${referralCode} and get ₹50 off your first order! 🥦🍅`,
        url: referralLink,
      });
    } else {
      navigator.clipboard.writeText(referralLink);
      success("Link copied!", "Share this link with friends");
    }
  };

  const totalEarnings = referrals.filter((r: any) => r.status === "completed").length * 50;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white">Refer & Earn</h1>

      {/* Hero */}
      <div className="gradient-brand rounded-3xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 text-[120px] opacity-10 -translate-y-4 translate-x-6 pointer-events-none">🎁</div>
        <div className="relative z-10 space-y-3">
          <div className="text-4xl">🎁</div>
          <h2 className="text-2xl font-black">Earn ₹50 per referral!</h2>
          <p className="text-emerald-200">Invite friends to Sbjiwala. You both get ₹50 wallet credit when they place their first order.</p>
        </div>
      </div>

      {/* How it works */}
      <div className="card p-5 space-y-4">
        <h2 className="font-black text-slate-900 dark:text-white">How It Works</h2>
        <div className="space-y-3">
          {[
            { n: "1", text: "Share your unique referral code with friends" },
            { n: "2", text: "Friend registers using your code" },
            { n: "3", text: "They place their first order" },
            { n: "4", text: "You both get ₹50 wallet credit instantly!" },
          ].map(step => (
            <div key={step.n} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-sm font-black flex items-center justify-center flex-shrink-0">{step.n}</div>
              <p className="text-sm text-slate-700 dark:text-slate-300 pt-0.5">{step.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Your Code */}
      <div className="card p-5 space-y-4">
        <h2 className="font-black text-slate-900 dark:text-white">Your Referral Code</h2>
        <div className="flex gap-2">
          <div className="flex-1 border-2 border-dashed border-emerald-400 dark:border-emerald-600 rounded-2xl px-4 py-3 flex items-center justify-center">
            <span className="text-xl font-black tracking-[0.2em] text-emerald-700 dark:text-emerald-400 font-mono">{referralCode}</span>
          </div>
          <button
            onClick={copyCode}
            className={`px-4 rounded-2xl border-2 font-black text-sm transition-all ${copied ? "bg-emerald-600 border-emerald-600 text-white" : "border-emerald-400 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"}`}
          >
            {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
        <Button fullWidth variant="secondary" onClick={share} leftIcon={<Share2 className="w-4 h-4" />}>
          Share Invite Link
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          title="Referrals"
          value={referrals.length}
          icon={<Users className="w-5 h-5" />}
          iconBg="bg-blue-50 dark:bg-blue-950/30"
          iconColor="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          title="Total Earned"
          value={`₹${totalEarnings}`}
          icon={<Wallet className="w-5 h-5" />}
        />
      </div>

      {/* Referral List */}
      {referrals.length > 0 && (
        <div>
          <h2 className="font-black text-slate-900 dark:text-white mb-3">Your Referrals</h2>
          <div className="card divide-y divide-slate-100 dark:divide-slate-800" style={{ padding: 0 }}>
            {referrals.map((ref: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-5 py-4">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white font-black flex items-center justify-center text-sm">
                  {ref.referred_name?.[0] || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-900 dark:text-white">{ref.referred_name || "Friend"}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(ref.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <Badge variant={ref.status === "completed" ? "success" : "warning"} size="sm">
                  {ref.status === "completed" ? "+₹50" : "Pending"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
