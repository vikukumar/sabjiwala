"use client";

import React, { useState } from "react";
import { Mail, Phone, MapPin, Send, MessageSquare, Clock, HelpCircle, CheckCircle } from "lucide-react";
import { Button, Card, Input } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";

export default function ContactPage() {
  const { success, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [formState, setFormState] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name || !formState.message || (!formState.email && !formState.phone)) {
      showError("Required Fields", "Please enter your name, message, and either email or phone.");
      return;
    }
    setLoading(true);
    try {
      // Simulate form submission API delay
      await new Promise((resolve) => setTimeout(resolve, 1500));
      success("Message Sent", "Thank you for contacting Sbjiwala! Our support team will get back to you shortly.");
      setSubmitted(true);
    } catch (err) {
      showError("Submission Failed", "Something went wrong. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6 animate-fade-in font-sans">
        <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mx-auto shadow-md border border-emerald-500/10">
          <CheckCircle className="w-10 h-10 text-emerald-600 dark:text-emerald-400 animate-bounce" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Message Dispatched!</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Your inquiry has been logged in our support pipeline. An organic sourcing manager or customer support specialist will contact you in less than 2 hours.
          </p>
        </div>
        <button
          onClick={() => {
            setFormState({ name: "", email: "", phone: "", message: "" });
            setSubmitted(false);
          }}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-6 py-3 rounded-xl transition-all shadow-md uppercase tracking-wider"
        >
          Send Another Message
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-12 font-sans">
      {/* Hero Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-850 dark:text-emerald-300 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider">
          <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-450" />
          24/7 Support Desk
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          Get in Touch with<br />
          <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">Sbjiwala Team</span>
        </h1>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed font-medium">
          Have questions about organic sourcing, vendor partnerships, dark store deliveries, or loaded wallets? Fill out the form or reach out directly.
        </p>
      </div>

      <div className="grid md:grid-cols-5 gap-8">
        {/* Info Grid */}
        <div className="md:col-span-2 space-y-6">
          <Card className="p-6 space-y-6 bg-white dark:bg-slate-900">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Direct Channels</h3>
            
            <div className="space-y-4">
              <div className="flex gap-3.5 items-start">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-extrabold text-slate-400">Mobile Hotline</p>
                  <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-0.5">+91 98765 43210</p>
                  <p className="text-[10px] text-slate-500">Mon-Sat, 6:00 AM - 9:00 PM</p>
                </div>
              </div>

              <div className="flex gap-3.5 items-start">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-extrabold text-slate-400">Email Address</p>
                  <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-0.5">support@sbjiwala.qzz.io</p>
                  <p className="text-[10px] text-slate-500">For general support & disputes</p>
                </div>
              </div>

              <div className="flex gap-3.5 items-start">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-extrabold text-slate-400">Corporate Head Office</p>
                  <p className="text-sm font-bold text-slate-850 dark:text-slate-200 mt-0.5 leading-snug">
                    Sbjiwala Sourcing Hub, Near APMC Market, Vashi, Navi Mumbai, MH - 400703
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4 bg-slate-900 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full translate-x-1/3 -translate-y-1/3 blur-xl" />
            <h3 className="text-base font-black flex items-center gap-1.5">
              <Clock className="w-4.5 h-4.5 text-emerald-400 animate-pulse" /> Urgent Sourcing Help
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-semibold">
              Are you a local farmer looking to register on our growers list? Or a wholesale purchaser? Write to our vendor relations manager directly at:
              <span className="block mt-1 font-bold text-emerald-400">growers@sbjiwala.qzz.io</span>
            </p>
          </Card>
        </div>

        {/* Contact Form */}
        <div className="md:col-span-3">
          <Card className="p-8 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-3xl shadow-xl">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6">Send Sourcing Message</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Your Name *"
                placeholder="Enter your full name"
                value={formState.name}
                onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="name@example.com"
                  value={formState.email}
                  onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                />
                <Input
                  label="Phone Number"
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={formState.phone}
                  onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-wider text-slate-500 block">
                  Detailed Message *
                </label>
                <textarea
                  placeholder="Enter details of your inquiry, order number, or partnership offer..."
                  rows={5}
                  value={formState.message}
                  onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                  className="w-full p-4 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs rounded-2xl outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-semibold text-slate-800 dark:text-slate-250"
                  required
                />
              </div>

              <Button type="submit" fullWidth loading={loading} size="lg">
                Submit Sourcing Form <Send className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
