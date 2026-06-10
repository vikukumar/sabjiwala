"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Loader2, Save, Upload, Star } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import VendorLayout from "@/components/VendorLayout";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditProductPage({ params }: PageProps) {
  // Unwrap Next.js 16 params
  const { id } = React.use(params);
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();

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
  const [imageUrl, setImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Fetch product data
  const { data: productData, isLoading: productLoading } = useQuery<any>({
    queryKey: ["vendorProduct", id],
    queryFn: async () => {
      const res = await api.get(`/products/${id}`);
      return res.data;
    }
  });

  // Fetch categories
  const { data: categoriesData } = useQuery<any>({
    queryKey: ["allCategories"],
    queryFn: async () => {
      const res = await api.get("/catalog/categories", {
        params: { all_levels: true }
      });
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
      setImageUrl(attrs.image_url || "");
    }
  }, [productData]);

  // Image upload
  const handleImageUpload = async (file: File) => {
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/storage/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data?.url || res.data?.file_url || "";
      if (url) {
        setImageUrl(url);
        success("Image uploaded successfully!");
      } else {
        showError("Upload Failed", "No URL returned from server");
      }
    } catch (err: any) {
      showError("Upload Failed", err.response?.data?.detail || err.message);
    } finally {
      setImageUploading(false);
    }
  };

  // Update product details mutation
  const updateProductMutation = useMutation({
    mutationFn: async () => {
      // 1. Update product base and price
      await api.patch(`/products/${id}`, {
        name,
        description: desc || null,
        category_id: categoryId,
        unit,
        unit_value: parseFloat(unitValue) || 1.0,
        price: parseFloat(price) || 0.0,
        compare_at_price: comparePrice ? parseFloat(comparePrice) : null,
        attributes: {
          image_emoji: emoji,
          image_url: imageUrl || undefined,
        }
      });

      // 2. Adjust inventory stock
      const stockVal = parseFloat(stock);
      if (!isNaN(stockVal)) {
        await api.post(`/products/${id}/inventory`, null, {
          params: {
            quantity: stockVal,
            change_type: stockChangeType,
            notes: "Full product editor inventory update"
          }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorProduct", id] });
      queryClient.invalidateQueries({ queryKey: ["vendorCatalog"] });
      queryClient.invalidateQueries({ queryKey: ["vendorMetrics"] });
      success("Product updated successfully!");
      window.location.replace("/vendor/inventory");
    },
    onError: (err: any) => {
      showError("Update Failed", "Failed to update product: " + (err.response?.data?.detail || err.message));
    }
  });

  if (productLoading) {
    return (
      <VendorLayout title="Edit Product">
        <div className="py-20 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
          <span className="text-xs text-slate-500">Fetching product details...</span>
        </div>
      </VendorLayout>
    );
  }

  return (
    <VendorLayout title={`Edit: ${name || "Product"}`}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <a
            href="/vendor/inventory"
            className="bg-slate-100 dark:bg-slate-850 text-slate-700 dark:text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Catalog
          </a>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-sm space-y-4">
          <h4 className="text-sm font-black border-b pb-2">Edit Product Catalog Entry</h4>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!categoryId) {
                showError("Category Required", "Please select a category!");
                return;
              }
              updateProductMutation.mutate();
            }}
            className="space-y-4 text-xs"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Product Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Category *</label>
                <select
                  required
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                >
                  <option value="">Select Category</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.parent_id ? `└── ${c.name}` : c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-550 uppercase">Description</label>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-24 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Unit Type</label>
                <select
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                >
                  <option value="kg">kg</option>
                  <option value="gram">gram</option>
                  <option value="piece">piece</option>
                  <option value="dozen">dozen</option>
                  <option value="packet">packet</option>
                  <option value="litre">litre</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Unit Value</label>
                <input
                  type="number"
                  step="0.01"
                  value={unitValue}
                  onChange={e => setUnitValue(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Represent Emoji</label>
                <select
                  value={emoji}
                  onChange={e => setEmoji(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                >
                  <option value="🥬">🥬 Greens</option>
                  <option value="🍅">🍅 Tomato</option>
                  <option value="🥔">🥔 Potato</option>
                  <option value="🧅">🧅 Onion</option>
                  <option value="🥦">🥦 Broccoli</option>
                  <option value="🥕">🥕 Carrot</option>
                  <option value="🍎">🍎 Apple</option>
                  <option value="🥭">🥭 Mango</option>
                  <option value="🌶️">🌶️ Chilli</option>
                </select>
              </div>
            </div>

            {/* Image Upload Block */}
            <div className="space-y-2">
              <label className="font-bold text-slate-555 uppercase">Product Photo</label>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />
              <div className="flex items-center gap-4 flex-wrap">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={imageUploading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-slate-350 dark:border-slate-750 hover:border-emerald-500 bg-slate-50 dark:bg-slate-950 text-slate-655 dark:text-slate-400 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                  {imageUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Upload Image"}
                </button>
                {imageUrl && (
                  <div className="flex items-center gap-2">
                    <img src={imageUrl} alt="Uploaded product" className="w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-sm" />
                    <button type="button" onClick={() => setImageUrl("")} className="text-rose-500 font-bold hover:underline">Remove</button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Selling Price (₹) *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Compare Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={comparePrice}
                  onChange={e => setComparePrice(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Adjust Stock Panel */}
            <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-3">
              <h5 className="font-bold text-slate-500 uppercase">Manage Inventory Stock</h5>
              <div className="grid grid-cols-3 gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl border dark:border-slate-800">
                {["set", "add", "remove"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setStockChangeType(mode as any)}
                    className={`py-1.5 rounded-lg text-[10px] capitalize font-bold transition-all ${
                      stockChangeType === mode
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-bold"
                        : "text-slate-450 hover:text-slate-700"
                    }`}
                  >
                    {mode === "set" ? "Set Stock" : mode === "add" ? "+ Add Stock" : "- Deduct"}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Stock Quantity ({unit})</label>
                <input
                  type="number"
                  step="0.1"
                  value={stock}
                  onChange={e => setStock(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={updateProductMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {updateProductMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Modifications
            </button>
          </form>
        </div>
      </div>
    </VendorLayout>
  );
}
