"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, User, Bot, HelpCircle, Phone, FileText, PhoneOff, Mic, Square } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, initStreamCall, startStreamCall, endStreamCall, isStreamCallAvailable } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/index";

interface ChatMessage {
  id: string;
  sender_type: "customer" | "agent" | "bot";
  message: string;
  created_at?: string;
}

interface FAQCategory {
  category_id: string;
  category_name: string;
  faqs: FAQ[];
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

export default function LiveChatWidget() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [faqs, setFaqs] = useState<FAQCategory[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // New states for Calling and Ticket
  const [viewMode, setViewMode] = useState<"chat" | "call" | "ticket">("chat");
  const [callStatus, setCallStatus] = useState<"idle" | "dialing" | "connected">("idle");
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<any>(null);
  const rtcConnRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && viewMode === "chat") {
      scrollToBottom();
    }
  }, [messages, isOpen, viewMode]);

  // Profile data for calling
  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("sw_access_token");
  const { data: profile } = useQuery<any>({
    queryKey: ["customerProfile"],
    queryFn: async () => {
      const res = await api.get("/users/me");
      return res.data;
    },
    enabled: hasToken && isOpen
  });

  useEffect(() => {
    if (profile) {
      initStreamCall(profile).catch((err: any) => console.warn("Failed to init StreamCall:", err));
    }
  }, [profile]);

  useEffect(() => {
    if (!isOpen) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    let token = localStorage.getItem("sw_access_token") || "";
    let guestId = localStorage.getItem("sw_guest_chat_id");
    if (!token && !guestId) {
      guestId = "guest_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("sw_guest_chat_id", guestId);
    }

    const sessionId = localStorage.getItem("sw_chat_session_id") || "";

    const connectWS = () => {
      let baseHost = window.location.host;
      let protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      
      const storedBaseUrl = localStorage.getItem('sw_api_base_url');
      if (storedBaseUrl && (storedBaseUrl.startsWith("http://") || storedBaseUrl.startsWith("https://"))) {
        const url = new URL(storedBaseUrl);
        baseHost = url.host;
        protocol = url.protocol === "https:" ? "wss:" : "ws:";
      }

      const wsUrl = `${protocol}//${baseHost}/api/v1/chat/ws?${token ? 'token='+token : 'guest_id='+guestId}${sessionId ? '&session_id='+sessionId : ''}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "agent_assigned") {
            setMessages(prev => [...prev, { id: Date.now().toString(), sender_type: "agent", message: data.message }]);
          } else if (data.type === "bot_greeting") {
            setMessages(prev => [...prev, { id: Date.now().toString(), sender_type: "bot", message: data.message }]);
            if (data.faqs) setFaqs(data.faqs);
          } else if (data.type === "chat_message") {
            setMessages(prev => [...prev, { id: Date.now().toString(), sender_type: data.sender_type, message: data.message }]);
          } else if (data.type === "bot_ticket_created") {
             setMessages(prev => [...prev, { id: Date.now().toString(), sender_type: "bot", message: data.message }]);
          } else if (data.type === "call_answer") {
             handleCallAnswer(data.sdp, data.sender_id);
          } else if (data.type === "call_disconnected" || data.type === "call_rejected") {
             if (isStreamCallAvailable()) endStreamCall();
             cleanupWebRTC();
             setCallStatus("idle");
             success("Call Ended", "Voice support session closed.");
          } else if (data.type === "ice_candidate") {
             if (rtcConnRef.current && data.candidate) {
               rtcConnRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => console.warn(e));
             }
          }
        } catch (e) {
          console.error(e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
      };
    };

    connectWS();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isOpen]);

  const sendMessage = (text: string = inputValue) => {
    if (!text.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    wsRef.current.send(JSON.stringify({ type: "chat", message: text }));
    setMessages(prev => [...prev, { id: Date.now().toString(), sender_type: "customer", message: text }]);
    setInputValue("");
  };

  // Calling Logic
  const initiateCall = async () => {
    if (!hasToken) {
      showError("Login Required", "Please login to call support.");
      return;
    }
    const callId = "support_" + (profile?.id || "user") + "_" + Date.now();
    let nativeSuccess = false;
    if (isStreamCallAvailable()) {
      nativeSuccess = await startStreamCall(callId, "audio");
    }

    if (nativeSuccess) {
      setCallStatus("connected");
    } else {
      setCallStatus("dialing");
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "call_initiate",
        caller_name: profile ? `${profile.first_name} ${profile.last_name}` : "Valued User",
        caller_phone: profile?.phone || "",
        stream_call_id: nativeSuccess ? callId : undefined
      }));
    }
  };

  const handleCallAnswer = async (sdp: any, agentId: string) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({ type: "ice_candidate", target_id: agentId, candidate: event.candidate }));
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
    callTimerRef.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);
  };

  const disconnectCall = () => {
    if (isStreamCallAvailable()) endStreamCall();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "call_hangup", target_id: "", duration: callDuration, status: "completed" }));
    }
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

  // Ticket creation
  const createTicketMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/support/tickets", {
        subject: ticketSubject,
        category: "general",
        description: ticketDescription
      });
      return res.data;
    },
    onSuccess: () => {
      success("Ticket Created", "Your support ticket has been submitted successfully.");
      setTicketSubject("");
      setTicketDescription("");
      setViewMode("chat");
    },
    onError: (err: any) => {
      showError("Failed", err.response?.data?.detail || "Could not create ticket");
    }
  });

  if (!mounted) return null;

  return (
    <>
      <audio id="customerRemoteAudio" autoPlay className="hidden" />
      
      {/* Tawk.to Style Floating Button */}
      <div className={`fixed bottom-6 right-6 z-[9999] flex flex-col items-end transition-all duration-300 ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}>
        {/* Welcome Bubble */}
        <div className="bg-white dark:bg-slate-900 shadow-xl rounded-2xl rounded-br-sm p-3 mb-4 mr-2 border border-slate-100 dark:border-slate-800 animate-bounce origin-bottom-right">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
            👋 Hi there! <br/>
            <span className="text-emerald-600 dark:text-emerald-400 font-black">We're online.</span> Need help?
          </p>
        </div>
        
        {/* Main Floating Button */}
        <button
          onClick={() => setIsOpen(true)}
          className="w-[60px] h-[60px] bg-gradient-to-tr from-emerald-600 to-teal-500 hover:scale-110 text-white rounded-[24px] rounded-br-[8px] shadow-[0_8px_30px_rgb(16,185,129,0.3)] flex items-center justify-center transition-all duration-300 group"
        >
          {/* Custom Branding Icon replacing standard MessageSquare */}
          <svg className="w-8 h-8 group-hover:animate-wiggle" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.5 4.5H3.5C2.39543 4.5 1.5 5.39543 1.5 6.5V16.5C1.5 17.6046 2.39543 18.5 3.5 18.5H7.5L12 22.5L16.5 18.5H20.5C21.6046 18.5 22.5 17.6046 22.5 16.5V6.5C22.5 5.39543 21.6046 4.5 20.5 4.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="8" cy="11.5" r="1.5" fill="currentColor"/>
            <circle cx="12" cy="11.5" r="1.5" fill="currentColor"/>
            <circle cx="16" cy="11.5" r="1.5" fill="currentColor"/>
          </svg>
          {/* Notification Dot */}
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse"></span>
        </button>
      </div>

      {/* Chat Window */}
      <div
        className={`fixed bottom-6 right-6 w-[350px] h-[550px] max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 transform origin-bottom-right z-50 border border-slate-200 dark:border-slate-800 ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 p-4 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-sm">Live Support</h3>
            <p className="text-[10px] text-emerald-100 flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
              {isConnected ? "Connected" : "Connecting..."}
            </p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setViewMode("chat")} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'chat' ? 'bg-white/20' : 'hover:bg-white/10'}`} title="Live Chat">
              <MessageSquare className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode("call")} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'call' ? 'bg-white/20' : 'hover:bg-white/10'}`} title="Call Support">
              <Phone className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode("ticket")} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'ticket' ? 'bg-white/20' : 'hover:bg-white/10'}`} title="Create Ticket">
              <FileText className="w-4 h-4" />
            </button>
            <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Areas */}
        {viewMode === "chat" && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                  <MessageSquare className="w-8 h-8 opacity-50" />
                  <p className="text-xs text-center px-4">Start a conversation and we'll connect you to an agent shortly.</p>
                </div>
              )}

              {messages.map((msg, idx) => {
                const isCustomer = msg.sender_type === "customer";
                return (
                  <div key={msg.id + idx} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${isCustomer ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-bl-sm'}`}>
                      {msg.message}
                    </div>
                  </div>
                );
              })}
              
              {faqs.length > 0 && messages[messages.length - 1]?.sender_type === "bot" && (
                <div className="space-y-2 mt-2">
                  <p className="text-xs text-slate-500 font-bold px-1 uppercase">Suggested FAQs</p>
                  {faqs.map(cat => (
                    <div key={cat.category_id} className="space-y-1.5">
                      {cat.faqs.map(faq => (
                        <button
                          key={faq.id}
                          onClick={() => {
                            setMessages(prev => [...prev, { id: faq.id+'_q', sender_type: "customer", message: faq.question }]);
                            setTimeout(() => {
                              setMessages(prev => [...prev, { id: faq.id+'_a', sender_type: "bot", message: faq.answer }]);
                            }, 500);
                          }}
                          className="block w-full text-left text-[11px] p-2.5 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 border border-slate-200 dark:border-slate-700 rounded-xl text-emerald-700 dark:text-emerald-400 transition-colors"
                        >
                          <span className="flex items-start gap-2">
                            <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            {faq.question}
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 bg-slate-100 dark:bg-slate-800 border-none px-4 py-2.5 rounded-full text-sm focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white outline-none"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || !isConnected}
                  className="w-10 h-10 shrink-0 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-colors shadow-md"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </form>
            </div>
          </>
        )}

        {viewMode === "call" && (
          <div className="flex-1 p-6 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center space-y-6">
            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Phone className="w-10 h-10" />
            </div>
            
            <div className="text-center space-y-2">
              <h4 className="font-bold text-lg text-slate-900 dark:text-white">Call Support Agent</h4>
              {callStatus === "idle" && <p className="text-sm text-slate-500">Connect instantly over an encrypted internet call.</p>}
              {callStatus === "dialing" && <p className="text-sm text-emerald-500 font-bold animate-pulse">Dialing agent...</p>}
              {callStatus === "connected" && <p className="text-sm text-emerald-500 font-bold">Connected ({Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, '0')})</p>}
            </div>

            {callStatus === "idle" ? (
              <Button onClick={initiateCall} size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                Start Voice Call
              </Button>
            ) : (
              <Button onClick={disconnectCall} size="lg" className="w-full bg-rose-600 hover:bg-rose-700 text-white">
                End Call
              </Button>
            )}
          </div>
        )}

        {viewMode === "ticket" && (
          <div className="flex-1 p-5 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
            <h4 className="font-bold text-slate-900 dark:text-white mb-4">Submit a Support Ticket</h4>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Subject</label>
                <input
                  type="text"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="E.g., Missing items in order"
                  className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
                <textarea
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                  placeholder="Please describe your issue in detail..."
                  rows={6}
                  className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none text-slate-900 dark:text-white"
                />
              </div>
              <Button
                onClick={() => createTicketMutation.mutate()}
                loading={createTicketMutation.isPending}
                disabled={!ticketSubject.trim() || !ticketDescription.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl mt-4"
              >
                Submit Ticket
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
