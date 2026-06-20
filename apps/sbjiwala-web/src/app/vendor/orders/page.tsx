"use client";

import React, { useState, useEffect, useRef } from "react";
import { Clock, Loader2, Star, ShoppingBag, X, Package, CheckCircle2, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useWebSocket } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/index";
import VendorLayout from "@/components/VendorLayout";

// =========== ITEM REJECTION MODAL ===========
function ItemRejectionModal({
  isOpen, item, onConfirm, onCancel, loading
}: {
  isOpen: boolean; item: any;
  onConfirm: (quantity: number, reason: string) => void; onCancel: () => void; loading?: boolean;
}) {
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState("Quality Issue");

  useEffect(() => {
    if (isOpen && item) {
      setQuantity(item.quantity);
      setReason("Quality Issue");
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-in text-slate-800 dark:text-white shadow-2xl">
        <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950/40 rounded-2xl flex items-center justify-center mx-auto text-rose-600 dark:text-rose-455">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-black uppercase tracking-wider text-center">Reject Produce</h3>
        <p className="text-xs text-slate-555 dark:text-slate-400 text-center leading-normal">
          Rejecting items for <span className="font-extrabold text-slate-800 dark:text-slate-200">{item.product_name || item.name}</span>.
        </p>

        <div className="space-y-3.5 text-left">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Quantity to Reject (Max: {item.quantity} {item.unit})
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={item.quantity}
              value={quantity}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setQuantity(isNaN(val) ? 0 : Math.min(val, item.quantity));
              }}
              className="w-full px-4 py-2.5 text-sm font-bold border-2 border-slate-200 dark:border-slate-800 rounded-2xl bg-transparent focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reason for Rejection</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2.5 text-sm font-bold border-2 border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="Quality Issue">Quality Issue</option>
              <option value="Damaged / Bruised">Damaged / Bruised</option>
              <option value="Incorrect Product">Incorrect Product</option>
              <option value="Customer Refused">Customer Refused</option>
              <option value="Not Fresh">Not Fresh / Rotten</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="danger"
            onClick={() => {
              if (quantity > 0 && quantity <= item.quantity) {
                onConfirm(quantity, reason);
              }
            }}
            disabled={quantity <= 0 || quantity > item.quantity || loading}
            loading={loading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold"
          >
            Confirm Rejection
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// =========== OTP & Image Upload Modal ===========
function OtpPromptModal({
  isOpen, title, message, onConfirm, onCancel, loading
}: {
  isOpen: boolean; title: string; message: string;
  onConfirm: (otp: string, images: string[]) => void; onCancel: () => void; loading?: boolean;
}) {
  const [otp, setOtp] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { success, error: showError } = useToast();

  useEffect(() => {
    if (isOpen) {
      setOtp("");
      setImages([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploadedUrls: string[] = [...images];
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);
        const res = await api.post("/storage/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        const resAny = res as any;
        const url = resAny.url || resAny.data?.url || resAny.data?.data?.url;
        if (url) {
          uploadedUrls.push(url);
        }
      }
      setImages(uploadedUrls);
      success("Success", "Photos uploaded successfully!");
    } catch (err: any) {
      showError("Upload Failed", err.response?.data?.detail || err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, idx) => idx !== index));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-in text-center shadow-2xl text-slate-855 dark:text-white">
        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center mx-auto">
          <Package className="w-7 h-7 text-emerald-600 dark:text-emerald-455" />
        </div>
        <h3 className="text-base font-black uppercase tracking-wider">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">{message}</p>
        
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-slate-400 uppercase text-left mb-1">Enter Customer OTP</label>
          <input
            type="text" maxLength={4} pattern="[0-9]*" inputMode="numeric"
            value={otp} onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-full text-center tracking-[1.5em] pl-[1.5em] py-2 text-2xl font-black border-2 border-slate-200 dark:border-slate-700 rounded-2xl bg-transparent focus:outline-none focus:border-emerald-500 transition-colors"
            placeholder="••••" disabled={loading}
          />
        </div>

        <div className="space-y-2 text-left">
          <div className="flex justify-between items-center">
            <label className="block text-[10px] font-bold text-slate-400 uppercase">
              Upload Proof Pics ({images.length}/2 minimum)
            </label>
            {images.length < 2 && (
              <span className="text-[9px] font-black text-rose-500 uppercase animate-pulse">Required</span>
            )}
          </div>
          
          <input
            type="file" multiple accept="image/*"
            ref={fileInputRef} onChange={handleFileUpload}
            className="hidden" disabled={loading || uploading}
          />
          
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || uploading}
            className="w-full py-2.5 border-2 border-dashed border-slate-205 dark:border-slate-800 hover:border-emerald-500 rounded-2xl text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
            ) : (
              <span>📷 Upload Verification Photos</span>
            )}
          </button>

          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-2 pt-1">
              {images.map((url, idx) => (
                <div key={idx} className="relative aspect-square border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden group">
                  <img src={url} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-0.5 hover:bg-rose-600 shadow-sm"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="primary"
            onClick={() => { if (otp.length === 4 && images.length >= 2) onConfirm(otp, images); }}
            disabled={otp.length !== 4 || images.length < 2 || loading || uploading}
            loading={loading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold"
          >
            Verify & Deliver
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={loading || uploading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function VendorOrdersPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [selectedOrderForDeliveryOption, setSelectedOrderForDeliveryOption] = useState<any>(null);
  const [otpConfirmOrder, setOtpConfirmOrder] = useState<any>(null);
  const [rejectionConfig, setRejectionConfig] = useState<{ isOpen: boolean; orderId: string; item: any } | null>(null);

  const rejectItemsMutation = useMutation({
    mutationFn: async ({ orderId, payload }: { orderId: string; payload: any }) =>
      api.post(`/orders/${orderId}/reject-items`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorOrders"] });
      queryClient.invalidateQueries({ queryKey: ["vendorMetrics"] });
      success("Success", "Items adjusted and prices recalculated successfully!");
      setRejectionConfig(null);
    },
    onError: (err: any) => showError("Adjustment Failed", err.response?.data?.detail || err.message)
  });

  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useQuery<any>({
    queryKey: ["vendorOrders", activeTab],
    queryFn: async () => {
      const res = await api.get("/orders", {
        params: {
          status: activeTab !== "all" ? activeTab : undefined
        }
      });
      // API returns PaginatedResponse: { success, data: [...], pagination: {} }
      return res.data || [];
    }
  });

  // WebSocket: auto-refresh orders when new order or status update arrives
  useWebSocket((message: any) => {
    if (
      message.type === "order_status_update" ||
      message.type === "new_order" ||
      message.type === "notification"
    ) {
      refetchOrders();
      queryClient.invalidateQueries({ queryKey: ["vendorMetrics"] });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status, notes, deliveryOption, otp, images }: { orderId: string; status: string; notes: string; deliveryOption?: string; otp?: string; images?: string[] }) => {
      return api.patch(`/orders/${orderId}/status`, {
        status,
        notes,
        delivery_option: deliveryOption,
        otp,
        images
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorOrders"] });
      queryClient.invalidateQueries({ queryKey: ["vendorMetrics"] });
      success("Order status updated successfully!");
    },
    onError: (err: any) => {
      showError("Update Failed", "Failed to update order: " + (err.response?.data?.detail || err.message));
    }
  });

  const orders: any[] = Array.isArray(ordersData) ? ordersData : [];

  return (
    <VendorLayout title="Order Management Board">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Customer Requests</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Accept incoming customer orders, pack items, and track dispatch.</p>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-full border border-slate-205 dark:border-slate-700 text-xs font-semibold self-stretch md:self-auto justify-between sm:justify-start">
            {["all", "pending", "confirmed", "accepted", "packed", "out_for_delivery", "delivered", "cancelled"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-full capitalize text-[10px] sm:text-xs transition-all ${
                  activeTab === tab
                    ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm font-bold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-205"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {ordersLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
              <span className="text-xs text-slate-500 dark:text-slate-400">Fetching store orders...</span>
            </div>
          ) : orders.length > 0 ? (
            orders.map((order: any) => (
              <div key={order.id} className="p-6 flex flex-col gap-4 hover:bg-slate-50 dark:hover:bg-slate-850/10 transition-all">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">#Order {order.order_number}</span>
                      <span className="text-slate-400 dark:text-slate-550 text-xs">•</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-450">
                        {new Date(order.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-450">
                      Payment: <span className="font-bold text-slate-700 dark:text-slate-300">{order.payment_method.toUpperCase()}</span> ({order.payment_status})
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`inline-block text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                      order.status === "pending"
                        ? "bg-amber-100 dark:bg-amber-955/40 text-amber-800 dark:text-amber-400"
                        : order.status === "confirmed"
                          ? "bg-purple-100 dark:bg-purple-955/40 text-purple-800 dark:text-purple-400"
                          : order.status === "accepted"
                            ? "bg-teal-100 dark:bg-teal-955/40 text-teal-800 dark:text-teal-400"
                            : order.status === "packed"
                              ? "bg-blue-100 dark:bg-blue-955/40 text-blue-800 dark:text-blue-400"
                              : order.status === "assigned"
                                ? "bg-indigo-105 dark:bg-indigo-955/40 text-indigo-800 dark:text-indigo-400"
                                : order.status === "out_for_delivery"
                                  ? "bg-cyan-105 dark:bg-cyan-955/40 text-cyan-800 dark:text-cyan-400"
                                  : "bg-emerald-100 dark:bg-emerald-955/40 text-emerald-800 dark:text-emerald-400"
                    }`}>
                      {order.status}
                    </span>

                    {order.metadata_json?.delivery_option && (
                      <span className={`inline-block text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                        order.metadata_json.delivery_option === "self"
                          ? "bg-orange-100 dark:bg-orange-955/40 text-orange-800 dark:text-orange-400"
                          : "bg-indigo-100 dark:bg-indigo-955/40 text-indigo-800 dark:text-indigo-400"
                      }`}>
                        {order.metadata_json.delivery_option === "self" ? "Self Delivery" : "Platform Rider"}
                      </span>
                    )}

                    {order.status === "pending" && (
                      <button
                        disabled
                        className="bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-xl cursor-not-allowed"
                      >
                        Awaiting Payment/Confirmation
                      </button>
                    )}
                    {order.status === "confirmed" && (
                      <button
                        onClick={() => setSelectedOrderForDeliveryOption(order)}
                        disabled={updateStatusMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white text-[10px] sm:text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {updateStatusMutation.isPending ? "Accepting..." : "Accept Order"}
                      </button>
                    )}
                    {order.status === "assigned" && (
                      <button
                        onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: "accepted", notes: "Order accepted by vendor (Delivery Partner Assigned)" })}
                        disabled={updateStatusMutation.isPending}
                        className="bg-teal-650 hover:bg-teal-500 dark:bg-teal-500 dark:hover:bg-teal-400 text-white text-[10px] sm:text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {updateStatusMutation.isPending ? "Accepting..." : "Accept Order"}
                      </button>
                    )}
                    {order.status === "accepted" && (
                      <button
                        onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: "packed", notes: "Order packed by vendor" })}
                        disabled={updateStatusMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400 text-white text-[10px] sm:text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {updateStatusMutation.isPending ? "Packing..." : "Mark as Packed"}
                      </button>
                    )}
                    {order.status === "packed" && (
                      <button
                        onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: "out_for_delivery", notes: "Order is out for delivery by vendor" })}
                        disabled={updateStatusMutation.isPending}
                        className="bg-indigo-650 hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white text-[10px] sm:text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {updateStatusMutation.isPending ? "Shipping..." : "Ship Order (Out for Delivery)"}
                      </button>
                    )}
                    {order.status === "out_for_delivery" && (
                      <button
                        onClick={() => setOtpConfirmOrder(order)}
                        disabled={updateStatusMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white text-[10px] sm:text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {updateStatusMutation.isPending ? "Delivering..." : "Mark as Delivered"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Items in the Order */}
                {order.items && order.items.length > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-2">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Items to Pack ({order.items.length})</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {order.items.map((item: any) => (
                        <div key={item.id} className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800/80">
                          <span className="text-2xl">{item.attributes?.image_emoji || "🥬"}</span>
                          <div className="min-w-0 flex-1">
                            <h6 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 truncate">{item.product_name || item.name}</h6>
                            <p className="text-[10px] text-slate-500">{item.unit || "kg"}</p>
                          </div>
                          <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                            <span className="text-xs font-black text-slate-900 dark:text-white">Qty: {item.quantity}</span>
                            {["picked", "out_for_delivery"].includes(order.status) && item.quantity > 0 && (
                              <button
                                onClick={() => {
                                  setRejectionConfig({
                                    isOpen: true,
                                    orderId: order.id,
                                    item: item
                                  });
                                }}
                                className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-455 font-black text-[8px] uppercase tracking-wider border border-rose-100 dark:border-rose-955/40 cursor-pointer active:scale-95 transition-all"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shipping details if delivery boy is assigned */}
                {order.delivery_boy_id && (
                  <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/50 dark:bg-indigo-950/10 px-3 py-2 rounded-xl border border-indigo-100/50 dark:border-indigo-900/20 flex items-center justify-between">
                    <span>Delivery Partner Assigned</span>
                    <span>OTP: {order.delivery_otp || "Awaiting"}</span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="py-20 text-center text-slate-400 dark:text-slate-500 text-xs">
              No orders found matching status "{activeTab}".
            </div>
          )}
        </div>
      </div>

      {/* Delivery Option Selection Modal */}
      {selectedOrderForDeliveryOption && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedOrderForDeliveryOption(null)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-scale-in space-y-6 text-slate-850 dark:text-white">
            <div className="space-y-1">
              <h3 className="text-base font-black uppercase tracking-wider">Accept Order #{selectedOrderForDeliveryOption.order_number}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Choose how this order will be delivered before you start packing.</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => {
                  updateStatusMutation.mutate({
                    orderId: selectedOrderForDeliveryOption.id,
                    status: "accepted",
                    notes: "Order accepted by vendor with Platform Delivery",
                    deliveryOption: "auto"
                  });
                  setSelectedOrderForDeliveryOption(null);
                }}
                className="flex flex-col items-start p-4 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] text-left cursor-pointer group"
              >
                <span className="font-extrabold text-xs text-slate-850 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                  🚲 Platform Delivery Partner
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                  Our system will automatically search and assign a delivery boy based on proximity to match order destination.
                </span>
              </button>

              <button
                onClick={() => {
                  updateStatusMutation.mutate({
                    orderId: selectedOrderForDeliveryOption.id,
                    status: "accepted",
                    notes: "Order accepted by vendor with Self Delivery",
                    deliveryOption: "self"
                  });
                  setSelectedOrderForDeliveryOption(null);
                }}
                className="flex flex-col items-start p-4 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] text-left cursor-pointer group"
              >
                <span className="font-extrabold text-xs text-slate-850 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                  🎒 Store Self Delivery
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                  Deliver using your own store runner or personal courier. No platform delivery partner will be dispatched.
                </span>
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSelectedOrderForDeliveryOption(null)}
                className="flex-1 py-3 border border-slate-205 dark:border-slate-850 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <OtpPromptModal
        isOpen={!!otpConfirmOrder}
        title="Delivery OTP Verification"
        message={`Enter 4-digit OTP and upload proof photos to deliver Order #${otpConfirmOrder?.order_number}`}
        loading={updateStatusMutation.isPending}
        onConfirm={(otp, images) => {
          updateStatusMutation.mutate({
            orderId: otpConfirmOrder.id,
            status: "delivered",
            otp,
            images,
            notes: "Order marked delivered by vendor (Self Delivery Verification)"
          });
          setOtpConfirmOrder(null);
        }}
        onCancel={() => setOtpConfirmOrder(null)}
      />

      <ItemRejectionModal
        isOpen={!!rejectionConfig?.isOpen}
        item={rejectionConfig?.item}
        loading={rejectItemsMutation.isPending}
        onConfirm={(qty, reason) => {
          if (rejectionConfig?.orderId && rejectionConfig?.item) {
            rejectItemsMutation.mutate({
              orderId: rejectionConfig.orderId,
              payload: {
                rejected_items: [{
                  product_id: rejectionConfig.item.product_id,
                  variant_id: rejectionConfig.item.variant_id,
                  rejected_quantity: qty,
                  reason: reason
                }]
              }
            });
          }
        }}
        onCancel={() => setRejectionConfig(null)}
      />
    </VendorLayout>
  );
}
