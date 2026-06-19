"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Navigation, CheckCircle2, AlertCircle, ShoppingBag,
  MapPin, Loader2, Package, XCircle
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/index";
import DeliveryLayout, { useDelivery } from "@/components/DeliveryLayout";

// =========== OTP MODAL ===========
function OtpPromptModal({
  isOpen, title, message, onConfirm, onCancel, loading
}: {
  isOpen: boolean; title: string; message: string;
  onConfirm: (otp: string) => void; onCancel: () => void; loading?: boolean;
}) {
  const [otp, setOtp] = useState("");
  useEffect(() => { if (isOpen) setOtp(""); }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-in text-center shadow-2xl text-slate-800 dark:text-white">
        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center mx-auto">
          <Package className="w-7 h-7 text-emerald-600 dark:text-emerald-450" />
        </div>
        <h3 className="text-base font-black uppercase tracking-wider">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">{message}</p>
        <div className="space-y-1.5">
          <input
            type="text" maxLength={4} pattern="[0-9]*" inputMode="numeric"
            value={otp} onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-full text-center tracking-[1.5em] pl-[1.5em] py-3 text-2xl font-black border-2 border-slate-200 dark:border-slate-700 rounded-2xl bg-transparent focus:outline-none focus:border-emerald-500 transition-colors"
            placeholder="••••" disabled={loading}
          />
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="primary" onClick={() => { if (otp.length === 4) onConfirm(otp); }}
            disabled={otp.length !== 4 || loading} loading={loading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold">
            Verify & Deliver
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={loading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// =========== HAVERSINE DISTANCE CALCULATOR ===========
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// =========== DELIVERY TRACKING MAP ===========
function DeliveryTrackingMap({ order, currentPos, simulationMode, setSimulationMode, distanceInfo }: {
  order: any; currentPos: [number, number]; simulationMode: boolean;
  setSimulationMode: (val: boolean) => void; distanceInfo: string;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapObj, setMapObj] = useState<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const pathLineRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current || !order) return;
    let map: any = null;
    let active = true;
    import("leaflet").then((L) => {
      if (!active || !mapContainerRef.current) return;
      if ((mapContainerRef.current as any)._leaflet_id) return;
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const customerLat = order.delivery_latitude || order.delivery_address?.latitude || 19.0735;
      const customerLng = order.delivery_longitude || order.delivery_address?.longitude || 72.9985;
      const storeLat = order.vendor_store?.latitude || 19.0760;
      const storeLng = order.vendor_store?.longitude || 72.9977;

      const isPicked = ["picked", "out_for_delivery"].includes(order.status);
      const destLat = isPicked ? customerLat : storeLat;
      const destLng = isPicked ? customerLng : storeLng;

      map = L.map(mapContainerRef.current!).setView([destLat, destLng], 14);
      const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
      const tileUrl = isDark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
      const tiles = L.tileLayer(tileUrl, {
        attribution: "&copy; OpenStreetMap &copy; CARTO",
        subdomains: "abcd",
        maxZoom: 20
      }).addTo(map);
      tiles.on("tileerror", () => {
        tiles.setUrl("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
      });

      const homeIcon = L.divIcon({ html: '<div style="background:#ef4444;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🏠</div>', iconSize: [32, 32], iconAnchor: [16, 16] });
      L.marker([customerLat, customerLng], { icon: homeIcon }).addTo(map).bindPopup("Delivery Address");

      const storeIcon = L.divIcon({ html: '<div style="background:#3b82f6;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🏪</div>', iconSize: [32, 32], iconAnchor: [16, 16] });
      L.marker([storeLat, storeLng], { icon: storeIcon }).addTo(map).bindPopup(order.vendor_store?.store_name || "Store");

      const driverIcon = L.divIcon({ html: '<div style="background:#10b981;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3)">🛵</div>', iconSize: [36, 36], iconAnchor: [18, 18] });
      const driverMarker = L.marker(currentPos, { icon: driverIcon }).addTo(map);
      driverMarkerRef.current = driverMarker;

      L.polyline([[storeLat, storeLng], [customerLat, customerLng]], { color: "#cbd5e1", weight: 2, dashArray: "4 4" }).addTo(map);
      pathLineRef.current = L.polyline([currentPos, [destLat, destLng]], { color: isPicked ? "#10b981" : "#3b82f6", weight: 4 }).addTo(map);

      map.fitBounds([currentPos, [destLat, destLng]], { padding: [40, 40] });
      setMapObj(map);
    });
    return () => { active = false; if (map) map.remove(); };
  }, [order]);

  useEffect(() => {
    if (mapObj && driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng(currentPos);
      if (pathLineRef.current && order) {
        const customerLat = order.delivery_latitude || order.delivery_address?.latitude || 19.0735;
        const customerLng = order.delivery_longitude || order.delivery_address?.longitude || 72.9985;
        const storeLat = order.vendor_store?.latitude || 19.0760;
        const storeLng = order.vendor_store?.longitude || 72.9977;

        const isPicked = ["picked", "out_for_delivery"].includes(order.status);
        const destLat = isPicked ? customerLat : storeLat;
        const destLng = isPicked ? customerLng : storeLng;

        pathLineRef.current.setLatLngs([currentPos, [destLat, destLng]]);
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
        <button onClick={() => setSimulationMode(!simulationMode)}
          className={`px-3 py-1 rounded-xl font-bold transition-all border cursor-pointer ${simulationMode
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          }`}>
          {simulationMode ? "Simulated GPS 🛰️" : "Device GPS 📍"}
        </button>
      </div>
      <div ref={mapContainerRef} className="h-48 rounded-2xl border border-slate-200 dark:border-slate-800 relative shadow-inner overflow-hidden" style={{ zIndex: 1 }} />
    </div>
  );
}

function ActiveOrdersDashboard() {
  const { globalPos, isOnline, simulationMode, setSimulationMode, distanceInfo } = useDelivery();
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [otpPromptConfig, setOtpPromptConfig] = useState<{ isOpen: boolean; orderId: string } | null>(null);

  // Fetch active assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<any[]>({
    queryKey: ["deliveryAssignments"],
    queryFn: async () => {
      const res = await api.get("/delivery/assignments");
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token") && isOnline,
  });

  const pickupOrderMutation = useMutation({
    mutationFn: async (orderId: string) => api.post(`/delivery/orders/${orderId}/pickup`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryAssignments"] });
      success("Pickup Complete! Order is now out for delivery.");
    },
    onError: (err: any) => showError("Pickup Failed", err.response?.data?.detail || err.message)
  });

  const deliverOrderMutation = useMutation({
    mutationFn: async ({ orderId, otp }: { orderId: string; otp: string }) =>
      api.post(`/delivery/orders/${orderId}/deliver`, { order_id: orderId, otp }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryAssignments"] });
      queryClient.invalidateQueries({ queryKey: ["deliveryEarnings"] });
      queryClient.invalidateQueries({ queryKey: ["deliveryProfile"] });
      success("Order delivered successfully!");
      setOtpPromptConfig(null);
    },
    onError: (err: any) => showError("Delivery Failed", err.response?.data?.detail || err.message)
  });

  const handleUpdateStatus = (id: string, currentStatus: string) => {
    if (currentStatus === "assigned" || currentStatus === "packed" || currentStatus === "accepted") {
      pickupOrderMutation.mutate(id);
    } else {
      setOtpPromptConfig({ isOpen: true, orderId: id });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
          Active Deliveries ({assignments.length})
        </h3>
        {!isOnline && (
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
            <AlertCircle className="w-3.5 h-3.5" /> Go Online to get orders
          </span>
        )}
      </div>

      <div className="space-y-4">
        {assignmentsLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
            <span className="text-sm text-slate-500 font-semibold">Checking assignments...</span>
          </div>
        ) : isOnline && assignments.length > 0 ? (
          assignments.map((task: any) => {
            const destAddr = task.delivery_address || {};
            const formattedAddr = destAddr.formatted_address || `${destAddr.address_line_1 || ""}, ${destAddr.city || ""}`;
            const isCOD = task.payment_method === "cod";
            return (
              <div key={task.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400">#{task.order_number}</span>
                      <h4 className="font-extrabold text-slate-900 dark:text-slate-50">{destAddr.full_name || "Customer"}</h4>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                        task.status === "assigned" || task.status === "packed"
                          ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400"
                          : "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400"
                      }`}>{task.status}</span>
                      {isCOD && (
                        <span className="text-[10px] font-bold bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full">
                          💵 COD ₹{task.total_amount}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-extrabold text-slate-800 dark:text-slate-200">
                          Store: {task.vendor_store?.store_name || "Vendor Store"}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                          {task.vendor_store?.address_line_1 || "Store Address"}
                        </p>
                        {task.vendor_store?.latitude && (
                          <span className="inline-block text-[9px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/20 px-1.5 py-0.5 rounded-full mt-1">
                            🛵 Aap store se {getHaversineDistance(globalPos[0], globalPos[1], task.vendor_store.latitude, task.vendor_store.longitude).toFixed(2)} km door hain
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-dashed border-slate-200 dark:border-slate-800 my-1" />

                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-extrabold text-slate-800 dark:text-slate-200">
                          Deliver to: {destAddr.full_name || "Customer"}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                          {formattedAddr}
                        </p>
                        {task.delivery_latitude && task.vendor_store?.latitude && (
                          <span className="inline-block text-[9px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded-full mt-1">
                            📍 Store se customer {getHaversineDistance(task.vendor_store.latitude, task.vendor_store.longitude, task.delivery_latitude, task.delivery_longitude).toFixed(2)} km door hai
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {["assigned", "confirmed", "accepted", "packed", "picked", "out_for_delivery"].includes(task.status) && (
                    <DeliveryTrackingMap
                      order={task} currentPos={globalPos}
                      simulationMode={simulationMode} setSimulationMode={setSimulationMode}
                      distanceInfo={distanceInfo}
                    />
                  )}

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        {isCOD ? "Collect Cash" : "Prepaid"}
                      </span>
                      <span className="font-black text-slate-900 dark:text-slate-50 text-sm">
                        {isCOD ? `₹${task.total_amount}` : "✓ Online Paid"}
                      </span>
                    </div>
                    <button
                      onClick={() => handleUpdateStatus(task.id, task.status)}
                      disabled={
                        pickupOrderMutation.isPending ||
                        deliverOrderMutation.isPending ||
                        (task.status === "assigned" || task.status === "accepted" || task.status === "confirmed")
                      }
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 flex items-center gap-1.5 cursor-pointer"
                    >
                      {task.status === "assigned" || task.status === "accepted" || task.status === "confirmed"
                        ? "Waiting for store to pack"
                        : task.status === "packed"
                          ? <><Package className="w-3.5 h-3.5" /> Confirm Pickup</>
                          : <><CheckCircle2 className="w-3.5 h-3.5" /> Verify OTP & Deliver</>}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
              <ShoppingBag className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-sm text-slate-500 font-medium">
              {isOnline ? "No active assignments right now." : "Toggle Online to start receiving orders."}
            </p>
          </div>
        )}
      </div>

      <OtpPromptModal
        isOpen={!!otpPromptConfig?.isOpen}
        title="Delivery OTP"
        message="Enter the 4-digit OTP from the customer to confirm delivery."
        loading={deliverOrderMutation.isPending}
        onConfirm={(otp) => { if (otpPromptConfig?.orderId) deliverOrderMutation.mutate({ orderId: otpPromptConfig.orderId, otp }); }}
        onCancel={() => setOtpPromptConfig(null)}
      />
    </div>
  );
}

export default function DeliveryAgentPage() {
  return (
    <DeliveryLayout>
      <ActiveOrdersDashboard />
    </DeliveryLayout>
  );
}
