"use client";

import React from "react";
import DeliveryLayout, { useDelivery } from "@/components/DeliveryLayout";
import { Star, Bike, BadgeCheck, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import versionInfo from "@/app/version.json";

function ProfileTabContent() {
  const router = useRouter();
  const { profile } = useDelivery();

  const vehicleTypes: Record<string, string> = {
    scooty: "🛵 Scooty",
    bike: "🏍️ Bike",
    bicycle: "🚲 Bicycle",
    truck: "🚚 Truck",
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    approved: { label: "Verified ✓", color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400" },
    pending: { label: "Pending Review", color: "text-amber-600 bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400" },
    rejected: { label: "Action Required", color: "text-rose-600 bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400" },
  };

  const status = statusConfig[profile?.kyc_status || "pending"];
  const rating = profile?.average_rating ?? 4.8;
  const totalDeliveries = profile?.total_deliveries ?? 0;

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("sw_access_token");
      localStorage.removeItem("sw_refresh_token");
      const isUnified = process.env.NEXT_PUBLIC_APP_MODE === "unified";
      router.replace(isUnified ? "/delivery/login" : "/login");
    }
  };

  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-3xl">
            🧑‍🦱
          </div>
          <div>
            <h3 className="text-lg font-black">{profile?.full_name || "Delivery Partner"}</h3>
            <p className="text-slate-400 text-xs">{profile?.phone || ""}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs font-bold bg-white/10 px-2 py-0.5 rounded-full">
                {vehicleTypes[profile?.vehicle_type || "scooty"] || "🛵 Scooty"}
              </span>
              {profile?.vehicle_number && (
                <span className="text-xs font-mono text-slate-300">{profile.vehicle_number}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Star className="w-4 h-4 text-amber-500 fill-current" />
            <span className="text-lg font-black text-slate-900 dark:text-white">{rating.toFixed(1)}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase">Rating</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-center">
          <p className="text-lg font-black text-slate-900 dark:text-white">{totalDeliveries}</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase">Deliveries</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-center">
          <div className={`text-xs font-bold px-2 py-1 rounded-lg ${status.color}`}>
            {status.label}
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">KYC</p>
        </div>
      </div>

      {/* Info List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
        {[
          { icon: Phone, label: "Phone", value: profile?.phone || "Not set" },
          { icon: Bike, label: "Vehicle", value: vehicleTypes[profile?.vehicle_type || "scooty"] || "Scooty" },
          { icon: BadgeCheck, label: "KYC Status", value: status.label },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Icon className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-white">{value}</span>
          </div>
        ))}
      </div>

      {/* Logout */}
      <button onClick={handleLogout}
        className="w-full bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-bold py-3 rounded-2xl border border-rose-200 dark:border-rose-900/40 transition-all text-sm cursor-pointer">
        Log Out
      </button>

      <p className="text-center text-[10px] text-slate-400 font-mono">Sbjiwala Delivery v{versionInfo.version}</p>
    </div>
  );
}

export default function DeliveryProfilePage() {
  return (
    <DeliveryLayout>
      <ProfileTabContent />
    </DeliveryLayout>
  );
}
