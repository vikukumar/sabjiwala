"use client";

import React, { useState, useEffect } from "react";
import { User, Settings, Save, Loader2, Award } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import VendorLayout from "@/components/VendorLayout";

export default function VendorProfilePage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();

  // Personal profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [displayName, setDisplayName] = useState("");

  // Business settings fields
  const [bizDesc, setBizDesc] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Fetch current user details
  const { data: userProfileData, isLoading: userLoading } = useQuery<any>({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await api.get("/users/me");
      return res.data;
    }
  });

  // Fetch vendor profile details
  const { data: vendorProfileData, isLoading: vendorLoading } = useQuery<any>({
    queryKey: ["vendorProfile"],
    queryFn: async () => {
      const res = await api.get("/vendors/me");
      return res.data;
    }
  });

  const user = userProfileData || null;
  const vendor = vendorProfileData || null;

  // Sync state values when data arrives
  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
      setDisplayName(user.display_name || "");
      setBio(user.bio || "");
    }
  }, [user]);

  useEffect(() => {
    if (vendor) {
      setBizDesc(vendor.description || "");
      setContactEmail(vendor.contact_email || "");
      setContactPhone(vendor.contact_phone || "");
    }
  }, [vendor]);

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
      success("Personal details updated successfully!");
    },
    onError: (err: any) => {
      showError("Update Failed", "Failed to update personal profile: " + (err.response?.data?.detail || err.message));
    }
  });

  // Mutation to update business settings
  const updateBusinessProfileMutation = useMutation({
    mutationFn: async () => {
      return api.patch("/vendors/me", {
        description: bizDesc,
        contact_email: contactEmail,
        contact_phone: contactPhone
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
      success("Business contact details updated successfully!");
    },
    onError: (err: any) => {
      showError("Update Failed", "Failed to update business contact: " + (err.response?.data?.detail || err.message));
    }
  });

  const isLoading = userLoading || vendorLoading;

  if (isLoading) {
    return (
      <VendorLayout title="Profile Management">
        <div className="py-20 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
          <span className="text-xs text-slate-505">Loading profile data...</span>
        </div>
      </VendorLayout>
    );
  }

  return (
    <VendorLayout title="Account Settings">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Personal Details */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600 dark:text-emerald-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Personal Info</h3>
              <p className="text-[10px] text-slate-500">Edit your user account details.</p>
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
              <label className="font-bold text-slate-500 uppercase">Display Name</label>
              <input
                type="text"
                placeholder="How your name appears to others"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase">Bio / Status</label>
              <textarea
                placeholder="A short sentence about you..."
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
              {updatePersonalProfileMutation.isPending ? "Saving..." : "Save Personal Details"}
            </button>
          </form>
        </div>

        {/* Business Settings & KYC Details (Read-only KYC) */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600 dark:text-emerald-400">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Business & Contact</h3>
                <p className="text-[10px] text-slate-500">Edit public contact details and description.</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateBusinessProfileMutation.mutate();
              }}
              className="space-y-4 text-xs font-medium"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500 uppercase">Contact Email</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={e => setContactEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500 uppercase">Contact Phone</label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Public Business Description</label>
                <textarea
                  value={bizDesc}
                  onChange={e => setBizDesc(e.target.value)}
                  placeholder="Describe your shop offerings..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-24 text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={updateBusinessProfileMutation.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer text-xs"
              >
                {updateBusinessProfileMutation.isPending ? "Saving..." : "Save Business Details"}
              </button>
            </form>
          </div>

          {/* Locked KYC Fields */}
          <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-slate-500">
              <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-xs font-black uppercase tracking-wider">Locked KYC Credentials</h4>
            </div>
            <p className="text-[10px] text-slate-450 leading-relaxed">
              These fields are verified regulatory documents and cannot be edited. Please contact the administrator team to modify them.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-450 uppercase">Store / Business Name</label>
                <input
                  type="text"
                  disabled
                  value={vendor?.business_name || ""}
                  className="w-full px-3 py-2 border border-slate-205 dark:border-slate-800 rounded-xl bg-slate-105/50 dark:bg-slate-950/30 text-slate-400 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-450 uppercase">Business Type</label>
                <input
                  type="text"
                  disabled
                  value={vendor?.business_type || ""}
                  className="w-full px-3 py-2 border border-slate-205 dark:border-slate-800 rounded-xl bg-slate-105/50 dark:bg-slate-950/30 text-slate-400 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-450 uppercase">PAN Code</label>
                <input
                  type="text"
                  disabled
                  value={vendor?.pan_number || "NOT SPECIFIED"}
                  className="w-full px-3 py-2 border border-slate-205 dark:border-slate-800 rounded-xl bg-slate-105/50 dark:bg-slate-950/30 text-slate-400 font-bold font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-450 uppercase">GST Registration</label>
                <input
                  type="text"
                  disabled
                  value={vendor?.gst_number || "NOT SPECIFIED"}
                  className="w-full px-3 py-2 border border-slate-205 dark:border-slate-800 rounded-xl bg-slate-105/50 dark:bg-slate-950/30 text-slate-400 font-bold font-mono"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-450 uppercase">FSSAI License Number</label>
                <input
                  type="text"
                  disabled
                  value={vendor?.fssai_number || "NOT SPECIFIED"}
                  className="w-full px-3 py-2 border border-slate-205 dark:border-slate-800 rounded-xl bg-slate-105/50 dark:bg-slate-950/30 text-slate-400 font-bold font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </VendorLayout>
  );
}
