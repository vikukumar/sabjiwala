"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sabjiwala/shared";
import { Bell, BellOff, Check, Package, Truck, Tag, MessageSquare, Wallet, Star } from "lucide-react";
import { Button, Badge, EmptyState, Skeleton } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";

const NOTIF_ICONS: Record<string, any> = {
  order: Package,
  delivery: Truck,
  offer: Tag,
  support: MessageSquare,
  wallet: Wallet,
  review: Star,
};

const NOTIF_COLORS: Record<string, string> = {
  order: "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400",
  delivery: "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400",
  offer: "bg-rose-50 dark:bg-rose-950/30 text-rose-500 dark:text-rose-400",
  support: "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400",
  wallet: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400",
  review: "bg-amber-50 dark:bg-amber-950/30 text-amber-500 dark:text-amber-400",
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsPage() {
  const { success } = useToast();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: async () => { const r = await api.get("/notifications/me"); return r.data || []; },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post("/notifications/me/mark-all-read"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      success("All marked as read");
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Notifications</h1>
          {unreadCount > 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{unreadCount} unread</p>}
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()} loading={markAllRead.isPending} leftIcon={<Check className="w-3.5 h-3.5" />}>
            Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : notifications.length === 0 ? (
        <EmptyState emoji="🔔" title="No notifications yet" description="You'll see order updates, offers, and more here." />
      ) : (
        <div className="space-y-2">
          {notifications.map((notif: any) => {
            const Icon = NOTIF_ICONS[notif.type] || Bell;
            const colorCls = NOTIF_COLORS[notif.type] || "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400";
            return (
              <div
                key={notif.id}
                onClick={() => !notif.is_read && markRead.mutate(notif.id)}
                className={`flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-sm ${
                  notif.is_read
                    ? "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
                    : "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30"
                }`}
              >
                <div className={`p-2.5 rounded-xl flex-shrink-0 ${colorCls}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-bold ${notif.is_read ? "text-slate-700 dark:text-slate-300" : "text-slate-900 dark:text-white"}`}>
                      {notif.title}
                    </p>
                    {!notif.is_read && <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{notif.body || notif.message}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-medium">{timeAgo(notif.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
