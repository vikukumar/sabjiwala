"use client";

import React, { useState, useRef } from "react";
import { Plus, Trash2, ArrowLeft, Loader2, Search, Star, Edit, AlertCircle } from "lucide-react";
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
        if (url) {
          uploadedUrls.push(url);
        }
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

  // Queries
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
      const res = await api.get("/catalog/categories", {
        params: { all_levels: true }
      });
      return res.data || [];
    }
  });

  // Mutations
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
      setNewCatName("");
      setNewCatDesc("");
      setNewCatParentId("");
      setNewCatIcon("");
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
        attributes: {
          image_emoji: newProdEmoji,
          image_url: newProdImageUrls[0] || undefined,
        },
        images: newProdImageUrls
      });

      const createdProd = res.data;
      const initialStockVal = parseFloat(newProdInitialStock) || 0.0;
      const prodId = createdProd?.id;
      if (prodId && initialStockVal > 0) {
        await api.post(`/products/${prodId}/inventory`, null, {
          params: {
            quantity: initialStockVal,
            change_type: "set",
            notes: "Initial inventory setup"
          }
        });
      }
      return createdProd;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorCatalog"] });
      queryClient.invalidateQueries({ queryKey: ["vendorMetrics"] });
      success("Product added to catalog successfully!");
      setNewProdName("");
      setNewProdDesc("");
      setNewProdCategoryId("");
      setNewProdPrice("");
      setNewProdComparePrice("");
      setNewProdInitialStock("50.0");
      setNewProdEmoji("🥬");
      setNewProdImageUrls([]);
      setActiveSubTab("list");
    },
    onError: (err: any) => {
      showError("Add Failed", "Failed to add product: " + (err.response?.data?.detail || err.message));
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (prodId: string) => {
      return api.delete(`/products/${prodId}`);
    },
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

        {activeSubTab === "add-category" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-sm max-w-xl mx-auto space-y-4">
            <h4 className="text-sm font-black border-b pb-2">Create Category / Subcategory</h4>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newCatName.trim()) return;
                addCategoryMutation.mutate();
              }}
              className="space-y-4 text-xs"
            >
              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Exotic Veggies, Root Vegetables"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Parent Category (Optional)</label>
                <select
                  value={newCatParentId}
                  onChange={e => setNewCatParentId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                >
                  <option value="">None (Creates a Top-Level Parent Category)</option>
                  {categories.filter((c: any) => c.parent_id === null).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Description</label>
                <textarea
                  placeholder="Brief description of category..."
                  value={newCatDesc}
                  onChange={e => setNewCatDesc(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-20 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Category Icon/Emoji (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 🥦, 🍎, 🥕"
                  value={newCatIcon}
                  onChange={e => setNewCatIcon(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={addCategoryMutation.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {addCategoryMutation.isPending ? "Creating..." : "Save Category"}
              </button>
            </form>
          </div>
        )}

        {activeSubTab === "add-product" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-sm max-w-2xl mx-auto space-y-4">
            <h4 className="text-sm font-black border-b pb-2">Add New Product to Catalog</h4>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newProdCategoryId) {
                  showError("Category Required", "Please select a category!");
                  return;
                }
                addProductMutation.mutate();
              }}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-555 uppercase">Product Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fresh Red Tomatoes"
                    value={newProdName}
                    onChange={e => setNewProdName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-555 uppercase">Category *</label>
                  <select
                    required
                    value={newProdCategoryId}
                    onChange={e => setNewProdCategoryId(e.target.value)}
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
                <label className="font-bold text-slate-555 uppercase">Description</label>
                <textarea
                  placeholder="Product description and details..."
                  value={newProdDesc}
                  onChange={e => setNewProdDesc(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-20 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-555 uppercase">Unit Type</label>
                  <select
                    value={newProdUnit}
                    onChange={e => setNewProdUnit(e.target.value)}
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
                  <label className="font-bold text-slate-555 uppercase">Unit Value</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProdUnitValue}
                    onChange={e => setNewProdUnitValue(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-555 uppercase">Fallback Emoji</label>
                  <input
                    type="text"
                    value={newProdEmoji}
                    onChange={e => setNewProdEmoji(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

               {/* Photo Upload */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-555 uppercase">Product Photos</label>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async e => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      await handleImagesUpload(Array.from(files));
                    }
                  }}
                />
                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={imageUploading}
                      className="px-4 py-2.5 rounded-xl border border-dashed border-slate-350 dark:border-slate-750 hover:border-emerald-500 bg-slate-55 dark:bg-slate-950 text-slate-655 dark:text-slate-450 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      {imageUploading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        "Upload Images (Max 5)"
                      )}
                    </button>
                  </div>
                  
                  {newProdImageUrls.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                      {newProdImageUrls.map((url, idx) => (
                        <div key={url} className="relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-955 aspect-square">
                          <img src={resolveImageUrl(url)} alt={`Product image ${idx + 1}`} className="w-full h-full object-cover" />
                          
                          {/* Actions Overlay */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  setNewProdImageUrls(prev => prev.filter((_, i) => i !== idx));
                                }}
                                className="p-1.5 rounded-lg bg-rose-655/90 text-white hover:bg-rose-500 transition-colors cursor-pointer"
                                title="Delete Image"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            {idx === 0 ? (
                              <span className="bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-md self-start">
                                PRIMARY
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setNewProdImageUrls(prev => {
                                    const next = [...prev];
                                    const item = next.splice(idx, 1)[0];
                                    next.unshift(item);
                                    return next;
                                  });
                                }}
                                className="bg-white/90 text-slate-900 hover:bg-white text-[9px] font-black px-2 py-0.5 rounded-md self-start transition-colors cursor-pointer"
                              >
                                Set Primary
                              </button>
                            )}
                          </div>
                          
                          {/* Primary badge outside hover */}
                          {idx === 0 && (
                            <div className="absolute top-2 left-2 bg-emerald-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md shadow z-10">
                              PRIMARY
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-555 uppercase">Price (₹) *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={newProdPrice}
                    onChange={e => setNewProdPrice(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-555 uppercase">Compare Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProdComparePrice}
                    onChange={e => setNewProdComparePrice(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-555 uppercase">Initial Stock</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newProdInitialStock}
                    onChange={e => setNewProdInitialStock(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={addProductMutation.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {addProductMutation.isPending ? "Saving..." : "Save Product to Catalog"}
              </button>
            </form>
          </div>
        )}

        {activeSubTab === "list" && (
          <div className="space-y-4">
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search catalog products..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-55/30 dark:bg-slate-950 text-xs focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
              <select
                value={selectedCategoryFilter}
                onChange={e => setSelectedCategoryFilter(e.target.value)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              >
                <option value="">All Categories</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.parent_id ? `└── ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Products Table */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              {productsLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
                  <span className="text-xs text-slate-500">Loading catalog items...</span>
                </div>
              ) : products.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-850/50 text-slate-400 uppercase font-black tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <th className="p-4 w-16 text-center">Image</th>
                        <th className="p-4">Product Info</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Sell Price</th>
                        <th className="p-4 text-center">Available Stock</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 dark:divide-slate-850">
                      {products.map((p: any) => {
                        const attrs = p.attributes || {};
                        const qty = parseFloat(attrs.quantity || 0);
                        const isOutOfStock = qty <= 0;
                        const isLowStock = qty < 10;
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                            <td className="p-4 text-center">
                              {p.primary_image_url || p.images?.[0]?.image_url || attrs.image_url ? (
                                <img src={resolveImageUrl(p.primary_image_url || p.images?.[0]?.image_url || attrs.image_url)} alt={p.name} className="w-10 h-10 object-cover rounded-xl border border-slate-205 mx-auto" />
                              ) : (
                                <span className="text-3xl">{attrs.image_emoji || "🥬"}</span>
                              )}
                            </td>
                            <td className="p-4">
                              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{p.name}</h4>
                              <p className="text-slate-500 mt-0.5">{p.unit_value} {p.unit}</p>
                            </td>
                            <td className="p-4">
                              <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full font-bold text-[10px] text-slate-655 dark:text-slate-350">
                                {p.category?.name || "Uncategorized"}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="font-black text-sm text-slate-900 dark:text-white">₹{attrs.price}</span>
                              {attrs.compare_at_price && (
                                <span className="text-slate-400 line-through ml-1.5">₹{attrs.compare_at_price}</span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              {isOutOfStock ? (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[9px] bg-red-500/10 text-red-650 border border-red-500/20">
                                    <AlertCircle className="w-3.5 h-3.5 text-red-500" /> Out of stock
                                  </span>
                                  <span className="text-[9px] font-extrabold text-rose-600 dark:text-rose-400 animate-pulse">
                                    Please increase stock
                                  </span>
                                </div>
                              ) : (
                                <span className={`inline-block px-3 py-1 rounded-full font-black text-[10px] ${
                                  isLowStock ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                }`}>
                                  {qty} {p.unit}
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-right space-x-2">
                              <Link
                                href={resolveVendorLink(`/inventory/edit?id=${p.id}`)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer text-slate-800 dark:text-white"
                              >
                                <Edit className="w-3 h-3" /> Full Edit
                              </Link>
                              <button
                                onClick={() => setProductToDelete(p)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-955/20 rounded-lg transition-all cursor-pointer inline-flex items-center"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-20 text-center text-slate-400 dark:text-slate-500 text-sm">
                  No catalog items found. Click "Add Product" to add your first catalog item!
                </div>
              )}
            </div>
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
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  loading
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 md:left-64 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-in text-center shadow-2xl">
        <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">{title}</h3>
        <p className="text-xs text-slate-550 dark:text-slate-400 leading-normal">{message}</p>
        <div className="flex gap-3 pt-2">
          <Button
            variant="danger"
            onClick={onConfirm}
            loading={loading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold"
          >
            Yes, Remove
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
