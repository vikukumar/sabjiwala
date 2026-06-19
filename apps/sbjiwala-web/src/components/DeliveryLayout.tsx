"use client";

import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import {
  Home, MapPin, History, IndianRupee, ArrowUpRight, User,
  ToggleLeft, ToggleRight, Loader2, Navigation, AlertCircle
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useRouter, usePathname } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

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
  const wsRef = useRef<WebSocket | null>(null);
  const triggeredProximityNotifs = useRef<Record<string, boolean>>({});

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
    const activeDelivery = assignments.find((a: any) => a.status === "out_for_delivery");
    if (simulationMode) {
      if (activeDelivery) {
        const storeLat = 19.0760; const storeLng = 72.9977;
        const customerLat = activeDelivery.delivery_address?.latitude || 19.0735;
        const customerLng = activeDelivery.delivery_address?.longitude || 72.9985;
        let step = 0;
        const interval = setInterval(() => {
          step = (step + 1) % 31;
          const ratio = step / 30;
          setGlobalPos([storeLat + (customerLat - storeLat) * ratio, storeLng + (customerLng - storeLng) * ratio]);
          setDistanceInfo(`${(2.4 * (1 - ratio)).toFixed(2)} km left to customer`);
        }, 3050);
        return () => clearInterval(interval);
      } else {
        const interval = setInterval(() => {
          setGlobalPos(([lat, lng]) => {
            const nl = lat + (Math.random() - 0.5) * 0.0003;
            const nn = lng + (Math.random() - 0.5) * 0.0003;
            if (Math.abs(nl - 19.0760) > 0.015 || Math.abs(nn - 72.9977) > 0.015) return [19.0760, 72.9977];
            return [nl, nn];
          });
          setDistanceInfo("Simulating GPS...");
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
    let ws: WebSocket; let reconnectTimeout: any;
    const connectWS = () => {
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
    connectWS();
    return () => { if (ws) ws.close(); if (reconnectTimeout) clearTimeout(reconnectTimeout); wsRef.current = null; };
  }, [isOnline]);

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

  return (
    <DeliveryContext.Provider value={{
      profile, isOnline, toggleOnline,
      globalPos, setGlobalPos,
      simulationMode, setSimulationMode,
      distanceInfo, setDistanceInfo,
      isProfileLoading
    }}>
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 antialiased font-sans flex flex-col transition-colors duration-200">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <span className="text-lg">🛵</span>
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 dark:text-white leading-none">Sbjiwala</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Delivery Partner</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Theme toggle */}
              <button onClick={toggleTheme}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:scale-105 transition-all cursor-pointer">
                <span className="text-sm">{theme === "light" ? "🌙" : "☀️"}</span>
              </button>
              {/* Online toggle */}
              <button onClick={() => toggleOnline(!isOnline)}
                disabled={toggleOnlineMutation.isPending}
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
        <main className="max-w-md w-full mx-auto px-4 py-4 space-y-4 flex-1 pb-24">
          {children}
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 safe-area-pb">
          <div className="max-w-md mx-auto flex">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const resolvedHref = resolveLink(item.href);
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(resolvedHref)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 relative transition-colors cursor-pointer ${
                    active
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? "stroke-[2.5]" : ""}`} />
                  <span className="text-[9px] font-bold">{item.label}</span>
                  {active && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Geolocation Request Modal */}
        {showPermissionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
            <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full animate-scale-in text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/40 rounded-2xl flex items-center justify-center mx-auto">
                <Navigation className="w-8 h-8 text-rose-600 dark:text-rose-400 animate-bounce" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Location Required 🛵</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Enable location to receive order assignments, navigate routes, and earn location-based incentives.
              </p>
              <button onClick={() => {
                if ("geolocation" in navigator) {
                  navigator.geolocation.getCurrentPosition(
                    () => { setShowPermissionModal(false); window.location.reload(); },
                    () => showError("Denied", "Enable location in browser settings.")
                  );
                }
              }} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-2xl text-sm transition-all cursor-pointer">
                Enable Location Access
              </button>
            </div>
          </div>
        )}
      </div>
    </DeliveryContext.Provider>
  );
}
