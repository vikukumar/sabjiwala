"use client";

import React, { useState } from "react";
import { Truck, Phone, Star, CheckCircle2, XCircle, Search, Loader2, MapPin, IndianRupee, Activity, BadgeCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import AdminLayout from "@/components/AdminLayout";

const KYC_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900" },
  documents_submitted: { label: "Docs Submitted", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900" },
  approved: { label: "Verified ✓", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900" },
  rejected: { label: "Rejected", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900" },
};

const VEHICLE_EMOJI: Record<string, string> = {
  scooty: "🛵", bike: "🏍️", bicycle: "🚲", truck: "🚚",
};

function DeliveryBoyModal({ boy, onClose }: { boy: any; onClose: () => void }) {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const approveMutation = useMutation({
    mutationFn: async () => api.post(`/admin/delivery-boys/${boy.id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminDeliveryBoys"] });
      queryClient.invalidateQueries({ queryKey: ["adminMetrics"] });
      success("Delivery boy approved successfully!");
      onClose();
    },
    onError: (err: any) => showError("Failed", err.response?.data?.detail || err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => api.post(`/admin/delivery-boys/${boy.id}/reject`, { reason: rejectionReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminDeliveryBoys"] });
      success("Delivery boy rejected.");
      onClose();
    },
    onError: (err: any) => showError("Failed", err.response?.data?.detail || err.message),
  });

  const kycStatus = boy.kyc_status || "pending";
  const statusCfg = KYC_STATUS[kycStatus] || KYC_STATUS.pending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
                {VEHICLE_EMOJI[boy.vehicle_type] || "🛵"}
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">{boy.full_name || "Delivery Partner"}</h2>
                <p className="text-xs text-slate-500">{boy.phone || "N/A"}</p>
              </div>
            </div>
            <span className={`inline-block text-[10px] font-black px-2.5 py-1 rounded-full border ${statusCfg.bg} ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Star, label: "Rating", value: boy.average_rating ? `${boy.average_rating.toFixed(1)}⭐` : "N/A", color: "text-amber-500" },
              { icon: Activity, label: "Deliveries", value: boy.total_deliveries || 0, color: "text-blue-500" },
              { icon: IndianRupee, label: "Wallet", value: `₹${(boy.wallet_balance || 0).toFixed(0)}`, color: "text-emerald-500" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-center">
                <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
                <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
                <p className="text-sm font-black text-slate-800 dark:text-white">{String(value)}</p>
              </div>
            ))}
          </div>

          {/* Details */}
          <div className="space-y-2 text-xs">
            {[
              { label: "Vehicle Type", value: `${VEHICLE_EMOJI[boy.vehicle_type] || ""} ${boy.vehicle_type || "N/A"}` },
              { label: "Vehicle Number", value: boy.vehicle_number || "N/A" },
              { label: "Online Status", value: boy.is_online ? "🟢 Online" : "⚫ Offline" },
              { label: "Current Location", value: boy.current_latitude ? `${parseFloat(boy.current_latitude).toFixed(4)}, ${parseFloat(boy.current_longitude).toFixed(4)}` : "Unknown" },
              { label: "Joined", value: new Date(boy.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 font-bold uppercase">{label}</span>
                <span className="font-bold text-slate-800 dark:text-white">{value}</span>
              </div>
            ))}
          </div>

          {/* KYC Documents */}
          {boy.kyc_documents?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">KYC Documents</p>
              <div className="grid grid-cols-2 gap-2">
                {boy.kyc_documents.map((doc: any, i: number) => (
                  <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 text-blue-700 dark:text-blue-400 p-2.5 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all">
                    <BadgeCheck className="w-3.5 h-3.5" />
                    {doc.document_type || `Document ${i + 1}`}
                  </a>
                ))}
              </div>
            </div>
          )}

          {showRejectForm && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Rejection Reason</label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Explain why..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm text-slate-800 dark:text-white focus:outline-none focus:border-rose-500 h-16 resize-none"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            {kycStatus !== "approved" && (
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {approveMutation.isPending ? "Approving..." : "Approve KYC"}
              </button>
            )}
            {!showRejectForm && kycStatus !== "rejected" && (
              <button onClick={() => setShowRejectForm(true)} className="flex items-center gap-2 bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 font-bold text-xs px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900 cursor-pointer">
                <XCircle className="w-4 h-4" />
                Reject KYC
              </button>
            )}
            {showRejectForm && (
              <>
                <button onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending || !rejectionReason.trim()} className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50">
                  {rejectMutation.isPending ? "Rejecting..." : "Confirm Reject"}
                </button>
                <button onClick={() => setShowRejectForm(false)} className="text-xs text-slate-500 font-bold cursor-pointer">Cancel</button>
              </>
            )}
            <button onClick={onClose} className="ml-auto bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDeliveryPage() {
  const [search, setSearch] = useState("");
  const [kycFilter, setKycFilter] = useState("all");
  const [onlineFilter, setOnlineFilter] = useState("all");
  const [selectedBoy, setSelectedBoy] = useState<any>(null);
  const [page, setPage] = useState(1);

  const { data: boysRes, isLoading } = useQuery<any>({
    queryKey: ["adminDeliveryBoys", kycFilter, search, onlineFilter, page],
    queryFn: async () => {
      const res = await api.get("/admin/delivery-boys", {
        params: {
          page, page_size: 20,
          kyc_status: kycFilter !== "all" ? kycFilter : undefined,
          search: search || undefined,
          is_online: onlineFilter === "online" ? true : onlineFilter === "offline" ? false : undefined,
        },
      });
      return res;
    },
  });

  const boys: any[] = boysRes?.data?.data || boysRes?.data || [];
  const pagination = boysRes?.data?.pagination || { page: 1, total_pages: 1 };

  return (
    <AdminLayout title="Delivery Boy Management">
      <div className="space-y-5">
        {/* Filters */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, phone..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { id: "all", label: "All" },
              { id: "pending", label: "Pending KYC" },
              { id: "documents_submitted", label: "Docs Submitted" },
              { id: "approved", label: "Approved" },
              { id: "rejected", label: "Rejected" },
            ].map(tab => (
              <button key={tab.id} onClick={() => { setKycFilter(tab.id); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border ${kycFilter === tab.id ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
                {tab.label}
              </button>
            ))}
            <div className="ml-auto flex gap-2">
              {[{ id: "all", label: "All Status" }, { id: "online", label: "🟢 Online" }, { id: "offline", label: "⚫ Offline" }].map(tab => (
                <button key={tab.id} onClick={() => { setOnlineFilter(tab.id); setPage(1); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border ${onlineFilter === tab.id ? "bg-emerald-600 text-white border-transparent" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="py-20 flex items-center justify-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
        ) : boys.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {boys.map((boy: any) => {
              const kycCfg = KYC_STATUS[boy.kyc_status || "pending"];
              return (
                <div key={boy.id} onClick={() => setSelectedBoy(boy)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 cursor-pointer hover:border-emerald-500/50 hover:shadow-md transition-all group space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-xl shadow-sm group-hover:scale-105 transition-transform">
                        {VEHICLE_EMOJI[boy.vehicle_type] || "🛵"}
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-slate-900 dark:text-white">{boy.full_name || "Rider"}</h3>
                        <p className="text-[11px] text-slate-500">{boy.phone}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${kycCfg.bg} ${kycCfg.color}`}>{kycCfg.label}</span>
                      <span className={`text-[9px] font-bold ${boy.is_online ? "text-emerald-600" : "text-slate-400"}`}>
                        {boy.is_online ? "🟢 Online" : "⚫ Offline"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-2 text-center border border-slate-100 dark:border-slate-800">
                      <p className="text-slate-400 font-bold">Rating</p>
                      <p className="font-black text-slate-800 dark:text-white">{boy.average_rating ? `${boy.average_rating.toFixed(1)}⭐` : "N/A"}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-2 text-center border border-slate-100 dark:border-slate-800">
                      <p className="text-slate-400 font-bold">Deliveries</p>
                      <p className="font-black text-slate-800 dark:text-white">{boy.total_deliveries || 0}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-2 text-center border border-slate-100 dark:border-slate-800">
                      <p className="text-slate-400 font-bold">Wallet</p>
                      <p className="font-black text-emerald-600 dark:text-emerald-400">₹{(boy.wallet_balance || 0).toFixed(0)}</p>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span>{boy.vehicle_number || "No plate"}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">View Details →</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-20 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No delivery boys found</p>
          </div>
        )}

        {pagination.total_pages > 1 && (
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <span className="text-xs text-slate-500">Page {page} of {pagination.total_pages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-50 cursor-pointer">Prev</button>
              <button onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))} disabled={page === pagination.total_pages} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-50 cursor-pointer">Next</button>
            </div>
          </div>
        )}
      </div>

      {selectedBoy && <DeliveryBoyModal boy={selectedBoy} onClose={() => setSelectedBoy(null)} />}
    </AdminLayout>
  );
}
