"use client";

/**
 * NavigationMap — Sbjiwala's built-in navigation component.
 *
 * Features:
 *  - Navigation chooser (Google Maps | Sbjiwala built-in)
 *  - 2-leg OSRM route: Current→Pickup (orange) and Pickup→Delivery (green)
 *  - Animated heading-locked vehicle marker
 *  - Live route re-fetching as GPS position changes
 *  - ETA + distance panel with live countdown
 *  - "Arrived" detection banner at 150 m from waypoint
 *  - Next-turn instruction banner from OSRM steps
 *  - Follow / lock-to-position mode
 *  - Dark map variant for navigation feel
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Navigation, MapPin, X, ExternalLink, ChevronRight,
  LocateFixed, Maximize2, ArrowLeft, CheckCircle2, Clock,
  TriangleAlert, Route
} from "lucide-react";

// ─────────────────────── Types ───────────────────────

export interface NavPoint {
  lat: number;
  lng: number;
  label: string;
  type: "store" | "customer" | "current";
}

export interface NavigationMapProps {
  /** Current GPS position of the agent [lat, lng] */
  currentPos: [number, number];
  /** Heading in degrees (0–360) */
  heading?: number;
  /** Speed in m/s */
  speed?: number;
  /** Pickup / store location */
  storePoint?: NavPoint;
  /** Customer delivery location */
  customerPoint?: NavPoint;
  /**
   * Whether the order has already been picked up.
   * - false → navigate to store (orange leg active)
   * - true  → navigate to customer (green leg active)
   */
  isPicked?: boolean;
  /** Order number for display */
  orderNumber?: string;
  /** Called when user closes built-in nav */
  onClose?: () => void;
  /** Extra CSS classes for wrapper */
  className?: string;
}

// ─────────────────────── Haversine ───────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────── OSRM Routing ───────────────────────

interface RouteData {
  coords: [number, number][];
  distanceM: number;
  durationS: number;
  steps: OsrmStep[];
}

interface OsrmStep {
  instruction: string;
  distanceM: number;
  maneuver: string;
}

async function fetchRoute(
  start: [number, number],
  end: [number, number]
): Promise<RouteData> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${start[1]},${start[0]};${end[1]},${end[0]}` +
      `?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes?.length > 0) {
      const route = data.routes[0];
      const coords: [number, number][] = route.geometry.coordinates.map(
        (c: number[]) => [c[1], c[0]] as [number, number]
      );
      const steps: OsrmStep[] = [];
      for (const leg of route.legs || []) {
        for (const step of leg.steps || []) {
          const maneuverType = step.maneuver?.type || "";
          const modifier = step.maneuver?.modifier || "";
          let instruction = step.name
            ? `${capitalize(maneuverType)} ${modifier} onto ${step.name}`
            : `${capitalize(maneuverType)} ${modifier}`;
          instruction = instruction.trim() || "Continue";
          steps.push({
            instruction,
            distanceM: step.distance || 0,
            maneuver: maneuverType,
          });
        }
      }
      return {
        coords,
        distanceM: route.distance,
        durationS: route.duration,
        steps: steps.filter(s => s.distanceM > 0),
      };
    }
  } catch (e) {
    console.warn("OSRM routing failed:", e);
  }
  return { coords: [start, end], distanceM: 0, durationS: 0, steps: [] };
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `< 1 min`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function maneuverIcon(maneuver: string) {
  switch (maneuver) {
    case "turn": return "↩";
    case "roundabout": return "🔄";
    case "merge": return "⤵";
    case "fork": return "⑂";
    case "end of road": return "🏁";
    case "arrive": return "📍";
    default: return "→";
  }
}

// ─────────────────────── Vehicle Marker SVG ───────────────────────

