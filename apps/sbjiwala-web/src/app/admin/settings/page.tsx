"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { Save, Radio, Shield, Globe, Mail, MessageSquare, ExternalLink, Key, Check } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";

const SECTIONS = [
  { id: "general", label: "General & Branding", icon: Globe },
  { id: "oauth", label: "Social Logins & OAuth", icon: Shield },
  { id: "smtp", label: "SMTP Email Server", icon: Mail },
  { id: "sms", label: "SMS Gateway Config", icon: MessageSquare },
];

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState("general");
  const [toastMsg, setToastMsg] = useState("");
  const [editedSettings, setEditedSettings] = useState<Record<string, any>>({});

  // Fetch settings
  const { data: settings = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["adminSettings"],
    queryFn: async () => {
      const res = await api.get("/admin/settings");
      return res.data?.data || res.data || [];
    }
  });

  // Initialize edited states
  useEffect(() => {
    if (settings.length > 0) {
      const initial: Record<string, any> = {};
      settings.forEach((s: any) => {
        initial[s.key] = s.value_json || s.value || "";
      });
      setEditedSettings(initial);
    }
  }, [settings]);

  // Mutation to save single setting
  const saveSettingMutation = useMutation({
    mutationFn: async ({ key, value, isJson }: { key: string; value: any; isJson: boolean }) => {
      const payload = isJson ? { value_json: value } : { value: String(value) };
      return api.put(`/admin/settings/${key}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSettings"] });
      setToastMsg("Setting updated successfully!");
      setTimeout(() => setToastMsg(""), 3000);
    },
    onError: (err: any) => {
      alert("Failed to update setting: " + (err.response?.data?.detail || err.message));
    }
  });

  if (isLoading) {
    return (
      <AdminLayout title="Platform Configuration Settings">
        <div className="h-96 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-bold text-slate-400">Loading system settings...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const appUrl = editedSettings["app_url"] || "http://localhost:3000";
  const googleCallback = `${appUrl}/api/v1/auth/google/callback`;
  const facebookCallback = `${appUrl}/api/v1/auth/facebook/callback`;
  const appleCallback = `${appUrl}/api/v1/auth/apple/callback`;

  const handleSave = (key: string) => {
    const orig = settings.find(s => s.key === key);
    if (!orig) return;
    const value = editedSettings[key];
    const isJson = orig.value_type === "json";
    saveSettingMutation.mutate({ key, value, isJson });
  };

  const handleChange = (key: string, val: any) => {
    setEditedSettings(prev => ({ ...prev, [key]: val }));
  };

  // Group settings for editing
  const getSettingControl = (key: string, label: string, desc: string, type: "text" | "password" | "boolean" | "select", options?: string[]) => {
    const orig = settings.find(s => s.key === key);
    if (!orig) return null;
    const currentVal = editedSettings[key];

    return (
      <div key={key} className="p-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-lg">
          <h4 className="text-xs font-black text-slate-850 dark:text-white">{label}</h4>
          <p className="text-[10px] text-slate-400 leading-normal">{desc}</p>
          <p className="text-[9px] font-mono text-slate-400 dark:text-slate-500">Key: {key.toUpperCase()}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {type === "boolean" ? (
            <button
              onClick={() => {
                const nextVal = currentVal === "true" || currentVal === true ? "false" : "true";
                handleChange(key, nextVal);
                saveSettingMutation.mutate({ key, value: nextVal, isJson: false });
              }}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 ${
                currentVal === "true" || currentVal === true ? "bg-emerald-600 justify-end" : "bg-slate-300 dark:bg-slate-800 justify-start"
              }`}
            >
              <span className="bg-white w-4 h-4 rounded-full shadow-md"></span>
            </button>
          ) : type === "select" ? (
            <select
              value={currentVal}
              onChange={(e) => {
                handleChange(key, e.target.value);
                saveSettingMutation.mutate({ key, value: e.target.value, isJson: false });
              }}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
            >
              {options?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              type={type === "password" ? "password" : "text"}
              value={currentVal}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-48 px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
            />
          )}

          {type !== "boolean" && type !== "select" && (
            <button
              onClick={() => handleSave(key)}
              className="p-2 bg-slate-50 dark:bg-slate-850 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-500 hover:text-emerald-600 rounded-xl transition-all cursor-pointer border border-slate-200/50 dark:border-slate-800"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <AdminLayout title="Platform settings dashboard">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white font-black text-xs px-5 py-3 rounded-2xl shadow-xl animate-bounce">
          <Check className="w-4 h-4" /> {toastMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 font-sans">
        {/* Navigation panel */}
        <div className="lg:col-span-1 space-y-2">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-emerald-600 to-teal-500 border-none text-white shadow-md font-extrabold"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-455 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-xs">{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Setting values panel */}
        <div className="lg:col-span-3 space-y-6">
          {activeSection === "general" && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-800 dark:text-white">General & Sourcing Settings</h3>
              {getSettingControl("app_name", "Application Brand Name", "Displayed as header title across client apps", "text")}
              {getSettingControl("app_url", "Customer App Base URL", "Must be matching target customer app host to compute callbacks", "text")}
              {getSettingControl("app_primary_color", "Brand Main Color", "Hex style color used dynamically", "text")}
              
              <h3 className="text-sm font-black text-slate-800 dark:text-white mt-8">Social Profile Links</h3>
              {getSettingControl("social_facebook", "Facebook Profile", "Optional target hyperlink inside homepage footer", "text")}
              {getSettingControl("social_instagram", "Instagram Profile", "Optional target hyperlink inside homepage footer", "text")}
              {getSettingControl("social_twitter", "Twitter Handle", "Optional target hyperlink inside homepage footer", "text")}
              {getSettingControl("social_linkedin", "LinkedIn URL", "Optional target hyperlink inside homepage footer", "text")}
              {getSettingControl("social_youtube", "YouTube Channel", "Optional target hyperlink inside homepage footer", "text")}
            </div>
          )}

          {activeSection === "oauth" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-black text-slate-850 dark:text-white">Social Sign In Credentials</h3>
                <p className="text-[10px] text-slate-400 mt-1">Configure credentials to allow customer logins using Google, Facebook, and Apple account integrations.</p>
              </div>

              {/* Dynamic redirection callbacks */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-emerald-500" />
                  Dynamic OAuth Callback URLs
                </h4>
                <p className="text-[10px] text-slate-550 dark:text-slate-400 leading-normal">
                  Copy and configure these exact redirect URLs inside your Google developer console, Facebook developer app dashboard, and Apple services console credentials setup.
                </p>

                <div className="space-y-3 font-mono text-[10px]">
                  {[
                    { label: "Google Redirect URI", val: googleCallback },
                    { label: "Facebook Redirect URI", val: facebookCallback },
                    { label: "Apple Redirect URI", val: appleCallback },
                  ].map(uri => (
                    <div key={uri.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-sans font-bold text-slate-400 uppercase">{uri.label}</span>
                        <div className="text-slate-750 dark:text-slate-300 mt-0.5 select-all">{uri.val}</div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-750" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-800 dark:text-white">Google OAuth Suffixes</h4>
                {getSettingControl("google_client_id", "Google Client ID", "The client ID from credentials page", "text")}
                {getSettingControl("google_client_secret", "Google Client Secret", "Keep secret secure", "password")}

                <h4 className="text-xs font-black text-slate-800 dark:text-white mt-6">Facebook App Identifiers</h4>
                {getSettingControl("facebook_client_id", "Facebook App Client ID", "Facebook client ID identifier", "text")}
                {getSettingControl("facebook_client_secret", "Facebook App Client Secret", "Private application key", "password")}

                <h4 className="text-xs font-black text-slate-800 dark:text-white mt-6">Apple Services Sign In</h4>
                {getSettingControl("apple_client_id", "Apple Client ID", "Apple services developer client ID", "text")}
                {getSettingControl("apple_client_secret", "Apple Client Secret", "Apple private developer token key", "password")}
              </div>
            </div>
          )}

          {activeSection === "smtp" && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-800 dark:text-white">SMTP Mail Server Credentials</h3>
              {getSettingControl("smtp_host", "SMTP Host Address", "Host address of target mailserver (e.g. smtp.gmail.com)", "text")}
              {getSettingControl("smtp_port", "SMTP Port Number", "TLS usually uses 587, SSL uses 465", "text")}
              {getSettingControl("smtp_user", "SMTP Username Account", "Email address used to authenticate SMTP sessions", "text")}
              {getSettingControl("smtp_password", "SMTP Password Key", "Use application app password keys", "password")}
              {getSettingControl("smtp_from_name", "Sender Display Name", "Branded name shown in inbox", "text")}
              {getSettingControl("smtp_from_email", "Sender Email Address", "Header address shown in inbox", "text")}
              {getSettingControl("smtp_use_tls", "Use TLS Encryption", "Establish safe server handshakes", "boolean")}
              {getSettingControl("smtp_start_tls", "Use StartTLS Command", "Issue StartTLS commands", "boolean")}
            </div>
          )}

          {activeSection === "sms" && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-800 dark:text-white">SMS Gateway Configuration</h3>
              {getSettingControl("sms_provider", "Select SMS Provider Mode", "Choose your active SMS dispatching channel", "select", ["android_gateway", "sms_server", "msg91"])}
              {getSettingControl("sms_gateway_url", "Gateway REST API Endpoint", "HTTP URL (e.g., local gateway URL or Docker SMS server API endpoint)", "text")}
              {getSettingControl("sms_gateway_key", "Bearer Authorization Key", "API key or token passed in request authorization headers", "password")}
              {getSettingControl("sms_sender_id", "Sender ID / Header Code", "Branded header code for SMS", "text")}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
