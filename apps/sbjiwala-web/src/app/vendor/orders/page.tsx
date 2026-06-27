"use client";

import React, { useState, useEffect, useRef } from "react";
import { Clock, Loader2, Star, ShoppingBag, X, Package, CheckCircle2, AlertCircle, MapPin, Navigation, ExternalLink } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useWebSocket, resolveImageUrl } from "@sbjiwala/shared";
import { Geolocation } from "@capacitor/geolocation";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/index";
import VendorLayout from "@/components/VendorLayout";
import { NavigationChooser } from "@/components/NavigationMap";

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
        <p className="text-xs text-slate-555 dark:text-slate-400 text-center leading-normal">
          Rejecting items for <span className="font-extrabold text-slate-800 dark:text-slate-200">{item.product_name || item.name}</span>.
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

// =========== CANCEL ORDER MODAL ===========
function CancelOrderModal({
  isOpen, order, onConfirm, onCancel, loading
}: {
  isOpen: boolean; order: any;
  onConfirm: (reason: string) => void; onCancel: () => void; loading?: boolean;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (isOpen) {
      setReason("");
    }
  }, [isOpen]);

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 md:left-64 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-in text-slate-800 dark:text-white shadow-2xl">
        <div className="w-12 h-12 bg-rose-100 dark:bg-rose-955/40 rounded-2xl flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-black uppercase tracking-wider text-center">Cancel Order</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center leading-normal">
          Are you sure you want to cancel order <span className="font-extrabold text-slate-800 dark:text-slate-200">#{order.order_number}</span>?
        </p>

        <div className="space-y-1.5 text-left">
          <label className="block text-[10px] font-bold text-slate-400 uppercase">Reason for Cancellation</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Out of stock, Customer cancelled, etc."
            rows={3}
            disabled={loading}
            className="w-full px-4 py-2.5 text-xs font-bold border-2 border-slate-200 dark:border-slate-800 rounded-2xl bg-transparent focus:outline-none focus:border-rose-500 transition-colors"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="danger"
            onClick={() => {
              if (reason.trim()) {
                onConfirm(reason);
              }
            }}
            disabled={!reason.trim() || loading}
            loading={loading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold"
          >
            Yes, Cancel Order
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold"
          >
            No, Keep
          </Button>
        </div>
      </div>
    </div>
  );
}

// =========== OTP & Image Upload Modal ===========
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
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-in text-center shadow-2xl text-slate-855 dark:text-white">
        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center mx-auto">
          <Package className="w-7 h-7 text-emerald-600 dark:text-emerald-455" />
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
            className="w-full py-2.5 border-2 border-dashed border-slate-205 dark:border-slate-800 hover:border-emerald-500 rounded-2xl text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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
                  <img src={resolveImageUrl(url)} className="w-full h-full object-cover" />
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

const fetchRoute = async (start: [number, number], end: [number, number]): Promise<[number, number][]> => {
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const coords = data.routes[0].geometry.coordinates; // Array of [lng, lat]
      return coords.map((c: any) => [c[1], c[0]]); // Convert to [lat, lng]
    }
  } catch (error) {
    console.error("OSRM Route API failed, falling back to straight line:", error);
  }
  return [start, end];
};