function vehicleMarkerHtml(heading: number, isPicked: boolean) {
  const color = isPicked ? "#10b981" : "#f97316";
  return `
    <div style="
      width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
      transform: rotate(${heading}deg);
      transition: transform 0.5s ease;
      filter: drop-shadow(0 3px 8px rgba(0,0,0,0.4));
    ">
      <svg viewBox="0 0 44 44" width="44" height="44" xmlns="http://www.w3.org/2000/svg">
        <circle cx="22" cy="22" r="20" fill="${color}" opacity="0.18"/>
        <circle cx="22" cy="22" r="13" fill="${color}"/>
        <polygon points="22,8 27,20 22,17 17,20" fill="white"/>
        <circle cx="22" cy="22" r="4" fill="white"/>
      </svg>
    </div>
  `;
}

function storeMarkerHtml() {
  return `
    <div style="
      width: 38px; height: 38px;
      display: flex; align-items: center; justify-content: center;
      filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));
    ">
      <div style="
        width: 36px; height: 36px;
        background: #ef4444;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        border: 2.5px solid white;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="20" height="20">
          <path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/>
        </svg>
      </div>
    </div>
  `;
}

function customerMarkerHtml() {
  return `
    <div style="
      width: 38px; height: 38px;
      display: flex; align-items: center; justify-content: center;
      filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));
    ">
      <div style="
        width: 36px; height: 36px;
        background: #3b82f6;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        border: 2.5px solid white;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="20" height="20">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
    </div>
  `;
}

// ─────────────────────── Built-in Navigation Map ───────────────────────

