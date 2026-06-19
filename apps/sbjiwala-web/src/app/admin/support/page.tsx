"use client";

import React, { useState, useEffect } from "react";
import { MessageSquare, Layout, Bell, Save, Check, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import AdminLayout from "@/components/AdminLayout";

export default function AdminSupportPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<"cms" | "templates">("cms");

  // CMS Form Data state
  const [cmsFormData, setCmsFormData] = useState<Record<string, string>>({
    app_name: "",
    app_logo_url: "",
    app_primary_color: "",
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
    policy_privacy: "",
    policy_terms: "",
    policy_refund: "",
    about_us: "",
    how_it_works: ""
  });

  const { data: settings = [], isLoading: isCmsLoading } = useQuery<any[]>({
    queryKey: ["adminAllSettings"],
    queryFn: async () => {
      const res = await api.get("/admin/settings");
      // Since response data might be a key-value object instead of list:
      if (res.data && !Array.isArray(res.data)) {
        return Object.entries(res.data).map(([key, value]) => ({ key, value }));
      }
      return res.data || [];
    }
  });

  useEffect(() => {
    if (settings.length > 0) {
      const data: Record<string, string> = {};
      settings.forEach((s: any) => {
        data[s.key] = s.value || "";
      });
      setCmsFormData(prev => ({ ...prev, ...data }));
    }
  }, [settings]);

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return api.patch(`/admin/settings/${key}`, { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAllSettings"] });
    }
  });

  const handleCmsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      for (const [key, value] of Object.entries(cmsFormData)) {
        await updateSettingMutation.mutateAsync({ key, value });
      }
      success("CMS and branding settings saved successfully!");
    } catch (err: any) {
      showError("Save Failed", err.message || "Failed to update branding settings");
    }
  };

  // Notification Templates state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    in_app_title: "",
    in_app_body: "",
    email_subject: "",
    email_body: "",
    sms_body: "",
    push_title: "",
    push_body: "",
    channels: [] as string[],
    is_active: true
  });

  const { data: templates = [], isLoading: isTemplatesLoading } = useQuery<any[]>({
    queryKey: ["adminNotificationTemplates"],
    queryFn: async () => {
      const res = await api.get("/admin/notification-templates");
      return res.data || [];
    }
  });

  const selectedTemplate = templates.find((t: any) => t.id === selectedTemplateId);

  useEffect(() => {
    if (selectedTemplate) {
      setTemplateForm({
        name: selectedTemplate.name || "",
        in_app_title: selectedTemplate.in_app_title || "",
        in_app_body: selectedTemplate.in_app_body || "",
        email_subject: selectedTemplate.email_subject || "",
        email_body: selectedTemplate.email_body || "",
        sms_body: selectedTemplate.sms_body || "",
        push_title: selectedTemplate.push_title || "",
        push_body: selectedTemplate.push_body || "",
        channels: selectedTemplate.channels || [],
        is_active: selectedTemplate.is_active ?? true
      });
    } else if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [selectedTemplate, templates, selectedTemplateId]);

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: typeof templateForm }) => {
      return api.put(`/admin/notification-templates/${id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminNotificationTemplates"] });
      success("Notification template updated successfully!");
    },
    onError: (err: any) => {
      showError("Update Failed", err.response?.data?.detail || err.message);
    }
  });

  const handleTemplateSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateId) return;
    updateTemplateMutation.mutate({ id: selectedTemplateId, body: templateForm });
  };

  const handleChannelToggle = (channel: string) => {
    setTemplateForm(prev => {
      const channels = prev.channels.includes(channel)
        ? prev.channels.filter(c => c !== channel)
        : [...prev.channels, channel];
      return { ...prev, channels };
    });
  };

  return (
    <AdminLayout title="CMS Support & Alerts">
      <div className="space-y-6 text-slate-800 dark:text-slate-100 font-sans">
        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-px">
          <button
            onClick={() => setActiveSubTab("cms")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black transition-all border-b-2 cursor-pointer ${
              activeSubTab === "cms"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-450"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Layout className="w-4 h-4" />
            Branding & CMS Policies
          </button>
          <button
            onClick={() => setActiveSubTab("templates")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black transition-all border-b-2 cursor-pointer ${
              activeSubTab === "templates"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-450"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Bell className="w-4 h-4" />
            Notification & Email Templates
          </button>
        </div>

        {/* Tab 1: CMS Branding & Policies */}
        {activeSubTab === "cms" && (
          isCmsLoading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
          ) : (
            <form onSubmit={handleCmsSave} className="space-y-6 text-xs max-w-4xl">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                <h4 className="font-bold text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">Visual Branding</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-500 uppercase">App Name</label>
                    <input
                      type="text"
                      value={cmsFormData.app_name}
                      onChange={e => setCmsFormData(p => ({ ...p, app_name: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-909 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-500 uppercase">App Logo URL</label>
                    <input
                      type="text"
                      value={cmsFormData.app_logo_url}
                      onChange={e => setCmsFormData(p => ({ ...p, app_logo_url: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-909 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-505 uppercase">Primary Color Theme</label>
                    <input
                      type="text"
                      value={cmsFormData.app_primary_color}
                      onChange={e => setCmsFormData(p => ({ ...p, app_primary_color: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-909 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                <h4 className="font-bold text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">SEO Configurations</h4>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-500 uppercase">Meta Title Tag</label>
                    <input
                      type="text"
                      value={cmsFormData.seo_title}
                      onChange={e => setCmsFormData(p => ({ ...p, seo_title: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-500 uppercase">Meta Description</label>
                    <textarea
                      value={cmsFormData.seo_description}
                      onChange={e => setCmsFormData(p => ({ ...p, seo_description: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white h-20 resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                <h4 className="font-bold text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">Legal Policy Content</h4>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-500 uppercase">Privacy Policy Document</label>
                    <textarea
                      value={cmsFormData.policy_privacy}
                      onChange={e => setCmsFormData(p => ({ ...p, policy_privacy: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-32 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-500 uppercase">Terms & Conditions Agreement</label>
                    <textarea
                      value={cmsFormData.policy_terms}
                      onChange={e => setCmsFormData(p => ({ ...p, policy_terms: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-32 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="bg-emerald-650 hover:bg-emerald-600 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer uppercase tracking-wider"
                >
                  <Save className="w-4 h-4" /> Save CMS Policies
                </button>
              </div>
            </form>
          )
        )}

        {/* Tab 2: Notification Templates */}
        {activeSubTab === "templates" && (
          isTemplatesLoading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left sidebar templates list */}
              <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Trigger Events</h3>
                <div className="space-y-1">
                  {templates.map((t: any) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplateId(t.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                        selectedTemplateId === t.id
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow"
                          : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                      }`}
                    >
                      🔔 {t.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right template form edit */}
              <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                {selectedTemplateId ? (
                  <form onSubmit={handleTemplateSave} className="space-y-4 text-xs">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Configure template: {templateForm.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">Configure channels and alerts content variables.</p>
                    </div>

                    {/* Channel selection checkboxes */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-500 uppercase">Alert Delivery Channels</label>
                      <div className="flex gap-4">
                        {["in_app", "email", "sms", "push"].map(ch => {
                          const active = templateForm.channels.includes(ch);
                          return (
                            <button
                              key={ch}
                              type="button"
                              onClick={() => handleChannelToggle(ch)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all ${
                                active
                                  ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200"
                                  : "border-slate-200 text-slate-400 hover:border-slate-400"
                              }`}
                            >
                              {active && <Check className="w-3.5 h-3.5" />}
                              {ch.replace("_", " ")}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Email Subject / Title */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-555 uppercase">In-App Alert Title</label>
                        <input
                          type="text"
                          value={templateForm.in_app_title}
                          onChange={e => setTemplateForm(p => ({ ...p, in_app_title: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-555 uppercase">Email Subject Header</label>
                        <input
                          type="text"
                          value={templateForm.email_subject}
                          onChange={e => setTemplateForm(p => ({ ...p, email_subject: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    {/* Email Body / Content */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-500 uppercase">Email Content Body</label>
                      <textarea
                        value={templateForm.email_body}
                        onChange={e => setTemplateForm(p => ({ ...p, email_body: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-28 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white resize-none"
                      />
                    </div>

                    {/* SMS Body / In-App Body */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-555 uppercase">SMS Text Message Content</label>
                        <textarea
                          value={templateForm.sms_body}
                          onChange={e => setTemplateForm(p => ({ ...p, sms_body: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-20 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white resize-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-555 uppercase">In-App Banner Body Text</label>
                        <textarea
                          value={templateForm.in_app_body}
                          onChange={e => setTemplateForm(p => ({ ...p, in_app_body: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-20 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white resize-none"
                        />
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={updateTemplateMutation.isPending}
                        className="bg-emerald-650 hover:bg-emerald-600 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer uppercase tracking-wider"
                      >
                        {updateTemplateMutation.isPending ? "Saving..." : "Save Template Updates"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="py-24 text-center text-slate-400 text-xs font-semibold">Select a notification template from the list.</div>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </AdminLayout>
  );
}
