"use client";

import React, { useState, useEffect, useRef } from "react";
import { RefreshCw, Building2, Truck, ShoppingBag, Loader2, Activity, Radio } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import AdminLayout from "@/components/AdminLayout";

function LiveOpsMap({ vendors, deliveryBoys, orders }: {
  vendors: any[];
  deliveryBoys: any[];
  orders: any[];
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;
    if (mapObjRef.current) return; // already initialized

    import("leaflet").then((L) => {
      if (!mapRef.current) return;
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const map = L.map(mapRef.current!, { zoomControl: true, attributionControl: false }).setView([19.076, 72.8777], 12);
      const isDark = document.documentElement.classList.contains("dark");
      L.tileLayer(
        isDark
          ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        { attribution: "© OpenStreetMap © CARTO", subdomains: "abcd", maxZoom: 20 }
      ).addTo(map);

      mapObjRef.current = map;
    });

    return () => {
      if (mapObjRef.current) {
        mapObjRef.current.remove();
        mapObjRef.current = null;
      }
    };
  }, []);

  // Update markers when data changes
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map) return;

    import("leaflet").then((L) => {
      // Clear old markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      // Add vendor markers 🏪
      vendors.forEach((vendor: any) => {
        const store = vendor.store || vendor.vendor_store || {};
        const lat = parseFloat(store.latitude || vendor.latitude || "0");
        const lng = parseFloat(store.longitude || vendor.longitude || "0");
        if (!lat || !lng) return;

        const isOnline = vendor.is_open || vendor.status === "approved";
        const iconHtml = `<div style="font-size: 28px; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; position: relative;">
          🏪
          ${isOnline ? '<div style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; background: #10b981; border-radius: 50%; border: 2px solid white; z-index: 3;"></div>' : '<div style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; background: #94a3b8; border-radius: 50%; border: 2px solid white; z-index: 3;"></div>'}
        </div>`;

        const icon = L.divIcon({
          html: iconHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          className: "",
        });

        const marker = L.marker([lat, lng], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:sans-serif;padding:4px">
              <b style="font-size:13px">🏪 ${vendor.business_name || "Vendor"}</b><br/>
              <span style="color:#6b7280;font-size:11px">${store.store_name || ""}</span><br/>
              <span style="font-size:11px">${store.city || ""}</span><br/>
              <span style="font-size:10px;font-weight:bold;color:${isOnline ? "#10b981" : "#94a3b8"}">${isOnline ? "● OPEN" : "○ CLOSED"}</span>
            </div>
          `);
        markersRef.current.push(marker);
      });

      // Add delivery boy markers 🛵
      deliveryBoys.forEach((boy: any) => {
        const lat = parseFloat(boy.current_latitude || boy.latitude || "0");
        const lng = parseFloat(boy.current_longitude || boy.longitude || "0");
        if (!lat || !lng) return;

        const isOnline = boy.is_online || boy.status === "approved";
        const isDelivering = boy.current_order_id;

        // Randomize vehicle emoji based on boy id
        const vehicles = ["🛵", "🏍️", "🚲"];
        const vehicleEmoji = vehicles[(boy.id?.charCodeAt(0) || 0) % vehicles.length] || "🛵";

        const iconHtml = `<div style="font-size: 28px; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; position: relative;">
          ${vehicleEmoji}
          ${isOnline ? `<div style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; background: ${isDelivering ? "#f59e0b" : "#10b981"}; border-radius: 50%; border: 2px solid white; z-index: 3;"></div>` : '<div style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; background: #94a3b8; border-radius: 50%; border: 2px solid white; z-index: 3;"></div>'}
        </div>`;

        const icon = L.divIcon({
          html: iconHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          className: "",
        });

        const marker = L.marker([lat, lng], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:sans-serif;padding:4px">
              <b style="font-size:13px">🛵 ${boy.full_name || "Delivery Partner"}</b><br/>
              <span style="color:#6b7280;font-size:11px">${boy.phone || ""}</span><br/>
              <span style="font-size:10px;color:#6b7280">${boy.vehicle_type || "scooty"} • ${boy.vehicle_number || ""}</span><br/>
              <span style="font-size:10px;font-weight:bold;color:${isDelivering ? "#f59e0b" : isOnline ? "#10b981" : "#94a3b8"}">${isDelivering ? "⚡ On Delivery" : isOnline ? "● Online" : "○ Offline"}</span>
            </div>
          `);
        markersRef.current.push(marker);
      });

      // Draw delivery route lines for active orders
      orders.forEach((order: any) => {
        if (!["assigned", "out_for_delivery", "picked"].includes(order.status)) return;
        const storeLat = parseFloat(order.vendor_store?.latitude || "0");
        const storeLng = parseFloat(order.vendor_store?.longitude || "0");
        const custLat = parseFloat(order.delivery_latitude || "0");
        const custLng = parseFloat(order.delivery_longitude || "0");
        if (!storeLat || !storeLng || !custLat || !custLng) return;

        const line = L.polyline([[storeLat, storeLng], [custLat, custLng]], {
          color: "#f59e0b",
          weight: 3,
          dashArray: "5 5",
          opacity: 0.6,
          lineCap: "round",
          lineJoin: "round"
        }).addTo(map);
        markersRef.current.push(line);

        // Customer icon 🏠
        const homeIcon = L.divIcon({
          html: `<div style="font-size: 28px; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 40px; height: 40px;">
            🙍‍♂️
          </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          className: "",
        });
        const custMarker = L.marker([custLat, custLng], { icon: homeIcon })
          .addTo(map)
          .bindPopup(`<b>📦 Order #${order.order_number}</b><br/>${order.delivery_address?.full_name || "Customer"}`);
        markersRef.current.push(custMarker);
      });

      // Fit bounds if we have markers
      if (markersRef.current.length > 0) {
        const group = L.featureGroup(markersRef.current.filter(m => m.getLatLng));
        if (group.getLayers().length > 0) {
          try { map.fitBounds(group.getBounds(), { padding: [40, 40] }); } catch {}
        }
      }
    });
  }, [vendors, deliveryBoys, orders]);

  return (
    <>
      <div ref={mapRef} className="w-full h-full rounded-2xl overflow-hidden" style={{ zIndex: 1 }} />
    </>
  );
}