function SbjiwalaNavMap({
  currentPos,
  heading = 0,
  speed = 0,
  storePoint,
  customerPoint,
  isPicked = false,
  orderNumber,
  onClose,
}: NavigationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);
  const leg1LineRef = useRef<any>(null);
  const leg2LineRef = useRef<any>(null);
  const followMode = useRef(true);
  const routeFetchTimer = useRef<any>(null);

  const [activeRoute, setActiveRoute] = useState<RouteData | null>(null);
  const [nextStep, setNextStep] = useState<OsrmStep | null>(null);
  const [arrivedAtStore, setArrivedAtStore] = useState(false);
  const [arrivedAtCustomer, setArrivedAtCustomer] = useState(false);
  const [isFollowing, setIsFollowing] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const destPoint = isPicked ? customerPoint : storePoint;
  const destDistKm = destPoint
    ? haversineKm(currentPos[0], currentPos[1], destPoint.lat, destPoint.lng)
    : null;

  // Proximity detection
  useEffect(() => {
    if (storePoint && !isPicked) {
      const d = haversineKm(currentPos[0], currentPos[1], storePoint.lat, storePoint.lng);
      setArrivedAtStore(d <= 0.15);
    }
    if (customerPoint && isPicked) {
      const d = haversineKm(currentPos[0], currentPos[1], customerPoint.lat, customerPoint.lng);
      setArrivedAtCustomer(d <= 0.15);
    }
  }, [currentPos, storePoint, customerPoint, isPicked]);

  // Determine next instruction step
  useEffect(() => {
    if (!activeRoute || activeRoute.steps.length === 0) {
      setNextStep(null);
      return;
    }
    // Find first step with meaningful distance
    const step = activeRoute.steps.find(s => s.distanceM > 30) || activeRoute.steps[0];
    setNextStep(step || null);
  }, [activeRoute]);

  // Initialize map
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;
    let active = true;

    mapRef.current.innerHTML = "";
    (mapRef.current as any)._leaflet_id = null;

    import("leaflet").then((L) => {
      if (!active || !mapRef.current || mapObjRef.current) return;

      const initialCenter = destPoint
        ? [destPoint.lat, destPoint.lng] as [number, number]
        : currentPos;

      const map = L.map(mapRef.current!, {
        attributionControl: false,
        zoomControl: false,
      }).setView(initialCenter, 15);

      // Dark navigation tiles
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "",
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Store marker
      if (storePoint) {
        const icon = L.divIcon({ className: "", html: storeMarkerHtml(), iconSize: [38, 38], iconAnchor: [19, 19] });
        L.marker([storePoint.lat, storePoint.lng], { icon }).addTo(map)
          .bindPopup(`<b>📦 ${storePoint.label}</b>`);
      }

      // Customer marker
      if (customerPoint) {
        const icon = L.divIcon({ className: "", html: customerMarkerHtml(), iconSize: [38, 38], iconAnchor: [19, 19] });
        L.marker([customerPoint.lat, customerPoint.lng], { icon }).addTo(map)
          .bindPopup(`<b>🏠 ${customerPoint.label}</b>`);
      }

      // Leg 1: Current→Store (orange)
      const leg1 = L.polyline([], {
        color: "#f97316", weight: 6, lineCap: "round", lineJoin: "round",
        opacity: isPicked ? 0.25 : 0.95,
      }).addTo(map);
      leg1LineRef.current = leg1;

      // Leg 2: Store→Customer (green)
      const leg2 = L.polyline([], {
        color: "#10b981", weight: 6, lineCap: "round", lineJoin: "round",
        opacity: isPicked ? 0.95 : 0.35,
      }).addTo(map);
      leg2LineRef.current = leg2;

      // Vehicle marker
      const vIcon = L.divIcon({ className: "", html: vehicleMarkerHtml(heading, isPicked), iconSize: [44, 44], iconAnchor: [22, 22] });
      const vMarker = L.marker(currentPos, { icon: vIcon, zIndexOffset: 1000 }).addTo(map);
      vehicleMarkerRef.current = vMarker;

      mapObjRef.current = map;
      setMapReady(true);

      // Fetch both legs initially
      const fetchAll = async () => {
        if (storePoint) {
          const leg1Data = await fetchRoute(currentPos, [storePoint.lat, storePoint.lng]);
          if (!active) return;
          leg1.setLatLngs(leg1Data.coords);
          if (!isPicked) {
            setActiveRoute(leg1Data);
          }
        }
        if (storePoint && customerPoint) {
          const leg2Data = await fetchRoute([storePoint.lat, storePoint.lng], [customerPoint.lat, customerPoint.lng]);
          if (!active) return;
          leg2.setLatLngs(leg2Data.coords);
          if (isPicked) {
            // Re-fetch active leg: current → customer
            const activeData = await fetchRoute(currentPos, [customerPoint.lat, customerPoint.lng]);
            if (!active) return;
            leg1.setLatLngs(activeData.coords);
            setActiveRoute(activeData);
          }
        }

        // Fit bounds to show all markers
        const points: [number, number][] = [currentPos];
        if (storePoint) points.push([storePoint.lat, storePoint.lng]);
        if (customerPoint) points.push([customerPoint.lat, customerPoint.lng]);
        if (active && mapObjRef.current) {
          mapObjRef.current.fitBounds(points, { padding: [50, 50], maxZoom: 16 });
        }
      };
      fetchAll();
    });

    return () => {
      active = false;
      if (mapObjRef.current) { mapObjRef.current.remove(); mapObjRef.current = null; }
      if (routeFetchTimer.current) clearTimeout(routeFetchTimer.current);
    };
  }, []);

  // Update vehicle position + re-route on position change
  useEffect(() => {
    if (!mapReady || !mapObjRef.current) return;

    // Update vehicle marker position and rotation
    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng(currentPos);
      const L = (window as any).L;
      if (L) {
        const newIcon = L.divIcon({
          className: "",
          html: vehicleMarkerHtml(heading, isPicked),
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });
        vehicleMarkerRef.current.setIcon(newIcon);
      }
    }

    // Follow mode: pan map to vehicle
    if (isFollowing && followMode.current) {
      mapObjRef.current.panTo(currentPos, { animate: true, duration: 0.8 });
    }

    // Debounced re-route every 15s
    if (routeFetchTimer.current) clearTimeout(routeFetchTimer.current);
    routeFetchTimer.current = setTimeout(async () => {
      const dest = isPicked ? customerPoint : storePoint;
      if (!dest || !leg1LineRef.current) return;
      const data = await fetchRoute(currentPos, [dest.lat, dest.lng]);
      if (leg1LineRef.current) leg1LineRef.current.setLatLngs(data.coords);
      setActiveRoute(data);
    }, 15000);
  }, [currentPos, heading, mapReady, isFollowing, isPicked]);

  const handleLocateMe = useCallback(() => {
    if (mapObjRef.current) {
      followMode.current = true;
      setIsFollowing(true);
      mapObjRef.current.flyTo(currentPos, 16, { animate: true, duration: 1.2 });
    }
  }, [currentPos]);

  const handleMapDrag = useCallback(() => {
    followMode.current = false;
    setIsFollowing(false);
  }, []);

  useEffect(() => {
    if (!mapReady || !mapObjRef.current) return;
    mapObjRef.current.on("dragstart", handleMapDrag);
    return () => mapObjRef.current?.off("dragstart", handleMapDrag);
  }, [mapReady, handleMapDrag]);

  const arrived = isPicked ? arrivedAtCustomer : arrivedAtStore;
  const arrivedLabel = isPicked
    ? (customerPoint?.label || "Customer")
    : (storePoint?.label || "Store");

  return (
    <div className="flex flex-col h-full w-full relative bg-slate-950 rounded-2xl overflow-hidden">

      {/* Top info bar */}
      <div className="absolute top-0 left-0 right-0 z-[1002] pointer-events-none">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 bg-gradient-to-b from-slate-950/95 to-transparent">
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={onClose}
              className="p-2 bg-slate-800/90 hover:bg-slate-700 text-white rounded-full border border-slate-700 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {orderNumber ? `Order #${orderNumber}` : "Navigation"}
              </p>
              <p className="text-xs font-black text-white">
                {isPicked ? "🏠 Delivering to Customer" : "📦 Heading to Pickup"}
              </p>
            </div>
          </div>

          {/* ETA panel */}
          {activeRoute && activeRoute.distanceM > 0 && (
            <div className="bg-slate-800/90 border border-slate-700 rounded-2xl px-3 py-2 text-right pointer-events-none">
              <p className="text-base font-black text-white leading-tight">
                {formatDuration(activeRoute.durationS)}
              </p>
              <p className="text-[10px] font-bold text-slate-400">
                {formatDistance(activeRoute.distanceM)} away
              </p>
            </div>
          )}
        </div>

        {/* Arrived banner */}
        {arrived && (
          <div className="mx-3 bg-emerald-500 border border-emerald-400 rounded-2xl px-4 py-2.5 flex items-center gap-2.5 shadow-xl animate-bounce pointer-events-none">
            <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0" />
            <div>
              <p className="text-xs font-black text-white">You've arrived!</p>
              <p className="text-[10px] text-emerald-100">
                You are near {arrivedLabel}
              </p>
            </div>
          </div>
        )}

        {/* Next step instruction */}
        {!arrived && nextStep && (
          <div className="mx-3 mt-1 bg-slate-800/95 border border-slate-700 rounded-2xl px-4 py-2.5 flex items-center gap-2.5 pointer-events-none">
            <span className="text-xl">{maneuverIcon(nextStep.maneuver)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-white truncate">{nextStep.instruction}</p>
              <p className="text-[10px] text-slate-400 font-semibold">
                in {formatDistance(nextStep.distanceM)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Map canvas */}
      <div ref={mapRef} className="flex-1 w-full" style={{ minHeight: 320 }} />

      {/* Sbjiwala watermark */}
      <div className="absolute bottom-20 left-3 pointer-events-none text-[9px] font-black text-white/30 tracking-[0.2em] z-[1001]">
        SABJIWALA NAV
      </div>

      {/* Speed badge */}
      {speed > 0.5 && (
        <div className="absolute bottom-20 right-14 z-[1002] bg-slate-800/90 border border-slate-700 rounded-xl px-2.5 py-1.5 text-center">
          <p className="text-sm font-black text-white leading-none">{Math.round(speed * 3.6)}</p>
          <p className="text-[8px] text-slate-400 font-bold">km/h</p>
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 z-[1002] p-3 bg-gradient-to-t from-slate-950/95 to-transparent">
        <div className="flex gap-2">
          {/* Route legend */}
          <div className="flex-1 bg-slate-800/90 border border-slate-700 rounded-2xl px-3 py-2.5 flex items-center gap-3">
            {storePoint && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-orange-500 flex-shrink-0" />
                <span className="text-[10px] font-bold text-slate-300 truncate max-w-[70px]">
                  {storePoint.label}
                </span>
              </div>
            )}
            {customerPoint && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-[10px] font-bold text-slate-300 truncate max-w-[70px]">
                  {customerPoint.label}
                </span>
              </div>
            )}
          </div>

          {/* Follow me button */}
          <button
            onClick={handleLocateMe}
            className={`p-3 rounded-2xl border transition-all cursor-pointer ${
              isFollowing
                ? "bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/25"
                : "bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <LocateFixed className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── Navigation Chooser Modal ───────────────────────

export interface NavigationChooserProps extends NavigationMapProps {
  /** If true, renders the chooser sheet and (when chosen) the built-in nav */
  isOpen: boolean;
  onDismiss: () => void;
}

export function NavigationChooser({
  isOpen,
  onDismiss,
  ...navProps
}: NavigationChooserProps) {
  const [mode, setMode] = useState<"chooser" | "builtin" | null>(null);

  useEffect(() => {
    if (!isOpen) setMode(null);
    else setMode("chooser");
  }, [isOpen]);

  if (!isOpen) return null;

  // Build Google Maps URL
  const dest = navProps.isPicked ? navProps.customerPoint : navProps.storePoint;
  const googleMapsUrl = dest
    ? `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`
    : null;

  if (mode === "builtin") {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: "#0a0f1a" }}>
        <SbjiwalaNavMap
          {...navProps}
          onClose={() => { setMode("chooser"); }}
        />
      </div>
    );
  }

  // Chooser bottom sheet
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onDismiss} />
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl p-6 animate-slide-up shadow-2xl">

        {/* Handle */}
        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-5" />

        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Navigate To</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {dest ? dest.label : "Destination"}
            </p>
          </div>
          <button onClick={onDismiss} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Google Maps option */}
          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onDismiss}
              className="flex items-center gap-4 p-4 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50 dark:bg-slate-800/50 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] group cursor-pointer"
            >
              <div className="w-11 h-11 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
                {/* Google Maps "G" icon */}
                <svg viewBox="0 0 24 24" width="26" height="26">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335"/>
                  <path d="M12 5c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" fill="white"/>
                  <path d="M12 7.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z" fill="#EA4335"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Google Maps
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Opens in Google Maps app or browser
                </p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </a>
          )}

          {/* Sbjiwala built-in nav */}
          <button
            onClick={() => setMode("builtin")}
            className="w-full flex items-center gap-4 p-4 border-2 border-emerald-500/60 dark:border-emerald-500/50 hover:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] group cursor-pointer text-left"
          >
            <div className="w-11 h-11 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
              <Route className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Sbjiwala Navigation
                </p>
                <span className="text-[8px] bg-emerald-500 text-white font-black px-1.5 py-0.5 rounded-full">BUILT-IN</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Route map, turn-by-turn directions & arrival alerts
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
          </button>
        </div>

        {/* Distance hint */}
        {dest && (
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 mt-4 font-semibold">
            <MapPin className="w-3 h-3 inline mr-1" />
            {haversineKm(navProps.currentPos[0], navProps.currentPos[1], dest.lat, dest.lng).toFixed(1)} km from your current position
          </p>
        )}
      </div>
    </div>
  );
}

// Default export for convenience
export default NavigationChooser;
