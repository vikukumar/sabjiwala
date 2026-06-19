"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert, ShieldCheck, CheckCircle2, XCircle, ArrowLeft,
  Loader2, Mail, Phone, FileText, ExternalLink, Calendar, AlertCircle
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@sbjiwala/shared";
import versionInfo from "@/app/version.json";

export default function VerifyVendorClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();

  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Fetch complete vendor profile details
  const { data: vendor, isLoading, error: queryError } = useQuery<any>({
    queryKey: ["adminVendorDetail", id],
    queryFn: async () => {
      const res = await api.get(`/admin/vendors/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  // Verify Vendor Mutation (Approve / Reject)
  const verifyMutation = useMutation({
    mutationFn: async ({ approve, reason }: { approve: boolean; reason?: string }) => {
      const status = approve ? "approved" : "rejected";
      return api.post(`/admin/vendors/${id}/verify`, null, {
        params: { status, reason }
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["adminVendorDetail", id] });
      queryClient.invalidateQueries({ queryKey: ["pendingVendors"] });
      success(
        variables.approve ? "Vendor Approved Successfully" : "Vendor Rejected Successfully",
        variables.approve ? "The vendor has been activated." : "The rejection details have been sent."
      );
      setTimeout(() => {
        router.push("/");
      }, 1500);
    },
    onError: (err: any) => {
      showError("Action Failed", err.response?.data?.detail || err.message);
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-emerald-650 animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">Loading vendor dossier...</p>
        </div>
      </div>
    );
  }

  if (queryError || !vendor) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-black">Vendor Dossier Not Found</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            The profile you are looking for does not exist or you do not have permission to view this section.
          </p>
          <button
            onClick={() => router.push("/")}
            className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-xs font-bold px-4 py-2.5 rounded-xl w-full transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const handleApprove = () => {
    verifyMutation.mutate({ approve: true });
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      showError("Validation Error", "Please provide a reason for rejection");
      return;
    }
    verifyMutation.mutate({ approve: false, reason: rejectionReason });
  };

  const isPending = verifyMutation.isPending;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 antialiased transition-colors duration-200 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back and Title */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Dossier Overview
          </button>

          <div className="flex items-center gap-2 bg-black/10 dark:bg-white/5 border border-slate-200 dark:border-slate-800 px-3 py-1 rounded-full text-[10px] font-mono tracking-wider">
            Sbjiwala v{versionInfo.version}
          </div>
        </div>

        {/* Profile Card Header */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">{vendor.business_name}</h1>
              <span
                className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                  vendor.status === "approved"
                    ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-450"
                    : vendor.status === "rejected"
                    ? "bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-450"
                    : "bg-amber-100 dark:bg-amber-955/40 text-amber-800 dark:text-amber-450"
                }`}
              >
                {vendor.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
              Business Type: <span className="font-bold">{vendor.business_type}</span>
            </p>
            {vendor.description && (
              <p className="text-xs text-slate-550 dark:text-slate-450 leading-relaxed max-w-xl">
                {vendor.description}
              </p>
            )}
          </div>

          <div className="space-y-2 text-slate-500 dark:text-slate-400 text-xs w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-slate-100 dark:border-slate-800 flex flex-col gap-1.5">
            <span className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" /> {vendor.contact_email}
            </span>
            <span className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-400" /> {vendor.contact_phone}
            </span>
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" /> Applied: {new Date(vendor.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Credentials and Document review grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* FSSAI, PAN, GST Details */}
          <div className="md:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-450">Tax & License Registration</h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400">FSSAI Number</span>
                <p className="text-sm font-bold text-slate-850 dark:text-slate-100 font-mono tracking-wider">
                  {vendor.fssai_number || "NOT_SUBMITTED"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400">PAN Card Number</span>
                <p className="text-sm font-bold text-slate-850 dark:text-slate-100 font-mono tracking-wider">
                  {vendor.pan_number || "NOT_SUBMITTED"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400">GSTIN / GST Number</span>
                <p className="text-sm font-bold text-slate-850 dark:text-slate-100 font-mono tracking-wider">
                  {vendor.gst_number || "NOT_SUBMITTED"}
                </p>
              </div>
            </div>
          </div>

          {/* Uploaded Documents */}
          <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-450">Uploaded Dossier Certificates</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {vendor.documents && vendor.documents.length > 0 ? (
                vendor.documents.map((doc: any) => (
                  <div key={doc.id} className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between hover:border-emerald-500/30 transition-all bg-slate-50/50 dark:bg-slate-850/10">
                    <div className="flex items-start gap-2.5">
                      <FileText className="w-5 h-5 text-emerald-650 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold capitalize text-slate-900 dark:text-white truncate">
                          {doc.document_type.replace(/_/g, " ")}
                        </p>
                        <p className="text-[10px] font-mono text-slate-450 truncate">
                          {doc.document_number || "No Document Number"}
                        </p>
                      </div>
                    </div>
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 py-2 rounded-xl transition-all"
                    >
                      Inspect File <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))
              ) : (
                <div className="sm:col-span-2 py-10 text-center text-slate-400 dark:text-slate-500 text-xs">
                  No scanned document uploads submitted for this registration.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Verification Controls / Action Panel */}
        {vendor.status !== "approved" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-450">Verification Action Room</h3>

            {!showRejectForm ? (
              <div className="flex items-center gap-4">
                <button
                  onClick={handleApprove}
                  disabled={isPending}
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-6 py-3.5 rounded-xl transition-all shadow-sm disabled:opacity-50 flex-1"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" /> Approve & Activate Store
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowRejectForm(true)}
                  disabled={isPending}
                  className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black px-6 py-3.5 rounded-xl transition-all shadow-sm disabled:opacity-50 flex-1"
                >
                  <ShieldAlert className="w-4 h-4" /> Reject Dossier Info
                </button>
              </div>
            ) : (
              <form onSubmit={handleRejectSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-450">Rejection Reason / Feedback Notes</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Provide detailed reasons for rejection (e.g. FSSAI certificate expired, PAN card name mismatch)."
                    rows={4}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3 text-sm transition-all"
                  ></textarea>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black px-5 py-3 rounded-xl transition-all shadow-sm disabled:opacity-50"
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Confirm Rejection"
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(false)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-800 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
