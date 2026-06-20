"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { Save, Send, Code, Eye, Grid, Plus, Trash2, AlertCircle, Sparkles, Check } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";

// Predefined blocks that can be added visually
const VISUAL_BLOCKS = [
  { id: "header", label: "Logo & Header", defaultHtml: "<div style='text-align: center; border-bottom: 2px solid #059669; padding-bottom: 10px;'>\n  <h2 style='color: #059669; margin: 0;'>Sabjiwala</h2>\n  <p style='color: #64748b; margin: 5px 0 0 0;'>Kisan ke Ghar Se Apke Ghar Tak</p>\n</div>" },
  { id: "heading", label: "Accent Title", defaultHtml: "<h3 style='color: #0f172a; margin-top: 20px; font-size: 18px;'>Order Placed Successfully! 🎉</h3>" },
  { id: "text", label: "Body Paragraph", defaultHtml: "<p>Hello,</p>\n<p>Thank you for shopping with us! Your order #{{ order_number }} has been received and will be delivered shortly.</p>" },
  { id: "items_table", label: "Order Items Table", defaultHtml: "<div style='background-color: #f8fafc; border-radius: 6px; padding: 15px; margin: 20px 0;'>\n  <p style='margin: 0 0 10px 0;'><strong>Order Details:</strong></p>\n  <table style='width: 100%; border-collapse: collapse;'>\n    <tr>\n      <td style='padding: 5px 0; color: #64748b;'>Order Amount:</td>\n      <td style='padding: 5px 0; text-align: right; font-weight: bold;'>₹{{ total_amount }}</td>\n    </tr>\n    <tr>\n      <td style='padding: 5px 0; color: #64748b;'>Delivery Address:</td>\n      <td style='padding: 5px 0; text-align: right;'>{{ delivery_address }}</td>\n    </tr>\n  </table>\n</div>" },
  { id: "footer", label: "Footer Disclaimer", defaultHtml: "<hr style='border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;'/>\n<p style='font-size: 12px; color: #94a3b8; text-align: center;'>Sabjiwala © 2026. All rights reserved.</p>" },
];

