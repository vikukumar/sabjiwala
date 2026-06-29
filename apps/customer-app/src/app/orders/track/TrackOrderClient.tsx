"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, useWebSocket } from "@sbjiwala/shared";
import Link from "next/link";
import { ChevronLeft, Phone, MessageSquare, MapPin, Truck, Clock, CheckCircle2 } from "lucide-react";
import { Badge, Button, Spinner } from "@/components/ui/index";
import { resolveLink } from "@/components/AppShell";
import { createCustomerIcon, createStoreIcon, createDeliveryAgentIcon } from "@sbjiwala/shared";
import { Navigation } from "lucide-react";
import "leaflet/dist/leaflet.css";

const VEHICLES = [
  { type: "scooty" },
  { type: "bike" },
  { type: "truck" },
  { type: "bicycle" }
];
const COLORS = ["#ea580c"];


const fetchRoute = async (start: [number, number], end: [number, number]): Promise<{ coords: [number, number][], distance: number, duration: number }> => {
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
  const mapObjRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const agentToStoreLineRef = useRef<any>(null);
  const storeToCustomerLineRef = useRef<any>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: number, duration: number } | null>(null);

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
    if ((message.type === "live_location" || message.type === "live_location_update") && message.data.order_id === id) {
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
    if (typeof window === "undefined" || !mapRef.current || mapObjRef.current || !order) return;

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

      map = L.map(mapRef.current!, { attributionControl: false, zoomControl: false }).setView([customerLat, customerLng], 14);
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
      L.marker([storeLat, storeLng], { icon: storeIcon }).addTo(map).bindPopup("Pickup Store");

      // Delivery agent marker - Backgroundless Swiggy Style
      const hash = (order.id || "agent").split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
      const types = ["scooty", "bike", "bicycle", "truck"];
      const type = order.delivery_agent?.vehicle_type || types[hash % types.length];
      const agentIcon = createDeliveryAgentIcon(L, type);

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
        fetchRoute([initDriverLat, initDriverLng], [storeLat, storeLng]).then((data) => {
          if (!active) return;
          agentToStorePolyline.setLatLngs(data.coords);
          agentToStorePolyline.setStyle({ color: "#f97316", weight: 5 });
          setRouteInfo({ distance: data.distance, duration: data.duration });
        });
      } else {
        fetchRoute([initDriverLat, initDriverLng], [customerLat, customerLng]).then((data) => {
          if (!active) return;
          agentToStorePolyline.setLatLngs(data.coords);
          agentToStorePolyline.setStyle({ color: "#10b981", weight: 5 });
          setRouteInfo({ distance: data.distance, duration: data.duration });
        });
      }

      map.fitBounds([[customerLat, customerLng], [storeLat, storeLng], [initDriverLat, initDriverLng]], { padding: [50, 50] });

      // Fix Leaflet gray map issue by forcing a resize calculation after rendering
      setTimeout(() => {
        if (active && map) {
          map.invalidateSize();
        }
      }, 500);

      mapObjRef.current = map;
      setMapLoaded(true);
    });

    return () => {
      active = false;
      if (map) map.remove();
    };
  }, [order]);

  // Handle live location updates reactively
  useEffect(() => {
    if (mapObjRef.current && driverLocation && driverMarkerRef.current && order) {
      const newPos = [driverLocation.latitude, driverLocation.longitude] as [number, number];
      driverMarkerRef.current.setLatLng(newPos);

      const customerLat = order.delivery_latitude || order.delivery_address?.latitude || 19.0735;
      const customerLng = order.delivery_longitude || order.delivery_address?.longitude || 72.9985;
      const storeLat = order.vendor_store?.latitude || 19.0760;
      const storeLng = order.vendor_store?.longitude || 72.9977;

      const isPicked = ["picked", "out_for_delivery"].includes(order.status);

      if (isPicked) {
        fetchRoute(newPos, [customerLat, customerLng]).then((data) => {
          if (agentToStoreLineRef.current) {
            agentToStoreLineRef.current.setLatLngs(data.coords);
            agentToStoreLineRef.current.setStyle({ color: "#10b981", weight: 5 });
          }
          setRouteInfo({ distance: data.distance, duration: data.duration });
        });
      } else {
        fetchRoute(newPos, [storeLat, storeLng]).then((data) => {
          if (agentToStoreLineRef.current) {
            agentToStoreLineRef.current.setLatLngs(data.coords);
            agentToStoreLineRef.current.setStyle({ color: "#f97316", weight: 5 });
          }
          setRouteInfo({ distance: data.distance, duration: data.duration });
        });
      }
    }
  }, [driverLocation, order]);

  let eta = order?.status === "out_for_delivery" ? "~5 min" : order?.status === "packed" ? "~15 min" : null;
  if (routeInfo && routeInfo.duration > 0) {
    eta = `~${Math.ceil(routeInfo.duration / 60)} min`;
  }

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
                {routeInfo ? `${(routeInfo.distance / 1000).toFixed(1)} km` : distance > 0 ? `${distance.toFixed(2)} km` : "Calculating..."}
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
      <div className="map-3d-wrapper card overflow-hidden relative" style={{ height: "360px" }}>
        <div ref={mapRef} className="w-full h-full" style={{ zIndex: 1 }} />
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="text-center space-y-2">
              <Spinner size="lg" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading map...</p>
            </div>
          </div>
        )}

        {/* Sbjiwala Watermark */}
        <div className="absolute bottom-2 left-2 pointer-events-none opacity-50 font-bold text-slate-800 tracking-widest text-[10px]" style={{ zIndex: 1000 }}>
          Sbjiwala
        </div>

        {/* Locate Me FAB */}
        <button
          onClick={() => {
            if (mapObjRef.current) {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => mapObjRef.current.flyTo([pos.coords.latitude, pos.coords.longitude], 16, { animate: true, duration: 1.5 }),
                  () => mapObjRef.current.flyTo([driverLat, driverLng], 15)
                );
              } else {
                mapObjRef.current.flyTo([driverLat, driverLng], 15);
              }
            }
          }}
          className="absolute bottom-4 right-4 bg-white dark:bg-slate-800 p-3 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          style={{ zIndex: 1000 }}
          title="Locate Me"
        >
          <Navigation className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </button>
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
