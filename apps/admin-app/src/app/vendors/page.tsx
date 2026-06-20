"use client";

import React, { useState } from "react";
import { Building2, MapPin, Phone, Mail, CheckCircle2, XCircle, Eye, Search, Loader2, Filter, ExternalLink, Clock, Star, Package } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import AdminLayout from "@/components/AdminLayout";
import dynamic from "next/dynamic";

const VendorLocationMap = dynamic(() => import("@/components/VendorLocationMap"), { ssr: false });

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending KYC", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/40" },
  documents_submitted: { label: "Docs Submitted", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/40" },
  under_review: { label: "Under Review", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-100 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/40" },
  approved: { label: "Approved ✓", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/40" },
  rejected: { label: "Rejected", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/40" },
  suspended: { label: "Suspended", color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700" },
};

function VendorDetailModal({ vendor, onClose }: { vendor: any; onClose: () => void }) {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const approveMutation = useMutation({
    mutationFn: async () => api.post(`/admin/vendors/${vendor.id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      queryClient.invalidateQueries({ queryKey: ["adminMetrics"] });
      success("Vendor approved successfully!");
      onClose();
    },
    onError: (err: any) => showError("Failed", err.response?.data?.detail || err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => api.post(`/admin/vendors/${vendor.id}/reject`, { reason: rejectionReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      success("Vendor rejected.");
      onClose();
    },
    onError: (err: any) => showError("Failed", err.response?.data?.detail || err.message),
  });

  const suspendMutation = useMutation({
    mutationFn: async () => api.post(`/admin/vendors/${vendor.id}/suspend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      success("Vendor suspended.");
      onClose();
    },
    onError: (err: any) => showError("Failed", err.response?.data?.detail || err.message),
  });

  const store = vendor.store || vendor.vendor_store || {};
  const statusCfg = STATUS_CONFIG[vendor.status] || STATUS_CONFIG.pending;

  return (
    <div className="fixed inset-0 md:left-64 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg">
                🏪
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">{vendor.business_name}</h2>
                <p className="text-xs text-slate-500">{store.store_name || "No store name"}</p>
              </div>
            </div>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${statusCfg.bg} ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {[
              { icon: Mail, label: "Email", value: vendor.email || vendor.user?.email || "N/A" },
              { icon: Phone, label: "Phone", value: vendor.phone || vendor.user?.phone || "N/A" },
              { icon: MapPin, label: "City", value: store.city || store.address_line_2 || "N/A" },
              { icon: Building2, label: "Business Type", value: vendor.business_type || "Retail" },
              { icon: Star, label: "Rating", value: `${vendor.average_rating || "N/A"} / 5` },
              { icon: Package, label: "Total Orders", value: vendor.total_orders || 0 },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
                  <p className="font-bold text-slate-800 dark:text-white">{String(value)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Store Address */}
          {store.address_line_1 && (
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
              <p className="font-bold text-slate-400 uppercase mb-1">Store Address</p>
              <p className="text-slate-700 dark:text-slate-200">{store.address_line_1}, {store.city} {store.pincode}</p>
            </div>
          )}

          {/* Map if location available */}
          {store.latitude && store.longitude && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500 uppercase">Store Location</p>
              <VendorLocationMap lat={parseFloat(store.latitude)} lng={parseFloat(store.longitude)} storeName={store.store_name || vendor.business_name} />
            </div>
          )}

          {/* KYC Documents */}
          {vendor.kyc_documents?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">KYC Documents</p>
              <div className="grid grid-cols-2 gap-2">
                {vendor.kyc_documents.map((doc: any, i: number) => (
                  <a
                    key={i}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-blue-700 dark:text-blue-400 p-2.5 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {doc.document_type || `Document ${i + 1}`}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Rejection Reason Input */}
          {showRejectForm && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Rejection Reason</label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Explain why this vendor is being rejected..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm text-slate-800 dark:text-white focus:outline-none focus:border-rose-500 h-20 resize-none"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            {vendor.status !== "approved" && (
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {approveMutation.isPending ? "Approving..." : "Approve Vendor"}
              </button>
            )}
            {!showRejectForm && vendor.status !== "rejected" && (
              <button
                onClick={() => setShowRejectForm(true)}
                className="flex items-center gap-2 bg-rose-100 dark:bg-rose-950/30 hover:bg-rose-200 text-rose-700 dark:text-rose-400 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer border border-rose-200 dark:border-rose-900/40"
              >
                <XCircle className="w-4 h-4" />
                Reject Vendor
              </button>
            )}
            {showRejectForm && (
              <>
                <button
                  onClick={() => rejectMutation.mutate()}
                  disabled={rejectMutation.isPending || !rejectionReason.trim()}
                  className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  {rejectMutation.isPending ? "Rejecting..." : "Confirm Reject"}
                </button>
                <button onClick={() => setShowRejectForm(false)} className="text-xs text-slate-500 hover:text-slate-700 font-bold cursor-pointer">
                  Cancel
                </button>
              </>
            )}
            {vendor.status === "approved" && (
              <button
                onClick={() => suspendMutation.mutate()}
                disabled={suspendMutation.isPending}
                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                {suspendMutation.isPending ? "Suspending..." : "Suspend Vendor"}
              </button>
            )}
            <button
              onClick={onClose}
              className="ml-auto flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminVendorsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [page, setPage] = useState(1);

  const { data: vendorsRes, isLoading } = useQuery<any>({
    queryKey: ["adminVendors", statusFilter, search, page],
    queryFn: async () => {
      const res = await api.get("/admin/vendors", {
        params: {
          page,
          page_size: 20,
          status: statusFilter !== "all" ? statusFilter : undefined,
          search: search || undefined,
        },
      });
      return res;
    },
  });

  const vendors: any[] = vendorsRes?.data?.data || vendorsRes?.data || [];
  const pagination = vendorsRes?.data?.pagination || { page: 1, total_pages: 1 };

  const statusTabs = [
    { id: "all", label: "All Vendors" },
    { id: "pending", label: "Pending KYC" },
    { id: "documents_submitted", label: "Docs Submitted" },
    { id: "under_review", label: "Under Review" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
  ];

  return (
    <AdminLayout title="Vendor Management">
      <div className="space-y-5">
        {/* Filters */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search vendors by name, city..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {statusTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setStatusFilter(tab.id); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all border ${
                  statusFilter === tab.id
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Vendors Grid */}
        {isLoading ? (
          <div className="py-20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : vendors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {vendors.map((vendor: any) => {
              const store = vendor.store || vendor.vendor_store || {};
              const statusCfg = STATUS_CONFIG[vendor.status] || STATUS_CONFIG.pending;
              return (
                <div
                  key={vendor.id}
                  onClick={() => setSelectedVendor(vendor)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer group space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-lg shadow-sm group-hover:scale-105 transition-transform">
                        🏪
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">{vendor.business_name}</h3>
                        <p className="text-[11px] text-slate-500 truncate">{store.store_name || store.city || "No store info"}</p>
                      </div>
                    </div>
                    <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full border flex-shrink-0 ${statusCfg.bg} ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-2 border border-slate-100 dark:border-slate-800">
                      <p className="text-slate-400 font-bold uppercase">Rating</p>
                      <p className="font-black text-slate-800 dark:text-white">{vendor.average_rating ? `⭐ ${vendor.average_rating}` : "N/A"}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-2 border border-slate-100 dark:border-slate-800">
                      <p className="text-slate-400 font-bold uppercase">Orders</p>
                      <p className="font-black text-slate-800 dark:text-white">{vendor.total_orders || 0}</p>
                    </div>
                  </div>

                  {store.city && (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <MapPin className="w-3 h-3 text-emerald-500" />
                      <span>{store.address_line_1 ? `${store.address_line_1}, ` : ""}{store.city}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span>Joined: {new Date(vendor.created_at).toLocaleDateString("en-IN")}</span>
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold group-hover:gap-2 transition-all">
                      View Details →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-20 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No vendors found</p>
          </div>
        )}

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <span className="text-xs text-slate-500">Page {pagination.page} of {pagination.total_pages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-50 cursor-pointer">Prev</button>
              <button onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))} disabled={page === pagination.total_pages} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-50 cursor-pointer">Next</button>
            </div>
          </div>
        )}
      </div>

      {selectedVendor && <VendorDetailModal vendor={selectedVendor} onClose={() => setSelectedVendor(null)} />}
    </AdminLayout>
  );
}
