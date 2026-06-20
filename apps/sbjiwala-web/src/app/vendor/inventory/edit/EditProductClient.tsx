"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
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
            
            const imgs = productData.images || [];
            const urls = imgs.map((img: any) => resolveImageUrl(img.image_url));
            if (urls.length === 0 && productData.primary_image_url) {
                urls.push(resolveImageUrl(productData.primary_image_url));
            }
            if (urls.length === 0 && attrs.image_url) {
                urls.push(resolveImageUrl(attrs.image_url));
            }
            setImageUrls(urls);
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
                    image_url: imageUrls[0] || undefined,
                },
                images: imageUrls
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
            router.replace(resolveVendorLink("/inventory"));
        },
        onError: (err: any) => {
            showError("Update Failed", "Failed to update product: " + (err.response?.data?.detail || err.message));
        }
    });

    // Handle fallback paths gracefully
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
                setImageUrls(prev => [...prev, ...uploadedUrls]);
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

    return (
        <VendorLayout title={`Edit: ${name || "Product"}`}>
            <div className="max-w-2xl mx-auto space-y-6 font-sans">
                <div className="flex justify-between items-center">
                    <Link
                        href={resolveVendorLink("/inventory")}
                        className="bg-slate-100 dark:bg-slate-850 text-slate-700 dark:text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Catalog
                    </Link>
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
                            <label className="font-bold text-slate-555 uppercase">Description</label>
                            <textarea
                                value={desc}
                                onChange={e => setDesc(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-24 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label className="font-bold text-slate-555 uppercase">Unit Type</label>
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
                                <label className="font-bold text-slate-555 uppercase">Unit Value</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={unitValue}
                                    onChange={e => setUnitValue(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-bold text-slate-555 uppercase">Fallback Emoji</label>
                                <input
                                    type="text"
                                    value={emoji}
                                    onChange={e => setEmoji(e.target.value)}
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
                                        className="px-4 py-2.5 rounded-xl border border-dashed border-slate-350 dark:border-slate-750 hover:border-emerald-500 bg-slate-50 dark:bg-slate-950 text-slate-655 dark:text-slate-400 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
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
                                
                                {imageUrls.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                                        {imageUrls.map((url, idx) => (
                                            <div key={url} className="relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 aspect-square">
                                                <img src={resolveImageUrl(url)} alt={`Product image ${idx + 1}`} className="w-full h-full object-cover" />
                                                
                                                {/* Actions Overlay */}
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                                                    <div className="flex justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setImageUrls(prev => prev.filter((_, i) => i !== idx));
                                                            }}
                                                            className="p-1.5 rounded-lg bg-rose-650/90 text-white hover:bg-rose-500 transition-colors cursor-pointer"
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
                                                                setImageUrls(prev => {
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
                                    value={price}
                                    onChange={e => setPrice(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-bold text-slate-555 uppercase">Compare Price (₹)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={comparePrice}
                                    onChange={e => setComparePrice(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-bold text-slate-555 uppercase">Stock Quantity</label>
                                <div className="flex gap-2">
                                    <select
                                        value={stockChangeType}
                                        onChange={e => setStockChangeType(e.target.value as any)}
                                        className="px-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none text-slate-900 dark:text-white text-xs"
                                    >
                                        <option value="set">Set to</option>
                                        <option value="add">Add</option>
                                        <option value="remove">Remove</option>
                                    </select>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={stock}
                                        onChange={e => setStock(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <button
                                type="submit"
                                disabled={updateProductMutation.isPending}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-50 cursor-pointer"
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
