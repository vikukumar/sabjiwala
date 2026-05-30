"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, Clock, CreditCard, Gift, TrendingUp } from "lucide-react";
import { Button, Card, Badge, Skeleton, EmptyState, StatCard } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";

const TXN_ICONS: Record<string, any> = {
  credit: ArrowDownLeft,
  debit: ArrowUpRight,
  refund: Gift,
};

const TXN_COLORS: Record<string, string> = {
  credit: "text-emerald-600 dark:text-emerald-400",
  debit: "text-rose-500 dark:text-rose-400",
  refund: "text-blue-600 dark:text-blue-400",
};

function AddMoneyModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState(200);
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(false);
  const presets = [100, 200, 500, 1000];

  const handleAdd = async () => {
    setLoading(true);
    try {
      await api.post("/wallets/me/add", { amount, source: "razorpay" });
      success("₹" + amount + " added to wallet!", "Money added successfully");
      onClose();
    } catch (err: any) {
      showError("Payment failed", err.response?.data?.detail || err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm space-y-5 animate-slide-up">
        <h3 className="text-xl font-black text-slate-900 dark:text-white">Add Money to Wallet</h3>
        <div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-700 dark:text-slate-300">₹</span>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className="input-base px-4 py-4 pl-8 text-2xl font-black text-center"
              min={10}
              max={10000}
            />
          </div>
          <div className="flex gap-2 mt-3">
            {presets.map(p => (
              <button key={p} onClick={() => setAmount(p)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${amount === p ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-emerald-400"}`}>
                ₹{p}
              </button>
            ))}
          </div>
        </div>
        <Button fullWidth size="lg" loading={loading} onClick={handleAdd} leftIcon={<CreditCard className="w-4 h-4" />}>
          Pay via Razorpay
        </Button>
        <p className="text-xs text-center text-slate-500 dark:text-slate-400">Secure payments powered by Razorpay</p>
      </div>
    </div>
  );
}

export default function WalletPage() {
  const [showAddMoney, setShowAddMoney] = useState(false);

  const { data: walletData, isLoading: walletLoading } = useQuery<any>({
    queryKey: ["wallet"],
    queryFn: async () => { const r = await api.get("/wallets/me"); return r.data; },
  });

  const { data: transactions = [], isLoading: txnLoading } = useQuery<any[]>({
    queryKey: ["walletTransactions"],
    queryFn: async () => { const r = await api.get("/wallets/me/transactions"); return r.data || []; },
  });

  const balance = walletData?.balance || 0;
  const totalCredits = transactions.filter((t: any) => t.type === "credit").reduce((s: number, t: any) => s + t.amount, 0);
  const totalDebits = transactions.filter((t: any) => t.type === "debit").reduce((s: number, t: any) => s + t.amount, 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {showAddMoney && <AddMoneyModal onClose={() => setShowAddMoney(false)} />}

      <h1 className="text-2xl font-black text-slate-900 dark:text-white">My Wallet</h1>

      {/* Balance Card */}
      <div className="gradient-brand rounded-3xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="relative z-10">
          <p className="text-emerald-200 text-sm font-semibold mb-1">Available Balance</p>
          <p className="text-4xl font-black mb-4">₹{balance.toFixed(2)}</p>
          <Button
            variant="outline"
            className="border-white/30 text-white hover:bg-white/20"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowAddMoney(true)}
          >
            Add Money
          </Button>
        </div>
        <Wallet className="absolute bottom-4 right-6 w-20 h-20 text-white/10" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          title="Total Added"
          value={`₹${totalCredits.toFixed(0)}`}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Total Used"
          value={`₹${totalDebits.toFixed(0)}`}
          icon={<ArrowUpRight className="w-5 h-5" />}
          iconBg="bg-rose-50 dark:bg-rose-950/30"
          iconColor="text-rose-500 dark:text-rose-400"
        />
      </div>

      {/* Transactions */}
      <div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3">Transaction History</h2>
        {txnLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : transactions.length === 0 ? (
          <EmptyState emoji="💳" title="No transactions yet" description="Your wallet activity will appear here." />
        ) : (
          <Card padding="none" className="divide-y divide-slate-100 dark:divide-slate-800">
            {transactions.map((txn: any) => {
              const Icon = TXN_ICONS[txn.type] || Clock;
              const colorClass = TXN_COLORS[txn.type] || "text-slate-500";
              return (
                <div key={txn.id} className="flex items-center gap-3 px-5 py-4">
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${txn.type === "credit" ? "bg-emerald-50 dark:bg-emerald-950/30" : txn.type === "debit" ? "bg-rose-50 dark:bg-rose-950/30" : "bg-blue-50 dark:bg-blue-950/30"}`}>
                    <Icon className={`w-4 h-4 ${colorClass}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{txn.description || txn.type}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(txn.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <p className={`font-black text-base flex-shrink-0 ${colorClass}`}>
                    {txn.type === "debit" ? "-" : "+"}₹{txn.amount.toFixed(2)}
                  </p>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}
