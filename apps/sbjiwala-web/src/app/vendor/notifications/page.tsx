"use client";

import React, { useState } from "react";
import { Bell, Check, Loader2, RefreshCw, ShoppingBag, Truck, Settings, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import VendorLayout from "@/components/VendorLayout";

const NOTIFICATION_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  order_placed: { icon: ShoppingBag, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950/30" },
  order_confirmed: { icon: Check, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950/30" },
  delivery_update: { icon: Truck, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-950/30" },
  system: { icon: Settings, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800" },
  alert: { icon: AlertCircle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950/30" },
};

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function VendorNotificationsPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data: notifications = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["vendorNotifications", filter],
    queryFn: async () => {
      const res = await api.get("/vendors/me/notifications", {
        params: { unread_only: filter === "unread" }
      });
      return res.data || [];
    },
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/vendors/me/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendorNotifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => api.post("/vendors/me/notifications/mark-all-read"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorNotifications"] });
      success("All notifications marked as read.");
    },
    onError: (err: any) => showError("Failed", err.response?.data?.detail || err.message),
  });

  const unreadCount = (notifications as any[]).filter((n: any) => !n.is_read).length;

  return (
    <VendorLayout title="Notifications">
      <div className="space-y-5">
        {/* Header Controls */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-500" />
            <h2 className="font-black text-slate-900 dark:text-white">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer transition-all"
              >
                <Check className="w-3 h-3" />
                Mark All Read
              </button>
            )}
            <button
              onClick={() => refetch()}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {[
            { id: "all", label: "All Notifications" },
            { id: "unread", label: `Unread (${unreadCount})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${filter === tab.id ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notification List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-16 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
            </div>
          ) : (notifications as any[]).length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-sm text-slate-500 font-semibold">No notifications yet</p>
              <p className="text-xs text-slate-400">Order alerts and system messages will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {(notifications as any[]).map((notif: any) => {
                const type = notif.notification_type || notif.type || "system";
                const config = NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.system;
                const Icon = config.icon;
                return (
                  <div
                    key={notif.id}
                    className={`p-4 flex items-start gap-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all ${!notif.is_read ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""}`}
                    onClick={() => { if (!notif.is_read) markReadMutation.mutate(notif.id); }}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${config.bg}`}>
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-bold ${!notif.is_read ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}>
                          {notif.title}
                        </p>
                        {!notif.is_read && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">{notif.body || notif.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{getTimeAgo(notif.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </VendorLayout>
  );
}
