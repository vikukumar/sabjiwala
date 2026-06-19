"use client";

import React, { useState } from "react";
import {
  IndianRupee, TrendingUp, Clock, CheckCircle2, Loader2,
  Send, CreditCard, ArrowUpRight, ArrowDownLeft, Wallet
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import VendorLayout, { resolveVendorLink } from "@/components/VendorLayout";

export default function VendorEarningsPage() {
  const { success, error: showError } = useToast();
  const [payoutMethod, setPayoutMethod] = useState<"upi" | "bank">("upi");
  const [upiId, setUpiId] = useState("");
  const [bankDetails, setBankDetails] = useState({ account_name: "", account_number: "", ifsc: "", bank_name: "" });
  const [amount, setAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "payout">("overview");

  const { data: earnings, isLoading: earningsLoading } = useQuery<any>({
    queryKey: ["vendorEarnings"],
    queryFn: async () => {
      const res = await api.get("/vendors/me/earnings");
      return res.data;
    },
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery<any[]>({
    queryKey: ["vendorTransactions"],
    queryFn: async () => {
      const res = await api.get("/vendors/me/transactions");
      return res.data || [];
    },
  });

  const payoutMutation = useMutation({
    mutationFn: async () => api.post("/vendors/me/payout", {
      amount: parseFloat(amount),
      method: payoutMethod,
      upi_id: payoutMethod === "upi" ? upiId : undefined,
      ...( payoutMethod === "bank" ? { bank_name: bankDetails.bank_name, account_number: bankDetails.account_number, ifsc_code: bankDetails.ifsc, account_holder_name: bankDetails.account_name } : {})
    }),
    onSuccess: () => {
      success("Payout Request Submitted! 🎉", `₹${amount} will be credited within 2-3 business days.`);
      setAmount("");
    },
    onError: (err: any) => showError("Payout Failed", err.response?.data?.detail || err.message),
  });

  const walletBalance = earnings?.wallet_balance || 0;
  const totalEarnings = earnings?.total_earnings || 0;
  const pendingSettlement = earnings?.pending_settlement || 0;
  const todayEarnings = earnings?.today_earnings || 0;
  const totalOrders = earnings?.total_orders || 0;

  const metrics = [
    { label: "Wallet Balance", value: `₹${walletBalance.toFixed(2)}`, sub: "Available to withdraw", color: "from-emerald-500 to-teal-600", textColor: "text-emerald-100" },
    { label: "Total Earnings", value: `₹${totalEarnings.toFixed(2)}`, sub: "All-time", color: "from-blue-500 to-indigo-600", textColor: "text-blue-100" },
    { label: "Today's Revenue", value: `₹${todayEarnings.toFixed(2)}`, sub: "Today", color: "from-amber-500 to-orange-600", textColor: "text-amber-100" },
    { label: "Pending Settlement", value: `₹${pendingSettlement.toFixed(2)}`, sub: "Processing", color: "from-purple-500 to-violet-600", textColor: "text-purple-100" },
  ];

  return (
    <VendorLayout title="Earnings & Payouts">
      <div className="space-y-6">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {earningsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ))
          ) : metrics.map((m) => (
            <div key={m.label} className={`bg-gradient-to-br ${m.color} rounded-2xl p-5 text-white shadow-lg`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${m.textColor}`}>{m.label}</p>
              <p className="text-2xl font-black mt-1">{m.value}</p>
              <p className={`text-[10px] mt-1 ${m.textColor}`}>{m.sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
          {[
            { id: "overview", label: "📊 Overview" },
            { id: "transactions", label: "📋 Transactions" },
            { id: "payout", label: "💸 Request Payout" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === tab.id ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="font-black text-slate-900 dark:text-white text-sm">Performance</h3>
              {[
                { label: "Total Orders Completed", value: totalOrders, icon: CheckCircle2, color: "text-emerald-500" },
                { label: "Average Order Value", value: `₹${totalOrders ? (totalEarnings / totalOrders).toFixed(2) : "0"}`, icon: TrendingUp, color: "text-blue-500" },
                { label: "Platform Commission (est.)", value: `₹${(totalEarnings * 0.05).toFixed(2)}`, icon: IndianRupee, color: "text-amber-500" },
                { label: "Net Revenue", value: `₹${(totalEarnings * 0.95).toFixed(2)}`, icon: Wallet, color: "text-purple-500" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-xs text-slate-600 dark:text-slate-400">{label}</span>
                  </div>
                  <span className="text-xs font-black text-slate-900 dark:text-white">{String(value)}</span>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="font-black text-slate-900 dark:text-white text-sm">Settlement Info</h3>
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">💡 How Settlements Work</p>
                <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
                  <li>Earnings credited after delivery confirmation</li>
                  <li>Settlement processed within 2-3 business days</li>
                  <li>Minimum payout amount: ₹100</li>
                  <li>Platform fee: 5% on each order</li>
                </ul>
              </div>
              <button
                onClick={() => setActiveTab("payout")}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Send className="w-4 h-4" />
                Request Payout Now
              </button>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === "transactions" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-slate-900 dark:text-white text-sm">Transaction History</h3>
            </div>
            {txLoading ? (
              <div className="py-12 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
            ) : (transactions as any[]).length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <IndianRupee className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-semibold text-sm">No transactions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {(transactions as any[]).map((txn: any) => (
                  <div key={txn.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${txn.type === "credit" ? "bg-emerald-100 dark:bg-emerald-950/30" : "bg-rose-100 dark:bg-rose-950/30"}`}>
                        {txn.type === "credit" ? <ArrowUpRight className="w-5 h-5 text-emerald-600" /> : <ArrowDownLeft className="w-5 h-5 text-rose-600" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-white">{txn.description || "Transaction"}</p>
                        <p className="text-[10px] text-slate-400">{new Date(txn.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-black ${txn.type === "credit" ? "text-emerald-600" : "text-rose-600"}`}>
                      {txn.type === "credit" ? "+" : "-"}₹{parseFloat(txn.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Payout Tab */}
        {activeTab === "payout" && (
          <div className="max-w-lg space-y-4">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg">
              <p className="text-emerald-100 text-xs font-bold uppercase">Available Balance</p>
              <p className="text-4xl font-black mt-1">₹{walletBalance.toFixed(2)}</p>
              <p className="text-emerald-200 text-xs mt-1">Minimum withdrawal: ₹100</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
              <label className="text-xs font-bold text-slate-500 uppercase">Withdrawal Amount (₹)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-500">₹</span>
                <input
                  type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0.00" min={100} max={walletBalance}
                  className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-lg font-black text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-2">
                {[500, 1000, 2000].filter(a => a <= walletBalance).map(a => (
                  <button key={a} onClick={() => setAmount(String(a))}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all ${parseFloat(amount) === a ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"}`}>
                    ₹{a}
                  </button>
                ))}
                {walletBalance >= 100 && (
                  <button onClick={() => setAmount(walletBalance.toFixed(2))}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all ${parseFloat(amount) === walletBalance ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"}`}>
                    All
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {(["upi", "bank"] as const).map(m => (
                  <button key={m} onClick={() => setPayoutMethod(m)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${payoutMethod === m ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"}`}>
                    {m === "upi" ? "📱 UPI" : "🏦 Bank Transfer"}
                  </button>
                ))}
              </div>

              {payoutMethod === "upi" ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">UPI ID</label>
                  <input type="text" value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="yourname@upi"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    { key: "account_name", label: "Account Holder Name", placeholder: "Full Name" },
                    { key: "bank_name", label: "Bank Name", placeholder: "e.g. SBI, HDFC" },
                    { key: "account_number", label: "Account Number", placeholder: "Enter account number" },
                    { key: "ifsc", label: "IFSC Code", placeholder: "e.g. SBIN0001234" },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key} className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">{label}</label>
                      <input type="text" value={(bankDetails as any)[key]} placeholder={placeholder}
                        onChange={e => setBankDetails(p => ({ ...p, [key]: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => payoutMutation.mutate()}
                disabled={payoutMutation.isPending || !amount || parseFloat(amount) < 100 || parseFloat(amount) > walletBalance}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {payoutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {payoutMutation.isPending ? "Processing..." : "Request Payout"}
              </button>
              <p className="text-[10px] text-center text-slate-400">Payouts are processed within 2-3 business days.</p>
            </div>
          </div>
        )}
      </div>
    </VendorLayout>
  );
}
