"use client";

import React, { useState } from "react";
import { api } from "@sbjiwala/shared";
import DeliveryLayout, { useDelivery } from "@/components/DeliveryLayout";
import { useToast } from "@/components/ui/Toast";
import { Send, Loader2 } from "lucide-react";

function PayoutTabContent() {
  const { success, error: showError } = useToast();
  const { profile } = useDelivery();
  const walletBalance = profile?.wallet_balance ?? 0;

  const [payoutMethod, setPayoutMethod] = useState<"upi" | "bank">("upi");
  const [upiId, setUpiId] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePayout = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      showError("Galat Amount", "Kripya sahi payout amount enter karein.");
      return;
    }
    if (parseFloat(amount) > walletBalance) {
      showError("Balance Kam Hai", "Payout amount aapke wallet balance se zyada hai.");
      return;
    }
    if (payoutMethod === "upi" && !upiId) {
      showError("UPI ID Chahiye", "Kripya apni UPI ID enter karein.");
      return;
    }
    if (payoutMethod === "bank" && (!accountNo || !ifscCode || !accountName)) {
      showError("Bank Details Adhoori Hain", "Kripya saare bank details fill karein.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/delivery/payout", {
        amount: parseFloat(amount),
        method: payoutMethod,
        upi_id: payoutMethod === "upi" ? upiId : undefined,
        bank_name: payoutMethod === "bank" ? bankName : undefined,
        account_number: payoutMethod === "bank" ? accountNo : undefined,
        ifsc_code: payoutMethod === "bank" ? ifscCode : undefined,
        account_holder_name: payoutMethod === "bank" ? accountName : undefined,
      });
      success("Payout Request Submit Ho Gayi! 🎉", `₹${amount} payout request bhej di gayi hai. 24-48 ghante mein process ho jayegi.`);
      setAmount("");
    } catch (err: any) {
      showError("Payout Fail Ho Gaya", err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Withdraw Earnings</h3>
        <p className="text-xs text-slate-500 mt-0.5">Transfer your wallet balance to your bank account or UPI</p>
      </div>

      {/* Available Balance */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white">
        <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider">Available to Withdraw</p>
        <p className="text-3xl font-black mt-1">₹{walletBalance.toFixed(2)}</p>
        <p className="text-emerald-200 text-xs mt-1">Wallet Balance</p>
      </div>

      {/* Amount Input */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
        <label className="text-xs font-bold text-slate-500 uppercase">Withdrawal Amount (₹)</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-500">₹</span>
          <input
            type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00" min={1} max={walletBalance}
            className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-lg font-black text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex gap-2">
          {[100, 200, 500].filter(p => p <= walletBalance).map(p => (
            <button key={p} onClick={() => setAmount(String(p))}
              className={`flex-grow py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${parseFloat(amount) === p ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"}`}>
              ₹{p}
            </button>
          ))}
          {walletBalance > 0 && (
            <button onClick={() => setAmount(String(walletBalance.toFixed(2)))}
              className={`flex-grow py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${parseFloat(amount) === walletBalance ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"}`}>
              All
            </button>
          )}
        </div>
      </div>

      {/* Method Toggle */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {(["upi", "bank"] as const).map(method => (
            <button key={method} onClick={() => setPayoutMethod(method)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${payoutMethod === method ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"}`}>
              {method === "upi" ? "📱 UPI" : "🏦 Bank Transfer"}
            </button>
          ))}
        </div>

        {payoutMethod === "upi" ? (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">UPI ID</label>
            <input type="text" value={upiId} onChange={e => setUpiId(e.target.value)}
              placeholder="yourname@upi"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Account Holder Name</label>
                <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)}
                  placeholder="Full Name" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Bank Name</label>
                <input type="text" value={bankName} onChange={e => setBankName(e.target.value)}
                  placeholder="e.g. SBI" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Account Number</label>
              <input type="text" value={accountNo} onChange={e => setAccountNo(e.target.value)}
                placeholder="Enter account number"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">IFSC Code</label>
              <input type="text" value={ifscCode} onChange={e => setIfscCode(e.target.value.toUpperCase())}
                placeholder="e.g. SBIN0001234" maxLength={11}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 uppercase" />
            </div>
          </div>
        )}

        <button onClick={handlePayout} disabled={loading || !amount || parseFloat(amount) <= 0}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {loading ? "Processing..." : "Request Payout"}
        </button>
        <p className="text-[10px] text-center text-slate-400">Payouts are processed within 24–48 hours on business days.</p>
      </div>
    </div>
  );
}

export default function DeliveryPayoutPage() {
  return (
    <DeliveryLayout>
      <PayoutTabContent />
    </DeliveryLayout>
  );
}
