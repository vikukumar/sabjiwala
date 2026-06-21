"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, User, Bot, HelpCircle } from "lucide-react";

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
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [faqs, setFaqs] = useState<FAQCategory[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

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

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 z-50 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
      >
        <MessageSquare className="w-6 h-6" />
      </button>

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
          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
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
          
          {/* FAQ Bot Options */}
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

        {/* Input */}
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
      </div>
    </>
  );
}
