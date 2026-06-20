"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useWebSocket } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import {
  MessageSquare, X, Send, Phone, PhoneOff, Mic, Square,
  Radio, Play, HelpCircle, Check, ShieldAlert, Award
} from "lucide-react";
import { Button, Card } from "@/components/ui/index";

export default function CustomerSupportWidget() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  // Call States
  const [callStatus, setCallStatus] = useState<"idle" | "dialing" | "connected" | "ivr" | "voicemail">("idle");
  const [isRecordingVoicemail, setIsRecordingVoicemail] = useState(false);
  const [ivrMessage, setIvrMessage] = useState("");
  const [callDuration, setCallDuration] = useState(0);

  // Audio / WebRTC Refs
  const rtcConnRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const tuneIntervalRef = useRef<any>(null);
  const callTimerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Check auth
  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("sw_access_token");

  // Fetch ticket details
  const { data: tickets = [] } = useQuery<any[]>({
    queryKey: ["customerTickets"],
    queryFn: async () => {
      const res = await api.get("/support/tickets");
      return res.data || [];
    },
    enabled: hasToken && isOpen,
  });

  const { data: ticketDetail } = useQuery<any>({
    queryKey: ["customerTicketDetail", activeTicketId],
    queryFn: async () => {
      const res = await api.get(`/support/tickets/${activeTicketId}`);
      return res.data || null;
    },
    enabled: hasToken && !!activeTicketId,
    refetchInterval: 3000,
  });

  const { data: profile } = useQuery<any>({
    queryKey: ["customerProfile"],
    queryFn: async () => {
      const res = await api.get("/users/me");
      return res.data;
    },
    enabled: hasToken && isOpen
  });

  // Synthesize Client-Side Caller Tunes using Web Audio API
  const playCallerTune = (role: string) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // Generate arpeggios based on caller role
      const playMelody = () => {
        let notes = [261.63, 329.63, 392.00, 523.25]; // C major chords default
        let speed = 250;
        
        if (role === "vendor") {
          // Upbeat major pentatonic for vendors
          notes = [293.66, 349.23, 440.00, 587.33]; // D minor/F major
          speed = 180;
        } else if (role === "delivery_boy") {
          // Warning alert pulses for delivery
          notes = [329.63, 493.88]; // E / B
          speed = 300;
        }

        notes.forEach((freq, idx) => {
          setTimeout(() => {
            if (callStatus !== "dialing" && tuneIntervalRef.current) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = role === "delivery_boy" ? "triangle" : "sine";
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
            gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.2);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
            
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
          }, idx * speed);
        });
      };

      playMelody();
      tuneIntervalRef.current = setInterval(playMelody, 2000);
    } catch (e) {
      console.warn("Could not play synthesized caller tune:", e);
    }
  };

  const stopCallerTune = () => {
    if (tuneIntervalRef.current) {
      clearInterval(tuneIntervalRef.current);
      tuneIntervalRef.current = null;
    }
  };

  // WebSocket signaling receiver
  const { sendMessage } = useWebSocket((message) => {
    const { type, data } = message;
    
    if (type === "incoming_call") {
      // Customer is not expected to receive incoming agent calls in this widget layout, but handles just in case
    } else if (type === "call_rejected") {
      stopCallerTune();
      if (data.reason === "no_agents_available") {
        setCallStatus("ivr");
        setIvrMessage("All support agents are currently busy assisting other users. Please select automated assistance:");
      }
    } else if (type === "call_answer") {
      stopCallerTune();
      handleCallAnswer(data.sdp, data.sender_id);
    } else if (type === "call_disconnected") {
      stopCallerTune();
      cleanupWebRTC();
      setCallStatus("idle");
      success("Call Ended", "Voice support session closed.");
    } else if (type === "ice_candidate") {
      if (rtcConnRef.current && data.candidate) {
        rtcConnRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => {
          console.warn("ICE candidate error:", e);
        });
      }
    }
  }, hasToken && isOpen);

  // WebRTC handshakes
  const initiateCall = async () => {
    setCallStatus("dialing");
    const roleName = profile?.user_type || "customer";
    playCallerTune(roleName);

    // Send call initiation message
    sendMessage({
      type: "call_initiate",
      data: {
        caller_name: profile ? `${profile.first_name} ${profile.last_name}` : "Valued User",
        caller_phone: profile?.phone || ""
      }
    });
  };

  const handleCallAnswer = async (sdp: any, agentId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({
          type: "ice_candidate",
          data: { target_id: agentId, candidate: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      const audio = document.getElementById("customerRemoteAudio") as HTMLAudioElement;
      if (audio) {
        audio.srcObject = event.streams[0];
        audio.play().catch(() => {});
      }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    } catch (e) {
      console.warn("Failed to get audio stream:", e);
    }

    rtcConnRef.current = pc;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    
    setCallStatus("connected");
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const disconnectCall = () => {
    stopCallerTune();
    sendMessage({
      type: "call_hangup",
      data: {
        target_id: "",
        duration: callDuration,
        status: "completed"
      }
    });
    cleanupWebRTC();
    setCallStatus("idle");
  };

  const cleanupWebRTC = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (rtcConnRef.current) {
      rtcConnRef.current.close();
      rtcConnRef.current = null;
    }
  };

  // Voicemail Recording using MediaRecorder
  const startRecordingVoicemail = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        // Simulating upload to storage or converting to base64 / URL path
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Send voicemail notification to agent
        sendMessage({
          type: "call_voicemail",
          data: {
            audio_url: audioUrl,
            caller_name: profile ? `${profile.first_name} ${profile.last_name}` : "User"
          }
        });
        
        success("Voicemail Saved", "Your message was sent to the support agent.");
        setCallStatus("idle");
        setIsRecordingVoicemail(false);
      };

      mediaRecorder.start();
      setIsRecordingVoicemail(true);
    } catch (e) {
      showError("Mic Denied", "Mic access is needed to record a voicemail.");
    }
  };

  const stopRecordingVoicemail = () => {
    if (mediaRecorderRef.current && isRecordingVoicemail) {
      mediaRecorderRef.current.stop();
    }
  };

  // IVR Options handler
  const handleIvrOption = (option: number) => {
    if (option === 1) {
      setIvrMessage("Your latest order is packed and will be delivered shortly. Driver: Ramesh (9876543210).");
    } else if (option === 2) {
      setIvrMessage("Refund policy: Returns are approved instantly, and balances credit back to your wallet within 5 minutes.");
    } else if (option === 3) {
      setCallStatus("voicemail");
    }
  };

  // Submit Ticket message mutation
  const submitMessageMutation = useMutation({
    mutationFn: async () => {
      if (!activeTicketId) {
        // Create new ticket first
        const tRes = await api.post("/support/tickets", {
          subject: "Live Assistance Query",
          category: "general",
          description: inputText
        });
        const ticketId = tRes.data.ticket_id;
        setActiveTicketId(ticketId);
        return ticketId;
      } else {
        await api.post(`/support/tickets/${activeTicketId}/messages`, { message: inputText });
        return activeTicketId;
      }
    },
    onSuccess: () => {
      setInputText("");
      queryClient.invalidateQueries({ queryKey: ["customerTickets"] });
      queryClient.invalidateQueries({ queryKey: ["customerTicketDetail", activeTicketId] });
    }
  });

  if (!hasToken) return null;

  return (
    <div className="fixed bottom-24 right-6 md:bottom-8 md:right-8 z-50 font-sans">
      <audio id="customerRemoteAudio" autoPlay className="hidden" />

      {/* Floating Circle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-gradient-to-tr from-emerald-500 to-teal-650 rounded-full flex items-center justify-center text-white shadow-2xl animate-bounce-in cursor-pointer border-0 hover:scale-105 active:scale-95 transition-all"
          title="Live Customer Support"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {/* Chat Drawer Widget */}
      {isOpen && (
        <Card className="w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col h-[500px] overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-650 to-teal-600 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <h3 className="text-xs font-black uppercase">Live Support</h3>
                <p className="text-[9px] opacity-75">Ask queries or connect to agents</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {callStatus === "idle" && (
                <button
                  onClick={initiateCall}
                  className="p-2 rounded-full hover:bg-white/10 text-white border-0 bg-transparent cursor-pointer"
                  title="Call Support Agent"
                >
                  <Phone className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-full hover:bg-white/10 text-white border-0 bg-transparent cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* DYNAMIC CALL COMPONENT */}
          {callStatus !== "idle" && (
            <div className="bg-slate-900 text-white p-4 space-y-4 border-b border-slate-800">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">
                  {callStatus.toUpperCase()} Mode
                </span>
                {callStatus === "connected" && (
                  <span className="font-mono text-xs text-emerald-400 font-bold">
                    {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, "0")}
                  </span>
                )}
              </div>

              {callStatus === "dialing" && (
                <div className="text-center space-y-1">
                  <p className="text-xs font-bold animate-pulse text-emerald-400">Connecting to Support Agent...</p>
                  <p className="text-[10px] text-slate-500">Playing Sbjiwala Caller Tune</p>
                  <Button
                    onClick={disconnectCall}
                    className="bg-rose-650 hover:bg-rose-600 text-white font-extrabold text-[10px] py-1.5 px-4 rounded-lg mt-2 cursor-pointer border-0"
                  >
                    Cancel Call
                  </Button>
                </div>
              )}

              {callStatus === "connected" && (
                <div className="text-center space-y-1">
                  <p className="text-xs font-bold text-emerald-400">Agent Connected</p>
                  <p className="text-[10px] text-slate-500">Call is encrypted end-to-end</p>
                  <Button
                    onClick={disconnectCall}
                    className="bg-rose-650 hover:bg-rose-600 text-white font-extrabold text-[10px] py-1.5 px-4 rounded-lg mt-2 cursor-pointer border-0"
                  >
                    Hang Up
                  </Button>
                </div>
              )}

              {callStatus === "ivr" && (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-350 leading-relaxed font-medium">{ivrMessage}</p>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      onClick={() => handleIvrOption(1)}
                      className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-[9px] py-2 px-1 rounded-lg border-0 cursor-pointer"
                    >
                      Order Status
                    </Button>
                    <Button
                      onClick={() => handleIvrOption(2)}
                      className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-[9px] py-2 px-1 rounded-lg border-0 cursor-pointer"
                    >
                      Refund Policy
                    </Button>
                    <Button
                      onClick={() => handleIvrOption(3)}
                      className="bg-emerald-600 hover:bg-emerald-550 text-white font-bold text-[9px] py-2 px-1 rounded-lg border-0 cursor-pointer"
                    >
                      Voicemail
                    </Button>
                  </div>

                  <div className="text-center pt-1 border-t border-slate-800/80">
                    <button
                      onClick={() => setCallStatus("idle")}
                      className="text-[10px] text-slate-500 hover:text-slate-400 font-bold uppercase tracking-wider bg-transparent border-0 cursor-pointer"
                    >
                      Return to Chat
                    </button>
                  </div>
                </div>
              )}

              {callStatus === "voicemail" && (
                <div className="text-center space-y-3">
                  <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Leave a Voicemail</p>
                  <p className="text-[10px] text-slate-400">Record a voice memo and our agents will respond shortly.</p>

                  <div className="flex justify-center gap-3">
                    {!isRecordingVoicemail ? (
                      <Button
                        onClick={startRecordingVoicemail}
                        className="bg-emerald-600 hover:bg-emerald-550 text-white font-bold text-[10px] py-2 px-4 rounded-xl flex items-center gap-1.5 border-0 cursor-pointer shadow-md"
                      >
                        <Mic className="w-4 h-4" /> Start Recording
                      </Button>
                    ) : (
                      <Button
                        onClick={stopRecordingVoicemail}
                        className="bg-rose-650 hover:bg-rose-600 text-white font-bold text-[10px] py-2 px-4 rounded-xl flex items-center gap-1.5 border-0 cursor-pointer shadow-md"
                      >
                        <Square className="w-4 h-4" /> Save Voicemail
                      </Button>
                    )}
                  </div>

                  <div className="text-center pt-1 border-t border-slate-800/80">
                    <button
                      onClick={() => setCallStatus("idle")}
                      className="text-[10px] text-slate-500 hover:text-slate-400 font-bold uppercase tracking-wider bg-transparent border-0 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CHAT THREAD VIEW */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar bg-slate-50/30 dark:bg-slate-950/10">
            {!activeTicketId ? (
              tickets.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Previous tickets</p>
                  {tickets.map((t: any) => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTicketId(t.id)}
                      className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-[11px] font-bold text-slate-700 dark:text-slate-350 cursor-pointer"
                    >
                      <div className="flex justify-between font-mono text-[9px] text-slate-400">
                        <span>#{t.ticket_number}</span>
                        <span className="capitalize">{t.status}</span>
                      </div>
                      <p className="mt-1">{t.subject}</p>
                    </button>
                  ))}
                  <button
                    onClick={() => setActiveTicketId("new")}
                    className="w-full text-center py-2.5 rounded-xl border border-dashed border-emerald-500 text-emerald-600 text-[11px] font-bold cursor-pointer hover:bg-emerald-500/5 transition-all mt-4"
                  >
                    + Open New Live Help Chat
                  </button>
                </div>
              ) : (
                <div className="text-center py-24 space-y-2">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase">No live chats active</p>
                  <p className="text-[10px] text-slate-400 max-w-[200px] mx-auto leading-relaxed font-semibold">
                    Type a message below to start a live support ticket with our automation and agents.
                  </p>
                </div>
              )
            ) : activeTicketId === "new" ? (
              <div className="text-center py-20 space-y-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase">Opening new live chat</p>
                <p className="text-[10px] text-slate-455 max-w-[220px] mx-auto font-medium">
                  Type your query below. A live support ticket will be dispatched to available agents.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-850 pb-1">
                  <button
                    onClick={() => setActiveTicketId(null)}
                    className="text-[10px] text-slate-400 hover:text-slate-655 font-bold uppercase tracking-wider bg-transparent border-0 cursor-pointer"
                  >
                    ← All Tickets
                  </button>
                  <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-450 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {ticketDetail?.status || "open"}
                  </span>
                </div>

                {ticketDetail?.messages?.filter((m: any) => !m.is_internal).map((msg: any) => {
                  const isAgentSender = ["support_agent", "admin", "super_admin"].includes(msg.sender_type);
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] ${isAgentSender ? "mr-auto items-start" : "ml-auto items-end"}`}
                    >
                      <div className={`p-3 rounded-2xl text-[11px] font-medium leading-relaxed shadow-sm border ${
                        isAgentSender
                          ? "bg-slate-100 dark:bg-slate-850 border-slate-205 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-none"
                          : "bg-emerald-600 border-transparent text-white rounded-br-none"
                      }`}>
                        <p>{msg.message}</p>
                      </div>
                      <span className="text-[8px] text-slate-400 mt-0.5 font-mono">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Input field */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2 bg-white dark:bg-slate-900">
            <textarea
              placeholder="Describe your issue..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-xs focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white resize-none h-10"
            />
            <Button
              onClick={() => {
                if (activeTicketId === "new") {
                  setActiveTicketId(null);
                }
                submitMessageMutation.mutate();
              }}
              disabled={submitMessageMutation.isPending || !inputText}
              className="bg-emerald-650 hover:bg-emerald-600 text-white p-2.5 rounded-xl flex items-center justify-center cursor-pointer flex-shrink-0 border-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
