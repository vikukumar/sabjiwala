import React, { useState, useEffect, useRef } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { api } from "../api-client";

interface FloatingChatWidgetProps {
  appMode?: "customer" | "delivery" | "vendor" | "admin" | "unified";
}

export function FloatingChatWidget({ appMode = "customer" }: FloatingChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatStatus, setChatStatus] = useState<"connecting" | "waiting" | "active" | "bot" | "closed">("connecting");
  const [botFaqs, setBotFaqs] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isConnected, sendMessage } = useWebSocket((data) => {
    if (data.type === "agent_assigned") {
      setChatStatus("active");
      setMessages((prev) => [...prev, { id: Date.now().toString(), sender_type: "system", message: data.message }]);
    } else if (data.type === "bot_greeting") {
      setChatStatus("bot");
      setBotFaqs(data.faqs || []);
      setMessages((prev) => [...prev, { id: Date.now().toString(), sender_type: "bot", message: data.message }]);
    } else if (data.type === "chat_message") {
      setMessages((prev) => [...prev, { id: Date.now().toString(), sender_type: data.sender_type, message: data.message }]);
    } else if (data.type === "bot_ticket_created") {
      setMessages((prev) => [...prev, { id: Date.now().toString(), sender_type: "bot", message: data.message }]);
    }
  });

  useEffect(() => {
    if (isOpen && isConnected && chatStatus === "connecting") {
      setChatStatus("waiting");
    }
  }, [isOpen, isConnected, chatStatus]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage({ type: "chat_message", message: inputText.trim() });
    setMessages((prev) => [...prev, { id: Date.now().toString(), sender_type: "customer", message: inputText.trim() }]);
    setInputText("");
  };

  const handleFaqClick = (faq: any) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), sender_type: "customer", message: faq.question },
      { id: (Date.now() + 1).toString(), sender_type: "bot", message: faq.answer }
    ]);
  };

  // SVG Icons
  const ChatIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
  );

  const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
  );

  const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
  );

  const PhoneIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
  );

  const VideoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
  );

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
      {isOpen && (
        <div className="bg-white dark:bg-slate-900 w-[350px] h-[550px] max-h-[80vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col mb-4 overflow-hidden animate-scale-in origin-bottom-right">
          {/* Header */}
          <div className="bg-emerald-600 text-white p-4 flex justify-between items-center shadow-md">
            <div>
              <h3 className="font-black text-lg">Sabjiwala Support</h3>
              <p className="text-xs text-emerald-100 font-semibold flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-300 animate-pulse" : "bg-rose-400"}`}></span>
                {chatStatus === "bot" ? "Chatting with Bot" : chatStatus === "active" ? "Chatting with Agent" : "Connecting..."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {chatStatus === "active" && (
                <>
                  <button className="text-emerald-50 hover:text-white transition-colors" title="Voice Call"><PhoneIcon /></button>
                  <button className="text-emerald-50 hover:text-white transition-colors" title="Video Call"><VideoIcon /></button>
                </>
              )}
              <button onClick={() => setIsOpen(false)} className="text-emerald-50 hover:text-white transition-colors ml-1">
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.sender_type === "customer" ? "items-end" : "items-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                  msg.sender_type === "customer" 
                    ? "bg-emerald-600 text-white rounded-br-none" 
                    : msg.sender_type === "system" 
                      ? "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 self-center text-xs px-3 py-1 font-semibold rounded-full"
                      : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none shadow-sm border border-slate-100 dark:border-slate-700"
                }`}>
                  {msg.message}
                </div>
              </div>
            ))}

            {/* Bot FAQs */}
            {chatStatus === "bot" && botFaqs.length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-xs font-bold text-slate-400 uppercase ml-1">Suggested Topics</p>
                {botFaqs.map((cat: any) => (
                  <div key={cat.category_id} className="space-y-1.5">
                    {cat.faqs.map((faq: any) => (
                      <button 
                        key={faq.id} 
                        onClick={() => handleFaqClick(faq)}
                        className="block w-full text-left bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 text-xs font-semibold p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors shadow-sm"
                      >
                        {faq.question}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <div className="flex gap-2 relative">
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFaqClick}
                onKeyPress={(e) => { if (e.key === "Enter") handleSend(); }}
                placeholder="Type your message..."
                className="w-full bg-slate-100 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white transition-all outline-none"
                disabled={chatStatus === "connecting"}
              />
              <button 
                onClick={handleSend}
                disabled={!inputText.trim() || chatStatus === "connecting"}
                className="bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-xl shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[48px]"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(16,185,129,0.3)] transition-all transform hover:-translate-y-1 hover:scale-105 z-[100] group"
        >
          <div className="group-hover:animate-wiggle">
            <ChatIcon />
          </div>
          {/* Notification Dot */}
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-rose-500 border-2 border-white rounded-full"></span>
        </button>
      )}
    </div>
  );
}
