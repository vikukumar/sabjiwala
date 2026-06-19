"use client";

import React, { useState } from "react";
import { TrendingUp, ShoppingBag, Star, Users, Package, Loader2, ArrowUpRight, BarChart2, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import VendorLayout from "@/components/VendorLayout";

function MiniBarChart({ data, color = "#10b981" }: { data: number[]; color?: string }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((val, i) => (
        <div key={i} className="flex-1 rounded-t-sm transition-all" style={{ height: `${(val / max) * 100}%`, background: color, opacity: 0.7 + (i / data.length) * 0.3 }} />
      ))}
    </div>
  );
}

export default function VendorAnalyticsPage() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  const { data: analytics, isLoading } = useQuery<any>({
    queryKey: ["vendorAnalytics", period],
    queryFn: async () => {
      const res = await api.get("/vendors/me/analytics", { params: { period } });
      return res.data;
    },
  });

  const { data: topProducts = [] } = useQuery<any[]>({
    queryKey: ["vendorTopProducts"],
    queryFn: async () => {
      const res = await api.get("/vendors/me/top-products", { params: { limit: 10 } });
      return res.data || [];
    },
  });

  const metrics = [
    { label: "Total Revenue", value: `₹${(analytics?.total_revenue || 0).toFixed(2)}`, change: analytics?.revenue_change || 0, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
    { label: "Total Orders", value: analytics?.total_orders || 0, change: analytics?.orders_change || 0, icon: ShoppingBag, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
    { label: "Avg Rating", value: `${(analytics?.average_rating || 0).toFixed(1)} ⭐`, change: analytics?.rating_change || 0, icon: Star, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20" },
    { label: "Unique Customers", value: analytics?.unique_customers || 0, change: analytics?.customers_change || 0, icon: Users, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/20" },
  ];

  const revenueData: number[] = analytics?.revenue_trend || Array.from({ length: 7 }, () => Math.floor(Math.random() * 5000) + 1000);
  const ordersData: number[] = analytics?.orders_trend || Array.from({ length: 7 }, () => Math.floor(Math.random() * 50) + 10);

  return (
    <VendorLayout title="Analytics">
      <div className="space-y-6">
        {/* Period Selector */}
        <div className="flex items-center justify-between">
          <h2 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-emerald-500" />
            Performance Analytics
          </h2>
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(["7d", "30d", "90d"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${period === p ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"}`}>
                {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "3 Months"}
              </button>
            ))}
          </div>
        </div>

        {/* Metrics Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map(({ label, value, change, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-xl ${bg}`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  {change !== 0 && (
                    <span className={`text-[10px] font-black flex items-center gap-0.5 ${change > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      <ArrowUpRight className={`w-3 h-3 ${change < 0 ? "rotate-180" : ""}`} />
                      {Math.abs(change)}%
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">{String(value)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Revenue Chart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 dark:text-white text-sm">Revenue Trend</h3>
              <span className="text-[10px] text-slate-400 font-bold">{period}</span>
            </div>
            <MiniBarChart data={revenueData} color="#10b981" />
            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
              <span>Lowest: ₹{Math.min(...revenueData).toLocaleString()}</span>
              <span>Highest: ₹{Math.max(...revenueData).toLocaleString()}</span>
            </div>
          </div>

          {/* Orders Chart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 dark:text-white text-sm">Orders Trend</h3>
              <span className="text-[10px] text-slate-400 font-bold">{period}</span>
            </div>
            <MiniBarChart data={ordersData} color="#3b82f6" />
            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
              <span>Lowest: {Math.min(...ordersData)} orders</span>
              <span>Highest: {Math.max(...ordersData)} orders</span>
            </div>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-500" />
              Top Selling Products
            </h3>
          </div>
          {(topProducts as any[]).length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold">No data available yet</p>
              <p className="text-xs">Data appears after your first orders are completed.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {(topProducts as any[]).map((product: any, i: number) => (
                <div key={product.id || i} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-sm font-black text-slate-600 dark:text-slate-400">
                      {product.attributes?.image_emoji || "🥦"}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{product.name}</p>
                      <p className="text-[10px] text-slate-400">{product.category || "Vegetables"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900 dark:text-white">₹{(product.revenue || 0).toFixed(2)}</p>
                    <p className="text-[10px] text-slate-400">{product.units_sold || 0} units</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order Status Breakdown */}
        {analytics?.order_status_breakdown && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h3 className="font-black text-slate-900 dark:text-white text-sm mb-4">Order Status Breakdown</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(analytics.order_status_breakdown).map(([status, count]: [string, any]) => (
                <div key={status} className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-slate-900 dark:text-white">{count}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{status.replace("_", " ")}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </VendorLayout>
  );
}
