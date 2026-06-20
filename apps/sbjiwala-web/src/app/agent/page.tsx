"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useWebSocket } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import AgentLayout from "@/components/AgentLayout";
import {
  MessageSquare, Send, User, ShoppingBag, Radio, Phone,
  PhoneOff, PhoneIncoming, AlertTriangle, ArrowRightLeft,
  DollarSign, Check, X, ShieldAlert, Award, FileText
} from "lucide-react";
import { Button, Card } from "@/components/ui/index";

export default function AgentDashboard() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);

  // Reassign Modal
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [selectedReassignAgentId, setSelectedReassignAgentId] = useState("");

  // Refund Modal
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  // Call state
  const [activeCall, setActiveCall] = useState<{
    status: "idle" | "incoming" | "dialing" | "connected";
    callerId?: string;
    callerName?: string;
    callerRole?: string;
    callerPhone?: string;
    duration: number;
  }>({ status: "idle", duration: 0 });

  // WebRTC & Audio Refs
  const rtcConnRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringtoneOscRef = useRef<any>(null);
  const callDurationInterval = useRef<any>(null);

  // Queries
  const { data: ticketsData = [] } = useQuery<any[]>({
    queryKey: ["agentTickets"],
    queryFn: async () => {
      const res = await api.get("/support/tickets");
      return res.data || [];
    },
    refetchInterval: 5000,
  });

  const { data: agentsData = [] } = useQuery<any[]>({
    queryKey: ["supportAgents"],
    queryFn: async () => {
      const res = await api.get("/support/agents");
      return res.data || [];
    },
    enabled: reassignModalOpen
  });

  const { data: selectedTicket } = useQuery<any>({
    queryKey: ["ticketDetail", selectedTicketId],
    queryFn: async () => {
      const res = await api.get(`/support/tickets/${selectedTicketId}`);
      return res.data || null;
    },
    enabled: !!selectedTicketId,
    refetchInterval: 3000,
  });

  const { data: userProfile } = useQuery<any>({
    queryKey: ["supportUserProfile", selectedTicket?.user_id],
    queryFn: async () => {
      const res = await api.get(`/users/${selectedTicket.user_id}`);
      return res.data || null;
    },
    enabled: !!selectedTicket?.user_id
  });

  const { data: userOrders = [] } = useQuery<any[]>({
    queryKey: ["supportUserOrders", selectedTicket?.user_id],
    queryFn: async () => {
      // List user's orders using admin endpoint which has filter options or retrieve all orders
      const res = await api.get("/admin/orders");
      const list = res.data || [];
      return list.filter((o: any) => o.user_id === selectedTicket?.user_id);
    },
    enabled: !!selectedTicket?.user_id
  });

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const { data: selectedOrder } = useQuery<any>({
    queryKey: ["supportOrderDetail", selectedOrderId],
    queryFn: async () => {
      const res = await api.get(`/orders/${selectedOrderId}`);
      return res.data || null;
    },
    enabled: !!selectedOrderId
  });

  const { data: returnRequests = [] } = useQuery<any[]>({
    queryKey: ["adminReturnsList"],
    queryFn: async () => {
      const res = await api.get("/admin/returns");
      return res.data || [];
    }
  });

  // Check if active ticket's user order has pending return request
  const activeOrderReturn = returnRequests.find(
    (ret: any) => ret.order_id === selectedOrderId && ret.status === "requested"
  );

  // Initialize Support Agent Availability Profile
  useEffect(() => {
    api.get("/support/agent/profile").then(res => {
      if (res.data) {
        setIsAvailable(res.data.is_available);
      }
    }).catch(() => {});
  }, []);

  // Web Audio API Ringtone Generators
  const playRingtone = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // Play double-beep standard telephone dial ringtone loop
      const playBeeps = () => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime + 0.3);
        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);

        const osc2 = ctx.createOscillator();
        const gainNode2 = ctx.createGain();
        osc2.connect(gainNode2);
        gainNode2.connect(ctx.destination);
        osc2.frequency.setValueAtTime(480, ctx.currentTime);
        gainNode2.gain.setValueAtTime(0, ctx.currentTime);
        gainNode2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gainNode2.gain.setValueAtTime(0.3, ctx.currentTime + 0.3);
        gainNode2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);

        osc.start();
        osc2.start();
        osc.stop(ctx.currentTime + 0.4);
        osc2.stop(ctx.currentTime + 0.4);

        // Second beep
        const playSecond = () => {
          const oscB1 = ctx.createOscillator();
          const gainB1 = ctx.createGain();
          oscB1.connect(gainB1);
          gainB1.connect(ctx.destination);
          oscB1.frequency.setValueAtTime(440, ctx.currentTime);
          gainB1.gain.setValueAtTime(0, ctx.currentTime);
          gainB1.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
          gainB1.gain.setValueAtTime(0.3, ctx.currentTime + 0.3);
          gainB1.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);

          const oscB2 = ctx.createOscillator();
          const gainB2 = ctx.createGain();
          oscB2.connect(gainB2);
          gainB2.connect(ctx.destination);
          oscB2.frequency.setValueAtTime(480, ctx.currentTime);
          gainB2.gain.setValueAtTime(0, ctx.currentTime);
          gainB2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
          gainB2.gain.setValueAtTime(0.3, ctx.currentTime + 0.3);
          gainB2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);

          oscB1.start();
          oscB2.start();
          oscB1.stop(ctx.currentTime + 0.4);
          oscB2.stop(ctx.currentTime + 0.4);
        };
        setTimeout(playSecond, 500);
      };

      playBeeps();
      ringtoneOscRef.current = setInterval(playBeeps, 3000);
    } catch (e) {
      console.warn("Failed to play synthesized ringtone:", e);
    }
  };

  const stopRingtone = () => {
    if (ringtoneOscRef.current) {
      clearInterval(ringtoneOscRef.current);
      ringtoneOscRef.current = null;
    }
  };

  // WebSocket signaling
  const { sendMessage } = useWebSocket((message) => {
    const { type, data } = message;

    if (type === "incoming_call") {
      setActiveCall({
        status: "incoming",
        callerId: data.caller_id,
        callerRole: data.caller_role,
        callerName: data.caller_name,
        callerPhone: data.caller_phone,
        duration: 0
      });
      playRingtone();
    } else if (type === "call_disconnected") {
      stopRingtone();
      cleanupWebRTC();
      setActiveCall({ status: "idle", duration: 0 });
      success("Call Ended", "The voice support session ended.");
      queryClient.invalidateQueries({ queryKey: ["callLogs"] });
    } else if (type === "call_offer") {
      handleCallOffer(data.sdp, data.sender_id);
    } else if (type === "ice_candidate") {
      if (rtcConnRef.current && data.candidate) {
        rtcConnRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => {
          console.warn("Failed to add ICE candidate:", e);
        });
      }
    }
  }, true);

  // WebRTC Negotiation
  const initializeWebRTC = async (targetId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({
          type: "ice_candidate",
          data: { target_id: targetId, candidate: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      // Stream remote call audio
      const audio = document.getElementById("remoteAudioStream") as HTMLAudioElement;
      if (audio) {
        audio.srcObject = event.streams[0];
        audio.play().catch(e => console.warn("Failed to auto play remote audio stream:", e));
      }
    };

    // Get microphone permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    } catch (e) {
      showError("Mic Permission Required", "Please allow microphone access to talk.");
    }

    rtcConnRef.current = pc;
    return pc;
  };

  const handleCallOffer = async (sdp: any, callerId: string) => {
    const pc = await initializeWebRTC(callerId);
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    sendMessage({
      type: "call_answer",
      data: { target_id: callerId, sdp: answer }
    });
  };

  const answerCall = async () => {
    stopRingtone();
    if (!activeCall.callerId) return;

    setActiveCall(prev => ({ ...prev, status: "connected" }));
    // Start stopwatch counter
    callDurationInterval.current = setInterval(() => {
      setActiveCall(prev => ({ ...prev, duration: prev.duration + 1 }));
    }, 1000);

    // Answer the SDP call
    success("Connected", "Talking with customer support...");
  };

  const rejectCall = () => {
    stopRingtone();
    if (activeCall.callerId) {
      sendMessage({
        type: "call_hangup",
        data: {
          target_id: activeCall.callerId,
          duration: activeCall.duration,
          status: "missed"
        }
      });
    }
    cleanupWebRTC();
    setActiveCall({ status: "idle", duration: 0 });
  };

  const hangupCall = () => {
    stopRingtone();
    if (activeCall.callerId) {
      sendMessage({
        type: "call_hangup",
        data: {
          target_id: activeCall.callerId,
          duration: activeCall.duration,
          status: "completed"
        }
      });
    }
    cleanupWebRTC();
    setActiveCall({ status: "idle", duration: 0 });
    success("Call Finished", `Call lasted ${activeCall.duration}s`);
  };

  const cleanupWebRTC = () => {
    if (callDurationInterval.current) {
      clearInterval(callDurationInterval.current);
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (rtcConnRef.current) {
      rtcConnRef.current.close();
      rtcConnRef.current = null;
    }
  };

  // Profile status toggle mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (val: boolean) => {
      const res = await api.patch("/support/agent/profile", { is_available: val });
      return res.data;
    },
    onSuccess: (data) => {
      setIsAvailable(data.is_available);
      sendMessage({
        type: "agent_status",
        data: { is_available: data.is_available }
      });
      success("Status Updated", `Support agent profile is now ${data.is_available ? "ONLINE" : "OFFLINE"}`);
      queryClient.invalidateQueries({ queryKey: ["agentProfile"] });
    }
  });

  // Message Mutation
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (isInternalNote) {
        return api.post(`/support/tickets/${selectedTicketId}/notes`, { message: inputText });
      } else {
        return api.post(`/support/tickets/${selectedTicketId}/messages`, { message: inputText });
      }
    },
    onSuccess: () => {
      setInputText("");
      queryClient.invalidateQueries({ queryKey: ["ticketDetail", selectedTicketId] });
      success("Sent", isInternalNote ? "Internal Note saved" : "Reply sent to customer");
    },
    onError: (err: any) => {
      showError("Error", err.response?.data?.detail || "Failed to post message");
    }
  });

  // Reassign Ticket Mutation
  const reassignMutation = useMutation({
    mutationFn: async () => {
      return api.post(`/support/tickets/${selectedTicketId}/assign`, { assigned_to: selectedReassignAgentId });
    },
    onSuccess: (res) => {
      setReassignModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["ticketDetail", selectedTicketId] });
      success("Ticket Transferred", res.message || "Ticket successfully assigned.");
    }
  });

  // Refund mutation
  const refundMutation = useMutation({
    mutationFn: async () => {
      return api.post(`/support/tickets/${selectedTicketId}/refund`, {
        amount: parseFloat(refundAmount),
        reason: refundReason
      });
    },
    onSuccess: (res) => {
      setRefundModalOpen(false);
      setRefundAmount("");
      setRefundReason("");
      queryClient.invalidateQueries({ queryKey: ["ticketDetail", selectedTicketId] });
      queryClient.invalidateQueries({ queryKey: ["supportUserProfile", selectedTicket?.user_id] });
      success("Refund Processed", res.message || "Customer wallet credited.");
    },
    onError: (err: any) => {
      showError("Refund Failed", err.response?.data?.detail || "Could not process wallet refund.");
    }
  });

  // Return approvals
  const approveReturnMutation = useMutation({
    mutationFn: async (reqId: string) => {
      return api.post(`/admin/returns/${reqId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminReturnsList"] });
      queryClient.invalidateQueries({ queryKey: ["supportUserOrders", selectedTicket?.user_id] });
      queryClient.invalidateQueries({ queryKey: ["supportOrderDetail", selectedOrderId] });
      success("Approved", "Return request approved and order updated.");
    }
  });

  const rejectReturnMutation = useMutation({
    mutationFn: async (reqId: string) => {
      return api.post(`/admin/returns/${reqId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminReturnsList"] });
      queryClient.invalidateQueries({ queryKey: ["supportOrderDetail", selectedOrderId] });
      success("Rejected", "Return request rejected.");
    }
  });

  return (
    <AgentLayout
      title="Agent Support Console"
      isAvailable={isAvailable}
      onAvailabilityToggle={(val) => toggleStatusMutation.mutate(val)}
    >
      <audio id="remoteAudioStream" autoPlay className="hidden" />

      {/* CALL DIALER / OVERLAY VIEW */}
      {activeCall.status !== "idle" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full translate-x-1/2 -translate-y-1/2 blur-lg" />
          
          <div className="flex items-center gap-4 relative z-10">
            <div className={`p-4 rounded-2xl ${activeCall.status === "connected" ? "bg-emerald-500/20 text-emerald-400 animate-pulse" : "bg-emerald-500/10 text-emerald-500"}`}>
              {activeCall.status === "incoming" ? <PhoneIncoming className="w-8 h-8" /> : <Phone className="w-8 h-8" />}
            </div>
            <div>
              <span className="text-[10px] uppercase font-black bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">
                Live {activeCall.callerRole?.toUpperCase() || "CUSTOMER"} CALL
              </span>
              <h3 className="text-base font-black mt-1 leading-tight">{activeCall.callerName || "Loading caller..."}</h3>
              <p className="text-[11px] text-slate-450 mt-0.5">{activeCall.callerPhone || "No caller ID details"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 relative z-10">
            {activeCall.status === "incoming" ? (
              <>
                <Button
                  onClick={answerCall}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-6 py-3 rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer border-0"
                >
                  <Phone className="w-4 h-4" /> Accept Call
                </Button>
                <Button
                  onClick={rejectCall}
                  variant="secondary"
                  className="bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 font-extrabold text-xs px-6 py-3 rounded-xl shadow border-0 cursor-pointer"
                >
                  <X className="w-4 h-4" /> Reject
                </Button>
              </>
            ) : (
              <>
                <div className="text-right pr-2">
                  <p className="text-[10px] uppercase text-slate-500 font-black">Call Duration</p>
                  <p className="text-sm font-bold font-mono text-emerald-400">{Math.floor(activeCall.duration / 60)}:{(activeCall.duration % 60).toString().padStart(2, "0")}</p>
                </div>
                <Button
                  onClick={hangupCall}
                  className="bg-rose-650 hover:bg-rose-600 text-white font-extrabold text-xs px-6 py-3 rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer border-0"
                >
                  <PhoneOff className="w-4 h-4" /> Disconnect
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* MAIN TWO-PANE WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Tickets Queue */}
        <div className="lg:col-span-3 space-y-4">
          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Support Queue ({ticketsData.length})</h3>
          
          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] pr-1 custom-scrollbar">
            {ticketsData.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-semibold">No open support tickets.</div>
            ) : (
              ticketsData.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTicketId(t.id);
                    setSelectedOrderId(null);
                  }}
                  className={`w-full text-left p-4 rounded-2xl border text-xs transition-all relative overflow-hidden cursor-pointer ${
                    selectedTicketId === t.id
                      ? "bg-slate-900 border-transparent text-white dark:bg-slate-950/80 shadow-md"
                      : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex justify-between items-start gap-1">
                    <span className="font-mono text-[10px] text-slate-400">#{t.ticket_number}</span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                      t.priority === "urgent" || t.priority === "high"
                        ? "bg-rose-500/10 text-rose-500"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-450"
                    }`}>
                      {t.priority}
                    </span>
                  </div>
                  
                  <h4 className="font-bold text-slate-900 dark:text-white mt-1.5 truncate group-hover:text-emerald-500">{t.subject}</h4>
                  
                  <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-slate-500">
                    <span className="capitalize">{t.category}</span>
                    <span>•</span>
                    <span className="capitalize">{t.status.replace("_", " ")}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Middle Column: Chat Thread & Inputs */}
        <div className="lg:col-span-6 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl h-[calc(100vh-230px)] shadow-sm overflow-hidden">
          {selectedTicketId ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/20">
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase">Ticket Details</h3>
                  <p className="text-[10px] text-slate-550 dark:text-slate-400 mt-0.5">
                    Subject: <span className="font-bold">{selectedTicket?.subject}</span> ({selectedTicket?.category})
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => setReassignModalOpen(true)}
                    className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-extrabold text-[10px] py-2 px-3 rounded-lg border-0 flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" /> Reassign
                  </Button>
                  <Button
                    onClick={() => setRefundModalOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-550 text-white font-extrabold text-[10px] py-2 px-3 rounded-lg border-0 flex items-center gap-1 cursor-pointer"
                  >
                    <DollarSign className="w-3.5 h-3.5" /> Refund
                  </Button>
                </div>
              </div>

              {/* Chat Thread */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar bg-slate-50/20 dark:bg-slate-950/5">
                {selectedTicket?.messages?.map((msg: any) => {
                  const isInternal = msg.is_internal;
                  const isSystem = msg.message_type === "system";
                  
                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center my-1.5">
                        <div className="bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400 font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-emerald-500" />
                          {msg.message}
                        </div>
                      </div>
                    );
                  }

                  const isAgentSender = ["support_agent", "admin", "super_admin"].includes(msg.sender_type);
                  
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] ${isAgentSender ? "ml-auto items-end" : "mr-auto items-start"}`}
                    >
                      <div className={`p-3.5 rounded-2xl text-[11px] leading-relaxed font-medium shadow-sm border ${
                        isInternal
                          ? "bg-amber-50 dark:bg-amber-950/20 border-amber-250 text-amber-900 dark:text-amber-300"
                          : isAgentSender
                          ? "bg-emerald-600 border-transparent text-white rounded-br-none"
                          : "bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-none"
                      }`}>
                        {isInternal && (
                          <div className="flex items-center gap-1 text-[9px] uppercase font-black text-amber-700 dark:text-amber-500 mb-1 border-b border-amber-200 dark:border-amber-900/40 pb-0.5">
                            🔒 Internal Note (Agent Eyes Only)
                          </div>
                        )}
                        <p>{msg.message}</p>
                      </div>
                      <span className="text-[9px] text-slate-400 mt-1 font-mono">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsInternalNote(false)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer border ${
                        !isInternalNote
                          ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-250"
                          : "border-slate-200 text-slate-400"
                      }`}
                    >
                      Public Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsInternalNote(true)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer border ${
                        isInternalNote
                          ? "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-250"
                          : "border-slate-200 text-slate-400"
                      }`}
                    >
                      Internal Note
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <textarea
                    placeholder={isInternalNote ? "Add private notes about ticket analysis..." : "Type public assistance instructions..."}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-xs focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white resize-none h-14"
                  />
                  <Button
                    onClick={() => sendMessageMutation.mutate()}
                    disabled={sendMessageMutation.isPending || !inputText}
                    className="bg-emerald-650 hover:bg-emerald-600 text-white p-3 rounded-xl flex items-center justify-center cursor-pointer flex-shrink-0 border-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center h-full space-y-3 p-4">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-slate-400" />
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Select support ticket</h4>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                Click a ticket from the sidebar queue to inspect customer problems, chat live, review orders, and dispatch returns.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: User details, orders, and action details */}
        <div className="lg:col-span-3 space-y-4">
          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Client Context</h3>

          {selectedTicketId ? (
            <div className="space-y-4 max-h-[calc(100vh-230px)] overflow-y-auto pr-1 custom-scrollbar">
              {/* User details */}
              <Card className="p-4 space-y-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm rounded-2xl">
                <h4 className="font-bold text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1.5">User Profile</h4>
                {userProfile ? (
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-slate-800 dark:text-white">{userProfile.first_name} {userProfile.last_name}</p>
                    <p className="text-slate-500 font-medium">{userProfile.email}</p>
                    <p className="text-slate-500 font-medium">{userProfile.phone}</p>
                    <div className="pt-1.5 flex gap-1.5">
                      <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 text-[9px] font-black uppercase px-2 py-0.5 rounded">
                        Verified
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 text-center text-slate-400 text-xs">Loading user profile...</div>
                )}
              </Card>

              {/* User's recent orders */}
              <Card className="p-4 space-y-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm rounded-2xl">
                <h4 className="font-bold text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1.5">Recent Orders</h4>
                
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {userOrders.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-[11px] font-medium">No order history found.</div>
                  ) : (
                    userOrders.map((o: any) => (
                      <button
                        key={o.id}
                        onClick={() => setSelectedOrderId(o.id)}
                        className={`w-full text-left p-2.5 rounded-xl border text-[11px] transition-all cursor-pointer ${
                          selectedOrderId === o.id
                            ? "bg-slate-100 border-emerald-500 text-slate-900"
                            : "bg-transparent border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-450 hover:bg-slate-50/50"
                        }`}
                      >
                        <div className="flex justify-between font-bold">
                          <span>#{o.order_number}</span>
                          <span className="text-emerald-600 dark:text-emerald-400">₹{o.total_amount}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1 capitalize font-medium">
                          <span>{o.status}</span>
                          <span>{new Date(o.created_at).toLocaleDateString()}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </Card>

              {/* Active selected order details */}
              {selectedOrderId && selectedOrder && (
                <Card className="p-4 space-y-3 border border-emerald-500/20 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm rounded-2xl">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <h4 className="font-bold text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Order Items</h4>
                    <button
                      onClick={() => setSelectedOrderId(null)}
                      className="text-slate-400 hover:text-slate-600 text-[10px] font-bold border-0 bg-transparent cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  
                  <div className="text-[11px] space-y-2">
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                      {selectedOrder.items?.map((item: any) => (
                        <div key={item.id} className="flex justify-between font-medium">
                          <span className="text-slate-700 dark:text-slate-300">{item.product_name} x {item.quantity}</span>
                          <span className="font-bold text-slate-900 dark:text-white">₹{item.unit_price * item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    <hr className="border-slate-100 dark:border-slate-800" />
                    
                    {/* Return Action block if there is a pending return */}
                    {activeOrderReturn ? (
                      <div className="bg-amber-500/10 border border-amber-300 dark:border-amber-900/60 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-350 font-black uppercase text-[9px]">
                          <AlertTriangle className="w-3.5 h-3.5" /> Return Requested
                        </div>
                        <p className="text-[10px] text-slate-600 dark:text-amber-400 font-medium">Reason: &ldquo;{activeOrderReturn.reason}&rdquo;</p>
                        <div className="flex gap-2 pt-1">
                          <Button
                            onClick={() => approveReturnMutation.mutate(activeOrderReturn.id)}
                            disabled={approveReturnMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-550 text-white font-extrabold text-[9px] py-1.5 px-3 rounded-lg border-0 cursor-pointer shadow-sm"
                          >
                            Approve Return
                          </Button>
                          <Button
                            onClick={() => rejectReturnMutation.mutate(activeOrderReturn.id)}
                            disabled={rejectReturnMutation.isPending}
                            variant="secondary"
                            className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-extrabold text-[9px] py-1.5 px-3 rounded-lg border-0 cursor-pointer shadow-sm"
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center py-2 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-100 dark:border-slate-800">
                        No active return requests
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <div className="py-20 text-center text-slate-400 text-xs font-semibold">Select a support ticket first.</div>
          )}
        </div>
      </div>

      {/* REASSIGN AGENT MODAL */}
      {reassignModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <ArrowRightLeft className="w-5 h-5 text-emerald-500" /> Reassign Support Ticket
              </h3>
              <p className="text-xs text-slate-500 mt-1">Escalate or transfer ticket responsibilities to another support agent.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-450 uppercase">Select Available Agent</label>
              <select
                value={selectedReassignAgentId}
                onChange={e => setSelectedReassignAgentId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-xs focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              >
                <option value="">-- Choose Agent --</option>
                {agentsData.map((agent: any) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.first_name} {agent.last_name} ({agent.is_available ? "Online" : "Offline"})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                onClick={() => setReassignModalOpen(false)}
                variant="secondary"
                className="border border-slate-200 dark:border-slate-800 text-slate-655 dark:text-white font-extrabold text-xs px-4 py-2.5 rounded-xl bg-transparent hover:bg-slate-100"
              >
                Cancel
              </Button>
              <Button
                onClick={() => reassignMutation.mutate()}
                disabled={reassignMutation.isPending || !selectedReassignAgentId}
                className="bg-emerald-600 hover:bg-emerald-550 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl border-0 shadow cursor-pointer"
              >
                Transfer Ticket
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* REFUND REQUEST MODAL */}
      {refundModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-5 h-5 text-emerald-500" /> Wallet Refund
              </h3>
              <p className="text-xs text-slate-500 mt-1">Issue a direct credit refund to the client&apos;s wallet balance.</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-450 uppercase">Refund Amount (₹)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={refundAmount}
                  onChange={e => setRefundAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-xs focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-455 uppercase">Reason / Notes</label>
                <textarea
                  placeholder="Items spoiled, incorrect weight, damaged packaging..."
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-xs focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white resize-none h-16"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                onClick={() => setRefundModalOpen(false)}
                variant="secondary"
                className="border border-slate-200 dark:border-slate-800 text-slate-655 dark:text-white font-extrabold text-xs px-4 py-2.5 rounded-xl bg-transparent hover:bg-slate-100"
              >
                Cancel
              </Button>
              <Button
                onClick={() => refundMutation.mutate()}
                disabled={refundMutation.isPending || !refundAmount}
                className="bg-emerald-600 hover:bg-emerald-550 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl border-0 shadow cursor-pointer"
              >
                Process Refund
              </Button>
            </div>
          </div>
        </div>
      )}
    </AgentLayout>
  );
}
