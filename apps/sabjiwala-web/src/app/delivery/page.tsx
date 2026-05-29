"use client";

import React, { useState, useEffect } from "react";
import { 
  Navigation, CheckCircle2, AlertCircle, ShoppingBag, 
  MapPin, ToggleLeft, ToggleRight, DollarSign, Wallet, Loader2
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sabjiwala/shared";
import versionInfo from "./version.json";

export default function DeliveryAgentDashboard() {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

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

  // 2. Fetch active assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<any[]>({
    queryKey: ["deliveryAssignments"],
    queryFn: async () => {
      const res = await api.get("/delivery/assignments");
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // 3. Toggle Online/Offline Mutation
  const toggleOnlineMutation = useMutation({
    mutationFn: async (online: boolean) => {
      return api.patch("/delivery/availability", {
        is_available: online
      });
    },
    onSuccess: (_, online) => {
      setIsOnline(online);
      queryClient.invalidateQueries({ queryKey: ["deliveryAssignments"] });
    }
  });

  // 4. Pickup Order Mutation
  const pickupOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return api.post(`/delivery/orders/${orderId}/pickup`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryAssignments"] });
      alert("Order picked up successfully. It is now out for delivery!");
    },
    onError: (err: any) => {
      alert("Pickup failed: " + (err.response?.data?.detail || err.message));
    }
  });

  // 5. Deliver Order Mutation
  const deliverOrderMutation = useMutation({
    mutationFn: async ({ orderId, otp }: { orderId: string; otp: string }) => {
      return api.post(`/delivery/orders/${orderId}/deliver`, {
        order_id: orderId,
        otp: otp
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryAssignments"] });
      alert("Order delivered successfully! Payment captured.");
    },
    onError: (err: any) => {
      alert("Delivery verification failed: " + (err.response?.data?.detail || err.message));
    }
  });

  const handleToggleOnline = () => {
    toggleOnlineMutation.mutate(!isOnline);
  };

  const handleUpdateStatus = (id: string, currentStatus: string) => {
    if (currentStatus === "assigned" || currentStatus === "packed" || currentStatus === "accepted") {
      pickupOrderMutation.mutate(id);
    } else {
      // Prompt for delivery verification OTP (seeded or customer provided)
      const otp = prompt("Please enter the 4-digit Delivery OTP from the customer:");
      if (otp) {
        deliverOrderMutation.mutate({ orderId: id, otp });
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-55 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 antialiased font-sans flex flex-col pb-8 transition-colors duration-200">
      {/* Top Banner */}
      <header className="sticky top-0 z-50 bg-emerald-600 dark:bg-slate-900 text-white shadow-md transition-colors duration-200">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight">SabjiWala</span>
            <span className="text-[10px] uppercase bg-emerald-700 dark:bg-emerald-950/80 text-white dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-full">
              Delivery
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Custom Theme Switcher */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-emerald-700/80 dark:bg-slate-800 text-white dark:text-slate-350 hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center justify-center border border-emerald-800/50 dark:border-slate-700"
              title={theme === "light" ? "Switch to Dark Soil Mode" : "Switch to Light Veggie Mode"}
            >
              {theme === "light" ? (
                <span className="text-sm" role="img" aria-label="light mode">🍋</span>
              ) : (
                <span className="text-sm" role="img" aria-label="dark mode">🍆</span>
              )}
            </button>

            {/* Toggle Online */}
            <button 
              onClick={handleToggleOnline}
              disabled={toggleOnlineMutation.isPending}
              className="flex items-center gap-1.5 bg-emerald-700/80 dark:bg-slate-800 hover:bg-emerald-800 dark:hover:bg-slate-700 transition-colors px-3.5 py-1.5 rounded-full text-xs font-bold disabled:opacity-50 border border-emerald-800/50 dark:border-slate-700"
            >
              {isOnline ? (
                <>
                  <ToggleRight className="w-5 h-5 text-green-400" />
                  <span>ONLINE</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-5 h-5 text-slate-300 dark:text-slate-500" />
                  <span>OFFLINE</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-md w-full mx-auto px-4 py-6 space-y-6 flex-1">
        {/* Earnings Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800 transition-colors duration-200">
          <div className="pr-4 space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Earnings Today</span>
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-black text-xl">
              <DollarSign className="w-5 h-5" />
              <span>₹350.00</span>
            </div>
          </div>
          
          <div className="pl-4 space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Cash In Hand</span>
            <div className="flex items-center gap-1 text-slate-900 dark:text-slate-50 font-black text-xl">
              <Wallet className="w-5 h-5" />
              <span>₹220.00</span>
            </div>
          </div>
        </div>

        {/* Assignments Header */}
        <div className="flex justify-between items-center px-1">
          <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Active Deliveries ({assignments.length})</h3>
          {!isOnline && (
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-955/20 border border-amber-100 dark:border-amber-900/40 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Go Online to get orders
            </span>
          )}
        </div>

        {/* Assignments List */}
        <div className="space-y-4">
          {assignmentsLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
              <span className="text-sm text-slate-500 dark:text-slate-400 font-semibold">Checking assignments...</span>
            </div>
          ) : isOnline && assignments.length > 0 ? (
            assignments.map((task) => {
              const destAddr = task.delivery_address || {};
              const formattedAddr = destAddr.formatted_address || 
                `${destAddr.address_line_1 || ""}, ${destAddr.city || ""}`;
              
              return (
                <div key={task.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 transition-colors duration-200">
                  {/* Header */}
                  <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500">Order ID: #{task.order_number}</span>
                      <h4 className="font-extrabold text-slate-900 dark:text-slate-50">{destAddr.full_name || "Customer"}</h4>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                      task.status === "assigned" || task.status === "packed"
                        ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400"
                        : "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400"
                    }`}>
                      {task.status}
                    </span>
                  </div>

                  {/* Route Details */}
                  <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-350">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5" />
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">Pickup Store:</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">Green Grocers Ltd</p>
                        <p className="text-slate-400 dark:text-slate-500">Sector 14, Vashi</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Navigation className="w-4 h-4 text-emerald-600 dark:text-emerald-450 mt-0.5" />
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">Delivery Address:</p>
                        <p className="text-slate-550 dark:text-slate-400">{formattedAddr}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action details */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block uppercase">Collect Cash</span>
                      <span className="font-black text-slate-900 dark:text-slate-50 text-sm">
                        {task.payment_method === "cod" ? `₹${task.total_amount}` : "Prepaid (Online)"}
                      </span>
                    </div>

                    <button
                      onClick={() => handleUpdateStatus(task.id, task.status)}
                      disabled={pickupOrderMutation.isPending || deliverOrderMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50"
                    >
                      {task.status === "assigned" || task.status === "packed" || task.status === "accepted"
                        ? "Confirm Pickup" 
                        : "Verify OTP & Deliver"}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-center text-slate-400 dark:text-slate-500 text-sm space-y-2 transition-colors duration-200">
              <ShoppingBag className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-650" />
              <p>{isOnline ? "No active assignments right now." : "You are currently offline. Toggle online to start receiving orders."}</p>
            </div>
          )}
        </div>
      </main>

      <footer className="text-center py-4 mt-8 border-t border-slate-200/50 dark:border-slate-850 transition-colors duration-200">
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
          SabjiWala Delivery v{versionInfo.version}
        </span>
      </footer>
    </div>
  );
}
