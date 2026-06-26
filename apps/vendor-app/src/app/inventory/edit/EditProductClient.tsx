"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Loader2, Save, Trash2, ImagePlus, Star, Package, ChevronUp } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, resolveImageUrl } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import VendorLayout, { resolveVendorLink } from "@/components/VendorLayout";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function EditProductClient() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams?.get("id") || "";

  // Form states
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState("kg");
  const [unitValue, setUnitValue] = useState("1.0");
  const [price, setPrice] = useState("");
  const [comparePrice, setComparePrice] = useState("");
  const [emoji, setEmoji] = useState("🥬");
  const [stock, setStock] = useState("");
  const [stockChangeType, setStockChangeType] = useState<"set" | "add" | "remove">("set");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [localPreviews, setLocalPreviews] = useState<{ file: File; preview: string }[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [activePreviewIdx, setActivePreviewIdx] = useState(0);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Fetch product data
  const { data: productData, isLoading: productLoading } = useQuery<any>({
    queryKey: ["vendorProduct", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await api.get(`/products/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  // Fetch categories
  const { data: categoriesData } = useQuery<any>({
    queryKey: ["allCategories"],
    queryFn: async () => {
      const res = await api.get("/catalog/categories", { params: { all_levels: true } });
      return res.data || [];
    }
  });

  const categories = categoriesData || [];

  // Populate form fields
  useEffect(() => {
    if (productData) {
      setName(productData.name || "");
      setDesc(productData.description || "");
      setCategoryId(productData.category_id || "");
      setUnit(productData.unit || "kg");
      setUnitValue(String(productData.unit_value || "1.0"));

      const attrs = productData.attributes || {};
      setPrice(String(attrs.price || "0.00"));
      setComparePrice(attrs.compare_at_price ? String(attrs.compare_at_price) : "");
      setEmoji(attrs.image_emoji || "🥬");
      setStock(String(attrs.quantity || "0.0"));

      const imgs = productData.images || [];
      const urls = imgs.map((img: any) => resolveImageUrl(img.image_url));
      if (urls.length === 0 && productData.primary_image_url) urls.push(resolveImageUrl(productData.primary_image_url));
      if (urls.length === 0 && attrs.image_url) urls.push(resolveImageUrl(attrs.image_url));
      setImageUrls(urls);
    }
  }, [productData]);

  const handleImagesUpload = async (files: File[]) => {
    setImageUploading(true);
    // Show local previews immediately
    const newPreviews = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }));
    setLocalPreviews(prev => [...prev, ...newPreviews]);
    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await api.post("/storage/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const url = res.data?.url || res.data?.file_url || "";
        if (url) uploadedUrls.push(url);
      }
      if (uploadedUrls.length > 0) {
        setImageUrls(prev => [...prev, ...uploadedUrls]);
        success(`${uploadedUrls.length} image(s) uploaded!`);
      } else {
        showError("Upload Failed", "No URLs returned from server");
      }
    } catch (err: any) {
      showError("Upload Failed", err.response?.data?.detail || err.message);
    } finally {
      setImageUploading(false);
      setLocalPreviews([]);
    }
  };

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("Missing Product ID");
      await api.patch(`/products/${id}`, {
        name, description: desc || null, category_id: categoryId,
        unit, unit_value: parseFloat(unitValue) || 1.0,
        price: parseFloat(price) || 0.0,
        compare_at_price: comparePrice ? parseFloat(comparePrice) : null,
        attributes: { image_emoji: emoji, image_url: imageUrls[0] || undefined },
        images: imageUrls
      });
      const stockVal = parseFloat(stock);
      if (!isNaN(stockVal)) {
        await api.post(`/products/${id}/inventory`, null, {
          params: { quantity: stockVal, change_type: stockChangeType, notes: "Full product editor inventory update" }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorProduct", id] });
      queryClient.invalidateQueries({ queryKey: ["vendorCatalog"] });
      queryClient.invalidateQueries({ queryKey: ["vendorMetrics"] });
      success("Product updated successfully!");
      router.replace(resolveVendorLink("/inventory"));
    },
    onError: (err: any) => {
      showError("Update Failed", "Failed to update product: " + (err.response?.data?.detail || err.message));
    }
  });

  // All images combined (real + local previews)
  const allImageUrls = imageUrls;
  const previewSrc = allImageUrls[activePreviewIdx] || null;
  const emojiOrPlaceholder = emoji || "🥬";

  if (!id) {
    return (
      <VendorLayout title="Error">
        <div className="py-20 flex flex-col items-center justify-center gap-2 font-sans">
          <span className="text-sm font-bold text-red-500">No Product ID provided.</span>
          <Link href={resolveVendorLink("/inventory")} className="text-xs text-emerald-600 underline">Return to catalog</Link>
        </div>
      </VendorLayout>
    );
  }

  if (productLoading) {
    return (
      <VendorLayout title="Edit Product">
        <div className="py-20 flex flex-col items-center justify-center gap-2 font-sans">
          <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
          <span className="text-xs text-slate-500">Fetching product details...</span>
        </div>
      </VendorLayout>
    );
  }

  return (
    <VendorLayout title={`Edit: ${name || "Product"}`}>
      <div className="space-y-5 font-sans">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <Link
            href={resolveVendorLink("/inventory")}
            className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Catalog
          </Link>
          <span className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[200px]">{name || "Loading..."}</span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!categoryId) { showError("Category Required", "Please select a category!"); return; }
            updateProductMutation.mutate();
          }}
        >
          {/* Responsive two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 items-start">

            {/* ── LEFT: Image Preview & Upload ── */}
            <div className="space-y-4 lg:sticky lg:top-4">
              {/* Main Preview */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                <div className="relative aspect-square bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-850 overflow-hidden">
                  {previewSrc ? (
                    <img
                      key={previewSrc}
                      src={previewSrc}
                      alt={name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-8xl">{emojiOrPlaceholder}</span>
                    </div>
                  )}
                  {imageUploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                        <span className="text-white text-xs font-bold">Uploading...</span>
                      </div>
                    </div>
                  )}
                  {previewSrc && activePreviewIdx === 0 && (
                    <div className="absolute top-3 left-3 bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-md shadow">
                      PRIMARY
                    </div>
                  )}
                  {/* Prev/Next navigation */}
                  {allImageUrls.length > 1 && (
                    <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
                      <button type="button" onClick={() => setActivePreviewIdx(i => Math.max(0, i - 1))}
                        disabled={activePreviewIdx === 0}
                        className="pointer-events-auto p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-full disabled:opacity-30 transition-all cursor-pointer">
                        <ChevronUp className="w-4 h-4 -rotate-90" />
                      </button>
                      <button type="button" onClick={() => setActivePreviewIdx(i => Math.min(allImageUrls.length - 1, i + 1))}
                        disabled={activePreviewIdx === allImageUrls.length - 1}
                        className="pointer-events-auto p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-full disabled:opacity-30 transition-all cursor-pointer">
                        <ChevronUp className="w-4 h-4 rotate-90" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Thumbnail Strip */}
                {allImageUrls.length > 0 && (
                  <div className="p-3 flex gap-2 overflow-x-auto">
                    {allImageUrls.map((url, idx) => (
                      <div key={url}
                        onClick={() => setActivePreviewIdx(idx)}
                        className={`relative flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${activePreviewIdx === idx ? "border-emerald-500 shadow-lg shadow-emerald-500/20" : "border-slate-200 dark:border-slate-700 hover:border-slate-400"}`}
                      >
                        <img src={url} alt={`thumb ${idx + 1}`} className="w-full h-full object-cover" />
                        {idx === 0 && (
                          <div className="absolute top-0.5 left-0.5 bg-emerald-600 rounded-sm">
                            <Star className="w-2 h-2 text-white m-0.5" />
                          </div>
                        )}
                        {/* Delete button on thumbnail */}
                        <button type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageUrls(prev => prev.filter((_, i) => i !== idx));
                            setActivePreviewIdx(p => Math.max(0, p >= idx ? p - 1 : p));
                          }}
                          className="absolute top-0.5 right-0.5 p-0.5 bg-rose-600/90 text-white rounded-sm hover:bg-rose-500 cursor-pointer">
                          <Trash2 className="w-2 h-2" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upload Zone */}
              <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={async e => {
                  const files = e.target.files;
                  if (files && files.length > 0) await handleImagesUpload(Array.from(files));
                  e.target.value = "";
                }} />
              <div
                className={`border-2 border-dashed rounded-2xl transition-all cursor-pointer ${dragOver ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 scale-[1.01]" : "border-slate-300 dark:border-slate-700 hover:border-emerald-400 bg-slate-50 dark:bg-slate-900/50"}`}
                onClick={() => imageInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={async (e) => {
                  e.preventDefault(); setDragOver(false);
                  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
                  if (files.length > 0) await handleImagesUpload(files);
                }}
              >
                <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-500 dark:text-slate-400">
                  <ImagePlus className="w-7 h-7 text-slate-400" />
                  <p className="text-xs font-bold">Drop images or click to upload</p>
                  <p className="text-[10px] text-slate-400">PNG, JPG, WEBP up to 10MB</p>
                </div>
              </div>

              {/* Set Primary info */}
              {allImageUrls.length > 1 && (
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Set Primary Image</p>
                  <div className="flex flex-wrap gap-2">
                    {allImageUrls.map((url, idx) => (
                      <button key={url} type="button"
                        onClick={() => {
                          if (idx === 0) return;
                          setImageUrls(prev => { const next = [...prev]; const item = next.splice(idx, 1)[0]; next.unshift(item); return next; });
                          setActivePreviewIdx(0);
                        }}
                        className={`text-[9px] font-black px-2.5 py-1 rounded-lg transition-all cursor-pointer ${idx === 0 ? "bg-emerald-600 text-white" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400"}`}
                      >
                        {idx === 0 ? "★ Primary" : `Image ${idx + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT: Product Details Form ── */}
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">Basic Information</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-550 uppercase">Product Name *</label>
                    <input type="text" required value={name} onChange={e => setName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-550 uppercase">Category *</label>
                    <select required value={categoryId} onChange={e => setCategoryId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white">
                      <option value="">Select Category</option>
                      {categories.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.parent_id ? `└── ${c.name}` : c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="text-xs space-y-1.5">
                  <label className="font-bold text-slate-550 uppercase">Description</label>
                  <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white resize-none" />
                </div>
              </div>

              {/* Measurements */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">Measurements & Identity</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-550 uppercase">Unit Type</label>
                    <select value={unit} onChange={e => setUnit(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white">
                      <option value="kg">kg</option><option value="gram">gram</option>
                      <option value="piece">piece</option><option value="dozen">dozen</option>
                      <option value="packet">packet</option><option value="litre">litre</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-550 uppercase">Unit Value</label>
                    <input type="number" step="0.01" value={unitValue} onChange={e => setUnitValue(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-550 uppercase">Fallback Emoji</label>
                    <input type="text" value={emoji} onChange={e => setEmoji(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">Pricing</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-550 uppercase">Sell Price (₹) *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₹</span>
                      <input type="number" required step="0.01" value={price} onChange={e => setPrice(e.target.value)}
                        className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-550 uppercase">Compare Price (₹)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₹</span>
                      <input type="number" step="0.01" value={comparePrice} onChange={e => setComparePrice(e.target.value)}
                        className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
                    </div>
                    {comparePrice && price && parseFloat(comparePrice) > parseFloat(price) && (
                      <p className="text-[10px] text-emerald-600 font-bold">
                        {Math.round(((parseFloat(comparePrice) - parseFloat(price)) / parseFloat(comparePrice)) * 100)}% discount shown to customers
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Inventory */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
                  <Package className="w-3.5 h-3.5" /> Stock Management
                </h4>
                <div className="text-xs space-y-1.5">
                  <label className="font-bold text-slate-550 uppercase">Adjust Stock Quantity</label>
                  <div className="flex gap-2">
                    <select value={stockChangeType} onChange={e => setStockChangeType(e.target.value as any)}
                      className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none text-slate-900 dark:text-white text-xs font-bold min-w-[100px]">
                      <option value="set">Set to</option>
                      <option value="add">Add</option>
                      <option value="remove">Remove</option>
                    </select>
                    <input type="number" step="0.1" value={stock} onChange={e => setStock(e.target.value)} placeholder="Quantity"
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
                    <div className="flex items-center px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold min-w-[50px] text-center justify-center">
                      {unit}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">Current stock: {productData?.attributes?.quantity ?? "—"} {unit}</p>
                </div>
              </div>

              {/* Save Button */}
              <button
                type="submit"
                disabled={updateProductMutation.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-600/20 transition-all text-sm tracking-wide"
              >
                {updateProductMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving Changes...</>
                ) : (
                  <><Save className="w-4 h-4" /> Save Changes</>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </VendorLayout>
  );
}
