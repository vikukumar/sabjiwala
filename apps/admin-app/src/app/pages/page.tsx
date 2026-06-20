"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { Save, Eye, Edit3, Settings, HelpCircle, AlertCircle, FileText, Check } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";

const PAGES_LIST = [
  { slug: "privacy-policy", label: "Privacy Policy", icon: FileText, desc: "Data protection and geolocation disclosure" },
  { slug: "terms-conditions", label: "Terms of Service", icon: FileText, desc: "User purchasing guidelines and rules" },
  { slug: "refund-policy", label: "Refund & Rejection Policy", icon: FileText, desc: "Doorstep rejection and wallet credit terms" },
  { slug: "contact-us", label: "Contact Us Details", icon: FileText, desc: "Dynamic descriptive header for support requests" },
];

export default function AdminPagesEditor() {
  const queryClient = useQueryClient();
  const [selectedSlug, setSelectedSlug] = useState("privacy-policy");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [toastMsg, setToastMsg] = useState("");

  // Fetch all pages
  const { data: pages = [], isLoading } = useQuery<any[]>({
    queryKey: ["adminPages"],
    queryFn: async () => {
      const res = await api.get("/admin/pages");
      return res.data?.data || res.data || [];
    }
  });

  // Load selected page attributes
  useEffect(() => {
    const page = pages.find((p: any) => p.slug === selectedSlug);
    if (page) {
      setTitle(page.title || "");
      setContent(page.content || "");
      setMetaTitle(page.meta_title || "");
      setMetaDescription(page.meta_description || "");
      setIsPublished(page.is_published || false);
    } else {
      // Set default placeholders
      setTitle(selectedSlug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "));
      setContent(`<h1>${selectedSlug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</h1>\n<p>Please update your dynamic content here...</p>`);
      setMetaTitle("");
      setMetaDescription("");
      setIsPublished(false);
    }
  }, [selectedSlug, pages]);

  // Mutation to create/update
  const saveMutation = useMutation({
    mutationFn: async () => {
      const pageData = {
        slug: selectedSlug,
        title,
        content,
        content_html: content,
        meta_title: metaTitle || title,
        meta_description: metaDescription,
        is_published: isPublished,
        page_type: "custom",
        sort_order: 0
      };
      
      const exists = pages.some((p: any) => p.slug === selectedSlug);
      if (exists) {
        return api.put(`/admin/pages/${selectedSlug}`, pageData);
      } else {
        return api.post("/admin/pages", pageData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminPages"] });
      setToastMsg("Page saved successfully!");
      setTimeout(() => setToastMsg(""), 3000);
    },
    onError: (err: any) => {
      alert("Failed to save page: " + (err.response?.data?.detail || err.message));
    }
  });

  return (
    <AdminLayout title="CMS Policy Pages Editor">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white font-black text-xs px-5 py-3 rounded-2xl shadow-xl animate-bounce">
          <Check className="w-4 h-4" /> {toastMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 font-sans">
        {/* Left selector pane */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Select Policy Page</h3>
            <div className="space-y-2">
              {PAGES_LIST.map((page) => {
                const Icon = page.icon;
                const isSelected = selectedSlug === page.slug;
                const pageExists = pages.some((p: any) => p.slug === page.slug);
                return (
                  <button
                    key={page.slug}
                    onClick={() => {
                      setSelectedSlug(page.slug);
                      setActiveTab("edit");
                    }}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900 text-emerald-800 dark:text-emerald-450"
                        : "bg-transparent border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <Icon className="w-5 h-5 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-extrabold flex items-center gap-1.5">
                        {page.label}
                        {pageExists && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Configured in database"></span>}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal mt-0.5">{page.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right editor/preview pane */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 p-4 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("edit")}
                  className={`flex items-center gap-1.5 text-xs font-black px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                    activeTab === "edit"
                      ? "bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  Editor Mode
                </button>
                <button
                  onClick={() => setActiveTab("preview")}
                  className={`flex items-center gap-1.5 text-xs font-black px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                    activeTab === "preview"
                      ? "bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Live Preview
                </button>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  Published
                </label>
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {saveMutation.isPending ? "Saving..." : "Save Page"}
                </button>
              </div>
            </div>

            {/* Layout content */}
            <div className="p-6">
              {activeTab === "edit" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-extrabold text-slate-400">Page Heading Title</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Terms and Conditions"
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-extrabold text-slate-400">SEO Meta Title Override</label>
                      <input
                        type="text"
                        value={metaTitle}
                        onChange={(e) => setMetaTitle(e.target.value)}
                        placeholder="Default is Page Title"
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-extrabold text-slate-400">SEO Meta Description</label>
                    <textarea
                      value={metaDescription}
                      onChange={(e) => setMetaDescription(e.target.value)}
                      placeholder="Enter compelling meta description..."
                      rows={2}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase font-extrabold text-slate-400">HTML or Plain Text Content Body</label>
                      <span className="text-[9px] text-slate-400 font-bold">Supports standard HTML tag blocks</span>
                    </div>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Write your page HTML content here..."
                      rows={14}
                      className="w-full p-4 font-mono text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl p-6 min-h-[400px]">
                  <div className="max-w-2xl mx-auto space-y-6">
                    <div className="text-center space-y-2 border-b border-slate-200/50 dark:border-slate-800 pb-4">
                      <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{title || "Untitled Page"}</h1>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PREVIEW OF CUSTOMER SITE LAYOUT</p>
                    </div>
                    {content ? (
                      <div 
                        className="prose dark:prose-invert max-w-none text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: content }}
                      />
                    ) : (
                      <div className="text-center py-12 text-slate-400 text-xs">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        No content written yet.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
