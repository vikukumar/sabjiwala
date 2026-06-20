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
        html: `
          <div style="filter: drop-shadow(0 4px 10px rgba(239, 68, 68, 0.4)); position: relative; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px;">
            <span style="position: absolute; width: 46px; height: 46px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); animation: ping 1.8s infinite; display: block; box-sizing: border-box;"></span>
            <div style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 2; box-sizing: border-box;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                <path d="m2 7 4.41-3.67A2 2 0 0 1 7.73 3h8.54a2 2 0 0 1 1.32.33L22 7"/>
                <path d="M4 12V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/>
                <path d="M12 12A4 4 0 0 0 4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a4 4 0 0 0-8 0Z"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        className: "leaflet-custom-icon",
      });

      map = L.map(mapRef.current!, { attributionControl: false }).setView([lat, lng], 15);
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
