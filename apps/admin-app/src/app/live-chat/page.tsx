"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, User, Send, CheckCircle, Clock } from "lucide-react";
import { api } from "@sbjiwala/shared";

interface ChatSession {
  id: string;
  customer_id: string | null;
  guest_id: string | null;
  status: string;
  assigned_at: string;
}

interface ChatMessage {
  id: string;
  sender_type: "customer" | "agent" | "bot";
  message: string;
  created_at: string;
}

export default function LiveChatDashboard() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch active sessions assigned to this agent
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await api.get("/chat/sessions");
        if (res.data) setSessions(res.data);
      } catch (err) {
        console.error("Failed to fetch sessions", err);
      }
    };
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000); // Polling for new assignments
    return () => clearInterval(interval);
  }, []);

  // Connect WebSocket
  useEffect(() => {
    const token = localStorage.getItem("sw_access_token");
    if (!token) return;

    let baseHost = window.location.host;
    let protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    
    const storedBaseUrl = localStorage.getItem('sw_api_base_url');
    if (storedBaseUrl && (storedBaseUrl.startsWith("http://") || storedBaseUrl.startsWith("https://"))) {
      const url = new URL(storedBaseUrl);
      baseHost = url.host;
      protocol = url.protocol === "https:" ? "wss:" : "ws:";
    }

    const wsUrl = `${protocol}//${baseHost}/api/v1/chat/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_chat_assigned") {
          // A new chat was assigned
          api.get("/chat/sessions").then(res => {
            if (res.data) setSessions(res.data);
          });
        } else if (data.type === "chat_message") {
          // Only append if it belongs to the currently viewed session
          if (activeSession && data.session_id === activeSession.id) {
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              sender_type: data.sender_type,
              message: data.message,
              created_at: new Date().toISOString()
            }]);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };

    return () => {
      ws.close();
    };
  }, [activeSession]);

  // Load messages for selected session
  useEffect(() => {
    if (!activeSession) return;
    const fetchMessages = async () => {
      try {
        const res = await api.get(`/chat/sessions/${activeSession.id}/messages`);
        if (res.data) setMessages(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchMessages();
  }, [activeSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!inputValue.trim() || !activeSession) return;
    
    const postMessage = async () => {
      try {
        await api.post(`/chat/sessions/${activeSession.id}/messages`, {
          message: inputValue
        });
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          sender_type: "agent",
          message: inputValue,
          created_at: new Date().toISOString()
        }]);
        setInputValue("");
      } catch (e) {
        console.error("Failed to send", e);
      }
    };
    postMessage();
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 p-4 gap-4">
      {/* Left Pane - Chat Queue */}
      <div className="w-1/3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
        <div className="p-4 bg-emerald-600 text-white font-bold flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> Active Chats ({sessions.length})
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSession(s)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${activeSession?.id === s.id ? 'bg-emerald-50 border-emerald-500 dark:bg-emerald-900/30 dark:border-emerald-500' : 'bg-white border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700'}`}
            >
              <div className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                <User className="w-4 h-4" /> 
                {s.customer_id ? 'Registered User' : 'Guest'}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Waiting...
              </div>
            </button>
          ))}
          {sessions.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-sm">
              No active chats in your queue.
            </div>
          )}
        </div>
      </div>

      {/* Right Pane - Chat Window */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
        {activeSession ? (
          <>
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white">Chat #{activeSession.id.slice(0,8)}</h3>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Active</p>
              </div>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {messages.map((msg, i) => {
                const isAgent = msg.sender_type === "agent";
                return (
                  <div key={i} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-xl p-3 text-sm ${isAgent ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white'}`}>
                      {msg.message}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
               <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
                 <input 
                   type="text" 
                   value={inputValue}
                   onChange={e => setInputValue(e.target.value)}
                   placeholder="Type a message..."
                   className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2"
                 />
                 <button type="submit" disabled={!inputValue.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg disabled:opacity-50 flex items-center justify-center">
                   <Send className="w-5 h-5" />
                 </button>
               </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
            <p>Select a chat from the queue to start responding.</p>
          </div>
        )}
      </div>
    </div>
  );
}
