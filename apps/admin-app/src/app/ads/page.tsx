"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import AdminLayout from "@/components/AdminLayout";
import { Plus, Trash2, Edit2, Loader2, Megaphone, X, Tv, Image } from "lucide-react";

export default function AdminAdsPage() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<any>(null);
  
  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [advertiserName, setAdvertiserName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [clickUrl, setClickUrl] = useState("");
  const [placement, setPlacement] = useState("inline");
  const [videoUrl, setVideoUrl] = useState("");
  const [pageTarget, setPageTarget] = useState("home");
  const [position, setPosition] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Fetch Ads List
  const { data: adsRes, isLoading } = useQuery<any>({
    queryKey: ["adminAds"],
    queryFn: async () => {
      const res = await api.get("/admin/ads");
      return res.data;
    },
  });
  const ads = adsRes || [];

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (newAd: any) => api.post("/admin/ads", newAd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAds"] });
      success("Advertisement created successfully!");
      closeModal();
    },
    onError: (err: any) => showError("Create failed", err.response?.data?.detail || err.message),
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => api.put(`/admin/ads/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAds"] });
      success("Advertisement updated successfully!");
      closeModal();
    },
    onError: (err: any) => showError("Update failed", err.response?.data?.detail || err.message),
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/ads/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAds"] });
      success("Advertisement deleted successfully!");
    },
    onError: (err: any) => showError("Delete failed", err.response?.data?.detail || err.message),
  });

  const openCreateModal = () => {
    setEditingAd(null);
    setName("");
    setDescription("");
    setAdvertiserName("");
    setImageUrl("");
    setClickUrl("");
    setPlacement("inline");
    setVideoUrl("");
    setPageTarget("home");
    setPosition("middle");
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (ad: any) => {
    setEditingAd(ad);
    setName(ad.name || "");
    setDescription(ad.description || "");
    setAdvertiserName(ad.advertiser_name || "");
    setImageUrl(ad.image_url || "");
    setClickUrl(ad.click_url || "");
    setPlacement(ad.placement || "inline");
    setVideoUrl(ad.video_url || "");
    setPageTarget(ad.page_target || "home");
    setPosition(ad.position || "");
    setIsActive(ad.is_active !== false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAd(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !imageUrl) {
      showError("Validation Error", "Name and Image URL are required");
      return;
    }

    const payload = {
      name,
      description: description || null,
      advertiser_name: advertiserName || null,
      image_url: imageUrl,
      click_url: clickUrl || null,
      placement,
      video_url: placement === "pip" ? (videoUrl || null) : null,
      page_target: pageTarget,
      position: placement === "inline" ? (position || null) : null,
      is_active: isActive,
    };

    if (editingAd) {
      updateMutation.mutate({ id: editingAd.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this ad?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <AdminLayout title="Advertisement spaces">
      <div className="space-y-6">
        {/* Top Header Card */}
        <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-slate-950 dark:text-white flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-emerald-500" /> Promotion & Ads Dashboard
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure picture-in-picture video ads, activity popups, and inline page banner spaces.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-550 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md hover:scale-102 active:scale-98 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Ad Space
          </button>
        </div>

        {/* Ads Grid/Table */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          </div>
        ) : ads.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-sm">
            <span className="text-5xl block select-none">📣</span>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-850 dark:text-slate-200">No active ads configured</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Setup banners, popup modal campaigns, or floating pip video players to promote services.
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="bg-emerald-600 hover:bg-emerald-550 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
            >
              Add Ad Space
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-black text-slate-500 uppercase bg-slate-50/50 dark:bg-slate-900">
                    <th className="px-6 py-4">Creative Preview</th>
                    <th className="px-6 py-4">Ad Details</th>
                    <th className="px-6 py-4">Placement Info</th>
                    <th className="px-6 py-4">Page Target</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {ads.map((ad: any) => (
                    <tr key={ad.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-850/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="w-24 h-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                          {ad.placement === "pip" && ad.video_url ? (
                            <div className="relative w-full h-full flex items-center justify-center bg-black">
                              <Tv className="w-5 h-5 text-white" />
                              <span className="absolute bottom-1 right-1 text-[8px] bg-red-650 text-white font-black px-1 rounded">VIDEO</span>
                            </div>
                          ) : ad.image_url ? (
                            <img src={ad.image_url} alt={ad.name} className="w-full h-full object-cover" />
                          ) : (
                            <Image className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 space-y-1">
                        <p className="font-bold text-slate-900 dark:text-white">{ad.name}</p>
                        {ad.description && <p className="text-[10px] text-slate-500 line-clamp-1">{ad.description}</p>}
                        {ad.advertiser_name && <p className="text-[9px] text-slate-400 font-medium">By: {ad.advertiser_name}</p>}
                      </td>
                      <td className="px-6 py-4 space-y-1">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 capitalize">
                          {ad.placement}
                        </span>
                        {ad.position && (
                          <p className="text-[10px] text-slate-450">Position: {ad.position}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 capitalize font-semibold text-slate-700 dark:text-slate-300">
                        {ad.page_target.replace("_", " ")}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${ad.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-400/10 text-slate-400"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${ad.is_active ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                          {ad.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditModal(ad)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(ad.id)}
                            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 hover:text-rose-700 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-100 dark:hover:border-rose-900"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create / Edit Modal Popup Form */}
        {isModalOpen && (
          <div className="fixed inset-0 md:left-64 bg-black/60 dark:bg-black/85 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 relative animate-scale-in max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-emerald-550" />
                  {editingAd ? "Edit Advertisement" : "Create New Ad Space"}
                </h3>
                <button onClick={closeModal} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 bg-white dark:bg-slate-900">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-705 dark:text-slate-300">Campaign / Ad Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Weekend Flash Sale PopUp"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-705 dark:text-slate-300">Description / Tagline</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Enter promotional text description..."
                      rows={2}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-705 dark:text-slate-300">Advertiser Name</label>
                    <input
                      type="text"
                      value={advertiserName}
                      onChange={e => setAdvertiserName(e.target.value)}
                      placeholder="e.g. FarmFresh Partners"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-705 dark:text-slate-300">Ad Placement Type</label>
                    <select
                      value={placement}
                      onChange={e => setPlacement(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white dark:bg-slate-900"
                    >
                      <option value="inline">Inline Banner</option>
                      <option value="popup">Popup Modal</option>
                      <option value="pip">Video Picture-in-Picture</option>
                      <option value="sidebar">Sidebar Slot</option>
                    </select>
                  </div>

                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-705 dark:text-slate-300">Image Creative URL *</label>
                    <input
                      type="text"
                      required
                      value={imageUrl}
                      onChange={e => setImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                    />
                  </div>

                  {placement === "pip" && (
                    <div className="col-span-2 space-y-1">
                      <label className="text-xs font-bold text-slate-705 dark:text-slate-300">Video URL (For Video PIP) *</label>
                      <input
                        type="text"
                        required
                        value={videoUrl}
                        onChange={e => setVideoUrl(e.target.value)}
                        placeholder="https://...mp4"
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-705 dark:text-slate-300">Page Target</label>
                    <select
                      value={pageTarget}
                      onChange={e => setPageTarget(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white dark:bg-slate-900"
                    >
                      <option value="home">Home Page</option>
                      <option value="product_detail">Product Detail Page</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-705 dark:text-slate-300">Target Position (e.g. middle, bottom)</label>
                    <input
                      type="text"
                      disabled={placement !== "inline"}
                      value={position}
                      onChange={e => setPosition(e.target.value)}
                      placeholder="e.g. middle"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white disabled:opacity-50"
                    />
                  </div>

                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-705 dark:text-slate-300">Redirect Click Link / CTA Route</label>
                    <input
                      type="text"
                      value={clickUrl}
                      onChange={e => setClickUrl(e.target.value)}
                      placeholder="e.g. /offers or /products/detail?id=..."
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="col-span-2 flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="isActiveCheckbox"
                      checked={isActive}
                      onChange={e => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                    />
                    <label htmlFor="isActiveCheckbox" className="text-xs font-bold text-slate-700 dark:text-slate-300 select-none cursor-pointer">
                      Make this advertisement live immediately
                    </label>
                  </div>
                </div>

                {/* Submit Panel */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-705 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="flex items-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-550 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    {editingAd ? "Save Changes" : "Create Advertisement"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
