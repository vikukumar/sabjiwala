"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp, Users, ShoppingBag, DollarSign,
  Settings, Award, RefreshCw, Clock, MapPin, Loader2, Menu, X
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import versionInfo from "./version.json";

export default function VendorDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
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

  // 2. Fetch metrics
  const { data: metricsData } = useQuery<any>({
    queryKey: ["vendorMetrics"],
    queryFn: async () => {
      const res = await api.get("/vendors/me/metrics");
      return res.data;
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // 2b. Fetch vendor profile
  const { data: vendorProfileData } = useQuery<any>({
    queryKey: ["vendorProfile"],
    queryFn: async () => {
      const res = await api.get("/vendors/me");
      return res.data;
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // 3. Fetch incoming/recent orders
  const { data: ordersData, isLoading: ordersLoading } = useQuery<any>({
    queryKey: ["vendorOrders", activeTab],
    queryFn: async () => {
      const res = await api.get("/orders", {
        params: {
          status: activeTab !== "all" ? activeTab : undefined
        }
      });
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // 4. Mutation to accept and pack order
  const acceptOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return api.patch(`/orders/${orderId}/status`, {
        status: "packed",
        notes: "Order accepted and packed by vendor"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorOrders"] });
      queryClient.invalidateQueries({ queryKey: ["vendorMetrics"] });
      alert("Order accepted and marked as packed successfully!");
    },
    onError: (err: any) => {
      alert("Failed to update order: " + (err.response?.data?.detail || err.message));
    }
  });

  const vendorProfile = vendorProfileData || null;
  const businessName = vendorProfile?.business_name || "Green Grocers Ltd";
  const vendorStatus = vendorProfile?.status || "pending";

  const metrics = metricsData || {
    total_sales: 0,
    total_orders: 0,
    wallet_balance: 0,
    pending_balance: 0
  };

  const orders = ordersData || [];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 antialiased font-sans flex transition-colors duration-200">
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
                  <img src="/logo_horizontal.png" alt="Sbjiwala Logo" className="h-6 w-auto object-contain brightness-0 invert" />
                  <span className="text-[9px] uppercase tracking-wider bg-slate-800 text-slate-400 font-bold px-1.5 py-0.5 rounded">
                    Vendor
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
                  <ShoppingBag className="w-5 h-5" />
                  <span>Dashboard</span>
                </a>
                <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-800 hover:text-white text-sm transition-all">
                  <TrendingUp className="w-5 h-5" />
                  <span>Inventory</span>
                </a>
                <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-800 hover:text-white text-sm transition-all">
                  <MapPin className="w-5 h-5" />
                  <span>Service Area</span>
                </a>
                <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-800 hover:text-white text-sm transition-all">
                  <Settings className="w-5 h-5" />
                  <span>Settings</span>
                </a>
              </nav>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-850 rounded-xl p-4 space-y-1 border border-slate-800">
                <p className="text-xs text-slate-550">Log in as</p>
                <h4 className="text-sm font-bold text-white">{businessName}</h4>
                <span 
                  className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded cursor-pointer ${
                    vendorStatus === "approved"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : vendorStatus === "documents_submitted" || vendorStatus === "under_review"
                      ? "bg-blue-500/10 text-blue-400"
                      : "bg-rose-500/10 text-rose-400 hover:underline"
                  }`}
                  onClick={() => {
                    if (vendorStatus !== "approved") window.location.href = "/kyc";
                  }}
                >
                  {vendorStatus.toUpperCase()}
                </span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-slate-500 font-mono tracking-wider">
                  Sbjiwala v{versionInfo.version}
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
            <img src="/logo_horizontal.png" alt="Sbjiwala Logo" className="h-6 w-auto object-contain brightness-0 invert" />
            <span className="text-[10px] uppercase tracking-wider bg-slate-800 text-slate-450 font-bold px-2 py-0.5 rounded">
              Vendor
            </span>
          </div>

          <nav className="space-y-1">
            <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-800 text-white font-medium text-sm transition-all">
              <ShoppingBag className="w-5 h-5" />
              <span>Dashboard</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-800 hover:text-white text-sm transition-all">
              <TrendingUp className="w-5 h-5" />
              <span>Inventory</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-800 hover:text-white text-sm transition-all">
              <MapPin className="w-5 h-5" />
              <span>Service Area</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-800 hover:text-white text-sm transition-all">
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </a>
          </nav>
        </div>

        <div className="space-y-3">
          <div className="bg-slate-850 rounded-xl p-4 space-y-1 border border-slate-800">
            <p className="text-xs text-slate-550">Log in as</p>
            <h4 className="text-sm font-bold text-white">{businessName}</h4>
            <span 
              className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded cursor-pointer ${
                vendorStatus === "approved"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : vendorStatus === "documents_submitted" || vendorStatus === "under_review"
                  ? "bg-blue-500/10 text-blue-400"
                  : "bg-rose-500/10 text-rose-400 hover:underline"
              }`}
              onClick={() => {
                if (vendorStatus !== "approved") window.location.href = "/kyc";
              }}
            >
              {vendorStatus.toUpperCase()}
            </span>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-slate-500 font-mono tracking-wider">
              Sbjiwala v{versionInfo.version}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Layout */}
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
              <img src="/logo_horizontal.png" alt="Sbjiwala Logo" className="h-7 w-auto object-contain" />
              <span className="text-[9px] uppercase bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold px-1.5 py-0.5 rounded-full">
                Vendor
              </span>
            </div>

            <h2 className="text-base md:text-lg font-black text-slate-800 dark:text-slate-100 hidden md:block">
              Store Performance Overview
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
              <span>Accepting Orders: 09:00 AM - 09:00 PM</span>
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
          {vendorStatus !== "approved" && (
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-amber-500/10 dark:from-amber-955/20 dark:to-amber-955/20 border border-amber-300 dark:border-amber-900/60 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm backdrop-blur-sm">
              <div className="space-y-1">
                <h4 className="text-sm font-black text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  ⚠️ Action Required: Complete Store KYC
                </h4>
                <p className="text-xs text-slate-600 dark:text-amber-400/80 mt-0.5">
                  {vendorStatus === "rejected"
                    ? `Verification rejected: "${vendorProfile?.rejection_reason || 'Please upload valid documents'}"`
                    : vendorStatus === "documents_submitted" || vendorStatus === "under_review"
                    ? "Your verification documents are currently being reviewed by admin officers."
                    : "Your store profile is pending document verification. Verify PAN, FSSAI, and business credentials."}
                </p>
              </div>
              {vendorStatus !== "documents_submitted" && vendorStatus !== "under_review" && (
                <a
                  href="/kyc"
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-black px-5 py-3 rounded-xl transition-all shadow-sm flex-shrink-0"
                >
                  Verify Documents Now
                </a>
              )}
            </div>
          )}
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6 flex items-center justify-between shadow-sm transition-colors duration-200">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Sales</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50">₹{metrics.total_sales}</h3>
              </div>
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl text-emerald-600 dark:text-emerald-400">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6 flex items-center justify-between shadow-sm transition-colors duration-200">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Orders Fulfilled</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50">{metrics.total_orders}</h3>
              </div>
              <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 rounded-2xl text-blue-600 dark:text-blue-400">
                <ShoppingBag className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6 flex items-center justify-between shadow-sm transition-colors duration-200">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Wallet Balance</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50">₹{metrics.wallet_balance}</h3>
              </div>
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-2xl text-amber-500 dark:text-amber-400">
                <Award className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6 flex items-center justify-between shadow-sm transition-colors duration-200">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Pending Balance</p>
                <h3 className="text-2xl font-black text-rose-600 dark:text-rose-455">₹{metrics.pending_balance}</h3>
              </div>
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 rounded-2xl text-rose-600 dark:text-rose-400">
                <RefreshCw className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Orders Section */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-0.5">
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Incoming Orders</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Real-time customer requests needing dispatch</p>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                {["all", "pending", "packed", "delivered"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-full capitalize transition-all ${activeTab === tab
                      ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-205"
                      }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Orders List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {ordersLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
                  <span className="text-sm text-slate-500 dark:text-slate-400">Fetching store orders...</span>
                </div>
              ) : orders.length > 0 ? (
                orders.map((order: any) => (
                  <div key={order.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-all">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 dark:text-slate-100">#Order {order.order_number}</span>
                        <span className="text-slate-400 dark:text-slate-550 text-xs">•</span>
                        <span className="text-xs text-slate-500 dark:text-slate-450">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Customer ID: {order.user_id.substring(0, 8)}...</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-450">Method: {order.payment_method.toUpperCase()} • Status: {order.payment_status}</p>
                    </div>

                    <div className="flex items-center gap-6 self-stretch md:self-auto justify-between">
                      <div className="space-y-1 text-right">
                        <span className="block font-black text-slate-950 dark:text-slate-50">₹{order.total_amount}</span>
                        <span className={`inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${order.status === "pending"
                          ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400"
                          : order.status === "packed"
                            ? "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400"
                            : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400"
                          }`}>
                          {order.status}
                        </span>
                      </div>

                      {order.status === "pending" && (
                        <button
                          onClick={() => acceptOrderMutation.mutate(order.id)}
                          disabled={acceptOrderMutation.isPending}
                          className="bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50"
                        >
                          {acceptOrderMutation.isPending ? "Updating..." : "Accept & Pack"}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
                  No orders found matching this status.
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
