"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import AgentLayout from "@/components/AgentLayout";
import { Phone, Clock, Calendar, PhoneMissed, PhoneIncoming } from "lucide-react";
import { Card } from "@/components/ui/index";

export default function AgentCallLogs() {
  const [isAvailable, setIsAvailable] = useState(true);

  // Queries
  const { data: callLogs = [], isLoading } = useQuery<any[]>({
    queryKey: ["callLogs"],
    queryFn: async () => {
      const res = await api.get("/support/calls/logs");
      return res.data || [];
    }
  });

  return (
    <AgentLayout
      title="Call History Logs"
      isAvailable={isAvailable}
      onAvailabilityToggle={(val) => setIsAvailable(val)}
    >
      <div className="space-y-4 max-w-4xl font-sans">
        <div>
          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Voice Call Logs ({callLogs.length})</h3>
          <p className="text-xs text-slate-500 mt-1">Review active calling history records, missed alerts, and voicemails.</p>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="py-20 text-center text-slate-400 text-xs">Loading call logs...</div>
          ) : callLogs.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs">No call history logs found.</div>
          ) : (
            callLogs.map((log: any) => {
              const isMissed = log.status === "missed";
              const isVoicemail = log.status === "voicemail";
              
              return (
                <Card
                  key={log.id}
                  className="p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${
                      isMissed
                        ? "bg-rose-500/10 text-rose-500"
                        : isVoicemail
                        ? "bg-amber-500/10 text-amber-500"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {isMissed ? <PhoneMissed className="w-5 h-5" /> : <PhoneIncoming className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 dark:text-white text-xs">{log.caller_name || "Unknown Caller"}</h4>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-slate-100 dark:bg-slate-850 rounded text-slate-500">
                          {log.caller_role}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-455 font-medium mt-0.5">{log.caller_phone || "No Phone Info"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-right">
                    <div className="text-[11px] text-slate-500 space-y-1">
                      <p className="flex items-center justify-end gap-1 font-mono text-[10px]">
                        <Clock className="w-3.5 h-3.5" />
                        {Math.floor(log.duration_seconds / 60)}m {log.duration_seconds % 60}s
                      </p>
                      <p className="flex items-center justify-end gap-1 font-medium">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                        isMissed
                          ? "bg-rose-100 dark:bg-rose-950/20 text-rose-600"
                          : isVoicemail
                          ? "bg-amber-100 dark:bg-amber-950/20 text-amber-600"
                          : "bg-emerald-100 dark:bg-emerald-950/20 text-emerald-600"
                      }`}>
                        {log.status}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AgentLayout>
  );
}
