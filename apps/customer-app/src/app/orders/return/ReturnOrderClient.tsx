"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, resolveImageUrl } from "@sbjiwala/shared";
import { ChevronLeft, RotateCcw, Upload, X, Trash2, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { Button, Card, Badge, Spinner } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";
import { resolveLink } from "@/components/AppShell";

const REASONS = [
  { value: "rotten", label: "Rotten / Spoiled 🥦" },
  { value: "damaged", label: "Damaged / Bruised 🍎" },
  { value: "wrong_item", label: "Wrong Item Delivered 📦" },
  { value: "underweight", label: "Underweight / Less Quantity ⚖️" },
  { value: "expired", label: "Quality Issue / Stale 🥬" },
  { value: "other", label: "Other Reason 💬" },
];

export default function ReturnOrderClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams?.get("id") || searchParams?.get("order_id") || "";
  const { success, error: showError } = useToast();
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const [selectedItems, setSelectedItems] = useState<Record<string, {
    selected: boolean;
    reason: string;
    description: string;
    imageUrl: string;
    uploading: boolean;
  }>>({});

  const { data: order, isLoading } = useQuery<any>({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const res = await api.get(`/orders/${orderId}`);
      return res.data?.data || res.data;
    },
    enabled: !!orderId,
  });

  const submitReturn = useMutation({
    mutationFn: async (payload: any) => api.post(`/orders/${orderId}/return`, payload),
    onSuccess: () => {
      success("Return Request Submitted", "Our support agents will review your refund shortly.");
      router.replace(resolveLink(`/orders/detail?id=${orderId}`));
    },
    onError: (err: any) => {
      showError("Submission Failed", err.response?.data?.detail || err.message);
    }
  });

  if (!mounted || isLoading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!orderId) {
    return <div className="text-center py-20 text-slate-500">Order ID is missing</div>;
  }

  if (!order) {
    return <div className="text-center py-20 text-slate-500">Order not found</div>;
  }

  const handleToggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const current = prev[itemId] || { selected: false, reason: "", description: "", imageUrl: "", uploading: false };
      return {
        ...prev,
        [itemId]: { ...current, selected: !current.selected }
      };
    });
  };

  const handleFieldChange = (itemId: string, field: string, value: any) => {
    setSelectedItems(prev => {
      const current = prev[itemId] || { selected: false, reason: "", description: "", imageUrl: "", uploading: false };
      return {
        ...prev,
        [itemId]: { ...current, [field]: value }
      };
    });
  };

  const handleImageUpload = async (itemId: string, file: File) => {
    // Set loading state
    handleFieldChange(itemId, "uploading", true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/storage/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const resAny = res as any;
      const url = resAny.url || resAny.data?.url || resAny.data?.data?.url;
      if (url) {
        handleFieldChange(itemId, "imageUrl", url);
        success("Image uploaded!");
      }
    } catch (err: any) {
      showError("Upload failed", err.response?.data?.detail || err.message);
    } finally {
      handleFieldChange(itemId, "uploading", false);
    }
  };

  const handleSubmit = () => {
    const itemsToReturn = Object.entries(selectedItems)
      .filter(([_, data]) => data.selected)
      .map(([id, data]) => {
        const orderItem = order.items.find((item: any) => item.id === id);
        return {
          product_id: orderItem?.product_id,
          product_name: orderItem?.product_name || orderItem?.name,
          quantity: orderItem?.quantity,
          reason: data.reason,
          description: data.description,
          image_url: data.imageUrl
        };
      });

    if (itemsToReturn.length === 0) {
      showError("No items selected", "Select at least one product to return.");
      return;
    }

    // Verify all selected items have reasons
    const missingReason = itemsToReturn.some(item => !item.reason);
    if (missingReason) {
      showError("Reason required", "Choose a reason for each selected product.");
      return;
    }

    // Compile images
    const allImages = itemsToReturn.map(item => item.image_url).filter(Boolean);

    // Call submit mutation
    submitReturn.mutate({
      order_id: orderId,
      reason: `Return request for ${itemsToReturn.length} item(s)`,
      images: allImages,
      return_items: itemsToReturn
    });
  };

  const activeReturnsCount = Object.values(selectedItems).filter(item => item.selected).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 font-sans">
      {/* Back button and title */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Return Products</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Order #{order.order_number}</p>
        </div>
      </div>

      {/* Info Warning */}
      <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex gap-3 text-xs leading-normal">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-extrabold text-amber-800 dark:text-amber-400">Returns Policy Guarantee 🛡️</p>
          <p className="text-amber-700 dark:text-amber-500 mt-0.5">
            Please upload a clear photograph of fresh vegetable quality issues. Our admin desk reviews and credits refunds instantly to your wallet.
          </p>
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-4">
        {(order.items || []).map((item: any) => {
          const itemState = selectedItems[item.id] || { selected: false, reason: "", description: "", imageUrl: "", uploading: false };

          return (
            <Card key={item.id} className={`transition-all duration-300 ${itemState.selected ? "border-emerald-500 dark:border-emerald-700 shadow-md shadow-emerald-500/5" : "border-slate-200 dark:border-slate-800"}`} padding="none">
              <div className="p-4 flex items-start gap-4">
                {/* Checkbox */}
                <button
                  onClick={() => handleToggleItem(item.id)}
                  className={`mt-1.5 w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${itemState.selected ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300 dark:border-slate-700"}`}
                >
                  {itemState.selected && <CheckCircle2 className="w-3.5 h-3.5 fill-current" />}
                </button>

                {/* Product Detail */}
                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden relative border border-slate-200/50">
                  {item.product_image_url || (item.attributes?.image_emoji && (item.attributes.image_emoji.startsWith("http") || item.attributes.image_emoji.startsWith("/")))? (
                    <img src={resolveImageUrl(item.product_image_url || item.attributes.image_emoji)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    item.attributes?.image_emoji || "🥬"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">{item.name || item.product_name}</h3>
                  <p className="text-xs text-slate-550 dark:text-slate-400">₹{Number(item.unit_price).toFixed(2)} · Quantity: {item.quantity}</p>
                </div>
              </div>

              {/* Conditional return form for this product */}
              {itemState.selected && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-950/20">
                  {/* Reason Dropdown */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-black text-slate-400 uppercase">Reason for return *</label>
                    <select
                      value={itemState.reason}
                      onChange={(e) => handleFieldChange(item.id, "reason", e.target.value)}
                      className="input-base px-3 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-white"
                    >
                      <option value="">Select a reason...</option>
                      {REASONS.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-black text-slate-400 uppercase">Description / Notes</label>
                    <textarea
                      rows={2}
                      value={itemState.description}
                      onChange={(e) => handleFieldChange(item.id, "description", e.target.value)}
                      placeholder="e.g. Tomatoes were bruised on delivery, not usable."
                      className="input-base px-3 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full focus:outline-none focus:border-emerald-500 text-slate-850 dark:text-white resize-none"
                    />
                  </div>

                  {/* Photo Upload */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-black text-slate-400 uppercase">Upload proof photo</label>
                    <div className="flex items-center gap-3">
                      {itemState.imageUrl ? (
                        <div className="relative w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex-shrink-0 group">
                          <img src={resolveImageUrl(itemState.imageUrl)} alt="Proof upload" className="w-full h-full object-cover" />
                          <button
                            onClick={() => handleFieldChange(item.id, "imageUrl", "")}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors bg-white dark:bg-slate-900">
                          {itemState.uploading ? (
                            <Spinner size="sm" />
                          ) : (
                            <>
                              <Upload className="w-4 h-4 text-slate-400" />
                              <span className="text-[9px] font-extrabold text-slate-450 uppercase">Attach</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={itemState.uploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(item.id, file);
                            }}
                            className="hidden"
                          />
                        </label>
                      )}
                      <p className="text-[10px] text-slate-400 leading-normal">
                        Attach a photo displaying quality issue to bypass manual inspection.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Sticky Bottom Actions */}
      <div className="pt-2">
        <Button
          fullWidth
          size="lg"
          onClick={handleSubmit}
          loading={submitReturn.isPending}
          disabled={activeReturnsCount === 0}
          leftIcon={<RotateCcw className="w-4 h-4" />}
        >
          Submit Return Request ({activeReturnsCount})
        </Button>
      </div>
    </div>
  );
}
