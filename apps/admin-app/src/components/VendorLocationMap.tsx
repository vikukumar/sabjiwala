"use client";

import React, { useEffect, useRef } from "react";

interface VendorLocationMapProps {
  lat: number;
  lng: number;
  storeName?: string;
  height?: string;
  draggable?: boolean;
  onLocationChange?: (lat: number, lng: number) => void;
}

export default function VendorLocationMap({
  lat, lng, storeName = "Store", height = "200px", draggable = false, onLocationChange
}: VendorLocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;
    if ((mapRef.current as any)._leaflet_id) return;

    let map: any = null;
    let active = true;

    import("leaflet").then((L) => {
      if (!active || !mapRef.current) return;
      if ((mapRef.current as any)._leaflet_id) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const storeIcon = L.divIcon({
        html: `<div style="background:#3b82f6;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid white;box-shadow:0 3px 12px rgba(59,130,246,0.5)">🏪</div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        className: "",
      });

      map = L.map(mapRef.current!).setView([lat, lng], 15);
      const isDark = document.documentElement.classList.contains("dark");
      L.tileLayer(
        isDark
          ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        { attribution: "© OpenStreetMap © CARTO", subdomains: "abcd", maxZoom: 20 }
      ).addTo(map);

      const marker = L.marker([lat, lng], { icon: storeIcon, draggable }).addTo(map);
      marker.bindPopup(`<b>${storeName}</b>`).openPopup();

      if (draggable && onLocationChange) {
        marker.on("dragend", (e: any) => {
          const pos = e.target.getLatLng();
          onLocationChange(pos.lat, pos.lng);
        });
        map.on("click", (e: any) => {
          marker.setLatLng(e.latlng);
          onLocationChange(e.latlng.lat, e.latlng.lng);
        });
      }
    });

    return () => {
      active = false;
      if (map) map.remove();
    };
  }, [lat, lng]);

  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <div ref={mapRef} style={{ height }} className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm" />
    </>
  );
}