export default function AdminEmailDesigner() {
  const queryClient = useQueryClient();
  const [selectedSlug, setSelectedSlug] = useState("order_placed");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [variables, setVariables] = useState<string[]>([]);
  const [designerMode, setDesignerMode] = useState<"visual" | "html" | "preview">("visual");
  
  // Test email state
  const [testEmail, setTestEmail] = useState("");
  const [testVars, setTestVars] = useState<Record<string, string>>({
    order_number: "10283",
    total_amount: "320.00",
    delivery_address: "Flat 402, Green Glen Heights, Jaipur",
    refund_amount: "150.00"
  });

  const [toastMsg, setToastMsg] = useState("");

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery<any[]>({
    queryKey: ["adminEmailTemplates"],
    queryFn: async () => {
      const res = await api.get("/admin/email-templates");
      return res.data?.data || res.data || [];
    }
  });

  // Load details on selection
  useEffect(() => {
    const template = templates.find((t: any) => t.slug === selectedSlug);
    if (template) {
      setName(template.name || "");
      setSubject(template.subject || "");
      setBodyHtml(template.body_html || "");
      setBodyText(template.body_text || "");
      setVariables(template.variables || []);
    } else {
      // Default seed fallbacks
      setName(selectedSlug.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") + " Email");
      setSubject("Sabjiwala Notification");
      setBodyHtml("<div style='font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;'>\n  <h3>Notification</h3>\n  <p>Default details here...</p>\n</div>");
      setBodyText("Sabjiwala Notification");
      setVariables([]);
    }
  }, [selectedSlug, templates]);

  // Mutation to save email template
  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        name,
        slug: selectedSlug,
        subject,
        body_html: bodyHtml,
        body_text: bodyText || subject,
        variables,
        is_active: true,
        category: "transactional"
      };
      const exists = templates.some((t: any) => t.slug === selectedSlug);
      if (exists) {
        return api.put(`/admin/email-templates/${selectedSlug}`, data);
      } else {
        return api.post("/admin/email-templates", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminEmailTemplates"] });
      setToastMsg("Email template saved successfully!");
      setTimeout(() => setToastMsg(""), 3000);
    },
    onError: (err: any) => {
      alert("Failed to save template: " + (err.response?.data?.detail || err.message));
    }
  });

  // Mutation to send test email
  const testMutation = useMutation({
    mutationFn: async () => {
      if (!testEmail) {
        alert("Please enter a valid email address first.");
        throw new Error("No target email");
      }
      return api.post(`/admin/email-templates/${selectedSlug}/test`, {
        to_email: testEmail,
        variables: testVars
      });
    },
    onSuccess: () => {
      setToastMsg(`Test email successfully sent to ${testEmail}!`);
      setTimeout(() => setToastMsg(""), 3000);
    },
    onError: (err: any) => {
      alert("Failed to send test email: " + (err.response?.data?.detail || err.message));
    }
  });

  // Visual drag/drop click block appending helper
  const handleAddBlock = (blockHtml: string) => {
    setBodyHtml(prev => {
      // If wrapping div exists, try to inject before end, or append directly
      if (prev.trim().endsWith("</div>")) {
        const lastIdx = prev.lastIndexOf("</div>");
        return prev.substring(0, lastIdx) + "\n  " + blockHtml + "\n" + prev.substring(lastIdx);
      }
      return prev + "\n" + blockHtml;
    });
  };

  const handleClearTemplate = () => {
    if (confirm("Reset layout to standard wrapping frame?")) {
      setBodyHtml("<div style='font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;'>\n\n</div>");
    }
  };

  // Jinja token rendering emulation for designer live preview
  const getRenderedPreview = () => {
    let rendered = bodyHtml;
    Object.entries(testVars).forEach(([key, val]) => {
      rendered = rendered.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), val);
    });
    return rendered;
  };

  return (
    <AdminLayout title="Email Template Designer">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white font-black text-xs px-5 py-3 rounded-2xl shadow-xl animate-bounce">
          <Check className="w-4 h-4" /> {toastMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 font-sans">
        {/* Templates Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Email Events</h3>
            <div className="space-y-2">
              {[
                { slug: "order_placed", label: "Order Placed", desc: "Sent when order goes to pending/awaiting verification" },
                { slug: "order_confirmed", label: "Order Confirmed", desc: "Sent when store verifies catalog stock availability" },
                { slug: "order_delivered", label: "Order Delivered", desc: "Final order success verification" },
                { slug: "order_refunded", label: "Order Refunded", desc: "Digital wallet offset adjustment notices" },
              ].map((tpl) => {
                const isSelected = selectedSlug === tpl.slug;
                const exists = templates.some(t => t.slug === tpl.slug);
                return (
                  <button
                    key={tpl.slug}
                    onClick={() => {
                      setSelectedSlug(tpl.slug);
                      setDesignerMode("visual");
                    }}
                    className={`w-full flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900 text-emerald-800 dark:text-emerald-450"
                        : "bg-transparent border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <div className="text-xs font-extrabold flex items-center gap-1.5">
                      {tpl.label}
                      {exists && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Configured in database"></span>}
                    </div>
                    <p className="text-[9px] text-slate-400 leading-normal mt-0.5">{tpl.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sourcing Variable Helper Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-black text-slate-800 dark:text-white mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              Dynamic Variable Tags
            </h3>
            <p className="text-[10px] text-slate-450 leading-relaxed mb-3">Copy and drop these tokens inside your email markup content to fetch live order database details:</p>
            <div className="space-y-1.5 font-mono text-[9px] text-slate-655 dark:text-slate-350">
              <div className="bg-slate-50 dark:bg-slate-950 p-1.5 rounded-lg border border-slate-200/50 dark:border-slate-800 flex justify-between">
                <span>Order No:</span> <code className="text-emerald-600 font-bold">{"{{ order_number }}"}</code>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 p-1.5 rounded-lg border border-slate-200/50 dark:border-slate-800 flex justify-between">
                <span>Total Amount:</span> <code className="text-emerald-600 font-bold">{"{{ total_amount }}"}</code>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 p-1.5 rounded-lg border border-slate-200/50 dark:border-slate-800 flex justify-between">
                <span>Address Details:</span> <code className="text-emerald-600 font-bold">{"{{ delivery_address }}"}</code>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 p-1.5 rounded-lg border border-slate-200/50 dark:border-slate-800 flex justify-between">
                <span>Refund Offset:</span> <code className="text-emerald-600 font-bold">{"{{ refund_amount }}"}</code>
              </div>
            </div>
          </div>
        </div>

        {/* Builder Workstation */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            {/* toolbar */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 p-4 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDesignerMode("visual")}
                  className={`flex items-center gap-1.5 text-xs font-black px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                    designerMode === "visual"
                      ? "bg-white dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800 text-slate-850 dark:text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-655"
                  }`}
                >
                  <Grid className="w-4 h-4" />
                  Visual Blocks
                </button>
                <button
                  onClick={() => setDesignerMode("html")}
                  className={`flex items-center gap-1.5 text-xs font-black px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                    designerMode === "html"
                      ? "bg-white dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800 text-slate-850 dark:text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-655"
                  }`}
                >
                  <Code className="w-4 h-4" />
                  HTML Code Code
                </button>
                <button
                  onClick={() => setDesignerMode("preview")}
                  className={`flex items-center gap-1.5 text-xs font-black px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                    designerMode === "preview"
                      ? "bg-white dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800 text-slate-850 dark:text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-655"
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Email Preview
                </button>
              </div>

              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-550 disabled:opacity-50 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {saveMutation.isPending ? "Saving..." : "Save Template"}
              </button>
            </div>

            {/* Template Basic Metadata inputs */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-850 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-extrabold text-slate-455">Template Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Order Placed Email Template"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-extrabold text-slate-455">Subject Title Header</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Your Order #{{ order_number }} has been placed!"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Workspace Area */}
            <div className="p-6">
              {designerMode === "visual" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left panel of draggable/clickable blocks */}
                  <div className="md:col-span-1 space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-extrabold text-slate-455">Layout Blocks</span>
                        <button onClick={handleClearTemplate} className="text-[9px] font-black text-rose-500 hover:underline">Clear Frame</button>
                      </div>
                      <div className="space-y-2">
                        {VISUAL_BLOCKS.map(block => (
                          <button
                            key={block.id}
                            onClick={() => handleAddBlock(block.defaultHtml)}
                            className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-xl text-left hover:border-emerald-300 dark:hover:border-emerald-900 transition-all group cursor-pointer"
                          >
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{block.label}</span>
                            <Plus className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Visual preview and inline editor */}
                  <div className="md:col-span-2 space-y-3">
                    <label className="text-[10px] uppercase font-extrabold text-slate-455">Template Design Code (Click left blocks to append)</label>
                    <textarea
                      value={bodyHtml}
                      onChange={(e) => setBodyHtml(e.target.value)}
                      rows={14}
                      className="w-full p-4 font-mono text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {designerMode === "html" && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-extrabold text-slate-455">HTML Email Body Content</label>
                    <textarea
                      value={bodyHtml}
                      onChange={(e) => setBodyHtml(e.target.value)}
                      rows={18}
                      className="w-full p-4 font-mono text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {designerMode === "preview" && (
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-850 rounded-2xl p-6 min-h-[400px] flex items-center justify-center">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 max-w-lg w-full text-slate-800 font-sans" dangerouslySetInnerHTML={{ __html: getRenderedPreview() }}>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Test server email trigger panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5">
              <Send className="w-4.5 h-4.5 text-emerald-500" />
              SMTP Email Delivery Test Engine
            </h3>
            <p className="text-[10px] text-slate-400">Validate server connections and layout formatting immediately by pushing a real test email.</p>
            
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] uppercase font-extrabold text-slate-400">Target Email Address</label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="e.g. developer@sabjiwala.qzz.io"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-850 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
              <button
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-extrabold text-xs px-5 py-3 rounded-xl shadow-md cursor-pointer transition-all shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                {testMutation.isPending ? "Sending Test..." : "Send Test Email"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
