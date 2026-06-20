"use client";

import React from "react";
import {
  Building2, Users, Receipt, DollarSign, Database, XCircle, CheckCircle2,
  TrendingUp, ArrowUpRight, ShieldAlert, Clock, ShoppingBag, Loader2
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import AdminLayout from "@/components/AdminLayout";
import Link from "next/link";

export default function AdminDashboard() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();

  // Metrics summary
  const { data: metricsData, isLoading: metricsLoading } = useQuery<any>({
    queryKey: ["adminMetrics"],
    queryFn: async () => {
      const res = await api.get("/admin/metrics");
      return res.data;
    }
  });

  // Pending vendor KYC queue
  const { data: pendingVendors = [], isLoading: pendingVendorsLoading } = useQuery<any[]>({
    queryKey: ["pendingVendors"],
    queryFn: async () => {
      const res = await api.get("/admin/vendors/pending");
      return res.data || [];
    }
  });

  // Database evolution logs
  const { data: schemaLogs = [], isLoading: logsLoading } = useQuery<any[]>({
    queryKey: ["adminSchemaLogs"],
    queryFn: async () => {
      const res = await api.get("/admin/schema-logs");
      return res.data || [];
    }
  });

  // Verify Vendor Mutation
  const verifyVendorMutation = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const status = approve ? "approved" : "rejected";
      return api.post(`/admin/vendors/${id}/verify`, null, {
        params: { status }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingVendors"] });
      queryClient.invalidateQueries({ queryKey: ["adminMetrics"] });
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      success("Vendor KYC status updated successfully!");
    },
    onError: (err: any) => {
      showError("KYC Action Failed", err.response?.data?.detail || err.message);
    }
  });

  const metrics = metricsData || {
    total_revenue: 0,
    total_orders: 0,
    estimated_commission: 0,
    active_users: 0,
    active_vendors: 0,
    pending_orders: 0,
    pending_kyc: 0
  };

  return (
    <AdminLayout title="Dashboard Overview">
      <div className="space-y-6 text-slate-800 dark:text-slate-100 font-sans">
        
        {/* Core Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Active Vendors", value: metrics.active_vendors, icon: Building2, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20", href: "/vendors" },
            { label: "Registered Users", value: metrics.active_users, icon: Users, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/20", href: "/users" },
            { label: "Commission Collected", value: `₹${(metrics.estimated_commission || 0).toFixed(2)}`, icon: DollarSign, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20", href: "/settings" },
            { label: "Processed Orders", value: metrics.total_orders, icon: Receipt, color: "text-rose-600 bg-rose-50 dark:bg-rose-950/20", href: "/orders" }
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Link
                key={i}
                href={stat.href}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm hover:border-emerald-500/30 transition-all group"
              >
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">{stat.label}</span>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{stat.value}</h3>
                </div>
                <div className={`p-3 rounded-xl ${stat.color} group-hover:scale-105 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Live operational quick overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-6 shadow-lg border border-slate-850 flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">Live Operations Panel</span>
              </div>
              <h2 className="text-xl font-black mt-3 leading-tight max-w-md">Real-Time Tracking Dispatch Board</h2>
              <p className="text-xs text-slate-400 mt-2 max-w-sm">Monitor online vendors, active delivery riders, and live mapping routing metrics globally.</p>
            </div>
            <Link
              href="/maps"
              className="bg-emerald-650 hover:bg-emerald-600 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all inline-flex items-center gap-2 w-fit mt-4 uppercase tracking-wider"
            >
              Open Live Tracking Map <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Quick Platform Status */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-2">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Platform Health</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">Live service parameters checks</p>
            </div>
            <div className="space-y-3 pt-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Order Queues</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{metrics.pending_orders} pending confirmation</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Pending KYC approvals</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{metrics.pending_kyc} partners queue</span>
              </div>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-850 pt-3 mt-4 text-[10px] text-slate-400 font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-emerald-500" />
              <span>All systems operational</span>
            </div>
          </div>
        </div>

        {/* Queues & Evolution logs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending KYC Registration Queue */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">KYC Registration Queue</h3>
                <p className="text-xs text-slate-455 dark:text-slate-500">Unverified Vendor partner documents pending review</p>
              </div>
              <Link href="/vendors" className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
                View All Queue →
              </Link>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-850 flex-1 overflow-y-auto max-h-[350px] custom-scrollbar">
              {pendingVendorsLoading ? (
                <div className="p-12 text-center text-slate-400 flex justify-center"><Loader2 className="w-6 h-6 text-emerald-500 animate-spin" /></div>
              ) : pendingVendors.length > 0 ? (
                pendingVendors.map((vendor) => (
                  <div key={vendor.id} className="p-4 flex justify-between items-center gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{vendor.name}</h4>
                      <p className="text-xs text-slate-500">{vendor.contact}</p>
                      <span className="text-[10px] text-slate-400">Registered: {new Date(vendor.time).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => verifyVendorMutation.mutate({ id: vendor.id, approve: false })}
                        className="p-2 border border-slate-200 dark:border-slate-800 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => verifyVendorMutation.mutate({ id: vendor.id, approve: true })}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3.5 py-1.5 rounded-lg font-bold shadow-sm cursor-pointer"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-slate-400 dark:text-slate-550 text-xs">
                  All registrations verified. Queue empty!
                </div>
              )}
            </div>
          </div>

          {/* Database Migration Logs */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Schema Evolution Logs</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">Database mutations updated automatically</p>
              </div>
              <Database className="w-5 h-5 text-slate-450 dark:text-slate-500" />
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-850 flex-1 overflow-y-auto max-h-[350px] custom-scrollbar">
              {logsLoading ? (
                <div className="p-12 text-center text-slate-400 flex justify-center"><Loader2 className="w-6 h-6 text-emerald-500 animate-spin" /></div>
              ) : schemaLogs.length > 0 ? (
                schemaLogs.map((log) => (
                  <div key={log.id} className="p-4 space-y-1 hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                      <span>{log.table || "SYSTEM"}</span>
                      <span>{new Date(log.date).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-xs font-mono bg-slate-50 dark:bg-slate-950 p-2 rounded-lg text-slate-655 dark:text-slate-350">
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold mr-1.5">[{log.type}]</span>
                      {log.desc}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-slate-400 dark:text-slate-550 text-xs">No migration logs present.</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
