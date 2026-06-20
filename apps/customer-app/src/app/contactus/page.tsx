"use client";

import React, { useState, useEffect } from "react";
import { Mail, PhoneCall, MapPin, Loader2, Send, CheckCircle2, MessageSquare } from "lucide-react";
import { Button, Card } from "@/components/ui/index";
import { useQuery } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useSearchParams } from "next/navigation";

export default function ContactUsPage() {
  const { data: publicSettings } = useQuery<any>({
    queryKey: ["publicSettings"],
    queryFn: async () => {
      const res = await api.get("/installation/public-settings");
      return res.data || {};
    }
  });

  const searchParams = useSearchParams();
  const selectedPlan = searchParams?.get("plan") || "";

  useEffect(() => {
    const brandName = publicSettings?.app_name || "Sbjiwala";
    document.title = `Contact Us & Vendor Support | ${brandName}`;
  }, [publicSettings]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessType, setBusinessType] = useState(
    selectedPlan ? "vendor" : "customer"
  );
  const [message, setMessage] = useState(
    selectedPlan === "cloud"
      ? "Hi, I am interested in subscribing to the Cloud Managed (Pro) Plan for my grocery store. Please help me get setup!"
      : selectedPlan === "enterprise"
      ? "Hi, I am interested in the Custom Enterprise Plan for my multi-store/cooperative operations. Let's discuss integrations!"
      : ""
  );
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;
    setSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    }, 1500);
  };

  const supportCoords = [
    { icon: Mail, label: "Business Email", val: "support@sbjiwala.qzz.io", desc: "Response within 12 hours" },
    { icon: PhoneCall, label: "Merchant Hotline", val: "+91 90000 00004", desc: "Mon-Sat, 9AM to 6PM IST" },
    { icon: MapPin, label: "HQ Operations", val: "Sector 17, Vashi, Navi Mumbai, MH, 400703", desc: "Supply chain Hub & Dev Office" }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-12 font-sans">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          Get In Touch With<br />
          <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">Our Core Team</span>
        </h1>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed font-medium">
          Have questions about self-hosting, local delivery boys operations, or want to register as a farm vendor? We are here to help.
        </p>
      </div>

      <div className="grid md:grid-cols-5 gap-8 items-start">
        {/* Contact Info Panel */}
        <div className="md:col-span-2 space-y-6">
          <div className="space-y-1">
            <h3 className="font-black text-lg text-slate-905 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-500" /> Support Channels
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Reach out to our developers and operations support coordinators.
            </p>
          </div>

          <div className="space-y-4">
            {supportCoords.map((coord) => {
              const Icon = coord.icon;
              return (
                <div key={coord.label} className="flex gap-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl h-fit">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{coord.label}</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{coord.val}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-405 font-medium">{coord.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Contact Form Panel */}
        <div className="md:col-span-3">
          <Card className="p-6 md:p-8 border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900/60 rounded-3xl shadow-sm relative overflow-hidden">
            {submitted ? (
              <div className="text-center py-10 space-y-4 animate-scale-in">
                <div className="inline-flex p-3 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-full">
                  <CheckCircle2 className="w-10 h-10 animate-bounce" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-black text-slate-900 dark:text-white">Message Sent Successfully!</h4>
                  <p className="text-xs text-slate-550 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                    Thank you for contacting Sbjiwala. An operations coordinator or developer will respond to your inquiry shortly.
                  </p>
                </div>
                <Button
                  onClick={() => setSubmitted(false)}
                  className="bg-emerald-600 hover:bg-emerald-550 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
                >
                  Send Another Inquiry
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="font-black text-slate-900 dark:text-white text-base">Inquiry Form</h3>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Your Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="e.g. rahul@example.com"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="e.g. 9820012345"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">You Are A...</label>
                  <select
                    value={businessType}
                    onChange={e => setBusinessType(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white dark:bg-slate-900"
                  >
                    <option value="customer">Customer / Buyer</option>
                    <option value="vendor">Local Grocer / Vendor</option>
                    <option value="farmer">Farmer / Grower Collective</option>
                    <option value="developer">Open Source Developer</option>
                    <option value="partner">Delivery Fleet Operator</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Inquiry Message *</label>
                  <textarea
                    required
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Write details of your inquiry here..."
                    rows={4}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white resize-none"
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={submitting}
                    leftIcon={submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    className="bg-emerald-600 hover:bg-emerald-550 text-white font-extrabold text-xs px-5 py-3 rounded-xl shadow-md cursor-pointer"
                  >
                    {submitting ? "Sending inquiry..." : "Send Message"}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
