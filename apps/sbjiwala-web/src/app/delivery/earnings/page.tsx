"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import DeliveryLayout, { useDelivery } from "@/components/DeliveryLayout";
import { IndianRupee, Loader2 } from "lucide-react";

function EarningsTabContent() {
  const { profile } = useDelivery();

  const walletBalance = profile?.wallet_balance ?? 0;
  const cashInHand = profile?.cash_in_hand ?? 0;
  const todayEarnings = profile?.today_earnings ?? 0;
  const totalDeliveries = profile?.total_deliveries ?? 0;

  const { data: transactions = [], isLoading } = useQuery<any[]>({
    queryKey: ["deliveryEarnings"],
    queryFn: async () => {
      const res = await api.get("/delivery/earnings");
      const data = res.data?.data || res.data || {};
      const txns = data.transactions;
      return Array.isArray(txns) ? txns : [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
  });

  return (
    <div className="space-y-4">
      <h3 className="text-base font-black text-slate-800 dark:text-slate-100 px-1">Earnings Overview</h3>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white">
          <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-wider">Wallet Balance</p>
          <p className="text-2xl font-black mt-1">₹{walletBalance.toFixed(2)}</p>
          <p className="text-emerald-200 text-[10px] mt-1">Available to withdraw</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Cash In Hand</p>
          <p className="text-2xl font-black mt-1 text-slate-900 dark:text-white">₹{cashInHand.toFixed(2)}</p>
          <p className="text-slate-400 text-[10px] mt-1">COD collected</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Today's Earnings</p>
          <p className="text-lg font-black text-amber-600 dark:text-amber-400">₹{todayEarnings.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Deliveries</p>
          <p className="text-lg font-black text-blue-600 dark:text-blue-400">{totalDeliveries}</p>
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-2 px-1">Recent Transactions</h4>
        {isLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
            <IndianRupee className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No transactions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((txn: any) => (
              <div key={txn.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${txn.type === "credit" ? "bg-emerald-100 dark:bg-emerald-950/30" : "bg-rose-100 dark:bg-rose-950/30"}`}>
                    <IndianRupee className={`w-4 h-4 ${txn.type === "credit" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-white">{txn.description || "Delivery Earning"}</p>
                    <p className="text-[10px] text-slate-400">{new Date(txn.created_at).toLocaleDateString("en-IN")}</p>
                  </div>
                </div>
                <p className={`text-sm font-black ${txn.type === "credit" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {txn.type === "credit" ? "+" : "-"}₹{txn.amount?.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DeliveryEarningsPage() {
  return (
    <DeliveryLayout>
      <EarningsTabContent />
    </DeliveryLayout>
  );
}
