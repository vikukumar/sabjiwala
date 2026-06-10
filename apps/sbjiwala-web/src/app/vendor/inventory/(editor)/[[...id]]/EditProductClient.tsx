"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import VendorLayout from "@/components/VendorLayout";

interface EditProductClientProps {
    id: string;
}

export default function EditProductClient({ id }: EditProductClientProps) {
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

    // Update product details mutation
    const updateProductMutation = useMutation({
        mutationFn: async () => {
            if (!id) throw new Error("Missing Product ID");

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

    // Handle fallback paths gracefully
    if (!id) {
        return (
            <VendorLayout title="Error">
                <div className="py-20 flex flex-col items-center justify-center gap-2">
                    <span className="text-sm font-bold text-red-500">No Product ID provided.</span>
                    <a href="/vendor/inventory" className="text-xs text-emerald-600 underline">Return to catalog</a>
                </div>
            </VendorLayout>
        );
    }

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

                        <div className="pt-4 flex justify-end">
                            <button
                                type="submit"
                                disabled={updateProductMutation.isPending}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-50"
                            >
                                {updateProductMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </VendorLayout>
    );
}