function SelfDeliveryMap({ order, store }: { order: any; store: any }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const storeMarkerRef = useRef<any>(null);
  const customerMarkerRef = useRef<any>(null);
  const gpsMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const [gpsCoords, setGpsCoords] = useState<[number, number] | null>(null);

  // Track browser geolocation representing delivery agent GPS using Capacitor
  useEffect(() => {
    if (typeof window === "undefined") return;

    let watchId: string | null = null;

    const setupGeolocation = async () => {
      try {
        const permissions = await Geolocation.checkPermissions();
        if (permissions.location !== 'granted') {
          const req = await Geolocation.requestPermissions();
          if (req.location !== 'granted') {
            console.warn("Location permission denied");
            return;
          }
        }

        watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
          (pos, err) => {
            if (err) {
              console.warn("Geolocation watch failed", err);
              return;
            }
            if (pos) {
              setGpsCoords([pos.coords.latitude, pos.coords.longitude]);
            }
          }
        );
      } catch (e) {
        console.warn("Geolocation initialization failed", e);
      }
    };

    setupGeolocation();

    return () => {
      if (watchId !== null) {
        Geolocation.clearWatch({ id: watchId });
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;
    if (mapObjRef.current) return;

    // Clean up container to prevent duplicate map overlays in strict-mode
    mapRef.current.innerHTML = "";
    (mapRef.current as any)._leaflet_id = null;

    let active = true;
    import("leaflet").then((L) => {
      if (!active || !mapRef.current || mapObjRef.current) return;

      const customerLat = order.delivery_latitude || order.delivery_address?.latitude || 19.0735;
      const customerLng = order.delivery_longitude || order.delivery_address?.longitude || 72.9985;
      const storeLat = parseFloat(store.latitude || "19.0760");
      const storeLng = parseFloat(store.longitude || "72.8777");

      const map = L.map(mapRef.current!, { attributionControl: false, zoomControl: false }).setView([customerLat, customerLng], 14);
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Google Maps Voyager Style
      const tileUrl = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
      L.tileLayer(tileUrl, { attribution: "", subdomains: "abcd", maxZoom: 20 }).addTo(map);

      // Store Pin - Backgroundless Swiggy Style
      const storeIcon = L.divIcon({
        className: "",
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
            <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background-color: #ef4444; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff" stroke="#ffffff" stroke-width="1.5" style="width: 20px; height: 20px; flex-shrink: 0;">
                <path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      const storeMarker = L.marker([storeLat, storeLng], { icon: storeIcon }).addTo(map).bindPopup("Store Pickup Location");
      storeMarkerRef.current = storeMarker;

      // Customer Pin - Backgroundless Swiggy Style
      const homeIcon = L.divIcon({
        className: "",
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
            <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background-color: #3b82f6; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff" stroke="#ffffff" stroke-width="1.5" style="width: 20px; height: 20px; flex-shrink: 0;">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 11.2c-2.67 0-8 1.34-8 4v1.8h16v-1.8c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      const customerMarker = L.marker([customerLat, customerLng], { icon: homeIcon }).addTo(map).bindPopup("Customer Delivery Location");
      customerMarkerRef.current = customerMarker;

      // Easiest Route Line
      const routeLine = L.polyline([], {
        color: "#10b981",
        weight: 5,
        lineCap: "round",
        lineJoin: "round"
      }).addTo(map);
      routeLineRef.current = routeLine;

      fetchRoute([storeLat, storeLng], [customerLat, customerLng]).then((coords) => {
        if (!active) return;
        routeLine.setLatLngs(coords);
      });

      // GPS Marker Setup
      const gpsIcon = L.divIcon({
        className: "",
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
            <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background-color: #f97316; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff" stroke="#ffffff" stroke-width="1.5" style="width: 22px; height: 22px; flex-shrink: 0;">
                <circle cx="12" cy="12" r="10" fill="#f97316" stroke="#ffffff" stroke-width="1.5"></circle>
                <circle cx="12" cy="12" r="3" fill="#ffffff"></circle>
              </svg>
            </div>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const gpsMarker = L.marker([storeLat, storeLng], { icon: gpsIcon }).addTo(map).bindPopup("Live GPS Device Position");
      gpsMarkerRef.current = gpsMarker;

      map.fitBounds([[storeLat, storeLng], [customerLat, customerLng]], { padding: [40, 40] });
      mapObjRef.current = map;
    });

    return () => {
      active = false;
      if (mapObjRef.current) { mapObjRef.current.remove(); mapObjRef.current = null; }
    };
  }, [order, store]);

  // Update GPS position reactively and push to backend
  useEffect(() => {
    if (mapObjRef.current && gpsCoords && gpsMarkerRef.current && order && store) {
      gpsMarkerRef.current.setLatLng(gpsCoords);

      const customerLat = order.delivery_latitude || order.delivery_address?.latitude || 19.0735;
      const customerLng = order.delivery_longitude || order.delivery_address?.longitude || 72.9985;

      // Update the route line from the current GPS position to the customer
      fetchRoute(gpsCoords, [customerLat, customerLng]).then((coords) => {
        if (routeLineRef.current) {
          routeLineRef.current.setLatLngs(coords);
        }
      });

      // Push to backend
      if (order.status === "out_for_delivery") {
        api.post("/vendors/me/location", {
          latitude: gpsCoords[0],
          longitude: gpsCoords[1],
          order_id: order.id
        }).catch(err => console.warn("Failed to push vendor location", err));
      }
    }
  }, [gpsCoords]);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs font-bold text-slate-555 dark:text-slate-400">
        <span>🗺️ Easiest Delivery Route (Store self delivery active)</span>
        <span className="text-emerald-500 font-extrabold animate-pulse flex items-center gap-1">
          <Navigation className="w-3 h-3 animate-bounce" />
          Tracking Device GPS...
        </span>
      </div>
      <div className="w-full min-h-[50vh] rounded-2xl border border-slate-205 dark:border-slate-800 overflow-hidden shadow-inner relative z-10 flex flex-col">
        <div className="flex-1 w-full relative">
          <div ref={mapRef} className="w-full h-full absolute inset-0" />

          {/* Sbjiwala Watermark */}
          <div className="absolute bottom-2 left-2 pointer-events-none opacity-50 font-bold text-slate-800 tracking-widest text-[10px]" style={{ zIndex: 1000 }}>
            Sbjiwala
          </div>

          {/* Locate Me FAB */}
          <button
            onClick={() => {
              if (mapObjRef.current && gpsCoords) {
                mapObjRef.current.flyTo(gpsCoords, 16, { animate: true, duration: 1.5 });
              }
            }}
            className="absolute bottom-4 right-4 bg-white dark:bg-slate-800 p-3 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            style={{ zIndex: 1000 }}
            title="Locate Me"
          >
            <Navigation className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </button>
        </div>

        {/* Navigation Action Bar */}
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 flex gap-3 z-[1001] relative shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${order.delivery_latitude || order.delivery_address?.latitude},${order.delivery_longitude || order.delivery_address?.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white font-extrabold py-3.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          >
            <Navigation className="w-5 h-5" />
            Navigate to Customer
            <ExternalLink className="w-3.5 h-3.5 opacity-75 ml-1" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function VendorOrdersPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [selectedOrderForDeliveryOption, setSelectedOrderForDeliveryOption] = useState<any>(null);
  const [otpConfirmOrder, setOtpConfirmOrder] = useState<any>(null);
  const [rejectionConfig, setRejectionConfig] = useState<{ isOpen: boolean; orderId: string; item: any } | null>(null);
  const [cancelOrderConfig, setCancelOrderConfig] = useState<{ isOpen: boolean; order: any } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [navTarget, setNavTarget] = useState<{ order: any } | null>(null);
  const [vendorGpsPos, setVendorGpsPos] = useState<[number, number]>([19.0760, 72.9977]);

  // Fetch vendor store details to locate store marker correctly
  const { data: vendorData } = useQuery<any>({
    queryKey: ["vendorProfile"],
    queryFn: async () => {
      const res = await api.get("/vendors/me");
      return res.data;
    }
  });
  const store = vendorData?.store || {};

  // Track vendor GPS position for NavigationMap
  useEffect(() => {
    if (typeof window === "undefined") return;
    let watchId: string | null = null;
    const setup = async () => {
      try {
        const perms = await Geolocation.checkPermissions();
        if (perms.location === "granted" || perms.coarseLocation === "granted") {
          watchId = await Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
            (pos, err) => {
              if (!err && pos) {
                setVendorGpsPos([pos.coords.latitude, pos.coords.longitude]);
              }
            }
          );
        }
      } catch (e) {
        // Permission not available — fallback to browser geolocation
        if (navigator.geolocation) {
          navigator.geolocation.watchPosition(
            (pos) => setVendorGpsPos([pos.coords.latitude, pos.coords.longitude]),
            () => { },
            { enableHighAccuracy: true, maximumAge: 5000 }
          );
        }
      }
    };
    setup();
    return () => {
      if (watchId) Geolocation.clearWatch({ id: watchId }).catch(() => { });
    };
  }, []);

  const rejectItemsMutation = useMutation({
    mutationFn: async ({ orderId, payload }: { orderId: string; payload: any }) =>
      api.post(`/orders/${orderId}/reject-items`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorOrders"] });
      queryClient.invalidateQueries({ queryKey: ["vendorMetrics"] });
      success("Success", "Items adjusted and prices recalculated successfully!");
      setRejectionConfig(null);
    },
    onError: (err: any) => showError("Adjustment Failed", err.response?.data?.detail || err.message)
  });

  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useQuery<any>({
    queryKey: ["vendorOrders", activeTab],
    queryFn: async () => {
      const res = await api.get("/orders", {
        params: {
          status: activeTab !== "all" ? activeTab : undefined
        }
      });
      return res.data || [];
    }
  });

  // WebSocket: auto-refresh orders when new order or status update arrives
  useWebSocket((message: any) => {
    if (
      message.type === "order_status_update" ||
      message.type === "new_order" ||
      message.type === "notification"
    ) {
      refetchOrders();
      queryClient.invalidateQueries({ queryKey: ["vendorMetrics"] });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status, notes, deliveryOption, otp, images }: { orderId: string; status: string; notes: string; deliveryOption?: string; otp?: string; images?: string[] }) => {
      return api.patch(`/orders/${orderId}/status`, {
        status,
        notes,
        delivery_option: deliveryOption,
        otp,
        images
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorOrders"] });
      queryClient.invalidateQueries({ queryKey: ["vendorMetrics"] });
      success("Order status updated successfully!");
    },
    onError: (err: any) => {
      showError("Update Failed", "Failed to update order: " + (err.response?.data?.detail || err.message));
    }
  });

  const orders: any[] = Array.isArray(ordersData) ? ordersData : [];

  return (
    <VendorLayout title="Order Management Board">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Customer Requests</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Accept incoming customer orders, pack items, and track dispatch.</p>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-full border border-slate-205 dark:border-slate-700 text-xs font-semibold self-stretch md:self-auto justify-between sm:justify-start overflow-x-auto no-scrollbar">
            {["all", "pending", "confirmed", "accepted", "packed", "out_for_delivery", "delivered", "cancelled"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-full capitalize text-[10px] sm:text-xs transition-all whitespace-nowrap ${activeTab === tab
                  ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-205"
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {ordersLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
              <span className="text-xs text-slate-500 dark:text-slate-400">Fetching store orders...</span>
            </div>
          ) : orders.length > 0 ? (
            orders.map((order: any) => {
              const itemCount = order.items?.length || 0;
              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-850/10 transition-all cursor-pointer border-b border-slate-100 dark:border-slate-800"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">#Order {order.order_number}</span>
                      <span className="text-slate-400 dark:text-slate-500 text-xs">•</span>
                      <span className="text-[11px] text-slate-550 dark:text-slate-400">
                        {new Date(order.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-450">
                      <span>Items: <span className="font-extrabold text-slate-700 dark:text-slate-350">{itemCount}</span></span>
                      <span>•</span>
                      <span>Total: <span className="font-extrabold text-slate-900 dark:text-white">₹{order.total_amount}</span></span>
                      <span>•</span>
                      <span className="capitalize">{order.payment_method} ({order.payment_status})</span>
                    </div>

                    {/* Visual Item Images Row */}
                    <div className="flex gap-2 pt-1.5 overflow-x-auto scrollbar-hide">
                      {order.items?.slice(0, 5).map((item: any, idx: number) => {
                        const imageUrl = item.product_image_url || item.attributes?.image_emoji || item.attributes?.image_url;
                        const isHttpImage = imageUrl && (imageUrl.startsWith("http") || imageUrl.startsWith("/"));
                        return (
                          <div key={idx} className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 flex-shrink-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                            {isHttpImage ? (
                              <img src={resolveImageUrl(imageUrl)} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <span className="text-sm">{item.attributes?.image_emoji || "🥬"}</span>
                            )}
                          </div>
                        );
                      })}
                      {itemCount > 5 && (
                        <div className="w-8 h-8 rounded-lg border border-slate-205 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-550 dark:text-slate-400 flex-shrink-0">
                          +{itemCount - 5}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-end flex-shrink-0">
                    <span className={`inline-block text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${order.status === "pending"
                      ? "bg-amber-100 dark:bg-amber-955/40 text-amber-800 dark:text-amber-400"
                      : order.status === "confirmed"
                        ? "bg-purple-100 dark:bg-purple-955/40 text-purple-800 dark:text-purple-400"
                        : order.status === "accepted"
                          ? "bg-teal-100 dark:bg-teal-955/40 text-teal-800 dark:text-teal-400"
                          : order.status === "packed"
                            ? "bg-blue-100 dark:bg-blue-955/40 text-blue-800 dark:text-blue-400"
                            : order.status === "assigned"
                              ? "bg-indigo-105 dark:bg-indigo-955/40 text-indigo-800 dark:text-indigo-400"
                              : order.status === "out_for_delivery"
                                ? "bg-cyan-105 dark:bg-cyan-955/40 text-cyan-800 dark:text-cyan-400"
                                : "bg-emerald-100 dark:bg-emerald-955/40 text-emerald-800 dark:text-emerald-400"
                      }`}>
                      {order.status}
                    </span>
                    {order.metadata_json?.delivery_option && (
                      <span className={`inline-block text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${order.metadata_json.delivery_option === "self"
                        ? "bg-orange-100 dark:bg-orange-955/40 text-orange-800 dark:text-orange-400"
                        : "bg-indigo-100 dark:bg-indigo-955/40 text-indigo-800 dark:text-indigo-400"
                        }`}>
                        {order.metadata_json.delivery_option === "self" ? "Self Delivery" : "Platform Rider"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-20 text-center text-slate-400 dark:text-slate-500 text-xs">
              No orders found matching status "{activeTab}".
            </div>
          )}
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (() => {
        const order = orders.find((o: any) => o.id === selectedOrder.id) || selectedOrder;
        const itemCount = order.items?.length || 0;
        const isSelfDelivery = order.metadata_json?.delivery_option === "self";
        return (
          <div className="fixed inset-0 md:left-64 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
            <div className="relative bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in space-y-6 text-slate-850 dark:text-white scrollbar-hide">
              <div className="flex justify-between items-start">
                <div className="space-y-0.5">
                  <h3 className="text-base font-black uppercase tracking-wider">Order #{order.order_number}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Placed on {new Date(order.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-450 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Customer & Delivery Address details */}
              <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-2">
                <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Delivery Details</h5>
                <div className="space-y-1 text-xs">
                  <p className="font-extrabold text-slate-800 dark:text-slate-200">{order.delivery_address?.full_name}</p>
                  <p className="text-slate-500">
                    {["delivered", "cancelled"].includes(order.status) ? "•••••••••• (Hidden for privacy)" : order.delivery_address?.phone}
                  </p>
                  <p className="text-slate-650 dark:text-slate-350">
                    {["delivered", "cancelled"].includes(order.status) ? "•••••••••• (Hidden for privacy)" : `${order.delivery_address?.address_line_1 || ""}, ${order.delivery_address?.city || ""}`}
                  </p>
                  {order.customer_notes && !["delivered", "cancelled"].includes(order.status) && (
                    <div className="mt-2 bg-amber-500/10 text-amber-600 dark:text-amber-450 p-2 rounded-lg border border-amber-500/10 font-medium">
                      Note: "{order.customer_notes}"
                    </div>
                  )}
                </div>
              </div>

              {/* Order Status & Delivery Option */}
              <div className="flex justify-between items-center text-xs flex-wrap gap-2">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Status</p>
                  <span className={`inline-block text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${order.status === "pending"
                    ? "bg-amber-100 dark:bg-amber-955/40 text-amber-800 dark:text-amber-400"
                    : order.status === "confirmed"
                      ? "bg-purple-100 dark:bg-purple-955/40 text-purple-800 dark:text-purple-400"
                      : order.status === "accepted"
                        ? "bg-teal-100 dark:bg-teal-955/40 text-teal-800 dark:text-teal-400"
                        : order.status === "packed"
                          ? "bg-blue-100 dark:bg-blue-955/40 text-blue-800 dark:text-blue-400"
                          : order.status === "assigned"
                            ? "bg-indigo-105 dark:bg-indigo-955/40 text-indigo-800 dark:text-indigo-400"
                            : order.status === "out_for_delivery"
                              ? "bg-cyan-105 dark:bg-cyan-955/40 text-cyan-800 dark:text-cyan-400"
                              : "bg-emerald-100 dark:bg-emerald-955/40 text-emerald-800 dark:text-emerald-400"
                    }`}>
                    {order.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Delivery Option</p>
                  <span className={`inline-block text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${isSelfDelivery
                    ? "bg-orange-100 dark:bg-orange-955/40 text-orange-800 dark:text-orange-400"
                    : "bg-indigo-100 dark:bg-indigo-955/40 text-indigo-800 dark:text-indigo-400"
                    }`}>
                    {isSelfDelivery ? "Self Delivery" : "Platform Rider"}
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Payment ({order.payment_status})</p>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 uppercase">{order.payment_method}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-855 space-y-2">
                <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Items in Order ({itemCount})</h5>
                <div className="grid grid-cols-1 gap-2.5">
                  {order.items?.map((item: any) => {
                    const imageUrl = item.product_image_url || item.attributes?.image_emoji || item.attributes?.image_url;
                    const isHttpImage = imageUrl && (imageUrl.startsWith("http") || imageUrl.startsWith("/"));
                    return (
                      <div key={item.id} className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800/80">
                        <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 flex items-center justify-center bg-slate-50 dark:bg-slate-900 flex-shrink-0">
                          {isHttpImage ? (
                            <img src={resolveImageUrl(imageUrl)} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <span className="text-xl">{item.attributes?.image_emoji || "🥬"}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h6 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 truncate">{item.product_name || item.name}</h6>
                          <p className="text-[10px] text-slate-500">{item.unit || "kg"}</p>
                        </div>
                        <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                          <span className="text-xs font-black text-slate-900 dark:text-white">Qty: {item.quantity}</span>
                          {["picked", "out_for_delivery"].includes(order.status) && item.quantity > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRejectionConfig({
                                  isOpen: true,
                                  orderId: order.id,
                                  item: item
                                });
                              }}
                              className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-955/20 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-455 font-black text-[8px] uppercase tracking-wider border border-rose-100 dark:border-rose-955/40 cursor-pointer active:scale-95 transition-all animate-fade-in"
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Self Delivery Route Map Integration */}
              {isSelfDelivery && !["delivered", "cancelled"].includes(order.status) && (
                <SelfDeliveryMap order={order} store={store} />
              )}

              {/* Navigate button for self-delivery out_for_delivery orders */}
              {isSelfDelivery && order.status === "out_for_delivery" && (
                <button
                  onClick={() => setNavTarget({ order })}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs py-3 rounded-xl transition-all shadow-sm cursor-pointer border-0"
                >
                  <Navigation className="w-4 h-4" />
                  Navigate to Customer
                </button>
              )}

              {/* Status Action Buttons */}
              <div className="flex gap-2 flex-wrap pt-2">
                {order.status === "confirmed" && (
                  <button
                    onClick={() => {
                      setSelectedOrderForDeliveryOption(order);
                    }}
                    disabled={updateStatusMutation.isPending}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    Accept Order
                  </button>
                )}
                {order.status === "assigned" && (
                  <button
                    onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: "accepted", notes: "Order accepted by vendor (Delivery Partner Assigned)" })}
                    disabled={updateStatusMutation.isPending}
                    className="flex-1 bg-teal-650 hover:bg-teal-500 dark:bg-teal-500 dark:hover:bg-teal-400 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    Accept Order (Rider Assigned)
                  </button>
                )}
                {order.status === "accepted" && (
                  <button
                    onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: "packed", notes: "Order packed by vendor" })}
                    disabled={updateStatusMutation.isPending}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    Mark as Packed
                  </button>
                )}
                {order.status === "packed" && (
                  <button
                    onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: "out_for_delivery", notes: "Order is out for delivery by vendor" })}
                    disabled={updateStatusMutation.isPending}
                    className="flex-1 bg-indigo-650 hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    Ship Order (Out for Delivery)
                  </button>
                )}
                {order.status === "out_for_delivery" && (
                  <button
                    onClick={() => setOtpConfirmOrder(order)}
                    disabled={updateStatusMutation.isPending}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    Mark as Delivered
                  </button>
                )}
                {!["delivered", "cancelled", "returned", "refunded", "failed"].includes(order.status) && (
                  <button
                    onClick={() => {
                      setCancelOrderConfig({ isOpen: true, order });
                    }}
                    disabled={updateStatusMutation.isPending}
                    className="flex-1 bg-rose-600 hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    Cancel Order
                  </button>
                )}
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black uppercase text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/50 cursor-pointer text-center"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delivery Option Selection Modal */}
      {selectedOrderForDeliveryOption && (
        <div className="fixed inset-0 md:left-64 z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedOrderForDeliveryOption(null)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-scale-in space-y-6 text-slate-850 dark:text-white">
            <div className="space-y-1">
              <h3 className="text-base font-black uppercase tracking-wider">Accept Order #{selectedOrderForDeliveryOption.order_number}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Choose how this order will be delivered before you start packing.</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => {
                  updateStatusMutation.mutate({
                    orderId: selectedOrderForDeliveryOption.id,
                    status: "accepted",
                    notes: "Order accepted by vendor with Platform Delivery",
                    deliveryOption: "auto"
                  });
                  setSelectedOrderForDeliveryOption(null);
                }}
                className="flex flex-col items-start p-4 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] text-left cursor-pointer group"
              >
                <span className="font-extrabold text-xs text-slate-850 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                  🚲 Platform Delivery Partner
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                  Our system will automatically search and assign a delivery boy based on proximity to match order destination.
                </span>
              </button>

              <button
                onClick={() => {
                  updateStatusMutation.mutate({
                    orderId: selectedOrderForDeliveryOption.id,
                    status: "accepted",
                    notes: "Order accepted by vendor with Self Delivery",
                    deliveryOption: "self"
                  });
                  setSelectedOrderForDeliveryOption(null);
                }}
                className="flex flex-col items-start p-4 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] text-left cursor-pointer group"
              >
                <span className="font-extrabold text-xs text-slate-850 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                  🎒 Store Self Delivery
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                  Deliver using your own store runner or personal courier. No platform delivery partner will be dispatched.
                </span>
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSelectedOrderForDeliveryOption(null)}
                className="flex-1 py-3 border border-slate-205 dark:border-slate-850 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <OtpPromptModal
        isOpen={!!otpConfirmOrder}
        title="Delivery OTP Verification"
        message={`Enter 4-digit OTP and upload proof photos to deliver Order #${otpConfirmOrder?.order_number} ${
          otpConfirmOrder?.delivery_otp ? `(For testing, OTP: ${otpConfirmOrder.delivery_otp})` : ""
        }`}
        loading={updateStatusMutation.isPending}
        onConfirm={(otp, images) => {
          updateStatusMutation.mutate({
            orderId: otpConfirmOrder.id,
            status: "delivered",
            otp,
            images,
            notes: "Order marked delivered by vendor (Self Delivery Verification)"
          });
          setOtpConfirmOrder(null);
        }}
        onCancel={() => setOtpConfirmOrder(null)}
      />

      <CancelOrderModal
        isOpen={!!cancelOrderConfig?.isOpen}
        order={cancelOrderConfig?.order}
        loading={updateStatusMutation.isPending}
        onConfirm={(reason) => {
          if (cancelOrderConfig?.order) {
            updateStatusMutation.mutate({
              orderId: cancelOrderConfig.order.id,
              status: "cancelled",
              notes: reason
            });
            setCancelOrderConfig(null);
          }
        }}
        onCancel={() => setCancelOrderConfig(null)}
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

      {/* Navigation Chooser for self-delivery orders */}
      {navTarget && (() => {
        const order = navTarget.order;
        const custLat = order.delivery_latitude || order.delivery_address?.latitude || 19.0735;
        const custLng = order.delivery_longitude || order.delivery_address?.longitude || 72.9985;
        const storeLat = parseFloat(store.latitude || "19.0760");
        const storeLng = parseFloat(store.longitude || "72.8777");
        return (
          <NavigationChooser
            isOpen
            onDismiss={() => setNavTarget(null)}
            currentPos={vendorGpsPos}
            isPicked={true}
            orderNumber={order.order_number}
            storePoint={{
              lat: storeLat, lng: storeLng,
              label: store.store_name || "My Store",
              type: "store"
            }}
            customerPoint={{
              lat: custLat, lng: custLng,
              label: order.delivery_address?.full_name || "Customer",
              type: "customer"
            }}
          />
        );
      })()}
    </VendorLayout>
  );
}
