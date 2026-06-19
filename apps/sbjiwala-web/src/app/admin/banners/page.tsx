"use client";

import React, { useState } from "react";
import { Image, Search, Loader2, Plus, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import AdminLayout from "@/components/AdminLayout";

export default function AdminBannersPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [position, setPosition] = useState("home_top");
  const [sortOrder, setSortOrder] = useState("0");
  const [actionUrl, setActionUrl] = useState("");

  const { data: banners = [], isLoading } = useQuery<any[]>({
    queryKey: ["adminBanners"],
    queryFn: async () => {
      const res = await api.get("/admin/banners");
      return res.data || [];
    }
  });

  const createBannerMutation = useMutation({
    mutationFn: async () => {
      const body = {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        image_url: imageUrl.trim(),
        mobile_image_url: imageUrl.trim() || null,
        action_url: actionUrl.trim() || null,
        action_type: actionUrl.trim() ? "link" : "none",
        position: position,
        sort_order: parseInt(sortOrder) || 0,
      };
      return api.post("/admin/banners", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminBanners"] });
      success("Banner created successfully!");
      setTitle("");
      setSubtitle("");
      setImageUrl("");
      setActionUrl("");
      setSortOrder("0");
    },
    onError: (err: any) => {
      showError("Creation Failed", "Failed to create banner: " + (err.response?.data?.detail || err.message));
    }
  });

  const deleteBannerMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/admin/banners/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminBanners"] });
      success("Banner deleted successfully!");
    },
    onError: (err: any) => {
      showError("Deletion Failed", "Failed to delete banner: " + (err.response?.data?.detail || err.message));
    }
  });

  return (
    <AdminLayout title="Promotional Banners">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-slate-800 dark:text-slate-100 font-sans">
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Add Banner Ad</h3>
            <p className="text-xs text-slate-500 mt-1">Configure layout banners for express home slide display.</p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim() || !imageUrl.trim()) return;
              createBannerMutation.mutate();
            }}
            className="space-y-4 text-xs"
          >
            <div className="space-y-1.5">
              <label className="font-bold text-slate-550 uppercase">Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Monsoon Fruits Sale"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-550 uppercase">Subtitle</label>
              <input
                type="text"
                placeholder="e.g. Flat 15% off on organic apples"
                value={subtitle}
                onChange={e => setSubtitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-550 uppercase">Banner Image URL *</label>
              <input
                type="text"
                required
                placeholder="e.g. /banners/monsoon_fruits.png"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-555 uppercase">Layout Position</label>
                <select
                  value={position}
                  onChange={e => setPosition(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                >
                  <option value="home_top">Home Carousel (Top)</option>
                  <option value="home_middle">Home Banner (Middle)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-555 uppercase">Sort Order</label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={e => setSortOrder(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-555 uppercase">Redirect Action URL</label>
              <input
                type="text"
                placeholder="e.g. /search?q=organic"
                value={actionUrl}
                onChange={e => setActionUrl(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={createBannerMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer text-xs uppercase tracking-wider"
            >
              {createBannerMutation.isPending ? "Creating..." : "Save Banner"}
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Active Promotional Banners</h3>
            <p className="text-xs text-slate-500 mt-1">Manage carousel sequence and visual banners.</p>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 text-emerald-500 animate-spin" /></div>
            ) : banners.length > 0 ? (
              banners.map((b: any) => (
                <div key={b.id} className="p-4 border border-slate-150 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-14 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200/50 dark:border-slate-700 flex-shrink-0 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                      {b.image_url.startsWith("http") || b.image_url.startsWith("/") ? (
                        <img src={b.image_url} alt={b.title} className="w-full h-full object-cover" />
                      ) : (
                        "Image"
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">{b.title}</h4>
                      <p className="text-[10px] text-slate-400 truncate">{b.subtitle || "No subtitle"}</p>
                      <div className="flex gap-2 text-[9px] font-mono text-slate-400 mt-1">
                        <span>Pos: <span className="font-bold text-slate-700 dark:text-slate-350">{b.position}</span></span>
                        <span>Order: <span className="font-bold text-slate-700 dark:text-slate-350">{b.sort_order}</span></span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteBannerMutation.mutate(b.id)}
                    className="px-2.5 py-1 text-[10px] font-black text-rose-500 border border-rose-200 dark:border-rose-900 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 flex-shrink-0 cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">No banners registered. Add top home carousels above.</div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
