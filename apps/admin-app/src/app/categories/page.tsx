"use client";

import React, { useState } from "react";
import { Tag, Search, Loader2, Plus, Edit2, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import AdminLayout from "@/components/AdminLayout";

export default function AdminCategoriesPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newCatParentId, setNewCatParentId] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("");

  const { data: categories = [], isLoading } = useQuery<any[]>({
    queryKey: ["adminCategories"],
    queryFn: async () => {
      const res = await api.get("/catalog/categories", {
        params: { all_levels: true }
      });
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
      queryClient.invalidateQueries({ queryKey: ["adminCategories"] });
      success("Category / Subcategory added to global catalog successfully!");
      setNewCatName("");
      setNewCatDesc("");
      setNewCatParentId("");
      setNewCatIcon("");
    },
    onError: (err: any) => {
      showError("Creation Failed", "Failed to create category: " + (err.response?.data?.detail || err.message));
    }
  });

  const filteredCategories = categories.filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="Product Categories">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-slate-800 dark:text-slate-100 font-sans">
        {/* Create Category Form */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Create Catalog Category</h3>
            <p className="text-xs text-slate-500 mt-1">Add a new category or subcategory to the database catalog.</p>
          </div>

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
                placeholder="e.g. Root Vegetables, Fresh Exotics"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-850 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-550 uppercase">Parent Category (Optional)</label>
              <select
                value={newCatParentId}
                onChange={e => setNewCatParentId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-850 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-905 dark:text-white"
              >
                <option value="">None (Top-level Category)</option>
                {categories.filter((c: any) => c.parent_id === null).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-405">Select a parent category if you want to create a subcategory.</p>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-550 uppercase">Description</label>
              <textarea
                placeholder="Describe the items in this category..."
                value={newCatDesc}
                onChange={e => setNewCatDesc(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-850 bg-transparent text-sm h-24 focus:outline-none focus:border-emerald-500 text-slate-909 dark:text-white resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-550 uppercase">Icon/Emoji (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 🥦, 🥕, 🍇"
                value={newCatIcon}
                onChange={e => setNewCatIcon(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-855 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={addCategoryMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer text-xs uppercase tracking-wider"
            >
              {addCategoryMutation.isPending ? "Creating Category..." : "Save Category"}
            </button>
          </form>
        </div>

        {/* Categories Hierarchy / List */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Active Categories</h3>
              <p className="text-xs text-slate-500 mt-1">Browse and filter active parent categories and subcategories.</p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filter categories..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-850">
            {isLoading ? (
              <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 text-emerald-500 animate-spin" /></div>
            ) : filteredCategories.length > 0 ? (
              filteredCategories.map((cat: any) => (
                <div key={cat.id} className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 px-2 rounded-xl">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{cat.icon || "🥗"}</span>
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {cat.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono">Slug: {cat.slug}</p>
                      </div>
                    </div>
                    {cat.description && (
                      <p className="text-xs text-slate-500 mt-1 pl-8 leading-tight">{cat.description}</p>
                    )}
                  </div>
                  <div>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[9px] ${
                      cat.parent_id 
                        ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
                        : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    }`}>
                      {cat.parent_id ? "Subcategory" : "Parent"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">No categories found in the catalog.</div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
