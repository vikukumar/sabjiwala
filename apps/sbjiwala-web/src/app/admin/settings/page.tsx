"use client";

import React, { useState, useEffect } from "react";
import { Settings, Save, AlertTriangle, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import AdminLayout from "@/components/AdminLayout";

export default function AdminSettingsPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();

  const [globalConfig, setGlobalConfig] = useState({
    app_name: "Sbjiwala",
    maintenance_mode: "false",
    platform_handling_fee: "5.00",
    free_platform_fee_above: "199.00",
    delivery_boy_rate_per_km: "10.00",
    subscription_bronze_price: "199",
    subscription_silver_price: "499",
    subscription_gold_price: "999",
    inventory_max_limit: "500"
  });

  // Global system settings
  const { data: systemSettings, isLoading } = useQuery<any>({
    queryKey: ["systemSettings"],
    queryFn: async () => {
      const res = await api.get("/admin/settings");
      if (res.data) {
        setGlobalConfig({
          app_name: res.data.app_name || "Sbjiwala",
          maintenance_mode: String(res.data.maintenance_mode || "false"),
          platform_handling_fee: String(res.data.platform_handling_fee || "5.00"),
          free_platform_fee_above: String(res.data.free_platform_fee_above || "199.00"),
          delivery_boy_rate_per_km: String(res.data.delivery_boy_rate_per_km || "10.00"),
          subscription_bronze_price: String(res.data.subscription_bronze_price || "199"),
          subscription_silver_price: String(res.data.subscription_silver_price || "499"),
          subscription_gold_price: String(res.data.subscription_gold_price || "999"),
          inventory_max_limit: String(res.data.inventory_max_limit || "500")
        });
      }
      return res.data;
    }
  });

  // Update System Settings
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return api.patch(`/admin/settings/${key}`, { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systemSettings"] });
    },
    onError: (err: any) => {
      showError("Failed to save system setting", err.message);
    }
  });

  const saveAllGlobalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      for (const [key, val] of Object.entries(globalConfig)) {
        await updateSettingMutation.mutateAsync({ key, value: val });
      }
      success("All system configuration and pricing settings saved!");
    } catch (err: any) {
      showError("Save Failed", err.message);
    }
  };

  return (
    <AdminLayout title="System Settings & Pricing Configuration">
      <div className="space-y-6 text-slate-800 dark:text-slate-100 font-sans max-w-4xl">
        {isLoading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
        ) : (
          <form onSubmit={saveAllGlobalSettings} className="space-y-6">
            {/* Pricing Section */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-850 pb-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">Global Pricing & Surcharges</h3>
                <p className="text-xs text-slate-500 mt-1">Configure global application commissions, packaging, and shipping rules</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Packaging & Handling Fee (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={globalConfig.platform_handling_fee}
                    onChange={e => setGlobalConfig(p => ({ ...p, platform_handling_fee: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                  <p className="text-[10px] text-slate-400">Flat packaging surcharge applied on all customer orders.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Global Free Platform Fee Above (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={globalConfig.free_platform_fee_above}
                    onChange={e => setGlobalConfig(p => ({ ...p, free_platform_fee_above: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                  <p className="text-[10px] text-slate-400">Order subtotal above which packaging fee is exempted globally.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Delivery Boy Rate (₹ per KM)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={globalConfig.delivery_boy_rate_per_km}
                    onChange={e => setGlobalConfig(p => ({ ...p, delivery_boy_rate_per_km: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                  <p className="text-[10px] text-slate-400">Rate paid automatically to public delivery boys per delivered KM.</p>
                </div>
              </div>

              <div className="border-b border-slate-100 dark:border-slate-850 pb-4 pt-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">Subscription Tier Packages</h3>
                <p className="text-xs text-slate-500 mt-1">Configure monthly pricing packages for VIP customers offering free shipping rules</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Bronze Package Pricing (₹)</label>
                  <input
                    type="number"
                    value={globalConfig.subscription_bronze_price}
                    onChange={e => setGlobalConfig(p => ({ ...p, subscription_bronze_price: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Silver Package Pricing (₹)</label>
                  <input
                    type="number"
                    value={globalConfig.subscription_silver_price}
                    onChange={e => setGlobalConfig(p => ({ ...p, subscription_silver_price: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Gold Package Pricing (₹)</label>
                  <input
                    type="number"
                    value={globalConfig.subscription_gold_price}
                    onChange={e => setGlobalConfig(p => ({ ...p, subscription_gold_price: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Config Preferences */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-850 pb-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">Global Preferences</h3>
                <p className="text-xs text-slate-500 mt-1">Configure brand name, source limit, and debug preferences</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Application Brand Name</label>
                  <input
                    type="text"
                    value={globalConfig.app_name}
                    onChange={e => setGlobalConfig(p => ({ ...p, app_name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Inventory Sourcing Max Limit (Items)</label>
                  <input
                    type="number"
                    value={globalConfig.inventory_max_limit}
                    onChange={e => setGlobalConfig(p => ({ ...p, inventory_max_limit: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                  <p className="text-[10px] text-slate-400">Limits catalog stock entry volumes vendors can register.</p>
                </div>
              </div>

              {/* Maintenance Mode */}
              <div className="space-y-3 bg-red-50/20 dark:bg-red-950/15 p-5 rounded-2xl border border-red-500/10">
                <div className="flex gap-3 items-center">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Emergency Maintenance Mode</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Toggle this setting to block customer and partner operations during backend upgrades.</p>
                  </div>
                </div>
                <div className="pt-2 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setGlobalConfig(p => ({ ...p, maintenance_mode: "true" }))}
                    className={`px-4 py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                      globalConfig.maintenance_mode === "true"
                        ? "bg-red-600 text-white border-red-700 shadow"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                    }`}
                  >
                    Enable Maintenance
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlobalConfig(p => ({ ...p, maintenance_mode: "false" }))}
                    className={`px-4 py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                      globalConfig.maintenance_mode === "false"
                        ? "bg-emerald-600 text-white border-emerald-700 shadow"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                    }`}
                  >
                    Disable Mode (Live App)
                  </button>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={updateSettingMutation.isPending}
                className="bg-emerald-650 hover:bg-emerald-600 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <Save className="w-4 h-4" /> Save System Config
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
}
