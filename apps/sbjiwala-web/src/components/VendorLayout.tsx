"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ShoppingBag, TrendingUp, MapPin, Settings, LogOut,
  Clock, Menu, X, Loader2, IndianRupee, BarChart2, Bell, Navigation,
  Phone, Mic, Square, Radio
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, useWebSocket, initStreamCall, startStreamCall, endStreamCall, rejectStreamCall, isStreamCallAvailable } from "@sbjiwala/shared";
import versionInfo from "../app/version.json";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import Link from "next/link";

export const resolveVendorLink = (href: string) => {
  const isUnified = process.env.NEXT_PUBLIC_APP_MODE === "unified";
  if (isUnified) {
    if (href === "/") return "/vendor";
    if (href.startsWith("/vendor")) return href;
    return `/vendor${href}`;
  } else {
    if (href === "/vendor") return "/";
    if (href.startsWith("/vendor/")) return href.substring(7);
  }
  return href;
};

interface VendorLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function VendorLayout({ children, title = "Vendor Portal" }: VendorLayoutProps) {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  const { data: publicSettings } = useQuery<any>({
    queryKey: ["publicSettings"],
    queryFn: async () => {
      const res = await api.get("/installation/public-settings");
      return res.data?.data || res.data || {};
    },
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const primaryColor = publicSettings?.app_primary_color || "#059669";

    let styleTag = document.getElementById("dynamic-vendor-brand-styles");
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "dynamic-vendor-brand-styles";
      document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = `
      :root {
        --primary-brand-color: ${primaryColor};
        --emerald-600: ${primaryColor};
        --emerald-500: ${primaryColor};
        --emerald-750: ${primaryColor};
        --emerald-700: ${primaryColor};
      }
      .bg-emerald-600 { background-color: var(--primary-brand-color) !important; }
      .text-emerald-600 { color: var(--primary-brand-color) !important; }
      .hover\\:bg-emerald-600:hover { background-color: var(--primary-brand-color) !important; }
      .hover\\:text-emerald-600:hover { color: var(--primary-brand-color) !important; }
      .bg-emerald-500 { background-color: var(--primary-brand-color) !important; }
      .text-emerald-505 { color: var(--primary-brand-color) !important; }
      .text-emerald-500 { color: var(--primary-brand-color) !important; }
      .border-emerald-500 { border-color: var(--primary-brand-color) !important; }
      .focus\\:border-emerald-500:focus { border-color: var(--primary-brand-color) !important; }
      .bg-emerald-100 { background-color: var(--primary-brand-color)1a !important; }
      .text-emerald-700 { color: var(--primary-brand-color) !important; }
    `;
  }, [publicSettings]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sw_access_token") : null;
    if (!token) {
      const loginUrl = resolveVendorLink("/login");
      router.replace(loginUrl);
      return;
    }
    setIsAuthed(true);
  }, [router]);

  const { data: vendorOrders = [] } = useQuery<any[]>({
    queryKey: ["vendorOrders"],
    queryFn: async () => {
      const res = await api.get("/orders");
      return res.data || [];
    },
    enabled: !!isAuthed,
    refetchInterval: 10000, // Poll every 10 seconds to keep live
  });

  const { sendMessage } = useWebSocket((message) => {
    const { type, data } = message;
    if (type === "order_status_update") {
      queryClient.invalidateQueries({ queryKey: ["vendorOrders"] });
      queryClient.invalidateQueries({ queryKey: ["vendorMetrics"] });
      if (data?.status === "confirmed" || data?.status === "assigned") {
        success("New Order! 🔔", `Order #${data?.order_number || ""} received. Click to Accept.`);
      }
    } else if (type === "call_answer") {
      stopCallerTune();
      handleCallAnswer(data.sdp, data.sender_id);
    } else if (type === "call_disconnected") {
      stopCallerTune();
      if (isStreamCallAvailable()) endStreamCall();
      cleanupWebRTC();
      setCallStatus("idle");
      success("Call Ended", "Voice support session closed.");
    } else if (type === "call_rejected") {
      stopCallerTune();
      if (isStreamCallAvailable()) endStreamCall();
      if (data.reason === "no_agents_available") {
        setCallStatus("ivr");
        setIvrMessage("All support agents are busy. Please select automated options or leave a voicemail:");
      }
    } else if (type === "ice_candidate") {
      if (rtcConnRef.current && data.candidate) {
        rtcConnRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => console.warn(e));
      }
    }
  }, !!isAuthed);

  const [callStatus, setCallStatus] = useState<"idle" | "dialing" | "connected" | "ivr" | "voicemail">("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [ivrMessage, setIvrMessage] = useState("");
  const [isRecordingVoicemail, setIsRecordingVoicemail] = useState(false);
  const rtcConnRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const tuneIntervalRef = useRef<any>(null);
  const callTimerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const playCallerTune = (role: string) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const playMelody = () => {
        let notes = [293.66, 349.23, 440.00, 587.33];
        let speed = 180;
        notes.forEach((freq, idx) => {
          setTimeout(() => {
            if (callStatus !== "dialing" && tuneIntervalRef.current) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = "sine";
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

  const initiateCall = async () => {
    const callId = "support_vendor_" + (vendorProfile?.id || "vendor") + "_" + Date.now();
    
    let nativeSuccess = false;
    if (isStreamCallAvailable()) {
      nativeSuccess = await startStreamCall(callId, "audio");
    }

    if (nativeSuccess) {
      setCallStatus("connected");
    } else {
      setCallStatus("dialing");
      playCallerTune("vendor");
    }

    sendMessage({
      type: "call_initiate",
      data: {
        caller_name: businessName,
        caller_phone: vendorProfile?.contact_phone || "",
        stream_call_id: nativeSuccess ? callId : undefined
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
      const audio = document.getElementById("vendorRemoteAudio") as HTMLAudioElement;
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
    if (isStreamCallAvailable()) {
      endStreamCall();
    }
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

  const startRecordingVoicemail = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const audioUrl = URL.createObjectURL(audioBlob);
        sendMessage({
          type: "call_voicemail",
          data: {
            audio_url: audioUrl,
            caller_name: businessName
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

  const handleIvrOption = (option: number) => {
    if (option === 1) {
      setIvrMessage("Payout schedule: Vendor payouts are processed automatically every Monday morning at 08:00 AM.");
    } else if (option === 2) {
      setIvrMessage("Commission policy: Sbjiwala operates at 0% commission cartels to empower street vendors.");
    } else if (option === 3) {
      setCallStatus("voicemail");
    }
  };

  // Geolocation tracking for active self-delivery orders
  useEffect(() => {
    if (!isAuthed) return;
    
    // Check if there are active self-delivery orders that are out_for_delivery
    const activeSelfDeliveries = (vendorOrders || []).filter(
      (order: any) =>
        order.status === "out_for_delivery" &&
        order.metadata_json?.delivery_option === "self"
    );

    if (activeSelfDeliveries.length === 0) return;

    let watchId: number | null = null;
    
    if (typeof window !== "undefined" && navigator.geolocation) {
      const handleLocationUpdate = (position: GeolocationPosition) => {
        activeSelfDeliveries.forEach((order: any) => {
          sendMessage({
            type: "location_update",
            data: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              speed: position.coords.speed || 5,
              heading: position.coords.heading || 0,
              order_id: order.id
            }
          });
        });
      };

      // Send initial position immediately
      navigator.geolocation.getCurrentPosition(handleLocationUpdate, (err) => {
        console.warn("Initial Geolocation fetch error:", err);
      }, { enableHighAccuracy: true });

      // Start watching position
      watchId = navigator.geolocation.watchPosition(
        handleLocationUpdate,
        (error) => {
          console.warn("Geolocation tracking error", error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 10000
        }
      );
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [vendorOrders, isAuthed, sendMessage]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDark = document.documentElement.classList.contains("dark") || localStorage.getItem("sw_theme") === "dark";
      setTheme(isDark ? "dark" : "light");
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("sw_theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("sw_access_token");
    localStorage.removeItem("sw_refresh_token");
    const loginUrl = resolveVendorLink("/login");
    if (typeof window !== "undefined" && (window as any).Capacitor) {
      window.location.href = loginUrl;
    } else {
      router.replace(loginUrl);
    }
  };

  const { data: vendorProfileData } = useQuery<any>({
    queryKey: ["vendorProfile"],
    queryFn: async () => {
      const res = await api.get("/vendors/me");
      return res.data;
    },
    enabled: !!isAuthed
  });

  const { data: userProfile } = useQuery<any>({
    queryKey: ["currentUserProfile"],
    queryFn: async () => {
      const res = await api.get("/users/me");
      return res.data;
    },
    enabled: !!isAuthed
  });

  useEffect(() => {
    if (userProfile) {
      initStreamCall(userProfile).catch((err: any) => console.warn("Failed to init StreamCall:", err));
    }
  }, [userProfile]);

  // Initialize push notifications on authentication
  useEffect(() => {
    if (isAuthed) {
      import("@sbjiwala/shared").then(({ initPushNotifications }) => {
        initPushNotifications().catch(err => console.warn("Failed to init push notifications:", err));
      });
    }
  }, [isAuthed]);

  const vendorProfile = vendorProfileData || null;
  const businessName = vendorProfile?.business_name || "Green Grocers Ltd";
  const vendorStatus = vendorProfile?.status || "pending";

  const getActiveTab = () => {
    if (typeof window === "undefined") return "dashboard";
    const path = window.location.pathname;
    if (path.includes("/orders")) return "orders";
    if (path.includes("/inventory")) return "inventory";
    if (path.includes("/earnings")) return "earnings";
    if (path.includes("/analytics")) return "analytics";
    if (path.includes("/location")) return "location";
    if (path.includes("/notifications")) return "notifications";
    if (path.includes("/profile")) return "profile";
    return "dashboard";
  };

  const activeTab = getActiveTab();

  if (isAuthed === null) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#090d10] flex flex-col items-center justify-center space-y-6">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 w-32 h-32 rounded-full border-[3px] border-slate-800 animate-ping opacity-20" style={{ animationDuration: '2s' }} />
          <div className="w-28 h-28 rounded-[2rem] bg-gradient-to-tr from-emerald-600/20 to-teal-500/20 backdrop-blur-md border border-emerald-500/30 flex items-center justify-center p-4 shadow-[0_0_80px_rgba(16,185,129,0.25)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite]" />
            <img 
              src={publicSettings?.app_logo_url || "/icon.png"} 
              alt="Vendor Portal" 
              className="w-full h-full object-contain drop-shadow-2xl animate-pulse" 
              style={{ animationDuration: '2.5s' }}
              onError={(e) => { e.currentTarget.src = "/icon.png"; }} 
            />
          </div>
        </div>
        <div className="text-center space-y-3 mt-8">
          <h2 className="text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-emerald-100 to-emerald-400">
            SBJIWALA VENDOR
          </h2>
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-[0.3em]">Preparing Dashboard</p>
            <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full animate-[progress_1.5s_ease-in-out_infinite_alternate] w-1/2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: "dashboard", label: "Overview", icon: ShoppingBag, href: resolveVendorLink("/") },
    { id: "orders", label: "Orders Board", icon: Clock, href: resolveVendorLink("/orders") },
    { id: "inventory", label: "Inventory", icon: TrendingUp, href: resolveVendorLink("/inventory") },
    { id: "earnings", label: "Earnings", icon: IndianRupee, href: resolveVendorLink("/earnings") },
    { id: "analytics", label: "Analytics", icon: BarChart2, href: resolveVendorLink("/analytics") },
    { id: "location", label: "Store Location", icon: Navigation, href: resolveVendorLink("/location") },
    { id: "notifications", label: "Notifications", icon: Bell, href: resolveVendorLink("/notifications") },
    { id: "profile", label: "My Profile", icon: Settings, href: resolveVendorLink("/profile") },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between font-sans">
      <div className="space-y-6 flex flex-col h-[calc(100%-150px)]">
        <div className="flex items-center gap-2 flex-shrink-0">
          <img
            src={publicSettings?.app_logo_url || "/logo_horizontal.png"}
            alt={publicSettings?.app_name || "Logo"}
            className="h-6 w-auto object-contain brightness-0 invert"
            onError={(e) => { e.currentTarget.src = "/logo_horizontal.png"; }}
          />
          <span className="text-[10px] uppercase tracking-wider bg-slate-800 text-slate-450 font-bold px-2 py-0.5 rounded">
            Vendor
          </span>
        </div>

        {/* Scrollable sidebar menu area */}
        <nav className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isLocked = vendorStatus !== "approved" && !["dashboard", "inventory", "profile"].includes(item.id);

            if (isLocked) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => showError("Access Locked", "Complete KYC verification to unlock all features")}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-left font-medium text-sm text-slate-500 cursor-not-allowed hover:bg-slate-800/10 transition-all border-0 bg-transparent"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 opacity-45" />
                    <span className="opacity-50">{item.label}</span>
                  </div>
                  <span className="text-[10px]">🔒</span>
                </button>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left font-medium text-sm transition-all cursor-pointer ${
                  isActive ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/10" : "hover:bg-slate-850 hover:text-white text-slate-400"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 flex-shrink-0 pt-4 border-t border-slate-800">
        <div className="bg-slate-850 rounded-xl p-4 space-y-1 border border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase font-black">Logged in as</p>
          <h4 className="text-xs font-bold text-white truncate">{businessName}</h4>
          <span
            className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded cursor-pointer ${
              vendorStatus === "approved"
                ? "bg-emerald-500/10 text-emerald-400"
                : vendorStatus === "documents_submitted" || vendorStatus === "under_review"
                ? "bg-blue-500/10 text-blue-400"
                : "bg-rose-500/10 text-rose-400 hover:underline"
            }`}
            onClick={() => {
              if (vendorStatus !== "approved") router.push(resolveVendorLink("/kyc"));
            }}
          >
            {vendorStatus.toUpperCase()}
          </span>
        </div>
        <button
          onClick={initiateCall}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-xs hover:bg-emerald-950/20 text-emerald-400 hover:text-emerald-300 font-bold transition-all cursor-pointer border-0 bg-transparent"
        >
          <Phone className="w-4 h-4" />
          <span>Call Support</span>
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-xs hover:bg-rose-950/20 text-rose-400 hover:text-rose-300 font-bold transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
        <div className="text-center">
          <span className="text-[9px] text-slate-600 font-mono tracking-wider">
            Sbjiwala v{versionInfo.version}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 antialiased font-sans flex transition-colors duration-200">
      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[9999] flex md:hidden font-sans">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          {/* Drawer Content */}
          <aside className="relative w-64 max-w-xs bg-slate-900 text-slate-350 flex flex-col p-6 border-r border-slate-800 h-full">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="h-full">
              {sidebarContent}
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar (Not Scrollable, but Menu can scroll inside) */}
      <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col p-6 border-r border-slate-800 flex-shrink-0 h-full">
        {sidebarContent}
      </aside>

      {/* Main Layout (Only Inner Content Scrolls) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between shadow-sm transition-colors duration-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-2 md:hidden">
              <img
                src={publicSettings?.app_logo_url || "/logo_horizontal.png"}
                alt={publicSettings?.app_name || "Logo"}
                className="h-7 w-auto object-contain"
                onError={(e) => { e.currentTarget.src = "/logo_horizontal.png"; }}
              />
              <span className="text-[9px] uppercase bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold px-1.5 py-0.5 rounded-full">
                Vendor
              </span>
            </div>

            <h2 className="text-base md:text-lg font-black text-slate-800 dark:text-slate-100 hidden md:block">
              {title}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-450 bg-slate-105 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
              <span>Timings: 09:00 AM - 09:00 PM</span>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-655 dark:text-slate-350 hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-500/30"
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {theme === "light" ? (
                <span className="text-sm" role="img" aria-label="light mode">🍋</span>
              ) : (
                <span className="text-sm" role="img" aria-label="dark mode">🍆</span>
              )}
            </button>
          </div>
        </header>

        {/* Scrollable Content Container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {vendorStatus !== "approved" && (
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-amber-500/10 dark:from-amber-955/20 dark:to-amber-955/20 border border-amber-300 dark:border-amber-900/60 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm backdrop-blur-sm">
              <div className="space-y-0.5">
                <h4 className="text-xs font-black text-amber-800 dark:text-amber-350 flex items-center gap-1.5">
                  ⚠️ Action Required: KYC Pending
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-amber-400/80 leading-normal">
                  {vendorStatus === "rejected"
                    ? `Verification rejected: "${vendorProfile?.rejection_reason || 'Please upload valid documents'}"`
                    : vendorStatus === "documents_submitted" || vendorStatus === "under_review"
                    ? "Your verification documents are currently being reviewed by admin officers."
                    : "Your store profile is pending document verification. Please complete KYC."}
                </p>
              </div>
              {vendorStatus !== "documents_submitted" && vendorStatus !== "under_review" && (
                <Link
                  href={resolveVendorLink("/kyc")}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black px-4 py-2 rounded-xl transition-all shadow-sm flex-shrink-0"
                >
                  Verify Documents
                </Link>
              )}
            </div>
          )}
          {(() => {
            const isCurrentTabLocked = vendorStatus !== "approved" && !["dashboard", "inventory", "profile"].includes(activeTab) && (activeTab as string) !== "kyc";
            if (isCurrentTabLocked) {
              return (
                <div className="flex flex-col items-center justify-center text-center py-20 px-4 space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                  <div className="w-20 h-20 bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/20 rounded-3xl flex items-center justify-center">
                    <span className="text-4xl">🔒</span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">Feature Locked</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                    This section is locked until your store&apos;s KYC verification is completed and approved.
                  </p>
                  {vendorStatus !== "documents_submitted" && vendorStatus !== "under_review" && (
                    <Link href={resolveVendorLink("/kyc")}>
                      <button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer border-0">
                        Complete KYC Onboarding
                      </button>
                    </Link>
                  )}
                </div>
              );
            }
            return children;
          })()}
        </main>
      </div>
      
      {callStatus !== "idle" && (
        <div className="fixed bottom-6 right-6 z-50 w-80 bg-slate-900 border border-slate-800 text-white rounded-3xl p-5 shadow-2xl space-y-4 font-sans">
          <audio id="vendorRemoteAudio" autoPlay className="hidden" />
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
              <p className="text-xs font-bold animate-pulse text-emerald-400">Connecting to Support...</p>
              <p className="text-[9px] text-slate-500">Playing Sbjiwala Caller Tune</p>
              <button
                onClick={disconnectCall}
                className="w-full bg-rose-650 hover:bg-rose-600 text-white font-extrabold text-[10px] py-2.5 rounded-xl mt-2 cursor-pointer border-0"
              >
                Cancel Call
              </button>
            </div>
          )}

          {callStatus === "connected" && (
            <div className="text-center space-y-1">
              <p className="text-xs font-bold text-emerald-400">Support Connected</p>
              <p className="text-[9px] text-slate-500">Call is encrypted</p>
              <button
                onClick={disconnectCall}
                className="w-full bg-rose-650 hover:bg-rose-600 text-white font-extrabold text-[10px] py-2.5 rounded-xl mt-2 cursor-pointer border-0"
              >
                Hang Up
              </button>
            </div>
          )}

          {callStatus === "ivr" && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-350 leading-relaxed font-medium">{ivrMessage}</p>
              
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleIvrOption(1)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-[9px] py-2 px-1 rounded-lg border-0 cursor-pointer"
                >
                  Payouts Info
                </button>
                <button
                  onClick={() => handleIvrOption(2)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-[9px] py-2 px-1 rounded-lg border-0 cursor-pointer"
                >
                  Commission
                </button>
                <button
                  onClick={() => handleIvrOption(3)}
                  className="bg-emerald-600 hover:bg-emerald-550 text-white font-bold text-[9px] py-2 px-1 rounded-lg border-0 cursor-pointer"
                >
                  Voicemail
                </button>
              </div>

              <div className="text-center pt-1 border-t border-slate-800/80">
                <button
                  onClick={() => setCallStatus("idle")}
                  className="text-[10px] text-slate-500 hover:text-slate-400 font-bold uppercase tracking-wider bg-transparent border-0 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {callStatus === "voicemail" && (
            <div className="text-center space-y-3">
              <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Leave a Voicemail</p>
              <p className="text-[10px] text-slate-400">Record a voice memo and support agents will review it.</p>

              <div className="flex justify-center gap-3">
                {!isRecordingVoicemail ? (
                  <button
                    onClick={startRecordingVoicemail}
                    className="bg-emerald-600 hover:bg-emerald-550 text-white font-bold text-[10px] py-2 px-4 rounded-xl flex items-center gap-1.5 border-0 cursor-pointer shadow-md"
                  >
                    <Mic className="w-4 h-4" /> Start
                  </button>
                ) : (
                  <button
                    onClick={stopRecordingVoicemail}
                    className="bg-rose-650 hover:bg-rose-600 text-white font-bold text-[10px] py-2 px-4 rounded-xl flex items-center gap-1.5 border-0 cursor-pointer shadow-md"
                  >
                    <Square className="w-4 h-4" /> Save
                  </button>
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
    </div>
  );
}
