"use client";

import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, Loader2, Check, X, 
  Search, FileText, BadgeCheck, Phone, Mail, FileDigit, Calendar
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import AgentLayout from "@/components/AgentLayout";

const VEHICLE_EMOJI: Record<string, string> = {
  scooty: "🛵", bike: "🏍️", bicycle: "🚲", truck: "🚚",
};

export default function AgentKycPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"vendors" | "riders">("vendors");
  const [search, setSearch] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [isAvailable, setIsAvailable] = useState(true);

  // Initialize Support Agent Availability Profile
  useEffect(() => {
    api.get("/support/agent/profile").then(res => {
      if (res.data) {
        setIsAvailable(res.data.is_available);
      }
    }).catch(() => {});
  }, []);

  const toggleStatusMutation = useMutation({
    mutationFn: async (val: boolean) => {
      const res = await api.patch("/support/agent/profile", { is_available: val });
      return res.data;
    },
    onSuccess: (data) => {
      setIsAvailable(data.is_available);
      success("Status Updated", `Profile is now ${data.is_available ? "ONLINE" : "OFFLINE"}`);
    }
  });

  // Fetch pending vendors
  const { data: vendorsRes, isLoading: vendorsLoading } = useQuery<any>({
    queryKey: ["agentPendingVendors"],
    queryFn: async () => {
      const res = await api.get("/admin/vendors");
      // filter pending
      const list = res.data || [];
      return list.filter((v: any) => v.status === "pending" || v.status === "documents_submitted");
    }
  });

  // Fetch pending delivery partners
  const { data: ridersRes, isLoading: ridersLoading } = useQuery<any>({
    queryKey: ["agentPendingRiders"],
    queryFn: async () => {
      const res = await api.get("/admin/delivery-boys");
      // filter pending or documents_submitted
      const list = res.data || [];
      return list.filter((r: any) => r.status === "pending" || r.status === "documents_submitted" || r.status === "inactive");
    }
  });

  const pendingVendors = (vendorsRes || []).filter((v: any) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return v.business_name?.toLowerCase().includes(s) || v.contact_phone?.toLowerCase().includes(s);
  });

  const pendingRiders = (ridersRes || []).filter((r: any) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return r.name?.toLowerCase().includes(s) || r.phone?.toLowerCase().includes(s);
  });

  // Vendor KYC verification mutations
  const verifyVendorMutation = useMutation({
    mutationFn: async ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) => {
      return api.post(`/admin/vendors/${id}/verify`, null, {
        params: { status: approve ? "approved" : "rejected", reason }
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["agentPendingVendors"] });
      setRejectingId(null);
      setRejectionReason("");
      success(variables.approve ? "Vendor Approved!" : "Vendor Rejected");
    },
    onError: (err: any) => {
      showError("Action Failed", err.response?.data?.detail || err.message);
    }
  });

  // Rider KYC verification mutations
  const verifyRiderMutation = useMutation({
    mutationFn: async ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) => {
      if (approve) {
        return api.post(`/admin/delivery-boys/${id}/approve`);
      } else {
        return api.post(`/admin/delivery-boys/${id}/reject`, { reason });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["agentPendingRiders"] });
      setRejectingId(null);
      setRejectionReason("");
      success(variables.approve ? "Rider Approved!" : "Rider Rejected");
    },
    onError: (err: any) => {
      showError("Action Failed", err.response?.data?.detail || err.message);
    }
  });

  const handleApprove = (id: string) => {
    if (activeTab === "vendors") {
      verifyVendorMutation.mutate({ id, approve: true });
    } else {
      verifyRiderMutation.mutate({ id, approve: true });
    }
  };

  const handleReject = () => {
    if (!rejectingId) return;
    if (activeTab === "vendors") {
      verifyVendorMutation.mutate({ id: rejectingId, approve: false, reason: rejectionReason });
    } else {
      verifyRiderMutation.mutate({ id: rejectingId, approve: false, reason: rejectionReason });
    }
  };

  return (
    <AgentLayout 
      title="KYC Validation Center"
      isAvailable={isAvailable}
      onAvailabilityToggle={(val) => toggleStatusMutation.mutate(val)}
    >
      <div className="space-y-6 text-slate-800 dark:text-slate-100 font-sans max-w-5xl mx-auto">
        {/* Navigation & Search */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 p-4 rounded-2xl shadow-sm gap-4">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => { setActiveTab("vendors"); setSearch(""); setRejectingId(null); }}
              className={`flex-1 sm:flex-initial text-xs font-black px-5 py-2.5 rounded-lg cursor-pointer transition-all border-0 ${
                activeTab === "vendors" 
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm" 
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
              }`}
            >
              Vendor Queue ({pendingVendors.length})
            </button>
            <button
              onClick={() => { setActiveTab("riders"); setSearch(""); setRejectingId(null); }}
              className={`flex-1 sm:flex-initial text-xs font-black px-5 py-2.5 rounded-lg cursor-pointer transition-all border-0 ${
                activeTab === "riders" 
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm" 
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
              }`}
            >
              Delivery Queue ({pendingRiders.length})
            </button>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === "vendors" ? "Search business name..." : "Search rider name..."}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Vendors Section */}
        {activeTab === "vendors" && (
          <div className="space-y-4">
            {vendorsLoading ? (
              <div className="py-20 text-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto" /></div>
            ) : pendingVendors.length === 0 ? (
              <div className="py-20 text-center text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                <ShieldCheck className="w-12 h-12 mx-auto mb-2 text-emerald-500 opacity-40 animate-pulse" />
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">Vendor Queue Clean</h4>
                <p className="text-xs text-slate-500 mt-1">No vendors are currently waiting for KYC documents review.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {pendingVendors.map((vendor: any) => (
                  <div key={vendor.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white">{vendor.business_name || "Store Registration"}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{vendor.description || "No description provided."}</p>
                      </div>
                      <div className="flex gap-2">
                        {rejectingId === vendor.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Reason..."
                              value={rejectionReason}
                              onChange={e => setRejectionReason(e.target.value)}
                              className="px-3 py-1.5 border border-slate-250 dark:border-slate-700 bg-transparent rounded-lg text-xs focus:outline-none focus:border-rose-500 text-slate-900 dark:text-white"
                            />
                            <button onClick={handleReject} disabled={verifyVendorMutation.isPending || !rejectionReason.trim()} className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-3.5 py-1.5 rounded-lg font-bold border-0 cursor-pointer">
                              Reject
                            </button>
                            <button onClick={() => setRejectingId(null)} className="text-slate-400 hover:text-slate-600 text-xs font-bold bg-transparent border-0 cursor-pointer">Cancel</button>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => setRejectingId(vendor.id)} className="bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs px-3.5 py-1.5 rounded-xl font-bold cursor-pointer transition-all">
                              Reject KYC
                            </button>
                            <button onClick={() => handleApprove(vendor.id)} disabled={verifyVendorMutation.isPending} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-1.5 rounded-xl font-black shadow-sm cursor-pointer border-0">
                              Approve Partner
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-medium">
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Contact Details</p>
                        <p className="flex items-center gap-1.5 text-slate-655 dark:text-slate-350"><Phone className="w-3.5 h-3.5 text-slate-400" /> {vendor.contact_phone || "No phone"}</p>
                        <p className="flex items-center gap-1.5 text-slate-655 dark:text-slate-350"><Mail className="w-3.5 h-3.5 text-slate-400" /> {vendor.contact_email || "No email"}</p>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Registrations</p>
                        <p className="flex items-center gap-1.5 text-slate-655 dark:text-slate-350"><FileDigit className="w-3.5 h-3.5 text-slate-400" /> GST: {vendor.gst_number || "Not provided"}</p>
                        <p className="flex items-center gap-1.5 text-slate-655 dark:text-slate-350"><FileDigit className="w-3.5 h-3.5 text-slate-400" /> FSSAI: {vendor.fssai_number || "Not provided"}</p>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Submission Stats</p>
                        <p className="flex items-center gap-1.5 text-slate-655 dark:text-slate-350"><Calendar className="w-3.5 h-3.5 text-slate-400" /> Submitted: {new Date(vendor.created_at).toLocaleDateString()}</p>
                        <p className="flex items-center gap-1.5 text-slate-655 dark:text-slate-350"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> PAN: {vendor.pan_number || "Not provided"}</p>
                      </div>
                    </div>

                    {/* Document proof lists */}
                    {vendor.documents && vendor.documents.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] text-slate-400 uppercase font-black mb-2">Uploaded Document Files ({vendor.documents.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {vendor.documents.map((doc: any) => (
                            <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 px-3 py-2 rounded-xl text-xs font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 hover:bg-slate-100 transition-all">
                              <FileText className="w-3.5 h-3.5" />
                              <span className="capitalize">{doc.document_type} Document</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Riders Section */}
        {activeTab === "riders" && (
          <div className="space-y-4">
            {ridersLoading ? (
              <div className="py-20 text-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto" /></div>
            ) : pendingRiders.length === 0 ? (
              <div className="py-20 text-center text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                <ShieldCheck className="w-12 h-12 mx-auto mb-2 text-emerald-500 opacity-40 animate-pulse" />
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">Rider Queue Clean</h4>
                <p className="text-xs text-slate-500 mt-1">No delivery boys are currently waiting for documents verification.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {pendingRiders.map((rider: any) => (
                  <div key={rider.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-2xl shadow-sm">
                          {VEHICLE_EMOJI[rider.vehicle_type] || "🛵"}
                        </div>
                        <div>
                          <h3 className="text-base font-black text-slate-900 dark:text-white">{rider.name || "Delivery Boy Partner"}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">Vehicle: {rider.vehicle_type} ({rider.vehicle_number || "No plate"})</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {rejectingId === rider.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Reason..."
                              value={rejectionReason}
                              onChange={e => setRejectionReason(e.target.value)}
                              className="px-3 py-1.5 border border-slate-250 dark:border-slate-700 bg-transparent rounded-lg text-xs focus:outline-none focus:border-rose-500 text-slate-900 dark:text-white"
                            />
                            <button onClick={handleReject} disabled={verifyRiderMutation.isPending || !rejectionReason.trim()} className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-3.5 py-1.5 rounded-lg font-bold border-0 cursor-pointer">
                              Reject
                            </button>
                            <button onClick={() => setRejectingId(null)} className="text-slate-400 hover:text-slate-600 text-xs font-bold bg-transparent border-0 cursor-pointer">Cancel</button>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => setRejectingId(rider.id)} className="bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs px-3.5 py-1.5 rounded-xl font-bold cursor-pointer transition-all">
                              Reject KYC
                            </button>
                            <button onClick={() => handleApprove(rider.id)} disabled={verifyRiderMutation.isPending} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-1.5 rounded-xl font-black shadow-sm cursor-pointer border-0">
                              Approve Partner
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-medium">
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Contact Details</p>
                        <p className="flex items-center gap-1.5 text-slate-655 dark:text-slate-350"><Phone className="w-3.5 h-3.5 text-slate-400" /> {rider.phone || "No phone"}</p>
                        <p className="flex items-center gap-1.5 text-slate-655 dark:text-slate-350"><Mail className="w-3.5 h-3.5 text-slate-400" /> {rider.email || "No email"}</p>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Rider Details</p>
                        <p className="flex items-center gap-1.5 text-slate-655 dark:text-slate-350"><FileDigit className="w-3.5 h-3.5 text-slate-400" /> License: {rider.license_number || "Not provided"}</p>
                        <p className="flex items-center gap-1.5 text-slate-655 dark:text-slate-350"><BadgeCheck className="w-3.5 h-3.5 text-emerald-500" /> Status: {rider.status}</p>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Registration Date</p>
                        <p className="flex items-center gap-1.5 text-slate-655 dark:text-slate-350"><Calendar className="w-3.5 h-3.5 text-slate-400" /> Registered: {rider.created_at ? new Date(rider.created_at).toLocaleDateString() : "N/A"}</p>
                      </div>
                    </div>

                    {/* Document proof lists */}
                    {rider.kyc_documents && rider.kyc_documents.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] text-slate-400 uppercase font-black mb-2">Uploaded Document Files ({rider.kyc_documents.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {rider.kyc_documents.map((doc: any, i: number) => (
                            <a key={i} href={doc.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 px-3 py-2 rounded-xl text-xs font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 hover:bg-slate-100 transition-all">
                              <FileText className="w-3.5 h-3.5" />
                              <span>{doc.document_type || "KYC Doc File"}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AgentLayout>
  );
}
