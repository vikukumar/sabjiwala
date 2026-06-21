"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, useWebSocket } from "@sbjiwala/shared";
import Link from "next/link";
import { ChevronLeft, Phone, MessageSquare, MapPin, Truck, Clock, CheckCircle2 } from "lucide-react";
import { Badge, Button, Spinner } from "@/components/ui/index";
import { resolveLink } from "@/components/AppShell";

const VEHICLES = [
  { type: "scooty" },
  { type: "bike" },
  { type: "truck" },
  { type: "bicycle" }
];
const COLORS = ["#ea580c"];

const getVehicleDetails = (orderId: string, agentVehicleType?: string) => {
  const hash = (orderId || "agent").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const types = ["scooty", "bike", "bicycle", "truck"];
  const type = agentVehicleType || types[hash % types.length];
  
  let svg = "";
  if (type === "truck") {
    svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ea580c" stroke="#ffffff" stroke-width="1.5" style="width: 36px; height: 36px; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3)); flex-shrink: 0;">
        <rect x="1" y="3" width="15" height="13" rx="2" ry="2"></rect>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
        <circle cx="5.5" cy="18.5" r="2.5"></circle>
        <circle cx="18.5" cy="18.5" r="2.5"></circle>
      </svg>
    `;
  } else if (type === "bicycle") {
    svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 36px; height: 36px; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3)); flex-shrink: 0;">
        <circle cx="5.5" cy="17.5" r="2.5"></circle>
        <circle cx="18.5" cy="17.5" r="2.5"></circle>
        <path d="M15 5h1M12 17.5V14l-3-3 4-3 2 3h2" stroke="#ea580c" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `;
  } else if (type === "scooty") {
    svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ea580c" stroke="#ffffff" stroke-width="1.5" style="width: 36px; height: 36px; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3)); flex-shrink: 0;">
        <circle cx="6" cy="18" r="2.5"></circle>
        <circle cx="18" cy="18" r="2.5"></circle>
        <path d="M6 18h4l2-5h5l1.5 2.5h1.5l1-2.5v-2h-3l-1.5-3H13v2.5l-2 2.5H8l-2-5H3v2h2l1 5.5z"></path>
      </svg>
    `;
  } else {
    // bike
    svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ea580c" stroke="#ffffff" stroke-width="1.5" style="width: 36px; height: 36px; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3)); flex-shrink: 0;">
        <circle cx="6" cy="18" r="3"></circle>
        <circle cx="18" cy="18" r="3"></circle>
        <path d="M6 18h4.5l2-6h4l1.5 6H21v-2l-2-4h-4.5L12 8H8L6 18z"></path>
      </svg>
    `;
  }
  return { svg };
};

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

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function TrackOrderClient() {
  const params = useParams<{ id?: string }>();
  const searchParams = useSearchParams();
  const id = params?.id || searchParams?.get("id") || "";
  const queryClient = useQueryClient();
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [mapObj, setMapObj] = useState<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const agentToStoreLineRef = useRef<any>(null);
  const storeToCustomerLineRef = useRef<any>(null);

  const { data: order } = useQuery<any>({
    queryKey: ["order", id],
    queryFn: async () => { const r = await api.get(`/orders/${id}`); return r.data?.data || r.data; },
    enabled: !!id,
  });

  // Seed initial location
  useEffect(() => {
    if (order && !driverLocation) {
      const storeLat = order.vendor_store?.latitude || 19.0760;
      const storeLng = order.vendor_store?.longitude || 72.9977;
      setDriverLocation({
        latitude: order.delivery_agent?.latitude || order.delivery_agent?.current_latitude || storeLat,
        longitude: order.delivery_agent?.longitude || order.delivery_agent?.current_longitude || storeLng
      });
    }
  }, [order]);

  // Connect to WebSocket backplane
  useWebSocket((message) => {
    if (message.type === "live_location" && message.data.order_id === id) {
      setDriverLocation({
        latitude: message.data.latitude,
        longitude: message.data.longitude,
        speed: message.data.speed,
        heading: message.data.heading,
      });
    } else if (message.type === "order_status_update" && message.data.order_id === id) {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    }
  });

  // Initialize Leaflet map
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current || mapLoaded || !order) return;

    let map: any = null;
    let active = true;

    // Clean up container completely to resolve strict-mode duplication issues
    mapRef.current.innerHTML = "";
    (mapRef.current as any)._leaflet_id = null;

    import("leaflet").then((L) => {
      if (!active || !mapRef.current) return;

      const customerLat = order.delivery_latitude || order.delivery_address?.latitude || 19.0735;
      const customerLng = order.delivery_longitude || order.delivery_address?.longitude || 72.9985;
      const storeLat = order.vendor_store?.latitude || 19.0760;
      const storeLng = order.vendor_store?.longitude || 72.9977;

      const initDriverLat = driverLocation?.latitude || storeLat;
      const initDriverLng = driverLocation?.longitude || storeLng;

      map = L.map(mapRef.current!, { attributionControl: false }).setView([customerLat, customerLng], 14);
      const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
      const tileUrl = isDark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
      const tiles = L.tileLayer(tileUrl, {
        attribution: "",
        subdomains: "abcd",
        maxZoom: 20
      }).addTo(map);
      tiles.on("tileerror", () => {
        tiles.setUrl("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
      });

      // Delivery address marker (Customer) - Backgroundless Swiggy Style
      const homeIcon = L.divIcon({
        html: `
          <div style="display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; flex-shrink: 0;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3b82f6" stroke="#ffffff" stroke-width="1.5" style="width: 32px; height: 32px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.3)); flex-shrink: 0;">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 11.2c-2.67 0-8 1.34-8 4v1.8h16v-1.8c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        className: "leaflet-custom-icon",
      });
      L.marker([customerLat, customerLng], { icon: homeIcon }).addTo(map).bindPopup("Delivery Address");

      // Store marker - Backgroundless Swiggy Style
      const storeIcon = L.divIcon({
        html: `
          <div style="display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; flex-shrink: 0;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" style="width: 32px; height: 32px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.3)); flex-shrink: 0;">
              <path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/>
            </svg>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        className: "leaflet-custom-icon",
      });
      L.marker([storeLat, storeLng], { icon: storeIcon }).addTo(map).bindPopup("Pickup Store");

      // Delivery agent marker - Backgroundless Swiggy Style
      const { svg } = getVehicleDetails(order.id, order.delivery_agent?.vehicle_type);
      const agentIcon = L.divIcon({
        html: `
          <div style="display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; flex-shrink: 0;">
            ${svg}
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        className: "leaflet-custom-icon",
      });

      const driverMarker = L.marker([initDriverLat, initDriverLng], { icon: agentIcon }).addTo(map).bindPopup("Delivery Partner");
      driverMarkerRef.current = driverMarker;

      // Draw route lines using OSRM driving paths
      const isPicked = ["picked", "out_for_delivery", "delivered"].includes(order.status);

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
      fetchRoute([storeLat, storeLng], [customerLat, customerLng]).then((coords) => {
        if (!active) return;
        storeToCustomerPolyline.setLatLngs(coords);
        if (isPicked) {
          storeToCustomerPolyline.setStyle({ color: "#cbd5e1", weight: 3, dashArray: "5 5" });
        } else {
          storeToCustomerPolyline.setStyle({ color: "#10b981", weight: 4, dashArray: "5 5" });
        }
      });

      // Fetch Leg 1: Driver to current target (Store or Customer)
      if (!isPicked) {
        fetchRoute([initDriverLat, initDriverLng], [storeLat, storeLng]).then((coords) => {
          if (!active) return;
          agentToStorePolyline.setLatLngs(coords);
          agentToStorePolyline.setStyle({ color: "#f97316", weight: 5 });
        });
      } else {
        fetchRoute([initDriverLat, initDriverLng], [customerLat, customerLng]).then((coords) => {
          if (!active) return;
          agentToStorePolyline.setLatLngs(coords);
          agentToStorePolyline.setStyle({ color: "#10b981", weight: 5 });
        });
      }

      map.fitBounds([[customerLat, customerLng], [storeLat, storeLng], [initDriverLat, initDriverLng]], { padding: [50, 50] });

      setMapObj(map);
      setMapLoaded(true);
    });

    return () => {
      active = false;
      if (map) map.remove();
    };
  }, [order, mapLoaded]);

  // Handle live location updates reactively
  useEffect(() => {
    if (mapObj && driverLocation && driverMarkerRef.current && order) {
      const newPos = [driverLocation.latitude, driverLocation.longitude] as [number, number];
      driverMarkerRef.current.setLatLng(newPos);
      
      const customerLat = order.delivery_latitude || order.delivery_address?.latitude || 19.0735;
      const customerLng = order.delivery_longitude || order.delivery_address?.longitude || 72.9985;
      const storeLat = order.vendor_store?.latitude || 19.0760;
      const storeLng = order.vendor_store?.longitude || 72.9977;
      
      const isPicked = ["picked", "out_for_delivery"].includes(order.status);
      
      if (isPicked) {
        fetchRoute(newPos, [customerLat, customerLng]).then((coords) => {
          if (agentToStoreLineRef.current) {
            agentToStoreLineRef.current.setLatLngs(coords);
            agentToStoreLineRef.current.setStyle({ color: "#10b981", weight: 5 });
          }
        });
      } else {
        fetchRoute(newPos, [storeLat, storeLng]).then((coords) => {
          if (agentToStoreLineRef.current) {
            agentToStoreLineRef.current.setLatLngs(coords);
            agentToStoreLineRef.current.setStyle({ color: "#f97316", weight: 5 });
          }
        });
      }
    }
  }, [driverLocation, mapObj, order]);

  const eta = order?.status === "out_for_delivery" ? "~5 min" : order?.status === "packed" ? "~15 min" : null;

  const customerLat = order?.delivery_latitude || order?.delivery_address?.latitude || 19.0735;
  const customerLng = order?.delivery_longitude || order?.delivery_address?.longitude || 72.9985;
  const storeLat = order?.vendor_store?.latitude || 19.0760;
  const storeLng = order?.vendor_store?.longitude || 72.9977;

  const driverLat = driverLocation?.latitude || storeLat;
  const driverLng = driverLocation?.longitude || storeLng;

  const distance = calculateDistance(customerLat, customerLng, driverLat, driverLng);

  if (!id) return <div className="text-center py-20 text-slate-500">Order ID is missing</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 font-sans">
      <div className="flex items-center gap-3">
        <Link href={resolveLink(`/orders/detail?id=${id}`)}>
          <button className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </Link>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">Live Tracking</h1>
        {order && <Badge variant={order.status === "delivered" ? "success" : "warning"}>
          {order.status?.replace(/_/g, " ").toUpperCase()}
        </Badge>}
      </div>

      {/* ETA Banner */}
      {eta && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl flex items-center gap-3 animate-slide-down">
          <div className="p-2 bg-emerald-600 rounded-xl">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-black text-emerald-800 dark:text-emerald-300">Your order is on the way! 🛵</p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Estimated arrival: <span className="font-black">{eta}</span></p>
          </div>
        </div>
      )}

      {/* Live tracking stats card */}
      {order && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500">Estimated Time</p>
              <p className="text-sm font-black text-slate-900 dark:text-white">{eta || "~Instant"}</p>
            </div>
          </div>
          <div className="card p-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500">Distance</p>
              <p className="text-sm font-black text-slate-900 dark:text-white">
                {distance > 0 ? `${distance.toFixed(2)} km` : "Calculating..."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delivery OTP Card */}
      {!["delivered", "cancelled", "returned", "refunded"].includes(order?.status) && order?.delivery_otp && (
        <div className="card p-4 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Delivery OTP</p>
            <p className="text-xs text-slate-550 dark:text-slate-400 mt-0.5">Share with partner only at delivery time.</p>
          </div>
          <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-emerald-500/30">
            <span className="font-mono text-lg font-black tracking-widest text-emerald-600 dark:text-emerald-400">
              {order.delivery_otp}
            </span>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="map-3d-wrapper card overflow-hidden" style={{ height: "360px" }}>
        <div ref={mapRef} className="w-full h-full" style={{ zIndex: 1 }} />
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="text-center space-y-2">
              <Spinner size="lg" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading map...</p>
            </div>
          </div>
        )}
      </div>

      {/* Delivery Agent Info */}
      {order?.delivery_agent && (
        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white text-xl font-black flex-shrink-0">
            {order.delivery_agent.name?.[0] || "D"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-slate-900 dark:text-white">{order.delivery_agent.name}</p>
            <p className="text-xs text-slate-550 dark:text-slate-400">Your delivery agent</p>
          </div>
          <div className="flex gap-2">
            <a href={`tel:${order.delivery_agent.phone}`}>
              <Button variant="secondary" size="sm" leftIcon={<Phone className="w-3.5 h-3.5" />}>Call</Button>
            </a>
          </div>
        </div>
      )}

      {/* Delivery Address */}
      {order?.delivery_address && (
        <div className="card p-4 flex items-start gap-3">
          <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 tracking-wider">Delivering To</p>
            <p className="font-bold text-sm text-slate-900 dark:text-white">{order.delivery_address.full_name}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {order.delivery_address.address_line_1}, {order.delivery_address.city}
            </p>
          </div>
        </div>
      )}

      {order?.status === "delivered" && (
        <div className="card p-4 flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="font-black text-emerald-800 dark:text-emerald-300">Order Delivered! 🎉</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500">Your order has been delivered successfully</p>
          </div>
        </div>
      )}
    </div>
  );
}
