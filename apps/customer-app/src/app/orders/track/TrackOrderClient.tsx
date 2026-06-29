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
  const hasInitializedMap = useRef(false);

  const { data: order } = useQuery<any>({
    queryKey: ["order", id],
    queryFn: async () => { const r = await api.get(`/orders/${id}`); return r.data?.data || r.data; },
    enabled: !!id,
    refetchInterval: 5000,
  });

  // Seed initial/updated location
  useEffect(() => {
    if (order) {
      const storeLat = order.vendor_store?.latitude || 19.0760;
      const storeLng = order.vendor_store?.longitude || 72.9977;
      
      let lat = storeLat;
      let lng = storeLng;
      
      if (order.delivery_agent) {
        lat = order.delivery_agent.latitude || order.delivery_agent.current_latitude || storeLat;
        lng = order.delivery_agent.longitude || order.delivery_agent.current_longitude || storeLng;
      }
      
      setDriverLocation((prev: any) => {
        if (prev && prev.latitude === lat && prev.longitude === lng) return prev;
        return { ...prev, latitude: lat, longitude: lng };
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
    if (typeof window === "undefined" || !mapRef.current || mapObjRef.current || !order || hasInitializedMap.current) return;
    hasInitializedMap.current = true;

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

      {/* Swiggy Style Animated Tracker */}
      {order && ["accepted", "confirmed", "packed", "assigned", "picked", "out_for_delivery"].includes(order.status) ? (
        <SwiggyTracker 
          order={order} 
          driverLocation={driverLocation} 
          routeInfo={routeInfo} 
          eta={eta} 
          distance={distance} 
        />
      ) : eta ? (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl flex items-center gap-3 animate-slide-down">
          <div className="p-2 bg-emerald-600 rounded-xl">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-black text-emerald-800 dark:text-emerald-300">Your order is on the way! 🛵</p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Estimated arrival: <span className="font-black">{eta}</span></p>
          </div>
        </div>
      ) : null}

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

// Swiggy-style Premium Delivery Tracker Component
function SwiggyTracker({ order, driverLocation, routeInfo, eta, distance }: any) {
  const isPicked = ["picked", "out_for_delivery"].includes(order?.status);
  
  const vehicleIcon = order?.delivery_agent?.vehicle_type === "scooty" ? "🛵"
                      : order?.delivery_agent?.vehicle_type === "bike" ? "🏍️"
                      : order?.delivery_agent?.vehicle_type === "bicycle" ? "🚲"
                      : "🚚";

  const progressPercent = isPicked 
    ? Math.max(15, Math.min(85, 100 - (distance * 20)))
    : 10;

  return (
    <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-slate-900 dark:to-slate-900/60 border border-orange-150 dark:border-slate-800 rounded-3xl p-6 shadow-md relative overflow-hidden space-y-6">
      <style>{`
        @keyframes road-flow {
          0% { stroke-dashoffset: 20; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes vehicle-ride {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-2px) rotate(2deg); }
        }
        @keyframes ripple {
          0% { transform: scale(0.6); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .animated-road {
          stroke-dasharray: 6, 6;
          animation: road-flow 1.2s linear infinite;
        }
        .riding-vehicle {
          animation: vehicle-ride 0.6s ease-in-out infinite;
        }
        .ripple-effect {
          animation: ripple 1.6s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }
      `}</style>

      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping" />
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-orange-600 dark:text-orange-400">
              {isPicked ? "Out for Delivery" : "Driver heading to store"}
            </h3>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-none">
            Arriving in {eta || "10 mins"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isPicked 
              ? `Delivery agent ${order?.delivery_agent?.name || "partner"} is on the way!` 
              : "Preparing your fresh harvest."}
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-slate-500 block uppercase">Distance</span>
          <span className="text-lg font-black text-slate-900 dark:text-white">
            {distance > 0 ? `${distance.toFixed(1)} km` : "1.2 km"}
          </span>
        </div>
      </div>

      <div className="relative pt-6 pb-2 px-2">
        <div className="absolute top-[2.5rem] left-[2.5rem] right-[2.5rem] h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-1000"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <svg className="absolute top-[2.25rem] left-[2.5rem] right-[2.5rem] w-[calc(100%-5rem)] h-[10px] pointer-events-none" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <line 
            x1="0" y1="5" x2="100%" y2="5" 
            className="animated-road" 
            stroke="#ffffff" 
            strokeWidth="2" 
            opacity="0.6"
          />
        </svg>

        <div className="flex justify-between items-center relative">
          <div className="flex flex-col items-center gap-1.5 z-10">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm transition-colors ${!isPicked ? 'bg-orange-500 border-orange-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}`}>
              <span className="text-xl">🏪</span>
            </div>
            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 max-w-[64px] text-center truncate">
              {order?.vendor_store?.name || "Store"}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1.5 z-10">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm transition-colors ${order?.status === 'delivered' ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}`}>
              <span className="text-xl">🏠</span>
            </div>
            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 max-w-[64px] text-center truncate">
              Home
            </span>
          </div>

          <div 
            className="absolute top-[-0.5rem] transition-all duration-1000 ease-out z-20 flex flex-col items-center"
            style={{ 
              left: `calc(${progressPercent}% - 1.25rem)`,
            }}
          >
            <div className="absolute top-[0.5rem] w-10 h-10 bg-orange-500/20 dark:bg-orange-500/10 rounded-full ripple-effect pointer-events-none" />
            
            <div className="w-10 h-10 bg-white dark:bg-slate-800 border-2 border-orange-500 shadow-lg rounded-full flex items-center justify-center riding-vehicle">
              <span className="text-2xl filter drop-shadow-md">{vehicleIcon}</span>
            </div>
            <span className="text-[9px] font-bold bg-orange-600 text-white px-1.5 py-0.5 rounded-full mt-1.5 shadow-sm whitespace-nowrap">
              {order?.delivery_agent?.name?.split(" ")[0] || "Rider"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white/70 dark:bg-slate-900/70 border border-slate-200/50 dark:border-slate-800/50 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-black">
            {order?.delivery_agent?.name?.[0] || "D"}
          </div>
          <div>
            <p className="text-sm font-extrabold text-slate-900 dark:text-white">
              {order?.delivery_agent?.name || "Rider"}
            </p>
            <p className="text-[10px] text-slate-550 uppercase font-black">
              {order?.delivery_agent?.vehicle_number || "MH-12-AB-1234"}
            </p>
          </div>
        </div>
        <a href={`tel:${order?.delivery_agent?.phone}`} className="flex-shrink-0">
          <button className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer border-0">
            Call Rider
          </button>
        </a>
      </div>
    </div>
  );
}
