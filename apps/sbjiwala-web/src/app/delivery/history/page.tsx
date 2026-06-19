"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import DeliveryLayout from "@/components/DeliveryLayout";
import { CheckCircle2, History, Loader2 } from "lucide-react";

function HistoryTabContent() {
  const { data: history = [], isLoading } = useQuery<any[]>({
    queryKey: ["deliveryHistory"],
    queryFn: async () => {
      const res = await api.get("/delivery/history");
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
  });

  if (isLoading) {
    return (
      <div className="py-16 flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <span className="text-sm text-slate-500">Loading history...</span>
      </div>
    );
  }

  if (!history.length) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
          <History className="w-8 h-8 text-slate-300 dark:text-slate-600" />
        </div>
        <p className="text-sm text-slate-500 font-medium">No completed deliveries yet.</p>
        <p className="text-xs text-slate-400">Your delivery history will appear here once you complete orders.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-base font-black text-slate-800 dark:text-slate-100 px-1">
        Delivery History ({history.length})
      </h3>
      <div className="space-y-2">
        {history.map((item: any) => (
          <div key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-450" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">#{item.order_number}</p>
                <p className="text-xs text-slate-500">{item.delivery_address?.city || "Delivery"}</p>
                <p className="text-[10px] text-slate-400">{item.delivered_at ? new Date(item.delivered_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">₹{item.total_amount}</p>
              <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">Delivered</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DeliveryHistoryPage() {
  return (
    <DeliveryLayout>
      <HistoryTabContent />
    </DeliveryLayout>
  );
}
