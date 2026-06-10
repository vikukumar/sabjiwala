"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import {
  Wallet, Plus, ArrowUpRight, ArrowDownLeft, Clock, CreditCard,
  Gift, TrendingUp, Shield, Zap, IndianRupee, RefreshCw
} from "lucide-react";
import { Button, Card, Badge, Skeleton, EmptyState, StatCard } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";

const CASHFREE_ENABLED = Boolean(process.env.NEXT_PUBLIC_CASHFREE_APP_ID);

const TXN_ICONS: Record<string, any> = {
  credit: ArrowDownLeft,
  debit: ArrowUpRight,
  refund: Gift,
  reward: Zap,
  cashback: Gift,
  top_up: TrendingUp,
};

const TXN_COLORS: Record<string, { text: string; bg: string }> = {
  credit: { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  debit: { text: "text-rose-500 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/30" },
  refund: { text: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30" },
  reward: { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" },
  cashback: { text: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/30" },
  top_up: { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
};

function AddMoneyModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState(200);
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(false);
  const presets = [100, 200, 500, 1000];

  const handleAdd = async () => {
    if (amount < 10) { showError("Minimum ₹10", "Please enter at least ₹10"); return; }
    setLoading(true);
    try {
      if (CASHFREE_ENABLED) {
        // Initiate via Cashfree
        const res = await api.post("/wallets/me/add", { amount, source: "cashfree" });
        const { payment_session_id } = res.data || {};
        if (payment_session_id && typeof window !== "undefined" && (window as any).Cashfree) {
          const cf = new (window as any).Cashfree({
            mode: process.env.NEXT_PUBLIC_CASHFREE_ENV === "production" ? "production" : "sandbox",
          });
          await cf.checkout({ paymentSessionId: payment_session_id, returnUrl: window.location.href });
        }
      } else {
        // Direct credit (dev mode / no payment gateway)
        await api.post("/wallets/me/add", { amount, source: "manual" });
        success(`₹${amount} added to wallet!`, "Your wallet balance has been updated.");
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      showError("Failed", err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-sm space-y-5 animate-slide-up">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-900 dark:text-white">Add Money</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Amount Input */}
        <div className="space-y-3">
          <div className="relative bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">₹</span>
            <input
              type="number" value={amount} onChange={e => setAmount(Number(e.target.value))}
              className="w-full bg-transparent pl-7 text-3xl font-black text-slate-900 dark:text-white focus:outline-none"
              min={10} max={10000} placeholder="0"
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {presets.map(p => (
              <button key={p} onClick={() => setAmount(p)}
                className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${amount === p ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-emerald-400"}`}>
                ₹{p}
              </button>
            ))}
          </div>
        </div>

        <Button fullWidth size="lg" loading={loading} onClick={handleAdd}
          leftIcon={CASHFREE_ENABLED ? <CreditCard className="w-4 h-4" /> : <Plus className="w-4 h-4" />}>
          {CASHFREE_ENABLED ? "Pay via Cashfree" : "Add to Wallet"}
        </Button>

        <div className="flex items-center gap-2 justify-center">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          <p className="text-xs text-center text-slate-400">
            {CASHFREE_ENABLED ? "Secure payments powered by Cashfree PG" : "Wallet top-up (payment gateway not configured)"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function WalletPage() {
  const [showAddMoney, setShowAddMoney] = useState(false);
  const queryClient = useQueryClient();

  const { data: walletData, isLoading: walletLoading } = useQuery<any>({
    queryKey: ["wallet"],
    queryFn: async () => { const r = await api.get("/wallets/me"); return r.data; },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
  });

  const { data: transactions = [], isLoading: txnLoading } = useQuery<any[]>({
    queryKey: ["walletTransactions"],
    queryFn: async () => { const r = await api.get("/wallets/me/transactions"); return r.data || []; },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
  });

  const balance = walletData?.balance || 0;
  const totalCredited = parseFloat(walletData?.total_credited || "0");
  const totalDebited = parseFloat(walletData?.total_debited || "0");

  const txnsByMonth: Record<string, any[]> = {};
  transactions.forEach((txn: any) => {
    const key = new Date(txn.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    if (!txnsByMonth[key]) txnsByMonth[key] = [];
    txnsByMonth[key].push(txn);
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-24">
      {showAddMoney && (
        <AddMoneyModal
          onClose={() => setShowAddMoney(false)}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["wallet"] }); queryClient.invalidateQueries({ queryKey: ["walletTransactions"] }); }}
        />
      )}

      <h1 className="text-2xl font-black text-slate-900 dark:text-white">My Wallet</h1>

      {/* Balance Card */}
      <div className="relative overflow-hidden rounded-3xl p-6 text-white" style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 50%, #0f766e 100%)" }}>
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-emerald-200" />
            <p className="text-emerald-200 text-xs font-bold uppercase tracking-wider">Available Balance</p>
          </div>
          {walletLoading ? (
            <div className="h-10 w-32 bg-white/20 rounded-xl animate-pulse mb-4" />
          ) : (
            <p className="text-4xl font-black mb-4">₹{balance.toFixed(2)}</p>
          )}
          <Button
            variant="outline"
            className="border-white/30 text-white hover:bg-white/20"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowAddMoney(true)}
          >
            Add Money
          </Button>
        </div>
        <IndianRupee className="absolute bottom-4 right-6 w-20 h-20 text-white/8" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950/30 rounded-lg">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Added</span>
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white">₹{totalCredited.toFixed(0)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-rose-50 dark:bg-rose-950/30 rounded-lg">
              <ArrowUpRight className="w-4 h-4 text-rose-500 dark:text-rose-400" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Used</span>
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white">₹{totalDebited.toFixed(0)}</p>
        </div>
      </div>

      {/* Transaction History */}
      <div className="space-y-3">
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Transaction History</h2>
        {txnLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <Wallet className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-slate-500">No transactions yet</p>
            <p className="text-xs text-slate-400">Add money to your wallet to get started</p>
            <Button variant="secondary" size="sm" onClick={() => setShowAddMoney(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>Add Money</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(txnsByMonth).map(([month, monthTxns]) => (
              <div key={month} className="space-y-2">
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider px-1">{month}</p>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {monthTxns.map((txn: any) => {
                    const txnType = txn.transaction_type || txn.type || "debit";
                    const Icon = TXN_ICONS[txnType] || Clock;
                    const colors = TXN_COLORS[txnType] || TXN_COLORS.debit;
                    const isCredit = ["credit", "refund", "reward", "cashback", "top_up"].includes(txnType);
                    return (
                      <div key={txn.id} className="flex items-center gap-3 px-4 py-3.5">
                        <div className={`p-2 rounded-xl flex-shrink-0 ${colors.bg}`}>
                          <Icon className={`w-4 h-4 ${colors.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {txn.description || txnType.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-slate-400">
                            {new Date(txn.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <p className={`font-black text-base flex-shrink-0 ${colors.text}`}>
                          {isCredit ? "+" : "-"}₹{parseFloat(txn.amount || 0).toFixed(2)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
