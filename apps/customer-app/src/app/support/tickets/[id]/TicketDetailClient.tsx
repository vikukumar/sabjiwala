"use client";

import React, { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { ChevronLeft, Send, User, Bot } from "lucide-react";
import { Badge, Button, Skeleton } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";

export default function TicketDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { error: showError } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: ticket, isLoading } = useQuery<any>({
    queryKey: ["ticket", id],
    queryFn: async () => { const r = await api.get(`/support/tickets/${id}`); return r.data; },
    refetchInterval: 30_000,
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [ticket?.messages]);

  const sendReply = useMutation({
    mutationFn: () => api.post(`/support/tickets/${id}/reply`, { message }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ticket", id] }); setMessage(""); },
    onError: (err: any) => showError("Send failed", err.response?.data?.detail || err.message),
  });

  if (isLoading) return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48 w-full" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-black text-slate-900 dark:text-white text-sm line-clamp-1">{ticket?.subject}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{ticket?.category?.replace(/_/g, " ")}</p>
          </div>
          <Badge variant={ticket?.status === "resolved" ? "success" : ticket?.status === "closed" ? "danger" : "info"}>
            {ticket?.status?.replace(/_/g, " ")}
          </Badge>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Original ticket */}
        <div className="flex gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl rounded-tl-none p-3 max-w-[80%]">
            <p className="text-sm text-slate-800 dark:text-slate-200">{ticket?.description}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
              {ticket?.created_at && new Date(ticket.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
        </div>

        {/* Replies */}
        {(ticket?.messages || []).map((msg: any, i: number) => {
          const isAgent = msg.sender === "agent" || msg.from_admin;
          return (
            <div key={i} className={`flex gap-2 ${isAgent ? "" : "flex-row-reverse"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isAgent ? "bg-blue-100 dark:bg-blue-950/50" : "bg-emerald-100 dark:bg-emerald-950/50"}`}>
                {isAgent ? <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
              </div>
              <div className={`rounded-2xl p-3 max-w-[80%] ${isAgent ? "bg-slate-100 dark:bg-slate-800 rounded-tl-none" : "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-tr-none"}`}>
                <p className="text-sm text-slate-800 dark:text-slate-200">{msg.message || msg.content}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  {msg.created_at && new Date(msg.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply Input */}
      {ticket?.status !== "closed" && (
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && message.trim() && sendReply.mutate()}
              placeholder="Type your reply..."
              className="input-base px-4 py-2.5 text-sm flex-1"
            />
            <Button
              loading={sendReply.isPending}
              disabled={!message.trim()}
              onClick={() => sendReply.mutate()}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