export default function AdminMapsPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: vendors = [], isLoading: vendorsLoading, refetch: refetchVendors } = useQuery<any[]>({
    queryKey: ["adminLiveVendors"],
    queryFn: async () => {
      const res = await api.get("/admin/vendors", { params: { page_size: 100, status: "approved" } });
      return res.data?.data || res.data || [];
    },
    refetchInterval: autoRefresh ? 20000 : false,
  });

  const { data: deliveryBoys = [], isLoading: boysLoading, refetch: refetchBoys } = useQuery<any[]>({
    queryKey: ["adminLiveDeliveryBoys"],
    queryFn: async () => {
      const res = await api.get("/admin/delivery-boys", { params: { page_size: 100 } });
      return res.data?.data || res.data || [];
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const { data: ordersRes, isLoading: ordersLoading, refetch: refetchOrders } = useQuery<any>({
    queryKey: ["adminLiveOrders"],
    queryFn: async () => api.get("/orders", {
      params: { page_size: 50, status: "assigned,out_for_delivery,picked,accepted" }
    }),
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const activeOrders = ordersRes?.data?.data || [];
  const onlineDeliveryBoys = (deliveryBoys as any[]).filter((b: any) => b.is_online);
  const openVendors = (vendors as any[]).filter((v: any) => v.status === "approved");

  const isLoading = vendorsLoading || boysLoading || ordersLoading;

  const handleRefresh = () => {
    refetchVendors();
    refetchBoys();
    refetchOrders();
  };

  return (
    <AdminLayout title="Live Operations Map">
      <div className="space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Building2, label: "Active Vendors", value: openVendors.length, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
            { icon: Truck, label: "Online Riders", value: onlineDeliveryBoys.length, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
            { icon: ShoppingBag, label: "Active Orders", value: activeOrders.length, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
            { icon: Activity, label: "Total Riders", value: (deliveryBoys as any[]).length, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30" },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
              <div className={`p-2.5 rounded-xl flex-shrink-0 ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Map Controls */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 px-4 shadow-sm">
          <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-blue-500 inline-flex items-center justify-center text-[8px]">🏪</span> Vendors</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-emerald-500 inline-flex items-center justify-center text-[8px]">🛵</span> Riders Online</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-amber-500 inline-flex items-center justify-center text-[8px]">🛵</span> Riders Delivering</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-rose-500 inline-flex items-center justify-center text-[8px]">🏠</span> Customer</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(r => !r)}
              className={`flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                autoRefresh
                  ? "bg-emerald-100 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400"
                  : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600"
              }`}
            >
              <Radio className={`w-3 h-3 ${autoRefresh ? "animate-pulse" : ""}`} />
              {autoRefresh ? "Auto-Refresh ON" : "Auto-Refresh OFF"}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* The Map */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden" style={{ height: "calc(100vh - 300px)", minHeight: "500px" }}>
          {isLoading && !vendors.length && !deliveryBoys.length ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-3">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
                <p className="text-sm text-slate-500 font-semibold">Loading live map data...</p>
              </div>
            </div>
          ) : (
            <LiveOpsMap vendors={vendors as any[]} deliveryBoys={deliveryBoys as any[]} orders={activeOrders} />
          )}
        </div>

        {/* Sidebar Lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Online Riders */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-500" />
              Online Riders ({onlineDeliveryBoys.length})
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {onlineDeliveryBoys.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No riders online</p>
              ) : (
                onlineDeliveryBoys.map((boy: any) => (
                  <div key={boy.id} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-950/30 rounded-lg flex items-center justify-center text-sm">🛵</div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-white">{boy.full_name || "Rider"}</p>
                        <p className="text-[10px] text-slate-400">{boy.vehicle_type} • {boy.vehicle_number}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${boy.current_order_id ? "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" : "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"}`}>
                      {boy.current_order_id ? "Delivering" : "Available"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Orders */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-500" />
              Active Orders ({activeOrders.length})
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activeOrders.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No active orders</p>
              ) : (
                activeOrders.map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-white">#{order.order_number}</p>
                      <p className="text-[10px] text-slate-400">{order.vendor_store?.store_name || "Vendor"} → {order.delivery_address?.city || "Customer"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-900 dark:text-white">₹{order.total_amount}</p>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                        order.status === "out_for_delivery" ? "bg-cyan-100 text-cyan-700" : "bg-amber-100 text-amber-700"
                      }`}>{order.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
