"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import Link from "next/link";
import { MessageSquare, ChevronRight, Clock, CheckCircle2, XCircle, AlertCircle, ArrowRight } from "lucide-react";
import { Badge, EmptyState, Skeleton, Button } from "@/components/ui/index";

const STATUS_CONFIG: Record<string, { color: "success" | "warning" | "danger" | "info"; icon: any; label: string }> = {
  open: { color: "info", icon: AlertCircle, label: "Open" },
  in_progress: { color: "warning", icon: Clock, label: "In Progress" },
  resolved: { color: "success", icon: CheckCircle2, label: "Resolved" },
  closed: { color: "danger", icon: XCircle, label: "Closed" },
};

export default function TicketsPage() {
  const { data: tickets = [], isLoading } = useQuery<any[]>({
    queryKey: ["tickets"],
    queryFn: async () => { const r = await api.get("/support/tickets/me"); return r.data || []; },
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">My Tickets</h1>
        <Link href="/support">
          <Button size="sm" variant="secondary">New Ticket</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : tickets.length === 0 ? (
        <EmptyState
          emoji="🎫"
          title="No support tickets"
          description="Your support tickets will appear here."
          action={<Link href="/support"><Button>Raise a Ticket</Button></Link>}
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket: any) => {
            const cfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
            const Icon = cfg.icon;
            return (
              <Link key={ticket.id} href={`/support/tickets/${ticket.id}`}>
                <div className="card p-4 hover:border-emerald-400 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 bg-purple-50 dark:bg-purple-950/30 rounded-xl flex-shrink-0">
                        <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-sm text-slate-900 dark:text-white line-clamp-1">{ticket.subject}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">{ticket.category?.replace(/_/g, " ")}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          {new Date(ticket.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={cfg.color} size="sm">{cfg.label}</Badge>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                  {ticket.last_reply && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 line-clamp-1">
                      Last reply: {ticket.last_reply}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
