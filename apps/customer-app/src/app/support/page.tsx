"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { resolveLink } from "@/components/AppShell";
import { MessageSquare, Send, Phone, Mail, ArrowRight, ChevronRight, HelpCircle, Package, RefreshCcw, Truck, CreditCard, Loader2 } from "lucide-react";
import { Button, Input, Card, Badge, EmptyState, Skeleton } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";
import { useForm } from "react-hook-form";

const QUICK_TOPICS = [
  { icon: Package, label: "Order Issue" },
  { icon: RefreshCcw, label: "Refund / Return" },
  { icon: Truck, label: "Delivery Problem" },
  { icon: CreditCard, label: "Payment Help" },
  { icon: HelpCircle, label: "Other" },
];

function NewTicketForm({ orderId, onCreated }: { orderId?: string | null; onCreated: () => void }) {
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { subject: "", category: "order", description: "", order_id: orderId || "" },
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      await api.post("/support/tickets", data);
      success("Ticket raised!", "Our team will respond within 2 hours.");
      reset();
      onCreated();
    } catch (err: any) {
      showError("Failed to create ticket", err.response?.data?.detail || err.message);
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-4">
      <h2 className="font-black text-slate-900 dark:text-white">Raise a Support Ticket</h2>
      <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
        <select {...register("category")} className="input-base px-3 py-3 text-sm">
          <option value="order">Order Related</option>
          <option value="refund">Refund / Return</option>
          <option value="delivery">Delivery</option>
          <option value="payment">Payment</option>
          <option value="product">Product Quality</option>
          <option value="other">Other</option>
        </select>
      </div>
      <Input label="Subject *" placeholder="Brief description of your issue" error={errors.subject?.message}
        {...register("subject", { required: "Subject is required" })} />
      {orderId && <input type="hidden" {...register("order_id")} />}
      <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Description *</label>
        <textarea
          rows={4}
          {...register("description", { required: "Please describe your issue" })}
          className="input-base px-3 py-3 text-sm resize-none"
          placeholder="Please describe your issue in detail..."
        />
        {errors.description && <p className="text-xs text-rose-500 mt-1">{errors.description.message as string}</p>}
      </div>
      <Button type="submit" loading={loading} fullWidth leftIcon={<Send className="w-4 h-4" />}>
        Submit Ticket
      </Button>
    </form>
  );
}

function SupportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams?.get("order");
  const [showForm, setShowForm] = useState(!!orderId);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white">Help & Support</h1>

      {/* Quick contact */}
      <div className="grid grid-cols-2 gap-3">
        <a href="tel:+918000000000" className="card p-4 flex items-center gap-3 hover:border-emerald-400 transition-colors">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
            <Phone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900 dark:text-white">Call Us</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">9AM – 9PM</p>
          </div>
        </a>
        <a href="mailto:support@sbjiwala.qzz.io" className="card p-4 flex items-center gap-3 hover:border-emerald-400 transition-colors">
          <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
            <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900 dark:text-white">Email Us</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">24h response</p>
          </div>
        </a>
      </div>

      {/* Topics */}
      <div className="card p-5 space-y-3">
        <h2 className="font-black text-slate-900 dark:text-white">What can we help with?</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {QUICK_TOPICS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTopic === t.label;
            return (
              <button
                key={t.label}
                onClick={() => { setActiveTopic(t.label); setShowForm(true); }}
                className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-bold text-left transition-all ${isActive ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                  }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Raise Ticket */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full card p-4 flex items-center gap-3 hover:border-emerald-400 transition-colors text-left"
        >
          <div className="p-2.5 bg-purple-50 dark:bg-purple-950/30 rounded-xl">
            <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-900 dark:text-white">Raise Support Ticket</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">We'll respond within 2 hours</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      ) : (
        <NewTicketForm orderId={orderId} onCreated={() => { setShowForm(false); router.push(resolveLink("/support/tickets")); }} />
      )}

      {/* My tickets link */}
      <Link href={resolveLink("/support/tickets")} className="flex items-center justify-between card p-4 hover:border-emerald-400 transition-colors">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <span className="font-bold text-sm text-slate-800 dark:text-slate-200">View My Tickets</span>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </Link>

      {/* FAQ link */}
      <Link href={resolveLink("/faq")} className="flex items-center justify-between card p-4 hover:border-emerald-400 transition-colors">
        <div className="flex items-center gap-3">
          <HelpCircle className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <span className="font-bold text-sm text-slate-800 dark:text-slate-200">Frequently Asked Questions</span>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </Link>
    </div>
  );
}

export default function SupportPage() {
  return (
    <React.Suspense fallback={
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    }>
      <SupportContent />
    </React.Suspense>
  );
}
