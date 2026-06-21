"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MapPin, Navigation, Loader2, CheckCircle2, Search, RefreshCw
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import VendorLayout, { resolveVendorLink } from "@/components/VendorLayout";
import { createStoreIcon } from "@sbjiwala/shared";

function StoreLocationMap({
  lat, lng, onLocationChange, radius
}: {
  lat: number; lng: number; onLocationChange: (lat: number, lng: number) => void; radius: number;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;
    if (mapObjRef.current) return;

    // Clean up container to prevent duplicate map overlays in strict-mode
    mapRef.current.innerHTML = "";
    (mapRef.current as any)._leaflet_id = null;

    let active = true;
    import("leaflet").then((L) => {
      if (!active || !mapRef.current || mapObjRef.current) return;
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const storeIcon = createStoreIcon();

      const map = L.map(mapRef.current!, { attributionControl: false }).setView([lat, lng], 15);
      const isDark = document.documentElement.classList.contains("dark");
      L.tileLayer(
        isDark
          ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        { attribution: "", subdomains: "abcd", maxZoom: 20 }
      ).addTo(map);

      const marker = L.marker([lat, lng], { icon: storeIcon, draggable: true }).addTo(map);
      marker.bindPopup("📍 Drag me to set your store location!").openPopup();

      const circle = L.circle([lat, lng], {
        radius: radius * 1000,
        color: "#3b82f6",
        fillColor: "#3b82f6",
        fillOpacity: 0.1,
        weight: 2,
        dashArray: "5 5",
      }).addTo(map);

      marker.on("dragend", (e: any) => {
        const pos = e.target.getLatLng();
        circle.setLatLng(pos);
        onLocationChange(pos.lat, pos.lng);
      });

      map.on("click", (e: any) => {
        marker.setLatLng(e.latlng);
        circle.setLatLng(e.latlng);
        onLocationChange(e.latlng.lat, e.latlng.lng);
      });

      mapObjRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;
    });

    return () => {
      active = false;
      if (mapObjRef.current) { mapObjRef.current.remove(); mapObjRef.current = null; }
    };
  }, []);

  // Update marker/circle when lat/lng changes
  useEffect(() => {
    if (markerRef.current && mapObjRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      if (circleRef.current) circleRef.current.setLatLng([lat, lng]);
      mapObjRef.current.setView([lat, lng], mapObjRef.current.getZoom());
    }
  }, [lat, lng]);

  // Update circle radius when it changes
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radius * 1000);
    }
  }, [radius]);

  return (
    <>
      <div ref={mapRef} className="w-full h-96 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-inner" />
    </>
  );
}

export default function VendorLocationPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [geocodeQuery, setGeocodeQuery] = useState("");
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const { data: storeData, isLoading } = useQuery<any>({
    queryKey: ["vendorStore"],
    queryFn: async () => {
      const res = await api.get("/vendors/me");
      return res.data;
    },
  });

  const store = storeData?.store || {};
  const [lat, setLat] = useState<number>(parseFloat(store.latitude || "19.0760"));
  const [lng, setLng] = useState<number>(parseFloat(store.longitude || "72.8777"));
  const [radius, setRadius] = useState<number>(store.service_radius_km || 5);
  const [address, setAddress] = useState(store.address_line_1 || "");

  // Sync when storeData loads
  useEffect(() => {
    if (store.latitude) setLat(parseFloat(store.latitude));
    if (store.longitude) setLng(parseFloat(store.longitude));
    if (store.service_radius_km) setRadius(store.service_radius_km);
    if (store.address_line_1) setAddress(store.address_line_1);
  }, [store.latitude, store.longitude]);

  const handleLocationChange = useCallback((newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    // Reverse geocode
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${newLat}&lon=${newLng}&format=json`)
      .then(r => r.json())
      .then(data => {
        if (data.display_name) {
          setAddress(data.display_name.split(",").slice(0, 3).join(","));
        }
      })
      .catch(() => {});
  }, []);

  const handleGpsLocate = () => {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        handleLocationChange(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setGpsLoading(false);
        showError("Location Error", "Could not get GPS location. Please pin manually on the map.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleGeocode = async () => {
    if (!geocodeQuery.trim()) return;
    setGeocodeLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(geocodeQuery)}&format=json&limit=1&countrycodes=IN`);
      const data = await res.json();
      if (data.length > 0) {
        const { lat: newLat, lon: newLon, display_name } = data[0];
        setLat(parseFloat(newLat));
        setLng(parseFloat(newLon));
        setAddress(display_name.split(",").slice(0, 3).join(","));
      } else {
        showError("Not Found", "Address not found. Try a more specific query.");
      }
    } catch {
      showError("Error", "Failed to search address.");
    } finally {
      setGeocodeLoading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => api.patch("/vendors/me/store/location", {
      latitude: lat,
      longitude: lng,
      service_radius_km: radius,
      address_line_1: address,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorStore"] });
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
      success("Store location saved! 🏪", "Your store is now visible on the map for nearby customers.");
    },
    onError: (err: any) => showError("Failed", err.response?.data?.detail || err.message),
  });

  return (
    <VendorLayout title="Store Location">
      <div className="space-y-5">
        {/* Info Banner */}
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-2xl p-4 flex items-start gap-3">
          <MapPin className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-black text-blue-800 dark:text-blue-300">Set Your Store Location</h3>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              Drag the 🏪 pin or click on the map to set your exact store location. This determines which customers see your products.
            </p>
          </div>
        </div>

        {/* Search + GPS Controls */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text" placeholder="Search for your store address..."
                value={geocodeQuery} onChange={e => setGeocodeQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleGeocode()}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white"
              />
            </div>
            <button onClick={handleGeocode} disabled={geocodeLoading}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
              {geocodeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Search
            </button>
            <button onClick={handleGpsLocate} disabled={gpsLoading}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
              {gpsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
              GPS
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
              <p className="text-slate-400 font-bold uppercase text-[10px]">Latitude</p>
              <p className="font-black text-slate-900 dark:text-white font-mono">{lat.toFixed(6)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
              <p className="text-slate-400 font-bold uppercase text-[10px]">Longitude</p>
              <p className="font-black text-slate-900 dark:text-white font-mono">{lng.toFixed(6)}</p>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
          <StoreLocationMap lat={lat} lng={lng} onLocationChange={handleLocationChange} radius={radius} />
          <p className="text-[10px] text-center text-slate-400">Click anywhere on the map or drag the 🏪 pin to set your exact store location</p>
        </div>

        {/* Settings */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="font-black text-slate-900 dark:text-white text-sm">Delivery Radius</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
              <span>Service radius: {radius} km</span>
              <span className="text-blue-500">The blue circle shows your delivery zone</span>
            </div>
            <input
              type="range" min={1} max={30} step={0.5} value={radius}
              onChange={e => setRadius(parseFloat(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>1 km</span>
              <span>30 km</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Store Address (auto-filled)</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Store address..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white" />
          </div>

          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saveMutation.isPending ? "Saving Location..." : "Save Store Location"}
          </button>
        </div>
      </div>
    </VendorLayout>
  );
}
