"use client";

import React, { useState, useEffect } from "react";
import { User, Shield, Save, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";

export default function AdminProfilePage() {
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

  const user = userProfileData || null;

  // Sync state values
  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
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
      success("Profile details updated successfully!");
    },
    onError: (err: any) => {
      showError("Update Failed", "Failed to update admin profile: " + (err.response?.data?.detail || err.message));
    }
  });

  if (userLoading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-[#090d10] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-55/30 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 font-sans p-4 md:p-8">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <a
            href="/admin"
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm cursor-pointer hover:bg-slate-50"
          >
            ← Back to Board
          </a>
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">Administrator settings</h2>
        </div>

        {/* Profile Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600 dark:text-emerald-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Personal Info</h3>
              <p className="text-[10px] text-slate-500">Edit your administrator personal details.</p>
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
              <label className="font-bold text-slate-500 uppercase">Display Name / Alias</label>
              <input
                type="text"
                placeholder="e.g. Master Control"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase">Bio / Office Notes</label>
              <textarea
                placeholder="e.g. Sbjiwala Senior Operations Supervisor..."
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
              {updatePersonalProfileMutation.isPending ? "Saving..." : "Save Administrator Details"}
            </button>
          </form>
        </div>

        {/* Security Role Info */}
        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-205 dark:border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-xs font-black uppercase tracking-wider">Security Access Level</h4>
          </div>
          <div className="text-xs">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-150 dark:border-slate-800">
              <span className="font-bold text-slate-500">Current Role</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">SUPER ADMIN</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
