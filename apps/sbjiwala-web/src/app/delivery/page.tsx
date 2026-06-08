"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Navigation, CheckCircle2, AlertCircle, ShoppingBag,
  MapPin, ToggleLeft, ToggleRight, DollarSign, Wallet, Loader2
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import versionInfo from "./version.json";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/index";

function OtpPromptModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  loading
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: (otp: string) => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  const [otp, setOtp] = useState("");
  useEffect(() => {
    if (isOpen) {
      setOtp("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-in text-center shadow-2xl text-slate-800 dark:text-white">
        <h3 className="text-base font-black uppercase tracking-wider">{title}</h3>
        <p className="text-xs text-slate-550 dark:text-slate-400 leading-normal">{message}</p>
        
        <div className="space-y-1.5">
          <input
            type="text"
            maxLength={4}
            pattern="[0-9]*"
            inputMode="numeric"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-full text-center tracking-[1.5em] pl-[1.5em] py-3 text-lg font-black border border-slate-200 dark:border-slate-800 rounded-2xl bg-transparent focus:outline-none focus:border-emerald-500"
            placeholder="••••"
            disabled={loading}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="primary"
            onClick={() => {
              if (otp.length === 4) {
                onConfirm(otp);
              }
            }}
            disabled={otp.length !== 4 || loading}
            loading={loading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold"
          >
            Verify & Deliver
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeliveryTrackingMap({
  order,
  currentPos,
  simulationMode,
  setSimulationMode,
  distanceInfo
}: {
  order: any;
  currentPos: [number, number];
  simulationMode: boolean;
  setSimulationMode: (val: boolean) => void;
  distanceInfo: string;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapObj, setMapObj] = useState<any>(null);

  const driverMarkerRef = useRef<any>(null);
  const pathLineRef = useRef<any>(null);

  // Leaflet map setup
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current || !order) return;

    let map: any = null;
    let active = true;

    import("leaflet").then((L) => {
      if (!active || !mapContainerRef.current) return;

      if ((mapContainerRef.current as any)._leaflet_id) {
        return;
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const customerLat = order.delivery_address?.latitude || 19.0735;
      const customerLng = order.delivery_address?.longitude || 72.9985;
      const storeLat = 19.0760;
      const storeLng = 72.9977;

      map = L.map(mapContainerRef.current!).setView([storeLat, storeLng], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
      }).addTo(map);

      const homeIcon = L.divIcon({
        html: '<div style="background:#ef4444;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🏠</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      L.marker([customerLat, customerLng], { icon: homeIcon }).addTo(map).bindPopup("Delivery Address");

      const storeIcon = L.divIcon({
        html: '<div style="background:#3b82f6;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🏪</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      L.marker([storeLat, storeLng], { icon: storeIcon }).addTo(map).bindPopup("Pickup Store");

      const hash = (order.id || "agent").split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
      const vehicleColors = ["#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#10b981", "#ff4500", "#1e90ff"];
      const color = vehicleColors[hash % vehicleColors.length];
      const vehicleType = order.delivery_agent?.vehicle_type || "scooty";
      const emoji = vehicleType === "scooty" ? "🛵" : vehicleType === "bike" ? "🏍️" : vehicleType === "truck" ? "🚚" : "🚲";

      const driverIcon = L.divIcon({
        html: `
          <div style="background:${color};width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3);position:relative;">
            ${emoji}
            <span style="position:absolute;bottom:-4px;width:12px;height:12px;background:#10b981;border:2px solid white;border-radius:50%;animation:ping 1s infinite;"></span>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const driverMarker = L.marker(currentPos, { icon: driverIcon }).addTo(map);
      driverMarkerRef.current = driverMarker;

      L.polyline([[storeLat, storeLng], [customerLat, customerLng]], { color: "#cbd5e1", weight: 2, dashArray: "4 4" }).addTo(map);
      pathLineRef.current = L.polyline([currentPos, [customerLat, customerLng]], { color: "#10b981", weight: 4 }).addTo(map);

      map.fitBounds([[storeLat, storeLng], [customerLat, customerLng]], { padding: [40, 40] });
      setMapObj(map);
    });

    return () => {
      active = false;
      if (map) map.remove();
    };
  }, [order]);

  useEffect(() => {
    if (mapObj && driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng(currentPos);
      if (pathLineRef.current && order) {
        const customerLat = order.delivery_address?.latitude || 19.0735;
        const customerLng = order.delivery_address?.longitude || 72.9985;
        pathLineRef.current.setLatLngs([currentPos, [customerLat, customerLng]]);
      }
    }
  }, [currentPos, mapObj, order]);

  return (
    <div className="space-y-3">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 flex-wrap gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
          <Navigation className="w-4 h-4 text-emerald-600 dark:text-emerald-450 animate-bounce" />
          <span>{distanceInfo}</span>
        </div>
        <button
          onClick={() => setSimulationMode(!simulationMode)}
          className={`px-3 py-1 rounded-xl font-bold transition-all border ${simulationMode
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            } cursor-pointer`}
        >
          {simulationMode ? "Simulated GPS 🛰️" : "Device GPS 📍"}
        </button>
      </div>

      <div ref={mapContainerRef} className="h-48 rounded-2xl border border-slate-200 dark:border-slate-800 relative shadow-inner overflow-hidden" style={{ zIndex: 1 }} />
    </div>
  );
}

export default function DeliveryAgentDashboard() {
  const { success, error: showError } = useToast();
  const [otpPromptConfig, setOtpPromptConfig] = useState<{ isOpen: boolean; orderId: string } | null>(null);
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const [globalPos, setGlobalPos] = useState<[number, number]>([19.0760, 72.9977]);
  const [simulationMode, setSimulationMode] = useState(true);
  const [distanceInfo, setDistanceInfo] = useState<string>("Offline");

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  // Check location permission on start
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isNative = !!(window as any).Capacitor;
    if (isNative) return;

    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" as any }).then((result) => {
        if (result.state !== "granted") {
          setShowPermissionModal(true);
        }
      }).catch(() => { });
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

  // Route Protection check
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("sw_access_token")) {
      window.location.href = "/delivery/login";
    }
  }, []);

  // Fetch active assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<any[]>({
    queryKey: ["deliveryAssignments"],
    queryFn: async () => {
      const res = await api.get("/delivery/assignments");
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // Fetch delivery boy profile
  const { data: profileData } = useQuery<any>({
    queryKey: ["deliveryProfile"],
    queryFn: async () => {
      const res = await api.get("/delivery/me");
      return res.data;
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // Global Geolocation / Simulation loop
  useEffect(() => {
    if (!isOnline) {
      setDistanceInfo("Offline");
      return;
    }

    const activeDelivery = assignments.find((a: any) => a.status === "out_for_delivery");

    if (simulationMode) {
      if (activeDelivery) {
        const storeLat = 19.0760;
        const storeLng = 72.9977;
        const customerLat = activeDelivery.delivery_address?.latitude || 19.0735;
        const customerLng = activeDelivery.delivery_address?.longitude || 72.9985;

        let step = 0;
        const totalSteps = 30;

        const interval = setInterval(() => {
          step = (step + 1) % (totalSteps + 1);
          const ratio = step / totalSteps;
          const lat = storeLat + (customerLat - storeLat) * ratio;
          const lng = storeLng + (customerLng - storeLng) * ratio;
          setGlobalPos([lat, lng]);

          const remainingRatio = 1 - ratio;
          const totalDist = 2.4;
          const remDist = (totalDist * remainingRatio).toFixed(2);
          setDistanceInfo(`${remDist} km left to customer address`);
        }, 3050);

        return () => clearInterval(interval);
      } else {
        const interval = setInterval(() => {
          setGlobalPos(([lat, lng]) => {
            const nextLat = lat + (Math.random() - 0.5) * 0.0003;
            const nextLng = lng + (Math.random() - 0.5) * 0.0003;
            if (Math.abs(nextLat - 19.0760) > 0.015 || Math.abs(nextLng - 72.9977) > 0.015) {
              return [19.0760, 72.9977];
            }
            return [nextLat, nextLng];
          });
          setDistanceInfo("Simulating background location updates...");
        }, 4000);

        return () => clearInterval(interval);
      }
    } else {
      if (typeof window === "undefined" || !navigator.geolocation) {
        setDistanceInfo("Device GPS not supported");
        return;
      }

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setGlobalPos([lat, lng]);

          if (activeDelivery) {
            const customerLat = activeDelivery.delivery_address?.latitude || 19.0735;
            const customerLng = activeDelivery.delivery_address?.longitude || 72.9985;
            const dist = Math.sqrt(Math.pow(lat - customerLat, 2) + Math.pow(lng - customerLng, 2)) * 111.3;
            setDistanceInfo(`${dist.toFixed(2)} km left to customer`);
          } else {
            setDistanceInfo("Streaming live background GPS position...");
          }
        },
        (error) => {
          console.error("GPS tracking error:", error);
          setDistanceInfo("GPS error: " + error.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [simulationMode, isOnline, assignments]);

  // Setup WebSocket connection globally when online
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sw_access_token") : null;
    if (!isOnline || !token || typeof window === "undefined") {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    let ws: WebSocket;
    let reconnectTimeout: any;

    const connectWS = () => {
      const apiBase = api.client.defaults.baseURL || "/api/v1";
      let baseHost = "";
      let protocol = "ws:";

      if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
        const url = new URL(apiBase);
        baseHost = url.host;
        protocol = url.protocol === "https:" ? "wss:" : "ws:";
      } else {
        baseHost = window.location.host;
        protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      }

      ws = new WebSocket(`${protocol}//${baseHost}/ws?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Global Delivery WebSocket connected");
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWS, 5000);
      };

      ws.onerror = (err) => {
        console.warn("Global Delivery WS connection error:", err);
        ws.close();
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      wsRef.current = null;
    };
  }, [isOnline]);

  // Stream current location updates to the WebSocket backplane every 4 seconds
  useEffect(() => {
    if (!isOnline || !wsRef.current) return;

    const interval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "location_update",
          data: {
            latitude: globalPos[0],
            longitude: globalPos[1],
            accuracy: 10,
            speed: 5,
            heading: 0,
            order_id: assignments.find((a: any) => a.status === "out_for_delivery")?.id || null
          }
        }));
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [globalPos, isOnline, assignments]);

  // Toggle Online/Offline Mutation
  const toggleOnlineMutation = useMutation({
    mutationFn: async (online: boolean) => {
      return api.patch("/delivery/availability", {
        is_available: online
      });
    },
    onSuccess: (_, online) => {
      setIsOnline(online);
      queryClient.invalidateQueries({ queryKey: ["deliveryAssignments"] });
    }
  });

  // Pickup Order Mutation
  const pickupOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return api.post(`/delivery/orders/${orderId}/pickup`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryAssignments"] });
      success("Order picked up successfully. It is now out for delivery!");
    },
    onError: (err: any) => {
      showError("Pickup Failed", "Pickup failed: " + (err.response?.data?.detail || err.message));
    }
  });

  // Deliver Order Mutation
  const deliverOrderMutation = useMutation({
    mutationFn: async ({ orderId, otp }: { orderId: string; otp: string }) => {
      return api.post(`/delivery/orders/${orderId}/deliver`, {
        order_id: orderId,
        otp: otp
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryAssignments"] });
      success("Order delivered successfully! Payment captured.");
      setOtpPromptConfig(null);
    },
    onError: (err: any) => {
      showError("Delivery Failed", "Delivery verification failed: " + (err.response?.data?.detail || err.message));
    }
  });

  const handleToggleOnline = () => {
    toggleOnlineMutation.mutate(!isOnline);
  };

  const handleUpdateStatus = (id: string, currentStatus: string) => {
    if (currentStatus === "assigned" || currentStatus === "packed" || currentStatus === "accepted") {
      pickupOrderMutation.mutate(id);
    } else {
      setOtpPromptConfig({ isOpen: true, orderId: id });
    }
  };

  const profile = profileData || null;
  const isPrivateCourier = !!profile?.vendor_id;
  const walletBalance = profile?.wallet_balance ?? 0.0;
  const cashInHand = profile?.cash_in_hand ?? 0.0;

  return (
    <div className="min-h-screen bg-slate-55 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 antialiased font-sans flex flex-col pb-8 transition-colors duration-200">
      {/* Top Banner */}
      <header className="sticky top-0 z-50 bg-emerald-600 dark:bg-slate-900 text-white shadow-md transition-colors duration-200">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo_horizontal.png" alt="Sbjiwala Logo" className="h-8 w-auto object-contain brightness-0 invert" />
            <span className="text-[10px] uppercase bg-emerald-700 dark:bg-emerald-950/80 text-white dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-full">
              Delivery
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Custom Theme Switcher */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-emerald-700/80 dark:bg-slate-800 text-white dark:text-slate-350 hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center justify-center border border-emerald-800/50 dark:border-slate-700"
              title={theme === "light" ? "Switch to Dark Soil Mode" : "Switch to Light Veggie Mode"}
            >
              {theme === "light" ? (
                <span className="text-sm" role="img" aria-label="light mode">🍋</span>
              ) : (
                <span className="text-sm" role="img" aria-label="dark mode">🍆</span>
              )}
            </button>

            {/* Toggle Online */}
            <button
              onClick={handleToggleOnline}
              disabled={toggleOnlineMutation.isPending}
              className="flex items-center gap-1.5 bg-emerald-700/80 dark:bg-slate-800 hover:bg-emerald-800 dark:hover:bg-slate-700 transition-colors px-3.5 py-1.5 rounded-full text-xs font-bold disabled:opacity-50 border border-emerald-800/50 dark:border-slate-700"
            >
              {isOnline ? (
                <>
                  <ToggleRight className="w-5 h-5 text-green-400" />
                  <span>ONLINE</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-5 h-5 text-slate-300 dark:text-slate-500" />
                  <span>OFFLINE</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-md w-full mx-auto px-4 py-6 space-y-6 flex-1">
        {/* Earnings Card - Hidden for private couriers */}
        {!isPrivateCourier ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800 transition-colors duration-200">
            <div className="pr-4 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Earnings Balance</span>
              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-black text-xl">
                <span className="text-sm font-bold">₹</span>
                <span>{walletBalance.toFixed(2)}</span>
              </div>
            </div>

            <div className="pl-4 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Cash In Hand</span>
              <div className="flex items-center gap-1 text-slate-900 dark:text-slate-50 font-black text-xl">
                <span className="text-sm font-bold">₹</span>
                <span>{cashInHand.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-300 dark:border-emerald-900/40 rounded-2xl p-4 shadow-sm flex items-center justify-between transition-colors duration-200">
            <div className="space-y-0.5">
              <h4 className="text-xs font-black text-emerald-700 dark:text-emerald-300">Linked Store Courier</h4>
              <p className="text-[10px] text-slate-550 dark:text-slate-455">Offline direct settlements with vendor</p>
            </div>
            <span className="text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded">
              Store Courier
            </span>
          </div>
        )}

        {/* Assignments Header */}
        <div className="flex justify-between items-center px-1">
          <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Active Deliveries ({assignments.length})</h3>
          {!isOnline && (
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-955/20 border border-amber-100 dark:border-amber-900/40 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Go Online to get orders
            </span>
          )}
        </div>

        {/* Assignments List */}
        <div className="space-y-4">
          {assignmentsLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
              <span className="text-sm text-slate-500 dark:text-slate-400 font-semibold">Checking assignments...</span>
            </div>
          ) : isOnline && assignments.length > 0 ? (
            assignments.map((task) => {
              const destAddr = task.delivery_address || {};
              const formattedAddr = destAddr.formatted_address ||
                `${destAddr.address_line_1 || ""}, ${destAddr.city || ""}`;

              return (
                <div key={task.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 transition-colors duration-200">
                  {/* Header */}
                  <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500">Order ID: #{task.order_number}</span>
                      <h4 className="font-extrabold text-slate-900 dark:text-slate-50">{destAddr.full_name || "Customer"}</h4>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${task.status === "assigned" || task.status === "packed"
                      ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400"
                      : "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400"
                      }`}>
                      {task.status}
                    </span>
                  </div>

                  {/* Route Details */}
                  <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-350">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5" />
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">Pickup Store:</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">Green Grocers Ltd</p>
                        <p className="text-slate-400 dark:text-slate-500">Sector 14, Vashi</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Navigation className="w-4 h-4 text-emerald-600 dark:text-emerald-450 mt-0.5" />
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">Delivery Address:</p>
                        <p className="text-slate-550 dark:text-slate-400">{formattedAddr}</p>
                      </div>
                    </div>
                  </div>

                  {/* Active Live Tracking Map */}
                  {task.status === "out_for_delivery" && (
                    <DeliveryTrackingMap
                      order={task}
                      currentPos={globalPos}
                      simulationMode={simulationMode}
                      setSimulationMode={setSimulationMode}
                      distanceInfo={distanceInfo}
                    />
                  )}

                  {/* Action details */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block uppercase">Collect Cash</span>
                      <span className="font-black text-slate-900 dark:text-slate-50 text-sm">
                        {task.payment_method === "cod" ? `₹${task.total_amount}` : "Prepaid (Online)"}
                      </span>
                    </div>

                    <button
                      onClick={() => handleUpdateStatus(task.id, task.status)}
                      disabled={pickupOrderMutation.isPending || deliverOrderMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50"
                    >
                      {task.status === "assigned" || task.status === "packed" || task.status === "accepted"
                        ? "Confirm Pickup"
                        : "Verify OTP & Deliver"}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-center text-slate-400 dark:text-slate-500 text-sm space-y-2 transition-colors duration-200">
              <ShoppingBag className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-650" />
              <p>{isOnline ? "No active assignments right now." : "You are currently offline. Toggle online to start receiving orders."}</p>
            </div>
          )}
        </div>
      </main>

      <footer className="text-center py-4 mt-8 border-t border-slate-200/50 dark:border-slate-850 transition-colors duration-200">
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
          Sbjiwala Delivery v{versionInfo.version}
        </span>
      </footer>

      {/* Geolocation Permission Request Modal */}
      {showPermissionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full animate-scale-in text-slate-800 dark:text-white space-y-4 shadow-2xl text-center">
            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 rounded-2xl flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto">
              <Navigation className="w-8 h-8 animate-bounce" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black tracking-tight">Location Access Required 🛵</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                As a delivery partner, sharing your live location is mandatory to receive order assignments, navigate maps, and receive payout credits.
              </p>
            </div>

            <div className="text-xs font-semibold text-slate-650 dark:text-slate-350 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 text-left">
              <p className="flex items-center gap-2">
                <span className="text-emerald-500">✔</span>
                <span>Receive push order assignments near you</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="text-emerald-500">✔</span>
                <span>Get step-by-step navigation routes to stores & homes</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="text-emerald-500">✔</span>
                <span>Earn mileage incentives and correct coordinates payouts</span>
              </p>
            </div>

            <button
              onClick={() => {
                if (typeof window !== "undefined" && "geolocation" in navigator) {
                  navigator.geolocation.getCurrentPosition(
                    () => {
                      setShowPermissionModal(false);
                      window.location.reload();
                    },
                    () => {
                      showError("Permission Denied", "Location permission was denied. Please enable location permissions in browser site settings.");
                    }
                  );
                }
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-2xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              Enable Location Access
            </button>

            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              Note: Geolocation permissions can be toggled any time in browser settings.
            </p>
          </div>
        </div>
      )}

      <OtpPromptModal
        isOpen={!!otpPromptConfig?.isOpen}
        title="Enter Delivery OTP"
        message="Please enter the 4-digit Delivery OTP provided by the customer to verify handover."
        loading={deliverOrderMutation.isPending}
        onConfirm={(otp) => {
          if (otpPromptConfig?.orderId) {
            deliverOrderMutation.mutate({ orderId: otpPromptConfig.orderId, otp });
          }
        }}
        onCancel={() => setOtpPromptConfig(null)}
      />
    </div>
  );
}
