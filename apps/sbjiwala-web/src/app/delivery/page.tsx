"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Navigation, CheckCircle2, AlertCircle, ShoppingBag,
  MapPin, Loader2, Package, XCircle, X
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/index";
import DeliveryLayout, { useDelivery } from "@/components/DeliveryLayout";
import { createCustomerIcon, createStoreIcon, createDeliveryAgentIcon } from "@sbjiwala/shared";

// =========== OTP MODAL ===========
function OtpPromptModal({
  isOpen, title, message, onConfirm, onCancel, loading
}: {
  isOpen: boolean; title: string; message: string;
  onConfirm: (otp: string, images: string[]) => void; onCancel: () => void; loading?: boolean;
}) {
  const [otp, setOtp] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { success, error: showError } = useToast();

  useEffect(() => {
    if (isOpen) {
      setOtp("");
      setImages([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploadedUrls: string[] = [...images];
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);
        const res = await api.post("/storage/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        const resAny = res as any;
        const url = resAny.url || resAny.data?.url || resAny.data?.data?.url;
        if (url) {
          uploadedUrls.push(url);
        }
      }
      setImages(uploadedUrls);
      success("Success", "Photos uploaded successfully!");
    } catch (err: any) {
      showError("Upload Failed", err.response?.data?.detail || err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, idx) => idx !== index));
  };

  return (
    <div className="fixed inset-0 md:left-64 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-in text-center shadow-2xl text-slate-800 dark:text-white">
        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center mx-auto">
          <Package className="w-7 h-7 text-emerald-600 dark:text-emerald-450" />
        </div>
        <h3 className="text-base font-black uppercase tracking-wider">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">{message}</p>
        
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-slate-400 uppercase text-left mb-1">Enter Customer OTP</label>
          <input
            type="text" maxLength={4} pattern="[0-9]*" inputMode="numeric"
            value={otp} onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-full text-center tracking-[1.5em] pl-[1.5em] py-2 text-2xl font-black border-2 border-slate-200 dark:border-slate-700 rounded-2xl bg-transparent focus:outline-none focus:border-emerald-500 transition-colors"
            placeholder="••••" disabled={loading}
          />
        </div>

        <div className="space-y-2 text-left">
          <div className="flex justify-between items-center">
            <label className="block text-[10px] font-bold text-slate-400 uppercase">
              Upload Proof Pics ({images.length}/2 minimum)
            </label>
            {images.length < 2 && (
              <span className="text-[9px] font-black text-rose-500 uppercase animate-pulse">Required</span>
            )}
          </div>
          
          <input
            type="file" multiple accept="image/*"
            ref={fileInputRef} onChange={handleFileUpload}
            className="hidden" disabled={loading || uploading}
          />
          
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || uploading}
            className="w-full py-2.5 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500 rounded-2xl text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
            ) : (
              <span>📷 Upload Verification Photos</span>
            )}
          </button>

          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-2 pt-1">
              {images.map((url, idx) => (
                <div key={idx} className="relative aspect-square border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden group">
                  <img src={url} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-0.5 hover:bg-rose-600 shadow-sm"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="primary"
            onClick={() => { if (otp.length === 4 && images.length >= 2) onConfirm(otp, images); }}
            disabled={otp.length !== 4 || images.length < 2 || loading || uploading}
            loading={loading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold"
          >
            Verify & Deliver
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={loading || uploading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// =========== ITEM REJECTION MODAL ===========
function ItemRejectionModal({
  isOpen, item, onConfirm, onCancel, loading
}: {
  isOpen: boolean; item: any;
  onConfirm: (quantity: number, reason: string) => void; onCancel: () => void; loading?: boolean;
}) {
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState("Quality Issue");

  useEffect(() => {
    if (isOpen && item) {
      setQuantity(item.quantity);
      setReason("Quality Issue");
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 md:left-64 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-in text-slate-800 dark:text-white shadow-2xl">
        <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950/40 rounded-2xl flex items-center justify-center mx-auto text-rose-600 dark:text-rose-455">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-black uppercase tracking-wider text-center">Reject Produce</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center leading-normal">
          Rejecting items for <span className="font-extrabold text-slate-800 dark:text-slate-200">{item.product_name}</span>.
        </p>

        <div className="space-y-3.5 text-left">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Quantity to Reject (Max: {item.quantity} {item.unit})
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={item.quantity}
              value={quantity}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setQuantity(isNaN(val) ? 0 : Math.min(val, item.quantity));
              }}
              className="w-full px-4 py-2.5 text-sm font-bold border-2 border-slate-200 dark:border-slate-800 rounded-2xl bg-transparent focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reason for Rejection</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2.5 text-sm font-bold border-2 border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="Quality Issue">Quality Issue</option>
              <option value="Damaged / Bruised">Damaged / Bruised</option>
              <option value="Incorrect Product">Incorrect Product</option>
              <option value="Customer Refused">Customer Refused</option>
              <option value="Not Fresh">Not Fresh / Rotten</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="danger"
            onClick={() => {
              if (quantity > 0 && quantity <= item.quantity) {
                onConfirm(quantity, reason);
              }
            }}
            disabled={quantity <= 0 || quantity > item.quantity || loading}
            loading={loading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold"
          >
            Confirm Rejection
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

// =========== DELIVERY TRACKING MAP helpers ===========


const fetchRoute = async (start: [number, number], end: [number, number]): Promise<{coords: [number, number][], distance: number, duration: number}> => {
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const coords = data.routes[0].geometry.coordinates; // Array of [lng, lat]
      const distance = data.routes[0].distance; // in meters
      const duration = data.routes[0].duration; // in seconds
      return { coords: coords.map((c: any) => [c[1], c[0]]), distance, duration }; // Convert to [lat, lng]
    }
  } catch (error) {
    console.error("OSRM Route API failed, falling back to straight line:", error);
  }
  return { coords: [start, end], distance: 0, duration: 0 };
};

// =========== DELIVERY TRACKING MAP ===========
function DeliveryTrackingMap({ order, currentPos, simulationMode, setSimulationMode, distanceInfo }: {
  order: any; currentPos: [number, number]; simulationMode: boolean;
  setSimulationMode: (val: boolean) => void; distanceInfo: string;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapObj, setMapObj] = useState<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const agentToStoreLineRef = useRef<any>(null);
  const storeToCustomerLineRef = useRef<any>(null);
  const [routeInfo, setRouteInfo] = useState<{distance: number, duration: number} | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current || !order) return;
    let map: any = null;
    let active = true;

    // Clean up container completely to resolve strict-mode duplication issues
    mapContainerRef.current.innerHTML = "";
    (mapContainerRef.current as any)._leaflet_id = null;

    import("leaflet").then((L) => {
      if (!active || !mapContainerRef.current) return;

      const customerLat = order.delivery_latitude || order.delivery_address?.latitude || 19.0735;
      const customerLng = order.delivery_longitude || order.delivery_address?.longitude || 72.9985;
      const storeLat = order.vendor_store?.latitude || 19.0760;
      const storeLng = order.vendor_store?.longitude || 72.9977;

      const isPicked = ["picked", "out_for_delivery"].includes(order.status);
      const destLat = isPicked ? customerLat : storeLat;
      const destLng = isPicked ? customerLng : storeLng;

      map = L.map(mapContainerRef.current!, { attributionControl: false, zoomControl: false }).setView([destLat, destLng], 14);
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Google Maps Voyager Style
      const tileUrl = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
      const tiles = L.tileLayer(tileUrl, {
        attribution: "",
        subdomains: "abcd",
        maxZoom: 20
      }).addTo(map);
      tiles.on("tileerror", () => {
        tiles.setUrl("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
      });

      // Delivery address marker (Customer) - Backgroundless Swiggy Style
      const homeIcon = createCustomerIcon(L);
      L.marker([customerLat, customerLng], { icon: homeIcon }).addTo(map).bindPopup("Delivery Address");

      // Store marker - Backgroundless Swiggy Style
      const storeIcon = createStoreIcon(L);
      L.marker([storeLat, storeLng], { icon: storeIcon }).addTo(map).bindPopup(order.vendor_store?.store_name || "Store");

      // Delivery agent marker - Backgroundless Swiggy Style
      const hash = (order.id || "agent").split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
      const types = ["scooty", "bike", "bicycle", "truck"];
      const type = order.delivery_agent?.vehicle_type || types[hash % types.length];
      const driverIcon = createDeliveryAgentIcon(L, type);
      const driverMarker = L.marker(currentPos, { icon: driverIcon }).addTo(map);
      driverMarkerRef.current = driverMarker;

      // Draw route lines using OSRM driving paths
      const agentToStorePolyline = L.polyline([], {
        color: isPicked ? "#10b981" : "#f97316",
        weight: 5,
        lineCap: "round",
        lineJoin: "round"
      }).addTo(map);
      agentToStoreLineRef.current = agentToStorePolyline;

      const storeToCustomerPolyline = L.polyline([], {
        color: "#10b981",
        weight: 5,
        lineCap: "round",
        lineJoin: "round"
      }).addTo(map);
      storeToCustomerLineRef.current = storeToCustomerPolyline;

      // Fetch Leg 2: Store to Customer (dashed green / grey)
      fetchRoute([storeLat, storeLng], [customerLat, customerLng]).then((data) => {
        if (!active) return;
        storeToCustomerPolyline.setLatLngs(data.coords);
        if (isPicked) {
          storeToCustomerPolyline.setStyle({ color: "#cbd5e1", weight: 3, dashArray: "5 5" });
        } else {
          storeToCustomerPolyline.setStyle({ color: "#10b981", weight: 4, dashArray: "5 5" });
        }
      });

      // Fetch Leg 1: Driver to current target (Store or Customer)
      if (!isPicked) {
        fetchRoute(currentPos, [storeLat, storeLng]).then((data) => {
          if (!active) return;
          agentToStorePolyline.setLatLngs(data.coords);
          agentToStorePolyline.setStyle({ color: "#f97316", weight: 5 });
          setRouteInfo({ distance: data.distance, duration: data.duration });
        });
      } else {
        fetchRoute(currentPos, [customerLat, customerLng]).then((data) => {
          if (!active) return;
          agentToStorePolyline.setLatLngs(data.coords);
          agentToStorePolyline.setStyle({ color: "#10b981", weight: 5 });
          setRouteInfo({ distance: data.distance, duration: data.duration });
        });
      }

      map.fitBounds([currentPos, [destLat, destLng]], { padding: [40, 40] });
      setMapObj(map);
    });
    return () => { active = false; if (map) map.remove(); };
  }, [order]);

  useEffect(() => {
    if (mapObj && driverMarkerRef.current && order) {
      driverMarkerRef.current.setLatLng(currentPos);
      
      const customerLat = order.delivery_latitude || order.delivery_address?.latitude || 19.0735;
      const customerLng = order.delivery_longitude || order.delivery_address?.longitude || 72.9985;
      const storeLat = order.vendor_store?.latitude || 19.0760;
      const storeLng = order.vendor_store?.longitude || 72.9977;

      const isPicked = ["picked", "out_for_delivery"].includes(order.status);
      
      if (isPicked) {
        fetchRoute(currentPos, [customerLat, customerLng]).then((data) => {
          if (agentToStoreLineRef.current) {
            agentToStoreLineRef.current.setLatLngs(data.coords);
            agentToStoreLineRef.current.setStyle({ color: "#10b981", weight: 5 });
          }
          setRouteInfo({ distance: data.distance, duration: data.duration });
        });
      } else {
        fetchRoute(currentPos, [storeLat, storeLng]).then((data) => {
          if (agentToStoreLineRef.current) {
            agentToStoreLineRef.current.setLatLngs(data.coords);
            agentToStoreLineRef.current.setStyle({ color: "#f97316", weight: 5 });
          }
          setRouteInfo({ distance: data.distance, duration: data.duration });
        });
      }
    }
  }, [currentPos, mapObj, order]);

  const handleLocateMe = () => {
    if (mapObj) {
      mapObj.flyTo(currentPos, 16, { animate: true, duration: 1.5 });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 flex-wrap gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
          <Navigation className="w-4 h-4 text-emerald-600 dark:text-emerald-450 animate-bounce" />
          <span>
            {routeInfo ? (
              <>ETA: {Math.round(routeInfo.duration / 60)} mins • {(routeInfo.distance / 1000).toFixed(1)} km</>
            ) : distanceInfo}
          </span>
        </div>
        <button onClick={() => setSimulationMode(!simulationMode)}
          className={`px-3 py-1 rounded-xl font-bold transition-all border cursor-pointer ${simulationMode
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          }`}>
          {simulationMode ? "Simulated GPS 🛰️" : "Device GPS 📍"}
        </button>
      </div>
      <div className="map-3d-wrapper overflow-hidden border border-slate-200 dark:border-slate-800 relative shadow-inner rounded-2xl" style={{ zIndex: 1 }}>
        <div ref={mapContainerRef} className="h-48 md:h-80 w-full relative" />
        
        {/* Sabjiwala Watermark */}
        <div className="absolute bottom-2 left-2 pointer-events-none opacity-50 font-bold text-slate-800 tracking-widest text-[10px]" style={{ zIndex: 1000 }}>
          SABJIWALA
        </div>

        {/* Locate Me FAB */}
        <button 
          onClick={handleLocateMe}
          className="absolute bottom-4 right-4 bg-white dark:bg-slate-800 p-3 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          style={{ zIndex: 1000 }}
          title="Locate Me"
        >
          <Navigation className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </button>
      </div>
    </div>
  );
}

function ActiveOrdersDashboard() {
  const { globalPos, isOnline, simulationMode, setSimulationMode, distanceInfo } = useDelivery();
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [otpPromptConfig, setOtpPromptConfig] = useState<{ isOpen: boolean; orderId: string } | null>(null);
  const [rejectionConfig, setRejectionConfig] = useState<{ isOpen: boolean; orderId: string; item: any } | null>(null);

  const rejectItemsMutation = useMutation({
    mutationFn: async ({ orderId, payload }: { orderId: string; payload: any }) =>
      api.post(`/delivery/orders/${orderId}/reject-items`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryAssignments"] });
      success("Success", "Items rejected and prices updated successfully!");
      setRejectionConfig(null);
    },
    onError: (err: any) => showError("Rejection Failed", err.response?.data?.detail || err.message)
  });

  // Fetch active assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<any[]>({
    queryKey: ["deliveryAssignments"],
    queryFn: async () => {
      const res = await api.get("/delivery/assignments");
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token") && isOnline,
  });

  // Fetch nearby unassigned orders
  const { data: nearbyOrders = [], isLoading: nearbyLoading } = useQuery<any[]>({
    queryKey: ["deliveryNearbyOrders"],
    queryFn: async () => {
      const res = await api.get("/delivery/nearby-orders");
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token") && isOnline,
    refetchInterval: 15000,
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
    mutationFn: async ({ orderId, otp, images }: { orderId: string; otp: string; images: string[] }) =>
      api.post(`/delivery/orders/${orderId}/deliver`, { order_id: orderId, otp, images }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryAssignments"] });
      queryClient.invalidateQueries({ queryKey: ["deliveryEarnings"] });
      queryClient.invalidateQueries({ queryKey: ["deliveryProfile"] });
      success("Order delivered successfully!");
      setOtpPromptConfig(null);
    },
    onError: (err: any) => showError("Delivery Failed", err.response?.data?.detail || err.message)
  });

  const acceptOrderMutation = useMutation({
    mutationFn: async (orderId: string) => api.post(`/delivery/orders/${orderId}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryAssignments"] });
      queryClient.invalidateQueries({ queryKey: ["deliveryNearbyOrders"] });
      success("Order accepted! Go to store to pick it up.");
    },
    onError: (err: any) => showError("Accept Failed", err.response?.data?.detail || err.message)
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

                  {/* Items List */}
                  {task.items && task.items.length > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-550">Order Items (Inspect & Doorstep Reject)</p>
                      <div className="divide-y divide-slate-200/60 dark:divide-slate-800/40">
                        {task.items.map((item: any) => (
                          <div key={item.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                            <div className="min-w-0 flex-1">
                              <p className="font-extrabold text-slate-800 dark:text-slate-200 truncate">{item.product_name}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                                {item.quantity} {item.unit} × ₹{item.unit_price} = <span className="font-extrabold text-slate-700 dark:text-slate-300">₹{item.total_price}</span>
                              </p>
                            </div>
                            {["picked", "out_for_delivery"].includes(task.status) && item.quantity > 0 && (
                              <button
                                onClick={() => {
                                  setRejectionConfig({
                                    isOpen: true,
                                    orderId: task.id,
                                    item: item
                                  });
                                }}
                                className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-955/20 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-black text-[9px] uppercase tracking-wider border border-rose-100 dark:border-rose-950/40 cursor-pointer transition-all active:scale-95"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
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

      {/* Nearby Available Orders Section */}
      <div className="pt-6 space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            Nearby Available Orders ({isOnline ? nearbyOrders.length : 0})
          </h3>
        </div>

        <div className="space-y-4">
          {!isOnline ? (
            <div className="py-8 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs font-semibold text-slate-500">
              Go Online to view nearby orders
            </div>
          ) : nearbyLoading ? (
            <div className="py-8 flex justify-center items-center gap-2">
              <Loader2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-spin" />
              <span className="text-xs text-slate-500 font-semibold">Scanning nearby...</span>
            </div>
          ) : nearbyOrders.length > 0 ? (
            nearbyOrders.map((order: any) => {
              const destAddr = order.delivery_address || {};
              const formattedAddr = destAddr.formatted_address || `${destAddr.address_line_1 || ""}, ${destAddr.city || ""}`;
              return (
                <div key={order.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400">#{order.order_number}</span>
                      <h4 className="font-extrabold text-slate-900 dark:text-slate-50 text-xs">
                        Store: {order.vendor_store?.store_name || "Store"}
                      </h4>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-450">
                        ₹{order.total_amount}
                      </span>
                      <span className="text-[9px] uppercase font-bold text-slate-400 bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded-full">
                        {order.payment_method === "cod" ? "💵 COD" : "✓ Paid"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[11px] bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-slate-705 dark:text-slate-300">Pickup location</p>
                        <p className="text-slate-500 dark:text-slate-400 leading-tight">
                          {order.vendor_store?.address_line_1 || "Store Address"}
                        </p>
                      </div>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-800/60 my-1" />
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-slate-705 dark:text-slate-300">Deliver to</p>
                        <p className="text-slate-500 dark:text-slate-400 leading-tight">
                          {formattedAddr}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="text-[10px] font-bold text-slate-500">
                      Distance: <span className="text-emerald-600">{order.distance_km} km</span> away
                    </div>
                    <button
                      onClick={() => acceptOrderMutation.mutate(order.id)}
                      disabled={acceptOrderMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 border-0"
                    >
                      {acceptOrderMutation.isPending ? "Accepting..." : "Accept Order 🛵"}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-xs font-semibold text-slate-400">
              No new unassigned orders nearby.
            </div>
          )}
        </div>
      </div>

      <OtpPromptModal
        isOpen={!!otpPromptConfig?.isOpen}
        title="Delivery OTP"
        message="Enter the 4-digit OTP from the customer to confirm delivery."
        loading={deliverOrderMutation.isPending}
        onConfirm={(otp, images) => { if (otpPromptConfig?.orderId) deliverOrderMutation.mutate({ orderId: otpPromptConfig.orderId, otp, images }); }}
        onCancel={() => setOtpPromptConfig(null)}
      />

      <ItemRejectionModal
        isOpen={!!rejectionConfig?.isOpen}
        item={rejectionConfig?.item}
        loading={rejectItemsMutation.isPending}
        onConfirm={(qty, reason) => {
          if (rejectionConfig?.orderId && rejectionConfig?.item) {
            rejectItemsMutation.mutate({
              orderId: rejectionConfig.orderId,
              payload: {
                rejected_items: [{
                  product_id: rejectionConfig.item.product_id,
                  variant_id: rejectionConfig.item.variant_id,
                  rejected_quantity: qty,
                  reason: reason
                }]
              }
            });
          }
        }}
        onCancel={() => setRejectionConfig(null)}
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
