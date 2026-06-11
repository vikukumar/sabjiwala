"use client";

import React, { useState, useEffect } from "react";
import { User, Settings, Save, Loader2, Award, Bike } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";

export default function DeliveryProfilePage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();

  // Personal profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [displayName, setDisplayName] = useState("");

  // Fetch current user details
  const { data: userProfileData, isLoading: userLoading } = useQuery<any>({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await api.get("/users/me");
      return res.data;
    }
  });

  // Fetch delivery boy details
  const { data: deliveryProfileData, isLoading: deliveryLoading } = useQuery<any>({
    queryKey: ["deliveryProfile"],
    queryFn: async () => {
      const res = await api.get("/delivery/me");
      return res.data;
    }
  });

  const user = userProfileData || null;
  const delivery = deliveryProfileData || null;

  // Sync state values
  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
      setDisplayName(user.display_name || "");
      setBio(user.bio || "");
    }
  }, [user]);

  // Mutation to update personal profile details
  const updatePersonalProfileMutation = useMutation({
    mutationFn: async () => {
      return api.patch("/users/me", {
        first_name: firstName,
        last_name: lastName,
        display_name: displayName || `${firstName} ${lastName}`.trim(),
        bio: bio
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      success("Profile details update ho gaye hain!");
    },
    onError: (err: any) => {
      showError("Update Fail Ho Gaya", "Failed to update personal profile: " + (err.response?.data?.detail || err.message));
    }
  });

  const isLoading = userLoading || deliveryLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-[#090d10] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 font-sans p-4 md:p-8">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <a
            href={typeof window !== "undefined" && process.env.NEXT_PUBLIC_APP_MODE === "unified" ? "/delivery" : "/"}
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm cursor-pointer hover:bg-slate-50"
          >
            ← Back to Dashboard
          </a>
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">Delivery Partner Settings</h2>
        </div>

        {/* Personal Details Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600 dark:text-emerald-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Personal Information</h3>
              <p className="text-[10px] text-slate-500">Update your general contact profile details.</p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              updatePersonalProfileMutation.mutate();
            }}
            className="space-y-4 text-xs font-medium"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase">First Name *</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase">Display Name / Nickname</label>
              <input
                type="text"
                placeholder="e.g. Courier Swift"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase">Bio / Delivery Status Notes</label>
              <textarea
                placeholder="e.g. Clocking hours, active in South Zone..."
                value={bio}
                onChange={e => setBio(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-20 text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={updatePersonalProfileMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer text-xs"
            >
              {updatePersonalProfileMutation.isPending ? "Saving..." : "Save Profile Details"}
            </button>
          </form>
        </div>

        {/* Read-Only KYC & Vehicle Info */}
        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-xs font-black uppercase tracking-wider">Locked KYC & Vehicle Details</h4>
          </div>
          <p className="text-[10px] text-slate-450 leading-relaxed">
            Your verified background check status and vehicle registry. Contact Admin support for updates.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium">
            <div className="space-y-1">
              <label className="font-bold text-slate-455 uppercase">Vehicle Type</label>
              <input
                type="text"
                disabled
                value={delivery?.vehicle_type?.toUpperCase() || "SCOOTER / BIKE"}
                className="w-full px-3 py-2 border border-slate-205 dark:border-slate-800 rounded-xl bg-slate-105/50 dark:bg-slate-950/30 text-slate-400 font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-455 uppercase">License / Vehicle Number</label>
              <input
                type="text"
                disabled
                value={delivery?.vehicle_number || "MH-43-AB-1234"}
                className="w-full px-3 py-2 border border-slate-205 dark:border-slate-800 rounded-xl bg-slate-105/50 dark:bg-slate-950/30 text-slate-400 font-bold font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-455 uppercase">Registration Status</label>
              <input
                type="text"
                disabled
                value={delivery?.status?.toUpperCase() || "APPROVED"}
                className="w-full px-3 py-2 border border-slate-205 dark:border-slate-800 rounded-xl bg-slate-105/50 dark:bg-slate-950/30 text-emerald-505 dark:text-emerald-400 font-black"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-455 uppercase">Wallet Balance</label>
              <input
                type="text"
                disabled
                value={`₹${delivery?.wallet_balance || "0.00"}`}
                className="w-full px-3 py-2 border border-slate-205 dark:border-slate-800 rounded-xl bg-slate-105/50 dark:bg-slate-950/30 text-slate-400 font-bold"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
