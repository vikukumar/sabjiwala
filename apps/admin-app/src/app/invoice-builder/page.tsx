"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { Save, FileText, Check, Award, Eye, Edit3 } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";

// Built-in Invoice templates html
const TEMPLATES = [
  {
    id: "emerald",
    label: "Premium Emerald",
    desc: "Modern layout with green brand accents",
    html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Invoice {{ order_number }}</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 20px; }
        .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, .15); font-size: 14px; line-height: 22px; color: #555; }
        .invoice-box table { width: 100%; line-height: inherit; text-align: left; border-collapse: collapse; }
        .invoice-box table td { padding: 8px; vertical-align: top; }
        .invoice-box table tr td:nth-child(2) { text-align: right; }
        .invoice-box table tr.top table td { padding-bottom: 20px; }
        .invoice-box table tr.top table td.title { font-size: 32px; line-height: 32px; color: #059669; font-weight: bold; }
        .invoice-box table tr.information table td { padding-bottom: 30px; }
        .invoice-box table tr.heading td { background: #059669; color: #fff; font-weight: bold; padding: 8px; }
        .invoice-box table tr.item td { border-bottom: 1px solid #eee; }
        .invoice-box table tr.total td:nth-child(2) { border-top: 2px solid #059669; font-weight: bold; font-size: 16px; color: #059669; }
        .footer { text-align: center; margin-top: 40px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
    </style>
</head>
<body>
    <div class="invoice-box">
        <table>
            <tr class="top">
                <td colspan="2">
                    <table>
                        <tr>
                            <td class="title">
                                {{ company_name }}
                            </td>
                            <td>
                                Invoice #: {{ order_number }}<br>
                                Date: {{ created_at }}<br>
                                Status: {{ status }}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
            <tr class="information">
                <td colspan="2">
                    <table>
                        <tr>
                            <td>
                                <strong>Billed By:</strong><br>
                                {{ company_name }}<br>
                                {{ company_address }}<br>
                                GSTIN: {{ company_gstin }}
                            </td>
                            <td>
                                <strong>Billed To:</strong><br>
                                {{ customer_name }}<br>
                                {{ customer_phone }}<br>
                                {{ delivery_address }}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
            <tr class="heading">
                <td>Item</td>
                <td>Price</td>
            </tr>
            {% for item in items %}
            <tr class="item">
                <td>{{ item.name }} (x{{ item.quantity }} {{ item.unit }})</td>
                <td>₹{{ item.total_price }}</td>
            </tr>
            {% endfor %}
            <tr class="total">
                <td></td>
                <td>Total: ₹{{ total_amount }}</td>
            </tr>
        </table>
        <div class="footer">
            Thank you for buying fresh from {{ company_name }}! Keep supporting your local farmers.
        </div>
    </div>
</body>
</html>`
  },
  {
    id: "minimal",
    label: "Minimalist Dark",
    desc: "Chic layout with dark accents",
    html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Invoice {{ order_number }}</title>
    <style>
        body { font-family: 'Courier New', Courier, monospace; color: #111; margin: 0; padding: 20px; background: #fff; }
        .invoice-box { max-width: 800px; margin: auto; padding: 20px; border: 1px solid #111; font-size: 13px; line-height: 20px; }
        .invoice-box table { width: 100%; border-collapse: collapse; }
        .invoice-box table td { padding: 6px; }
        .invoice-box table tr td:nth-child(2) { text-align: right; }
        .invoice-box table tr.heading td { border-bottom: 2px solid #111; font-weight: bold; }
        .invoice-box table tr.item td { border-bottom: 1px dashed #ccc; }
        .invoice-box table tr.total td:nth-child(2) { border-top: 2px solid #111; font-weight: bold; }
        .title { font-size: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
        .footer { text-align: center; margin-top: 30px; font-size: 11px; }
    </style>
</head>
<body>
    <div class="invoice-box">
        <table>
            <tr>
                <td class="title">{{ company_name }}</td>
                <td>
                    INVOICE: {{ order_number }}<br>
                    DATE: {{ created_at }}
                </td>
            </tr>
            <tr>
                <td>
                    FROM: {{ company_address }}<br>
                    GST: {{ company_gstin }}
                </td>
                <td>
                    TO: {{ customer_name }} ({{ customer_phone }})<br>
                    DELIVERY: {{ delivery_address }}
                </td>
            </tr>
            <tr class="heading">
                <td>ITEM DESCRIPTION</td>
                <td>AMOUNT</td>
            </tr>
            {% for item in items %}
            <tr class="item">
                <td>{{ item.name }} x {{ item.quantity }}</td>
                <td>₹{{ item.total_price }}</td>
            </tr>
            {% endfor %}
            <tr class="total">
                <td></td>
                <td>TOTAL: ₹{{ total_amount }}</td>
            </tr>
        </table>
        <div class="footer">
            * Thank you for your business. Sourced directly from local farmers. *
        </div>
    </div>
</body>
</html>`
  },
  {
    id: "classic",
    label: "Classic Traditional",
    desc: "Professional layouts with double lines",
    html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Invoice {{ order_number }}</title>
    <style>
        body { font-family: Georgia, serif; color: #222; margin: 0; padding: 20px; }
        .invoice-box { max-width: 800px; margin: auto; padding: 25px; border: 3px double #333; font-size: 14px; line-height: 22px; }
        .invoice-box table { width: 100%; border-collapse: collapse; }
        .invoice-box table td { padding: 8px; }
        .invoice-box table tr td:nth-child(2) { text-align: right; }
        .invoice-box table tr.heading td { border-top: 1px solid #333; border-bottom: 1px solid #333; font-weight: bold; background-color: #f5f5f5; }
        .invoice-box table tr.item td { border-bottom: 1px solid #e0e0e0; }
        .invoice-box table tr.total td:nth-child(2) { border-top: 3px double #333; font-weight: bold; }
        .title { font-size: 26px; font-weight: bold; font-style: italic; color: #444; }
        .footer { text-align: center; margin-top: 30px; font-size: 11px; font-style: italic; }
    </style>
</head>
<body>
    <div class="invoice-box">
        <table>
            <tr>
                <td class="title">{{ company_name }}</td>
                <td>
                    <b>Invoice #:</b> {{ order_number }}<br>
                    <b>Date:</b> {{ created_at }}<br>
                    <b>Status:</b> {{ status }}
                </td>
            </tr>
            <tr>
                <td>
                    <b>Billed By:</b> {{ company_address }}<br>
                    <b>GSTIN:</b> {{ company_gstin }}
                </td>
                <td>
                    <b>Billed To:</b> {{ customer_name }}<br>
                    <b>Phone:</b> {{ customer_phone }}<br>
                    <b>Shipping:</b> {{ delivery_address }}
                </td>
            </tr>
            <tr class="heading">
                <td>DESCRIPTION</td>
                <td>AMOUNT</td>
            </tr>
            {% for item in items %}
            <tr class="item">
                <td>{{ item.name }} ({{ item.quantity }} {{ item.unit }})</td>
                <td>₹{{ item.total_price }}</td>
            </tr>
            {% endfor %}
            <tr class="total">
                <td></td>
                <td><b>Grand Total:</b> ₹{{ total_amount }}</td>
            </tr>
        </table>
        <div class="footer">
            Thank you for shopping with {{ company_name }}!
        </div>
    </div>
</body>
</html>`
  }
];

export default function AdminInvoiceBuilder() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [htmlTemplate, setHtmlTemplate] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyGstin, setCompanyGstin] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  // Fetch settings
  const { data: settings = [], isLoading } = useQuery<any[]>({
    queryKey: ["adminSettings"],
    queryFn: async () => {
      const res = await api.get("/admin/settings");
      return res.data?.data || res.data || [];
    }
  });

  // Load template HTML and branding JSON from settings
  useEffect(() => {
    if (settings.length > 0) {
      const tmplSetting = settings.find(s => s.key === "invoice_template_html");
      const brandingSetting = settings.find(s => s.key === "invoice_branding_json");
      
      if (tmplSetting) {
        setHtmlTemplate(tmplSetting.value || "");
      }
      if (brandingSetting) {
        const brand = brandingSetting.value_json || {};
        setCompanyName(brand.company_name || "Sabjiwala");
        setCompanyAddress(brand.company_address || "");
        setCompanyPhone(brand.company_phone || "");
        setCompanyGstin(brand.gstin || "");
      }
    }
  }, [settings]);

  // Mutations to save both settings
  const saveMutation = useMutation({
    mutationFn: async () => {
      const brandPayload = {
        value_json: {
          company_name: companyName,
          company_address: companyAddress,
          company_phone: companyPhone,
          gstin: companyGstin
        }
      };
      const tmplPayload = {
        value: htmlTemplate
      };

      await api.put("/admin/settings/invoice_template_html", tmplPayload);
      await api.put("/admin/settings/invoice_branding_json", brandPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSettings"] });
      setToastMsg("Invoice design saved successfully!");
      setTimeout(() => setToastMsg(""), 3000);
    },
    onError: (err: any) => {
      alert("Failed to save invoice design: " + (err.response?.data?.detail || err.message));
    }
  });

  // Apply visual preset template
  const handleApplyPreset = (tmplHtml: string) => {
    if (confirm("Replace current invoice HTML with this preset layout?")) {
      setHtmlTemplate(tmplHtml);
    }
  };

  // Mock template rendering for preview
  const getRenderedPreview = () => {
    let rendered = htmlTemplate;
    
    // Replace branding values
    rendered = rendered.replace(new RegExp("{{\\s*company_name\\s*}}", "g"), companyName || "Sabjiwala");
    rendered = rendered.replace(new RegExp("{{\\s*company_address\\s*}}", "g"), companyAddress || "123 Mandi Market, Jaipur");
    rendered = rendered.replace(new RegExp("{{\\s*company_phone\\s*}}", "g"), companyPhone || "+91 99999 88888");
    rendered = rendered.replace(new RegExp("{{\\s*company_gstin\\s*}}", "g"), companyGstin || "08ABCDE1234F1Z1");
    
    // Replace order specifics
    rendered = rendered.replace(new RegExp("{{\\s*order_number\\s*}}", "g"), "SBJ-98273");
    rendered = rendered.replace(new RegExp("{{\\s*created_at\\s*}}", "g"), "2026-06-20 22:45");
    rendered = rendered.replace(new RegExp("{{\\s*status\\s*}}", "g"), "Delivered");
    rendered = rendered.replace(new RegExp("{{\\s*customer_name\\s*}}", "g"), "Amit Sharma");
    rendered = rendered.replace(new RegExp("{{\\s*customer_phone\\s*}}", "g"), "+91 98765 43210");
    rendered = rendered.replace(new RegExp("{{\\s*delivery_address\\s*}}", "g"), "Flat 302, Block B, Royal Palms, Jaipur");
    rendered = rendered.replace(new RegExp("{{\\s*total_amount\\s*}}", "g"), "135.00");
    
    // Replace items loop
    const loopRegex = /{%\\s*for\\s+item\\s+in\\s+items\\s*%}([\s\S]*?){%\\s*endfor\\s*%}/g;
    rendered = rendered.replace(loopRegex, () => {
      return `
        <tr>
            <td>Organic Fresh Tomatoes (x2.0 KG)</td>
            <td>₹80.00</td>
        </tr>
        <tr>
            <td>Farm Potatoes (x1.0 KG)</td>
            <td>₹30.00</td>
        </tr>
        <tr>
            <td>Fresh Coriander Leaves (x1.0 BUNDLE)</td>
            <td>₹25.00</td>
        </tr>
      `;
    });
    
    return rendered;
  };

  if (isLoading) {
    return (
      <AdminLayout title="Invoice Builder Configurator">
        <div className="h-96 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-bold text-slate-400">Loading invoice configurations...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Branded Invoice Layout Builder">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white font-black text-xs px-5 py-3 rounded-2xl shadow-xl animate-bounce">
          <Check className="w-4 h-4" /> {toastMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 font-sans">
        {/* Preset selections */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Layout Presets</h3>
            <div className="space-y-2">
              {TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => handleApplyPreset(tmpl.html)}
                  className="w-full flex items-start gap-3 p-3 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl text-left transition-all cursor-pointer group"
                >
                  <FileText className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-200">{tmpl.label}</h4>
                    <p className="text-[9px] text-slate-400 mt-0.5 leading-normal">{tmpl.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-500" />
              Dynamic Variable Tags
            </h3>
            <p className="text-[10px] text-slate-400 leading-relaxed">The invoice engine injects these parameters at compile time:</p>
            <div className="space-y-1.5 font-mono text-[9px] text-slate-655 dark:text-slate-400">
              <div className="bg-slate-50 dark:bg-slate-950 p-1.5 rounded-lg">company_name</div>
              <div className="bg-slate-50 dark:bg-slate-950 p-1.5 rounded-lg">company_address</div>
              <div className="bg-slate-50 dark:bg-slate-950 p-1.5 rounded-lg">company_gstin</div>
              <div className="bg-slate-50 dark:bg-slate-950 p-1.5 rounded-lg">order_number</div>
              <div className="bg-slate-50 dark:bg-slate-950 p-1.5 rounded-lg">created_at</div>
              <div className="bg-slate-50 dark:bg-slate-950 p-1.5 rounded-lg">total_amount</div>
            </div>
          </div>
        </div>

        {/* Editing workstation */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            {/* toolbar */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 p-4 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("edit")}
                  className={`flex items-center gap-1.5 text-xs font-black px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                    activeTab === "edit"
                      ? "bg-white dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800 text-slate-850 dark:text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-655"
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  HTML Designer
                </button>
                <button
                  onClick={() => setActiveTab("preview")}
                  className={`flex items-center gap-1.5 text-xs font-black px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                    activeTab === "preview"
                      ? "bg-white dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800 text-slate-850 dark:text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-655"
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Live Preview
                </button>
              </div>

              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-550 disabled:opacity-50 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {saveMutation.isPending ? "Saving..." : "Save Invoice"}
              </button>
            </div>

            <div className="p-6 border-b border-slate-100 dark:border-slate-850 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-extrabold text-slate-455">Billed From Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Sabjiwala Sourcing Private Limited"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-extrabold text-slate-455">Billed From Address</label>
                <input
                  type="text"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="e.g. Plot No 4A, Jaipur Wholesale Fruit Market"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-extrabold text-slate-455">Billed From Phone Support</label>
                <input
                  type="text"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  placeholder="e.g. +91 99999 88888"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-extrabold text-slate-455">GSTIN / Corporate Tax ID</label>
                <input
                  type="text"
                  value={companyGstin}
                  onChange={(e) => setCompanyGstin(e.target.value)}
                  placeholder="e.g. 08ABCDE1234F1Z1"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="p-6">
              {activeTab === "edit" ? (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-455">HTML Template Code (Jinja Format)</label>
                  <textarea
                    value={htmlTemplate}
                    onChange={(e) => setHtmlTemplate(e.target.value)}
                    rows={18}
                    className="w-full p-4 font-mono text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-850 rounded-2xl p-6 min-h-[400px] flex items-center justify-center">
                  <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 max-w-lg w-full text-slate-800 font-sans" dangerouslySetInnerHTML={{ __html: getRenderedPreview() }}>
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
