"use client";

import React, { useState, useEffect } from "react";
import { 
  FileText, Check, X, Loader2, 
  Eye, ChevronDown, ChevronUp 
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import AgentLayout from "@/components/AgentLayout";

interface ReturnItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  reason?: string;
  image?: string;
}

interface ReturnRequest {
  id: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  reason: string;
  images: string[];
  return_items: ReturnItem[];
  refund_amount: number;
  status: string;
  created_at: string;
}

export default function AgentReturnsPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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

  // Fetch return requests
  const { data: response, isLoading } = useQuery<any>({
    queryKey: ["agentReturnsList"],
    queryFn: async () => {
      const res = await api.get("/admin/returns");
      return res.data;
    }
  });

  const returnRequests: ReturnRequest[] = response?.data || [];

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.post(`/admin/returns/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agentReturnsList"] });
      success("Return request approved successfully! Refund processed.");
    },
    onError: (err: any) => {
      showError("Approve Failed", err.response?.data?.detail || err.message);
    }
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.post(`/admin/returns/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agentReturnsList"] });
      success("Return request rejected.");
    },
    onError: (err: any) => {
      showError("Reject Failed", err.response?.data?.detail || err.message);
    }
  });

  const toggleExpand = (id: string) => {
    setExpandedRequestId(expandedRequestId === id ? null : id);
  };

  return (
    <AgentLayout 
      title="Returns & Refunds Control"
      isAvailable={isAvailable}
      onAvailabilityToggle={(val) => toggleStatusMutation.mutate(val)}
    >
      <div className="space-y-6 text-slate-800 dark:text-slate-100 font-sans max-w-6xl mx-auto">
        {/* Header summary stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Pending Returns</p>
              <h3 className="text-2xl font-black mt-0.5">
                {returnRequests.filter(r => r.status.toLowerCase() === "pending").length}
              </h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Approved Returns</p>
              <h3 className="text-2xl font-black mt-0.5">
                {returnRequests.filter(r => r.status.toLowerCase() === "approved").length}
              </h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500">
              <X className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Rejected Requests</p>
              <h3 className="text-2xl font-black mt-0.5">
                {returnRequests.filter(r => r.status.toLowerCase() === "rejected").length}
              </h3>
            </div>
          </div>
        </div>

        {/* Requests List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Customer Return Requests</h3>
              <p className="text-xs text-slate-550 dark:text-slate-450 mt-1">Review return requests, proof images, and approve refund claims.</p>
            </div>
          </div>

          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-xs text-slate-450 font-bold uppercase tracking-wider">Loading Requests...</p>
            </div>
          ) : returnRequests.length === 0 ? (
            <div className="py-24 text-center text-slate-400 dark:text-slate-550">
              <span className="text-4xl">📦</span>
              <h4 className="text-sm font-black mt-3">No return requests found</h4>
              <p className="text-xs mt-1">Customers haven't submitted any product returns yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {returnRequests.map((req) => {
                const isExpanded = expandedRequestId === req.id;
                const isPending = req.status.toLowerCase() === "pending";
                
                return (
                  <div key={req.id} className="transition-all hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                    {/* Header Row */}
                    <div 
                      onClick={() => toggleExpand(req.id)}
                      className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-850 flex items-center justify-center font-black text-xs text-slate-650 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                          #{req.order_number.slice(-6)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-xs">{req.customer_name}</span>
                            <span className="text-[10px] text-slate-450">({req.customer_phone})</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                            Created: {new Date(req.created_at).toLocaleDateString("en-IN", { 
                              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" 
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-[9px] text-slate-405 uppercase font-black tracking-wider">Refund Claim</p>
                          <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                            ₹{req.refund_amount.toFixed(2)}
                          </span>
                        </div>

                        <div>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                            req.status.toLowerCase() === "approved" 
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : req.status.toLowerCase() === "rejected"
                              ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                              : "bg-amber-500/10 text-amber-550 border-amber-500/20 animate-pulse"
                          }`}>
                            {req.status}
                          </span>
                        </div>

                        <button className="text-slate-400 hover:text-slate-600 p-1 bg-transparent border-0 cursor-pointer">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <div className="px-5 pb-6 pt-1 bg-slate-50/30 dark:bg-slate-900/30 border-t border-slate-105 dark:border-slate-800/60 animate-fade-in space-y-4">
                        {/* Overall Reason */}
                        <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 border border-slate-100 dark:border-slate-850">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Customer Reason & Notes</p>
                          <p className="text-xs text-slate-700 dark:text-slate-350 mt-1 font-semibold leading-relaxed">
                            {req.reason || "No notes provided."}
                          </p>
                        </div>

                        {/* Items Grid */}
                        <div className="space-y-2">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Returned Products</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {req.return_items?.map((item, idx) => (
                              <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm">
                                <div className="flex items-center gap-2.5">
                                  {item.image ? (
                                    <img 
                                      src={item.image} 
                                      alt={item.product_name} 
                                      className="w-10 h-10 object-cover rounded-lg border border-slate-200/50"
                                      onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                                    />
                                  ) : (
                                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-lg">
                                      🥦
                                    </div>
                                  )}
                                  <div>
                                    <h5 className="font-extrabold text-xs text-slate-900 dark:text-white">{item.product_name}</h5>
                                    <span className="text-[10px] text-slate-450 mt-0.5 block font-bold">Qty: {item.quantity} × ₹{item.price}</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                                    ₹{(item.quantity * item.price).toFixed(2)}
                                  </span>
                                  {item.reason && (
                                    <span className="block text-[9px] text-rose-500 font-black mt-0.5">{item.reason}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Uploaded Proof Images */}
                        {req.images && req.images.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Submitted Proof Image Files</p>
                            <div className="flex flex-wrap gap-3">
                              {req.images.map((img, idx) => (
                                <div 
                                  key={idx} 
                                  onClick={() => setSelectedImage(img)}
                                  className="group relative w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 cursor-zoom-in shadow-sm hover:scale-102 transition-all"
                                >
                                  <img src={img} alt="Return Proof" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                    <Eye className="w-5 h-5 text-white" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        {isPending && (
                          <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-850">
                            <button
                              onClick={() => approveMutation.mutate(req.id)}
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer transition-all border-0 shadow-sm shadow-emerald-500/10"
                            >
                              {approveMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              Approve & Refund
                            </button>
                            <button
                              onClick={() => rejectMutation.mutate(req.id)}
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                              className="bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 text-rose-600 dark:text-rose-450 font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer transition-all border border-rose-500/25"
                            >
                              <X className="w-4 h-4" />
                              Reject Claim
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lightbox / Modal for Image Preview */}
        {selectedImage && (
          <div className="fixed inset-0 md:left-64 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all border-0 bg-transparent cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
              <img src={selectedImage} alt="Return Proof Detail" className="max-w-full max-h-[85vh] object-contain" />
            </div>
          </div>
        )}
      </div>
    </AgentLayout>
  );
}
