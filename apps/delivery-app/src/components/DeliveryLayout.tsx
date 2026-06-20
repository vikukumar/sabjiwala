"use client";

import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import {
  Home, MapPin, History, IndianRupee, ArrowUpRight, User,
  ToggleLeft, ToggleRight, Loader2, Navigation, AlertCircle, Menu, X
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useRouter, usePathname } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";

interface DeliveryContextType {
  profile: any;
  isOnline: boolean;
  toggleOnline: (online: boolean) => void;
  globalPos: [number, number];
  setGlobalPos: React.Dispatch<React.SetStateAction<[number, number]>>;
  simulationMode: boolean;
  setSimulationMode: (val: boolean) => void;
  distanceInfo: string;
  setDistanceInfo: (val: string) => void;
  isProfileLoading: boolean;
}

const DeliveryContext = createContext<DeliveryContextType | undefined>(undefined);

export function useDelivery() {
  const context = useContext(DeliveryContext);
  if (!context) throw new Error("useDelivery must be used within a DeliveryProvider");
  return context;
}

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();

  const [isOnline, setIsOnline] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [globalPos, setGlobalPos] = useState<[number, number]>([19.0760, 72.9977]);
  const [simulationMode, setSimulationMode] = useState(false);
  const [distanceInfo, setDistanceInfo] = useState<string>("Offline");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const triggeredProximityNotifs = useRef<Record<string, boolean>>({});
  const simStartPosRef = useRef<[number, number] | null>(null);

  // Capture recent location when entering simulation mode
  useEffect(() => {
    if (simulationMode) {
      if (!simStartPosRef.current) {
        simStartPosRef.current = globalPos;
      }
    } else {
      simStartPosRef.current = null;
    }
  }, [simulationMode, globalPos]);

  // 1. Get profile data
  const { data: profile, isLoading: isProfileLoading } = useQuery<any>({
    queryKey: ["deliveryProfile"],
    queryFn: async () => {
      const res = await api.get("/delivery/me");
      return res.data;
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
  });

  // Sync isOnline from backend profile
  useEffect(() => {
    if (profile) {
      setIsOnline(profile.availability !== "offline");
    }
  }, [profile]);

  // Auth Guard
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("sw_access_token")) {
      const isUnified = process.env.NEXT_PUBLIC_APP_MODE === "unified";
      router.replace(isUnified ? "/delivery/login" : "/login");
    }
  }, [router]);

  // Handle Theme
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDark = document.documentElement.classList.contains("dark") || localStorage.getItem("sw_theme") !== "light";
      setTheme(isDark ? "dark" : "light");
      document.documentElement.classList.toggle("dark", isDark);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("sw_theme", nextTheme);
    if (nextTheme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  };

  // Toggle availability mutation
  const toggleOnlineMutation = useMutation({
    mutationFn: async (online: boolean) => api.patch("/delivery/availability", { is_available: online }),
    onSuccess: (_, online) => {
      setIsOnline(online);
      queryClient.invalidateQueries({ queryKey: ["deliveryAssignments"] });
      queryClient.invalidateQueries({ queryKey: ["deliveryProfile"] });
      success(online ? "You are now ONLINE! 🛵" : "You are now OFFLINE.");
    },
    onError: (err: any) => showError("Error", err.response?.data?.detail || err.message)
  });

  const toggleOnline = (online: boolean) => {
    if (profile?.status !== "active") {
      showError("Access Denied", "Your KYC verification is incomplete. Please wait for admin approval.");
      return;
    }
    toggleOnlineMutation.mutate(online);
  };

  // Location permissions check (non-native only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isNative = !!(window as any).Capacitor;
    if (isNative) return;
    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" as any }).then((result) => {
        if (result.state !== "granted") setShowPermissionModal(true);
      }).catch(() => {});
    }
  }, []);

  // Fetch active assignments for distance/proximity checking
  const { data: assignments = [] } = useQuery<any[]>({
    queryKey: ["deliveryAssignments"],
    queryFn: async () => {
      const res = await api.get("/delivery/assignments");
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token") && isOnline,
    refetchInterval: 15000
  });

  // Haversine helper
  const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Proximity alerts check
  useEffect(() => {
    if (!isOnline || !assignments || assignments.length === 0) return;

    const activeOrder = assignments.find((a: any) =>
      ["assigned", "confirmed", "accepted", "packed", "picked", "out_for_delivery"].includes(a.status)
    );
    if (!activeOrder) return;

    const isPicked = ["picked", "out_for_delivery"].includes(activeOrder.status);
    let destLat = 0; let destLng = 0; let destName = ""; let typeKey = "";

    if (!isPicked && activeOrder.vendor_store) {
      destLat = activeOrder.vendor_store.latitude;
      destLng = activeOrder.vendor_store.longitude;
      destName = activeOrder.vendor_store.store_name || "Vendor Store";
      typeKey = `store-${activeOrder.id}`;
    } else if (isPicked) {
      destLat = activeOrder.delivery_latitude || activeOrder.delivery_address?.latitude || 19.0735;
      destLng = activeOrder.delivery_longitude || activeOrder.delivery_address?.longitude || 72.9985;
      destName = activeOrder.delivery_address?.full_name || "Customer";
      typeKey = `customer-${activeOrder.id}`;
    }

    if (destLat && destLng && !triggeredProximityNotifs.current[typeKey]) {
      const dist = getHaversineDistance(globalPos[0], globalPos[1], destLat, destLng);
      if (dist <= 0.2) { // 200 meters
        triggeredProximityNotifs.current[typeKey] = true;
        const title = isPicked ? "Location ke paas hain! 📍" : "Store ke paas hain! 🏪";
        const body = isPicked
          ? `Aap ${destName} ke address ke paas pahunch gaye hain. Order #${activeOrder.order_number} deliver karein.`
          : `Aap ${destName} ke paas pahunch gaye hain. Order #${activeOrder.order_number} collect karein.`;

        success(title, body);

        if (typeof window !== "undefined") {
          import("@capacitor/local-notifications").then(({ LocalNotifications }) => {
            LocalNotifications.schedule({
              notifications: [
                {
                  title,
                  body,
                  id: Math.floor(Math.random() * 100000),
                  schedule: { at: new Date(Date.now() + 50) }
                }
              ]
            }).catch(() => {});
          }).catch(() => {});
        }
      }
    }
  }, [globalPos, isOnline, assignments]);

  // GPS Tracking & Simulation
  useEffect(() => {
    if (!isOnline) { setDistanceInfo("Offline"); return; }
    const activeDelivery = assignments.find((a: any) =>
      ["assigned", "confirmed", "accepted", "packed", "picked", "out_for_delivery"].includes(a.status)
    );
    if (simulationMode) {
      if (activeDelivery) {
        const storeLat = activeDelivery.vendor_store?.latitude || 19.0760;
        const storeLng = activeDelivery.vendor_store?.longitude || 72.9977;
        const customerLat = activeDelivery.delivery_latitude || activeDelivery.delivery_address?.latitude || 19.0735;
        const customerLng = activeDelivery.delivery_longitude || activeDelivery.delivery_address?.longitude || 72.9985;
        const isPicked = ["picked", "out_for_delivery"].includes(activeDelivery.status);

        // Determine simulation start and destination
        let startLat: number;
        let startLng: number;
        let endLat: number;
        let endLng: number;
        let routeLabel = "";

        if (!isPicked) {
          // Travel to Store
          startLat = simStartPosRef.current?.[0] || 19.0700;
          startLng = simStartPosRef.current?.[1] || 72.9900;
          endLat = storeLat;
          endLng = storeLng;
          routeLabel = "store";
        } else {
          // Travel to Customer
          startLat = storeLat;
          startLng = storeLng;
          endLat = customerLat;
          endLng = customerLng;
          routeLabel = "customer";
        }

        let step = 0;
        const interval = setInterval(() => {
          step = (step + 1) % 31;
          const ratio = step / 30;
          const currentLat = startLat + (endLat - startLat) * ratio;
          const currentLng = startLng + (endLng - startLng) * ratio;
          setGlobalPos([currentLat, currentLng]);

          const totalDist = getHaversineDistance(startLat, startLng, endLat, endLng);
          const remainingDist = totalDist * (1 - ratio);
          setDistanceInfo(`Simulating: ${remainingDist.toFixed(2)} km left to ${routeLabel}`);
        }, 3000);
        return () => clearInterval(interval);
      } else {
        const startLat = simStartPosRef.current?.[0] || 19.0760;
        const startLng = simStartPosRef.current?.[1] || 72.9977;
        const interval = setInterval(() => {
          setGlobalPos(([lat, lng]) => {
            const nl = lat + (Math.random() - 0.5) * 0.0003;
            const nn = lng + (Math.random() - 0.5) * 0.0003;
            if (getHaversineDistance(nl, nn, startLat, startLng) > 1.5) return [startLat, startLng];
            return [nl, nn];
          });
          setDistanceInfo("Simulating GPS (idle)...");
        }, 4000);
        return () => clearInterval(interval);
      }
    } else {
      if (typeof window === "undefined" || !navigator.geolocation) return;
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setGlobalPos([pos.coords.latitude, pos.coords.longitude]);
          setDistanceInfo("Streaming live GPS...");
        },
        () => setDistanceInfo("GPS error"),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [simulationMode, isOnline, assignments]);

  // WebSocket
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sw_access_token") : null;
    if (!isOnline || !token || typeof window === "undefined") {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      return;
    }
    let ws: WebSocket;
    let reconnectTimeout: any;
    let capacitorListener: any = null;

    const connectWS = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
        return;
      }
      const apiBase = api.client.defaults.baseURL || "/api/v1";
      let baseHost = ""; let protocol = "ws:";
      if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
        const url = new URL(apiBase);
        baseHost = url.host; protocol = url.protocol === "https:" ? "wss:" : "ws:";
      } else {
        baseHost = window.location.host;
        protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      }
      ws = new WebSocket(`${protocol}//${baseHost}/ws?token=${token}`);
      wsRef.current = ws;
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "order_status_update") {
            queryClient.invalidateQueries({ queryKey: ["deliveryAssignments"] });
            let title = ""; let body = "";
            if (message.data?.status === "assigned") {
              title = "Naya Delivery Order Mila! 🛵";
              body = `Order #${message.data?.order_number || ""} aapko assign kiya gaya hai.`;
            } else if (message.data?.status === "packed") {
              title = "Order Pack Ho Gaya! 📦";
              body = `Order #${message.data?.order_number || ""} pickup ke liye ready hai.`;
            }
            if (title) {
              success(title, body);
              if (typeof window !== "undefined") {
                import("@capacitor/local-notifications").then(({ LocalNotifications }) => {
                  LocalNotifications.schedule({
                    notifications: [
                      {
                        title,
                        body,
                        id: Math.floor(Math.random() * 100000),
                        schedule: { at: new Date(Date.now() + 50) }
                      }
                    ]
                  }).catch(() => {});
                }).catch(() => {});
              }
            }
          }
        } catch (err) {
          console.error("Error parsing delivery WS message:", err);
        }
      };
      ws.onclose = () => { reconnectTimeout = setTimeout(connectWS, 5000); };
      ws.onerror = () => ws.close();
    };

    const handleResume = () => {
      console.log("Delivery WebSocket checking connection status...");
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connectWS();
      }
    };

    window.addEventListener("focus", handleResume);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        handleResume();
      }
    });

    if (typeof window !== "undefined" && (window as any).Capacitor?.Plugins?.App) {
      try {
        const App = (window as any).Capacitor.Plugins.App;
        App.addListener("appStateChange", (state: any) => {
          if (state.isActive) {
            handleResume();
          }
        }).then((listener: any) => {
          capacitorListener = listener;
        }).catch(() => {});
      } catch (err) {
        console.warn("Failed to attach Capacitor app state listener", err);
      }
    }

    connectWS();
    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      window.removeEventListener("focus", handleResume);
      document.removeEventListener("visibilitychange", handleResume);
      if (capacitorListener) capacitorListener.remove();
      wsRef.current = null;
    };
  }, [isOnline]);

  // Initialize Push Notifications
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sw_access_token") : null;
    if (token) {
      import("@sbjiwala/shared").then(({ initPushNotifications }) => {
        initPushNotifications().catch(err => console.warn("Failed to init push notifications:", err));
      });
    }
  }, [profile]);

  // Send location via WS and HTTP
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sw_access_token") : null;
    if (!token) return;

    const interval = setInterval(() => {
      api.post("/delivery/location", {
        latitude: globalPos[0],
        longitude: globalPos[1],
        accuracy: 10,
        speed: 5,
        heading: 0
      }).catch((err) => console.warn("HTTP location sync failed:", err));

      if (isOnline && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const activeDelivery = assignments?.find((a: any) => a.status === "out_for_delivery");
        wsRef.current.send(JSON.stringify({
          type: "location_update",
          data: {
            latitude: globalPos[0],
            longitude: globalPos[1],
            accuracy: 10,
            speed: 5,
            heading: 0,
            order_id: activeDelivery ? activeDelivery.id : null
          }
        }));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [globalPos, isOnline, assignments]);

  if (isProfileLoading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-450 animate-spin" />
      </div>
    );
  }

  const resolveLink = (href: string) => {
    const isUnified = process.env.NEXT_PUBLIC_APP_MODE === "unified";
    return isUnified ? `/delivery${href === "/" ? "" : href}` : href;
  };

  const navItems = [
    { href: "/", icon: Home, label: "Orders" },
    { href: "/stores", icon: MapPin, label: "Stores" },
    { href: "/history", icon: History, label: "History" },
    { href: "/earnings", icon: IndianRupee, label: "Earnings" },
    { href: "/payout", icon: ArrowUpRight, label: "Payout" },
    { href: "/profile", icon: User, label: "Profile" },
  ] as const;

  const isActive = (href: string) => {
    const resolved = resolveLink(href);
    if (href === "/") {
      return pathname === resolved || pathname === "/delivery";
    }
    return pathname === resolved || pathname.startsWith(resolved + "/");
  };

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between font-sans text-slate-300">
      <div className="space-y-6 flex flex-col h-[calc(100%-150px)]">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-lg">🛵</span>
          </div>
          <div>
            <p className="text-sm font-black text-white leading-none">Sbjiwala</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Delivery Partner</p>
          </div>
        </div>

        {/* Scrollable sidebar menu area */}
        <nav className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const resolvedHref = resolveLink(item.href);
            const isLocked = profile?.status !== "active" && !["/", "/profile"].includes(item.href);

            if (isLocked) {
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => showError("Access Locked", "Complete KYC verification to unlock all features")}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-left font-medium text-sm text-slate-550 cursor-not-allowed hover:bg-slate-800/10 transition-all border-0 bg-transparent"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 opacity-40" />
                    <span className="opacity-50">{item.label}</span>
                  </div>
                  <span className="text-[10px]">🔒</span>
                </button>
              );
            }

            return (
              <button
                key={item.href}
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  router.push(resolvedHref);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left font-medium text-sm transition-all cursor-pointer border-0 bg-transparent ${
                  active
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/10"
                    : "hover:bg-slate-800 hover:text-white text-slate-400"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 flex-shrink-0 pt-4 border-t border-slate-800">
        <div className="bg-slate-850 rounded-xl p-4 space-y-1.5 border border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase font-black">Agent Profile</p>
          <h4 className="text-xs font-bold text-white truncate">
            {profile?.full_name || profile?.phone || "Delivery Agent"}
          </h4>
          <span className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded ${
            profile?.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
          }`}>
            {(profile?.status || "PENDING").toUpperCase()}
          </span>
        </div>

        <button
          onClick={() => {
            localStorage.removeItem("sw_access_token");
            localStorage.removeItem("sw_refresh_token");
            const isUnified = process.env.NEXT_PUBLIC_APP_MODE === "unified";
            router.replace(isUnified ? "/delivery/login" : "/login");
          }}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-xs hover:bg-rose-950/20 text-rose-400 hover:text-rose-355 font-bold transition-all cursor-pointer border-0 bg-transparent"
        >
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <DeliveryContext.Provider value={{
      profile, isOnline, toggleOnline,
      globalPos, setGlobalPos,
      simulationMode, setSimulationMode,
      distanceInfo, setDistanceInfo,
      isProfileLoading
    }}>
      <div className="h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 antialiased font-sans flex transition-colors duration-200">
        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden font-sans">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            ></div>
            {/* Drawer Content */}
            <aside className="relative w-64 max-w-xs bg-slate-900 text-slate-350 flex flex-col p-6 border-r border-slate-800 h-full">
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white border-0 bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="h-full">
                {sidebarContent}
              </div>
            </aside>
          </div>
        )}

        {/* Desktop Sidebar */}
        <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col p-6 border-r border-slate-850 flex-shrink-0 h-full">
          {sidebarContent}
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm flex-shrink-0">
            <div className="w-full px-4 h-14 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* Mobile Menu Toggle Button */}
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="md:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border-0 bg-transparent cursor-pointer"
                >
                  <Menu className="w-6 h-6" />
                </button>

                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center md:hidden">
                    <span className="text-lg">🛵</span>
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 dark:text-white leading-none md:hidden">Sbjiwala</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider md:hidden">Delivery Partner</p>
                    <p className="text-sm font-black text-slate-800 dark:text-white leading-none hidden md:block">Delivery Agent Dashboard</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Theme toggle */}
                <button onClick={toggleTheme}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:scale-105 transition-all cursor-pointer border-0">
                  <span className="text-sm">{theme === "light" ? "🌙" : "☀️"}</span>
                </button>
                {/* Online toggle */}
                <button onClick={() => toggleOnline(!isOnline)}
                  disabled={toggleOnlineMutation.isPending || profile?.status !== "active"}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    isOnline
                      ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                  } disabled:opacity-50`}>
                  {isOnline
                    ? <><ToggleRight className="w-4 h-4" /> ONLINE</>
                    : <><ToggleLeft className="w-4 h-4" /> OFFLINE</>
                  }
                </button>
              </div>
            </div>
          </header>

          {/* Scrollable Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 pb-24 md:pb-6">
            {(() => {
              const isCurrentTabLocked = profile?.status !== "active" && !["/", "/profile"].includes(pathname) && !pathname.includes("/kyc");
              if (isCurrentTabLocked) {
                return (
                  <div className="flex flex-col items-center justify-center text-center py-20 px-4 space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                    <div className="w-20 h-20 bg-amber-500/10 dark:bg-amber-955/20 border border-amber-500/25 rounded-3xl flex items-center justify-center animate-bounce-in">
                      <span className="text-4xl">🔒</span>
                    </div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">Feature Locked</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                      This section is locked until your delivery agent KYC verification is completed and approved.
                    </p>
                    {profile?.status !== "documents_submitted" && profile?.status !== "under_review" && (
                      <Link href={resolveLink("/kyc")}>
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

          {/* Bottom Navigation (Mobile Only) */}
          <nav className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl bg-white/60 dark:bg-[#090d10]/60 border-t border-slate-200/40 dark:border-slate-800/80 safe-area-pb md:hidden rounded-t-[20px] shadow-lg">
            <div className="max-w-md mx-auto flex items-center justify-around h-16 px-1">
              {navItems.map((item) => {
                const active = isActive(item.href);
                const resolvedHref = resolveLink(item.href);
                const Icon = item.icon;
                const isLocked = profile?.status !== "active" && !["/", "/profile"].includes(item.href);
                return (
                  <button
                    key={item.href}
                    onClick={() => {
                      if (isLocked) {
                        showError("Access Locked", "Complete KYC verification to unlock all features");
                      } else {
                        router.push(resolvedHref);
                      }
                    }}
                    className={`relative flex flex-col items-center justify-center flex-1 h-full transition-all active:scale-95 border-0 bg-transparent ${
                      active
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-450 dark:text-slate-500"
                    }`}
                    aria-label={item.label}
                  >
                    <div className={active 
                      ? "w-11 h-11 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-[0_8px_20px_rgba(16,185,129,0.3)] -translate-y-5 border-4 border-slate-50 dark:border-[#090d10] transition-all duration-300 scale-110 relative overflow-hidden active-nav-shine"
                      : "relative p-1.5 rounded-xl transition-all"
                    }>
                      <Icon className="w-5 h-5" />
                    </div>
                    {!active && (
                      <span className="text-[10px] font-bold opacity-70">
                        {item.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>

        {/* Geolocation Request Modal */}
        {showPermissionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
            <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full animate-scale-in text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/40 rounded-2xl flex items-center justify-center mx-auto">
                <Navigation className="w-8 h-8 text-rose-600 dark:text-rose-455 animate-bounce" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Location Required 🛵</h3>
              <p className="text-xs text-slate-550 text-slate-500 dark:text-slate-400 leading-relaxed">
                Enable location to receive order assignments, navigate routes, and earn location-based incentives.
              </p>
              <button onClick={() => {
                if ("geolocation" in navigator) {
                  navigator.geolocation.getCurrentPosition(
                    () => { setShowPermissionModal(false); window.location.reload(); },
                    () => showError("Denied", "Enable location in browser settings.")
                  );
                }
              }} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-2xl text-sm transition-all cursor-pointer border-0">
                Enable Location Access
              </button>
            </div>
          </div>
        )}
      </div>
    </DeliveryContext.Provider>
  );
}
