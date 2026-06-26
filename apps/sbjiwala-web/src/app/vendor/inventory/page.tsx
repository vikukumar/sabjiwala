"use client";

import React, { useState, useRef } from "react";
import {
  Plus, Trash2, ArrowLeft, Loader2, Search, Edit3, AlertCircle, Package, Tag, IndianRupee
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, resolveImageUrl } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import VendorLayout, { resolveVendorLink } from "@/components/VendorLayout";
import { Button } from "@/components/ui/index";
import Link from "next/link";

export default function VendorInventoryPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<"list" | "add-product" | "add-category">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");

  // Form states for adding product
  const [newProdName, setNewProdName] = useState("");
  const [newProdDesc, setNewProdDesc] = useState("");
  const [newProdCategoryId, setNewProdCategoryId] = useState("");
  const [newProdUnit, setNewProdUnit] = useState("kg");
  const [newProdUnitValue, setNewProdUnitValue] = useState("1.0");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdComparePrice, setNewProdComparePrice] = useState("");
  const [newProdEmoji, setNewProdEmoji] = useState("🥬");
  const [newProdInitialStock, setNewProdInitialStock] = useState("50.0");
  const [newProdImageUrls, setNewProdImageUrls] = useState<string[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Form states for adding category/subcategory
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newCatParentId, setNewCatParentId] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("");

  // Delete product state
  const [productToDelete, setProductToDelete] = useState<any | null>(null);

  const handleImagesUpload = async (files: File[]) => {
    setImageUploading(true);
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
        setNewProdImageUrls(prev => [...prev, ...uploadedUrls]);
        success(`${uploadedUrls.length} image(s) uploaded successfully!`);
      } else {
        showError("Upload Failed", "No URLs returned from server");
      }
    } catch (err: any) {
      showError("Upload Failed", err.response?.data?.detail || err.message);
    } finally {
      setImageUploading(false);
    }
  };

  const { data: vendorProfileData } = useQuery<any>({
    queryKey: ["vendorProfile"],
    queryFn: async () => {
      const res = await api.get("/vendors/me");
      return res.data;
    }
  });

  const vendorId = vendorProfileData?.id || "";

  const { data: productsData, isLoading: productsLoading } = useQuery<any>({
    queryKey: ["vendorCatalog", vendorId, searchQuery, selectedCategoryFilter],
    queryFn: async () => {
      const res = await api.get("/catalog/products", {
        params: {
          vendor_id: vendorId,
          search: searchQuery || undefined,
          category_id: selectedCategoryFilter || undefined,
          page_size: 100,
          include_out_of_stock: true,
        }
      });
      return res.data || [];
    },
    enabled: !!vendorId
  });

  const { data: categoriesData } = useQuery<any>({
    queryKey: ["allCategories"],
    queryFn: async () => {
      const res = await api.get("/catalog/categories", { params: { all_levels: true } });
      return res.data || [];
    }
  });

  const addCategoryMutation = useMutation({
    mutationFn: async () => {
      return api.post("/products/categories", {
        name: newCatName,
        description: newCatDesc || null,
        parent_id: newCatParentId || null,
        icon: newCatIcon || null,
        is_active: true,
        sort_order: 0
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allCategories"] });
      success("Category created successfully!");
      setNewCatName(""); setNewCatDesc(""); setNewCatParentId(""); setNewCatIcon("");
      setActiveSubTab("list");
    },
    onError: (err: any) => {
      showError("Creation Failed", "Failed to create category: " + (err.response?.data?.detail || err.message));
    }
  });

  const addProductMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/products", {
        name: newProdName,
        description: newProdDesc || null,
        category_id: newProdCategoryId,
        unit: newProdUnit,
        unit_value: parseFloat(newProdUnitValue) || 1.0,
        price: parseFloat(newProdPrice) || 0.0,
        compare_at_price: newProdComparePrice ? parseFloat(newProdComparePrice) : null,
        attributes: { image_emoji: newProdEmoji, image_url: newProdImageUrls[0] || undefined },
        images: newProdImageUrls
      });
      const createdProd = res.data;
      const initialStockVal = parseFloat(newProdInitialStock) || 0.0;
      const prodId = createdProd?.id;
      if (prodId && initialStockVal > 0) {
        await api.post(`/products/${prodId}/inventory`, null, {
          params: { quantity: initialStockVal, change_type: "set", notes: "Initial inventory setup" }
        });
      }
      return createdProd;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorCatalog"] });
      queryClient.invalidateQueries({ queryKey: ["vendorMetrics"] });
      success("Product added to catalog successfully!");
      setNewProdName(""); setNewProdDesc(""); setNewProdCategoryId("");
      setNewProdPrice(""); setNewProdComparePrice(""); setNewProdInitialStock("50.0");
      setNewProdEmoji("🥬"); setNewProdImageUrls([]);
      setActiveSubTab("list");
    },
    onError: (err: any) => {
      showError("Add Failed", "Failed to add product: " + (err.response?.data?.detail || err.message));
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (prodId: string) => api.delete(`/products/${prodId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorCatalog"] });
      success("Product removed from catalog successfully!");
    },
    onError: (err: any) => {
      showError("Deletion Failed", "Failed to delete product: " + (err.response?.data?.detail || err.message));
    }
  });

  const categories = categoriesData || [];
  const products = productsData || [];

  return (
    <VendorLayout title="Catalog & Inventory Control">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-5 rounded-3xl shadow-sm">
          <div>
            <h3 className="text-xs font-black text-slate-550 uppercase tracking-wider">Store Inventory</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Manage products, adjust stock quantities, configure pricing, and add categories.</p>
          </div>
          <div className="flex gap-2">
            {activeSubTab !== "list" ? (
              <button
                onClick={() => setActiveSubTab("list")}
                className="bg-slate-105 dark:bg-slate-850 text-slate-700 dark:text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Catalog
              </button>
            ) : (
              <>
                <button
                  onClick={() => setActiveSubTab("add-category")}
                  className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-250 dark:border-emerald-900 text-xs font-black px-4 py-2.5 rounded-xl cursor-pointer hover:bg-emerald-100/50"
                >
                  + New Category
                </button>
                <button
                  onClick={() => {
                    if (categories.length === 0) {
                      showError("Category Required", "Please add a category first!");
                      return;
                    }
                    setActiveSubTab("add-product");
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-md cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Product
                </button>
              </>
            )}
          </div>
        </div>

        {/* Add Category Form */}
        {activeSubTab === "add-category" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-sm max-w-xl mx-auto space-y-4">
            <h4 className="text-sm font-black border-b pb-2">Create Category / Subcategory</h4>
            <form
              onSubmit={(e) => { e.preventDefault(); if (!newCatName.trim()) return; addCategoryMutation.mutate(); }}
              className="space-y-4 text-xs"
            >
              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Category Name *</label>
                <input type="text" required placeholder="e.g. Exotic Veggies, Root Vegetables" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Parent Category (Optional)</label>
                <select value={newCatParentId} onChange={e => setNewCatParentId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white">
                  <option value="">None (Creates a Top-Level Parent Category)</option>
                  {categories.filter((c: any) => c.parent_id === null).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Description</label>
                <textarea placeholder="Brief description of category..." value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-20 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Category Icon/Emoji (Optional)</label>
                <input type="text" placeholder="e.g. 🥦, 🍎, 🥕" value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
              </div>
              <button type="submit" disabled={addCategoryMutation.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer">
                {addCategoryMutation.isPending ? "Creating..." : "Save Category"}
              </button>
            </form>
          </div>
        )}

        {/* Add Product Form */}
        {activeSubTab === "add-product" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-sm max-w-3xl mx-auto space-y-5">
            <h4 className="text-sm font-black border-b border-slate-200 dark:border-slate-800 pb-3">Add New Product to Catalog</h4>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newProdCategoryId) { showError("Category Required", "Please select a category!"); return; }
                addProductMutation.mutate();
              }}
              className="space-y-5 text-xs"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-550 uppercase">Product Name *</label>
                  <input type="text" required placeholder="e.g. Fresh Red Tomatoes" value={newProdName} onChange={e => setNewProdName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-550 uppercase">Category *</label>
                  <select required value={newProdCategoryId} onChange={e => setNewProdCategoryId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white">
                    <option value="">Select Category</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.parent_id ? `└── ${c.name}` : c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Description</label>
                <textarea placeholder="Product description and details..." value={newProdDesc} onChange={e => setNewProdDesc(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-20 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-550 uppercase">Unit Type</label>
                  <select value={newProdUnit} onChange={e => setNewProdUnit(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white">
                    <option value="kg">kg</option><option value="gram">gram</option>
                    <option value="piece">piece</option><option value="dozen">dozen</option>
                    <option value="packet">packet</option><option value="litre">litre</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-550 uppercase">Unit Value</label>
                  <input type="number" step="0.01" value={newProdUnitValue} onChange={e => setNewProdUnitValue(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-550 uppercase">Fallback Emoji</label>
                  <input type="text" value={newProdEmoji} onChange={e => setNewProdEmoji(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
                </div>
              </div>

              {/* Photo Upload — drag and drop zone */}
              <div className="space-y-3">
                <label className="font-bold text-slate-550 uppercase">Product Photos</label>
                <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={async e => {
                    const files = e.target.files;
                    if (files && files.length > 0) await handleImagesUpload(Array.from(files));
                  }} />
                <div
                  className={`relative border-2 border-dashed rounded-2xl transition-all cursor-pointer ${dragOver ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-slate-300 dark:border-slate-700 hover:border-emerald-400 bg-slate-50 dark:bg-slate-950/50"}`}
                  onClick={() => imageInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={async (e) => {
                    e.preventDefault(); setDragOver(false);
                    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
                    if (files.length > 0) await handleImagesUpload(files);
                  }}
                >
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-500 dark:text-slate-400">
                    {imageUploading ? (
                      <>
                        <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
                        <span className="text-xs font-semibold">Uploading images...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-2xl">📸</div>
                        <p className="text-xs font-bold">Drop images here or click to upload</p>
                        <p className="text-[10px] text-slate-400">PNG, JPG, WEBP up to 10MB each (max 5)</p>
                      </>
                    )}
                  </div>
                </div>

                {newProdImageUrls.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {newProdImageUrls.map((url, idx) => (
                      <div key={url} className="relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 aspect-square shadow-sm">
                        <img src={resolveImageUrl(url)} alt={`Product image ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
                          <button type="button" onClick={(e) => { e.stopPropagation(); setNewProdImageUrls(prev => prev.filter((_, i) => i !== idx)); }}
                            className="self-end p-1.5 rounded-lg bg-rose-600/90 text-white hover:bg-rose-500 transition-colors cursor-pointer">
                            <Trash2 className="w-3 h-3" />
                          </button>
                          {idx !== 0 && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); setNewProdImageUrls(prev => { const next = [...prev]; const item = next.splice(idx, 1)[0]; next.unshift(item); return next; }); }}
                              className="bg-white/90 text-slate-900 hover:bg-white text-[9px] font-black px-2 py-0.5 rounded-md self-start transition-colors cursor-pointer">
                              Set Primary
                            </button>
                          )}
                        </div>
                        {idx === 0 && (
                          <div className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md shadow z-10">PRIMARY</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-550 uppercase">Price (₹) *</label>
                  <input type="number" required step="0.01" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-550 uppercase">Compare Price (₹)</label>
                  <input type="number" step="0.01" value={newProdComparePrice} onChange={e => setNewProdComparePrice(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-550 uppercase">Initial Stock</label>
                  <input type="number" step="0.1" value={newProdInitialStock} onChange={e => setNewProdInitialStock(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
                </div>
              </div>

              <button type="submit" disabled={addProductMutation.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer">
                {addProductMutation.isPending ? "Saving..." : "Save Product to Catalog"}
              </button>
            </form>
          </div>
        )}

        {/* Product List — Card Grid */}
        {activeSubTab === "list" && (
          <div className="space-y-4">
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Search catalog products..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-55/30 dark:bg-slate-950 text-xs focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
              </div>
              <select value={selectedCategoryFilter} onChange={e => setSelectedCategoryFilter(e.target.value)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white">
                <option value="">All Categories</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.parent_id ? `└── ${c.name}` : c.name}</option>
                ))}
              </select>
            </div>

            {productsLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
                <span className="text-xs text-slate-500">Loading catalog items...</span>
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((p: any) => {
                  const attrs = p.attributes || {};
                  const qty = parseFloat(attrs.quantity || 0);
                  const isOutOfStock = qty <= 0;
                  const isLowStock = qty > 0 && qty < 10;
                  const imageUrl = p.primary_image_url || p.images?.[0]?.image_url || attrs.image_url;
                  const emoji = attrs.image_emoji || "🥬";
                  const price = attrs.price;
                  const comparePrice = attrs.compare_at_price;

                  return (
                    <div key={p.id} className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col">
                      {/* Product Image */}
                      <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-850 overflow-hidden">
                        {imageUrl ? (
                          <img
                            src={resolveImageUrl(imageUrl)}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-6xl">{emoji}</span>
                          </div>
                        )}

                        {/* Stock badge */}
                        <div className="absolute top-2.5 left-2.5">
                          {isOutOfStock ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                              <AlertCircle className="w-2.5 h-2.5" /> OUT OF STOCK
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                              LOW STOCK
                            </span>
                          ) : null}
                        </div>

                        {/* Compare price discount badge */}
                        {comparePrice && price && (
                          <div className="absolute top-2.5 right-2.5">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-600 text-white shadow">
                              -{Math.round(((comparePrice - price) / comparePrice) * 100)}% OFF
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Card Content */}
                      <div className="p-4 flex flex-col gap-2.5 flex-1">
                        {/* Category */}
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3 h-3 text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">
                            {p.category?.name || "Uncategorized"}
                          </span>
                        </div>

                        {/* Name */}
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight line-clamp-2">{p.name}</h4>

                        {/* Unit */}
                        <p className="text-[10px] text-slate-400 font-semibold">{p.unit_value} {p.unit}</p>

                        {/* Price Row */}
                        <div className="flex items-center gap-2 mt-auto">
                          <IndianRupee className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                          <span className="font-black text-base text-slate-900 dark:text-white">{price}</span>
                          {comparePrice && (
                            <span className="text-xs text-slate-400 line-through">₹{comparePrice}</span>
                          )}
                        </div>

                        {/* Stock */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Package className="w-3 h-3 text-slate-400" />
                            <span className={`text-[10px] font-bold ${isOutOfStock ? "text-rose-500" : isLowStock ? "text-amber-600" : "text-emerald-600 dark:text-emerald-400"}`}>
                              {isOutOfStock ? "No stock" : `${qty} ${p.unit}`}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 mt-1">
                          <Link
                            href={resolveVendorLink(`/inventory/edit?id=${p.id}`)}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 rounded-xl transition-all shadow-sm"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                          </Link>
                          <button
                            onClick={() => setProductToDelete(p)}
                            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl border border-slate-200 dark:border-slate-800 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-20 text-center">
                <div className="text-5xl mb-4">🥬</div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">No products yet</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">Click "Add Product" to add your first catalog item!</p>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!productToDelete}
        title="Remove Product?"
        message={productToDelete ? `Remove "${productToDelete.name}" from your catalog?` : ""}
        loading={deleteProductMutation.isPending}
        onConfirm={async () => {
          if (productToDelete) {
            await deleteProductMutation.mutateAsync(productToDelete.id);
            setProductToDelete(null);
          }
        }}
        onCancel={() => setProductToDelete(null)}
      />
    </VendorLayout>
  );
}

function ConfirmModal({
  isOpen, title, message, onConfirm, onCancel, loading
}: {
  isOpen: boolean; title: string; message: string;
  onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 md:left-64 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-in text-center shadow-2xl">
        <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">{title}</h3>
        <p className="text-xs text-slate-550 dark:text-slate-400 leading-normal">{message}</p>
        <div className="flex gap-3 pt-2">
          <Button variant="danger" onClick={onConfirm} loading={loading} className="flex-1 py-3 text-xs cursor-pointer font-bold">Yes, Remove</Button>
          <Button variant="outline" onClick={onCancel} disabled={loading} className="flex-1 py-3 text-xs cursor-pointer font-bold">Cancel</Button>
        </div>
      </div>
    </div>
  );
}
