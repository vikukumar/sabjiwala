"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import DeliveryLayout, { useDelivery } from "@/components/DeliveryLayout";
import { MapPin } from "lucide-react";

// Haversine Distance helper
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

function VendorLocatorMapContent() {
  const { globalPos, isOnline } = useDelivery();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapObj, setMapObj] = useState<any>(null);
  const driverMarkerRef = useRef<any>(null);

  // Fetch locator vendors
  const { data: stores = [] } = useQuery<any[]>({
    queryKey: ["locatorVendors"],
    queryFn: async () => {
      const res = await api.get("/delivery/vendors");
      return res.data || [];
    },
    enabled: isOnline,
  });

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;
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

      map = L.map(mapContainerRef.current!).setView(globalPos, 13);
      const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
      const tileUrl = isDark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
      const tiles = L.tileLayer(tileUrl, {
        attribution: "&copy; OpenStreetMap &copy; CARTO",
        subdomains: "abcd",
        maxZoom: 20
      }).addTo(map);
      tiles.on("tileerror", () => {
        tiles.setUrl("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
      });

      // Rider Marker
      const driverIcon = L.divIcon({
        html: `
          <div style="filter: drop-shadow(0 6px 16px rgba(16,185,129,0.3)); position: relative;">
            <span style="position: absolute; top: -5px; left: -5px; width: 46px; height: 46px; border-radius: 50%; background: rgba(16,185,129,0.15); animation: ping 1.5s infinite;"></span>
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.15)">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;">
                <circle cx="18.5" cy="17.5" r="2.5"></circle>
                <circle cx="5.5" cy="17.5" r="2.5"></circle>
                <path d="M15 5h1a2 2 0 0 1 2 2v2"></path>
                <path d="M12 17.5V14l-3-3 4-3 2 3h2"></path>
              </svg>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      const driverMarker = L.marker(globalPos, { icon: driverIcon }).addTo(map);
      driverMarkerRef.current = driverMarker;

      // Store Markers
      const storeIcon = L.divIcon({
        html: `
          <div style="filter: drop-shadow(0 4px 10px rgba(59,130,246,0.35)); position: relative;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.15)">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                <path d="m2 7 4.41-3.67A2 2 0 0 1 7.73 3h8.54a2 2 0 0 1 1.32.33L22 7"/>
                <path d="M4 12V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/>
                <path d="M12 12A4 4 0 0 0 4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a4 4 0 0 0-8 0Z"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const bounds: any[] = [globalPos];

      stores.forEach((store) => {
        if (store.latitude && store.longitude) {
          const storePos: [number, number] = [store.latitude, store.longitude];
          bounds.push(storePos);
          L.marker(storePos, { icon: storeIcon })
            .addTo(map)
            .bindPopup(`<b>${store.store_name || "Vendor Store"}</b><br/>${store.address_line_1 || ""}`);
        }
      });

      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }

      setMapObj(map);
    });

    return () => {
      active = false;
      if (map) map.remove();
    };
  }, [stores]);

  useEffect(() => {
    if (mapObj && driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng(globalPos);
    }
  }, [globalPos, mapObj]);

  const sortedStores = [...stores].map(store => {
    const distance = store.latitude && store.longitude
      ? getHaversineDistance(globalPos[0], globalPos[1], store.latitude, store.longitude)
      : null;
    return { ...store, distance };
  }).sort((a, b) => {
    if (a.distance === null) return 1;
    if (b.distance === null) return -1;
    return a.distance - b.distance;
  });

  return (
    <div className="space-y-4">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Vendor Locator Map</h3>
          <span className="text-[10px] font-bold text-slate-400">
            {isOnline ? `${stores.length} stores nearby` : "Go Online to locate stores"}
          </span>
        </div>
        
        <div ref={mapContainerRef} className="h-64 rounded-2xl border border-slate-200 dark:border-slate-800 relative shadow-inner overflow-hidden" style={{ zIndex: 1 }} />
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Nearby Vendor Stores</h4>
        {sortedStores.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-500 font-medium">
            {isOnline ? "No active stores found." : "Go online to see store locations."}
          </div>
        ) : (
          sortedStores.map((store) => (
            <div key={store.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex justify-between items-center gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-950/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">🏪</span>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{store.store_name || "Vendor Store"}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{store.address_line_1 || "Store address"}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                  {store.distance !== null ? `${store.distance.toFixed(2)} km` : "N/A"}
                </span>
                <span className="block text-[9px] text-slate-400">away</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function VendorLocatorMapPage() {
  return (
    <DeliveryLayout>
      <VendorLocatorMapContent />
    </DeliveryLayout>
  );
}
