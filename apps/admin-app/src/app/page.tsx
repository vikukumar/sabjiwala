"use client";

import React, { useState, useEffect } from "react";
import { 
  Building2, Users, Receipt, Settings, 
  CheckCircle2, XCircle, Database, ShieldAlert, Sparkles, ChevronRight, Loader2, Menu, X
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sabjiwala/shared";
import versionInfo from "./version.json";

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [commissionRate, setCommissionRate] = useState(5.0);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("sw_theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // 1. Route Protection check
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("sw_access_token")) {
      window.location.href = "/login";
    }
  }, []);

  // 2. Fetch platform metrics
  const { data: metricsData } = useQuery<any>({
    queryKey: ["adminMetrics"],
    queryFn: async () => {
      const res = await api.get("/admin/metrics");
      return res.data;
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // 3. Fetch pending KYC applications
  const { data: pendingVendors = [], isLoading: vendorsLoading } = useQuery<any[]>({
    queryKey: ["pendingVendors"],
    queryFn: async () => {
      const res = await api.get("/admin/vendors/pending");
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // 4. Fetch DB schema evolution logs
  const { data: schemaLogs = [], isLoading: logsLoading } = useQuery<any[]>({
    queryKey: ["schemaLogs"],
    queryFn: async () => {
      const res = await api.get("/admin/schema-logs");
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // 5. Vendor verification mutation (Approve/Reject)
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
      alert("Vendor verification processed successfully!");
    },
    onError: (err: any) => {
      alert("Verification update failed: " + (err.response?.data?.detail || err.message));
    }
  });

  // 6. Settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      return api.patch("/admin/settings/commission_rate", {
        value: commissionRate.toString()
      });
    },
    onSuccess: () => {
      alert("System commission rate updated successfully!");
    },
    onError: (err: any) => {
      alert("Failed to save settings: " + (err.response?.data?.detail || err.message));
    }
  });

  // Fetch initial commission rate setting on mount
  useQuery({
    queryKey: ["systemSettings"],
    queryFn: async () => {
      const res = await api.get("/admin/settings");
      if (res.data && res.data.commission_rate) {
        setCommissionRate(parseFloat(res.data.commission_rate));
      }
      return res.data;
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  const metrics = metricsData || {
    total_revenue: 0,
    total_orders: 0,
    estimated_commission: 0,
    active_users: 0,
    active_vendors: 0
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 antialiased font-sans flex transition-colors duration-200">
      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden font-sans">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          {/* Drawer Content */}
          <aside className="relative w-64 max-w-xs bg-slate-900 text-slate-300 flex flex-col justify-between p-6 border-r border-slate-800 h-full">
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="/logo_horizontal.png" alt="SabjiWala Logo" className="h-6 w-auto object-contain brightness-0 invert" />
                  <span className="text-[9px] uppercase tracking-wider bg-slate-800 text-slate-400 font-bold px-1.5 py-0.5 rounded">
                    Admin
                  </span>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1">
                <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-800 text-white font-medium text-sm transition-all">
                  <Building2 className="w-5 h-5" />
                  <span>Vendors Oversight</span>
                </a>
                <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-800 hover:text-white text-sm transition-all">
                  <Database className="w-5 h-5" />
                  <span>Auto Migration Logs</span>
                </a>
                <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-800 hover:text-white text-sm transition-all">
                  <Settings className="w-5 h-5" />
                  <span>System Settings</span>
                </a>
              </nav>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-850 rounded-xl p-4 space-y-1 border border-slate-800">
                <p className="text-xs text-slate-550">Authenticated as</p>
                <h4 className="text-sm font-bold text-white">System Admin</h4>
                <span className="inline-block bg-emerald-500/10 text-emerald-400 text-[10px] font-extrabold px-2 py-0.5 rounded">
                  SUPER_USER
                </span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-slate-500 font-mono tracking-wider">
                  SabjiWala v{versionInfo.version}
                </span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col justify-between p-6 border-r border-slate-800 flex-shrink-0">
        <div className="space-y-8">
          <div className="flex items-center gap-2">
            <img src="/logo_horizontal.png" alt="SabjiWala Logo" className="h-6 w-auto object-contain brightness-0 invert" />
            <span className="text-[10px] uppercase tracking-wider bg-slate-800 text-slate-450 font-bold px-2.5 py-0.5 rounded">
              Super Admin
            </span>
          </div>

          <nav className="space-y-1">
            <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-800 text-white font-medium text-sm transition-all">
              <Building2 className="w-5 h-5" />
              <span>Vendors Oversight</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-800 hover:text-white text-sm transition-all">
              <Database className="w-5 h-5" />
              <span>Auto Migration Logs</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-800 hover:text-white text-sm transition-all">
              <Settings className="w-5 h-5" />
              <span>System Settings</span>
            </a>
          </nav>
        </div>

        <div className="space-y-3">
          <div className="bg-slate-850 rounded-xl p-4 space-y-1 border border-slate-800">
            <p className="text-xs text-slate-555">Authenticated as</p>
            <h4 className="text-sm font-bold text-white">System Admin</h4>
            <span className="inline-block bg-emerald-500/10 text-emerald-400 text-[10px] font-extrabold px-2 py-0.5 rounded">
              SUPER_USER
            </span>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-slate-500 font-mono tracking-wider">
              SabjiWala v{versionInfo.version}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between shadow-sm transition-colors duration-200 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            {/* Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-355"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            <div className="flex items-center gap-2 md:hidden">
              <img src="/logo_horizontal.png" alt="SabjiWala Logo" className="h-7 w-auto object-contain" />
              <span className="text-[9px] uppercase bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold px-1.5 py-0.5 rounded-full">
                Admin
              </span>
            </div>

            <h2 className="text-base md:text-lg font-black text-slate-800 dark:text-slate-100 hidden md:block">
              Platform Administration Control
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-955/20 border border-emerald-100 dark:border-emerald-900/40 px-3 py-1.5 rounded-full">
              <Sparkles className="w-4 h-4" />
              <span>Platform Status: Live & Optimal</span>
            </div>

            {/* Custom Theme Switcher */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-500/30"
              title={theme === "light" ? "Switch to Dark Soil Mode" : "Switch to Light Veggie Mode"}
            >
              {theme === "light" ? (
                <span className="text-sm" role="img" aria-label="light mode">🍋</span>
              ) : (
                <span className="text-sm" role="img" aria-label="dark mode">🍆</span>
              )}
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-8 space-y-8 max-w-6xl w-full mx-auto">
          {/* Metrics Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex items-center justify-between shadow-sm transition-colors duration-200">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Active Vendors</span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50">{metrics.active_vendors}</h3>
              </div>
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-955/20 rounded-2xl text-emerald-600 dark:text-emerald-450">
                <Building2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex items-center justify-between shadow-sm transition-colors duration-200">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Registered Users</span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50">{metrics.active_users}</h3>
              </div>
              <div className="p-3.5 bg-blue-50 dark:bg-blue-955/20 rounded-2xl text-blue-600 dark:text-blue-450">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex items-center justify-between shadow-sm transition-colors duration-200">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Super Admin Revenue</span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50">₹{metrics.estimated_commission.toFixed(2)}</h3>
              </div>
              <div className="p-3.5 bg-amber-50 dark:bg-amber-955/20 rounded-2xl text-amber-500 dark:text-amber-450">
                <Receipt className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Vendor KYC Applications */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col transition-colors duration-200">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Pending Vendor verifications</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">Review KYC documents submitted by applicants</p>
              </div>

              <div className="flex-1 divide-y divide-slate-100 dark:divide-slate-800">
                {vendorsLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-450 animate-spin" />
                    <span className="text-sm text-slate-500 dark:text-slate-455 font-semibold">Loading applicants...</span>
                  </div>
                ) : pendingVendors.length > 0 ? (
                  pendingVendors.map((vendor) => (
                    <div key={vendor.id} className="p-6 flex justify-between items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-all">
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">{vendor.name}</h4>
                        <p className="text-xs text-slate-550 dark:text-slate-400">Contact: {vendor.contact}</p>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">Doc: {vendor.docType} • {new Date(vendor.time).toLocaleString()}</p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => verifyVendorMutation.mutate({ id: vendor.id, approve: false })}
                          disabled={verifyVendorMutation.isPending}
                          className="p-2 border border-slate-200 dark:border-slate-800 hover:border-red-250 dark:hover:border-red-800 text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-all disabled:opacity-50"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => verifyVendorMutation.mutate({ id: vendor.id, approve: true })}
                          disabled={verifyVendorMutation.isPending}
                          className="bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Approve
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-sm">
                    All vendor registrations are processed.
                  </div>
                )}
              </div>
            </div>

            {/* Auto Schema Evolutions */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col transition-colors duration-200">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Auto Database Evolution logs</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-550">Schema modifications automatically synchronized</p>
                </div>
                <Database className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              </div>

              <div className="flex-1 divide-y divide-slate-100 dark:divide-slate-800 max-h-[400px] overflow-y-auto">
                {logsLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-450 animate-spin" />
                    <span className="text-sm text-slate-500 dark:text-slate-455">Retrieving schema history...</span>
                  </div>
                ) : schemaLogs.length > 0 ? (
                  schemaLogs.map((log) => (
                    <div key={log.id} className="p-6 space-y-2 hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-all">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-extrabold text-slate-900 dark:text-slate-100">{log.table.toUpperCase()}</span>
                        <span className="text-slate-400 dark:text-slate-500">{new Date(log.date).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs text-slate-650 dark:text-slate-350 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/50 dark:border-slate-850 p-2.5 rounded-xl font-mono">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold mr-1">[{log.type}]</span>
                        {log.desc}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-sm">
                    No schema evolution logs registered yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* System settings form */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4 transition-colors duration-200">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Quick Platform Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Vendor Commission Rate (%)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(parseFloat(e.target.value))}
                    className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-2.5 text-sm w-32 focus:border-emerald-500 outline-none"
                  />
                  <span className="text-xs text-slate-400 dark:text-slate-500">Default rate taken from vendor revenue</span>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button 
                  onClick={() => saveSettingsMutation.mutate()}
                  disabled={saveSettingsMutation.isPending}
                  className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white border border-slate-800 dark:border-slate-700 font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-md disabled:opacity-50"
                >
                  {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
