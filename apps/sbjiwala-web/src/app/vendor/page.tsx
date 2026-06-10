"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  DollarSign, ShoppingBag, Award, RefreshCw, Clock, MapPin, Loader2, Navigation, Save
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import VendorLayout from "@/components/VendorLayout";

export default function VendorDashboard() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Service Area & map states
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapObj, setMapObj] = useState<any>(null);
  const [markerObj, setMarkerObj] = useState<any>(null);
  const [circleObj, setCircleObj] = useState<any>(null);

  const [centerLat, setCenterLat] = useState(19.0760);
  const [centerLng, setCenterLng] = useState(72.9977);
  const [radius, setRadius] = useState(5.0);

  // Pricing rules states
  const [minOrder, setMinOrder] = useState("0.00");
  const [freeAbove, setFreeAbove] = useState("199.00");
  const [baseCharge, setBaseCharge] = useState("30.00");
  const [perKmCharge, setPerKmCharge] = useState("10.00");
  const [packagingFee, setPackagingFee] = useState("0.00");
  const [freePlatformFeeAbove, setFreePlatformFeeAbove] = useState("");

  // Timings states
  const [storeTimings, setStoreTimings] = useState<any>({
    monday: { open: "09:00", close: "21:00", is_closed: false },
    tuesday: { open: "09:00", close: "21:00", is_closed: false },
    wednesday: { open: "09:00", close: "21:00", is_closed: false },
    thursday: { open: "09:00", close: "21:00", is_closed: false },
    friday: { open: "09:00", close: "21:00", is_closed: false },
    saturday: { open: "09:00", close: "21:00", is_closed: false },
    sunday: { open: "09:00", close: "21:00", is_closed: false },
  });

  const { data: areasData } = useQuery<any>({
    queryKey: ["myServiceAreas"],
    queryFn: async () => {
      const res = await api.get("/vendors/me/service-areas");
      return res.data || [];
    }
  });

  const { data: rulesData } = useQuery<any>({
    queryKey: ["myDeliveryRules"],
    queryFn: async () => {
      const res = await api.get("/vendors/me/delivery-rules");
      return res.data || [];
    }
  });

  const { data: vendorProfileData } = useQuery<any>({
    queryKey: ["vendorProfile"],
    queryFn: async () => {
      const res = await api.get("/vendors/me");
      return res.data;
    }
  });

  const { data: metricsData } = useQuery<any>({
    queryKey: ["vendorMetrics"],
    queryFn: async () => {
      const res = await api.get("/vendors/me/metrics");
      return res.data;
    }
  });

  const { data: recentOrdersData } = useQuery<any>({
    queryKey: ["vendorRecentOrders"],
    queryFn: async () => {
      const res = await api.get("/orders", { params: { page_size: 5 } });
      return res.data || [];
    }
  });

  const vendorProfile = vendorProfileData || null;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (areasData && areasData.length > 0) {
      const activeArea = areasData[0];
      if (activeArea.center_latitude) setCenterLat(activeArea.center_latitude);
      if (activeArea.center_longitude) setCenterLng(activeArea.center_longitude);
      if (activeArea.radius_km) setRadius(activeArea.radius_km);
    }
  }, [areasData]);

  useEffect(() => {
    if (rulesData && rulesData.length > 0) {
      const activeRule = rulesData[0];
      setMinOrder(activeRule.min_order_amount.toString());
      setFreeAbove(activeRule.free_delivery_above ? activeRule.free_delivery_above.toString() : "");
      setBaseCharge(activeRule.base_delivery_charge.toString());
      setPerKmCharge(activeRule.per_km_charge.toString());
      setPackagingFee(activeRule.packaging_fee ? activeRule.packaging_fee.toString() : "0.00");
      setFreePlatformFeeAbove(activeRule.free_platform_fee_above ? activeRule.free_platform_fee_above.toString() : "");
    }
  }, [rulesData]);

  useEffect(() => {
    if (vendorProfile?.store?.store_timings) {
      setStoreTimings(vendorProfile.store.store_timings);
    }
  }, [vendorProfile]);

  useEffect(() => {
    if (!isMounted || typeof window === "undefined" || !mapContainerRef.current) return;

    let map: any = null;
    let active = true;

    import("leaflet").then((L) => {
      if (!active || !mapContainerRef.current) return;

      if ((mapContainerRef.current as any)._leaflet_id) {
        return;
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      map = L.map(mapContainerRef.current!).setView([centerLat, centerLng], 13);
      const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
      const tileUrl = isDark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
      const tiles = L.tileLayer(tileUrl, {
        attribution: "&copy; OpenStreetMap &copy; CARTO",
        subdomains: "abcd",
        maxZoom: 20
      }).addTo(map);
      tiles.on("tileerror", () => {
        tiles.setUrl("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
      });

      const storeIcon = L.divIcon({
        html: '<div style="background:#3b82f6;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3)">🏪</div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      const marker = L.marker([centerLat, centerLng], { icon: storeIcon, draggable: true }).addTo(map);
      setMarkerObj(marker);

      const circle = L.circle([centerLat, centerLng], {
        color: "#10b981",
        fillColor: "#10b981",
        fillOpacity: 0.15,
        radius: radius * 1000
      }).addTo(map);
      setCircleObj(circle);

      marker.on("dragend", (event: any) => {
        const position = event.target.getLatLng();
        setCenterLat(position.lat);
        setCenterLng(position.lng);
        circle.setLatLng(position);
      });

      map.on("click", (event: any) => {
        const position = event.latlng;
        setCenterLat(position.lat);
        setCenterLng(position.lng);
        marker.setLatLng(position);
        circle.setLatLng(position);
      });

      setMapObj(map);
    });

    return () => {
      active = false;
      if (map) map.remove();
    };
  }, [isMounted]);

  useEffect(() => {
    if (circleObj) {
      circleObj.setRadius(radius * 1000);
      if (mapObj) {
        mapObj.fitBounds(circleObj.getBounds(), { padding: [20, 20] });
      }
    }
  }, [radius, circleObj, mapObj]);

  useEffect(() => {
    if (mapObj && markerObj && circleObj) {
      const currentMarkerLatLng = markerObj.getLatLng();
      if (Math.abs(currentMarkerLatLng.lat - centerLat) > 0.00001 || Math.abs(currentMarkerLatLng.lng - centerLng) > 0.00001) {
        const latlng = [centerLat, centerLng] as [number, number];
        mapObj.setView(latlng, mapObj.getZoom());
        markerObj.setLatLng(latlng);
        circleObj.setLatLng(latlng);
      }
    }
  }, [centerLat, centerLng, mapObj, markerObj, circleObj]);

  const saveServiceAreaMutation = useMutation({
    mutationFn: async () => {
      return api.post("/vendors/me/service-areas", {
        name: "Main Delivery Zone",
        radius_km: radius,
        center_latitude: centerLat,
        center_longitude: centerLng,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myServiceAreas"] });
      success("Service Area updated successfully!");
    },
    onError: (err: any) => {
      showError("Update Failed", "Failed to update Service Area: " + (err.response?.data?.detail || err.message));
    }
  });

  const saveDeliveryRulesMutation = useMutation({
    mutationFn: async () => {
      return api.post("/vendors/me/delivery-rules", {
        min_order_amount: parseFloat(minOrder) || 0.0,
        free_delivery_above: freeAbove ? parseFloat(freeAbove) : null,
        base_delivery_charge: parseFloat(baseCharge) || 0.0,
        per_km_charge: parseFloat(perKmCharge) || 0.0,
        max_delivery_distance_km: radius,
        packaging_fee: parseFloat(packagingFee) || 0.0,
        free_platform_fee_above: freePlatformFeeAbove ? parseFloat(freePlatformFeeAbove) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myDeliveryRules"] });
      success("Delivery Rules updated successfully!");
    },
    onError: (err: any) => {
      showError("Update Failed", "Failed to update Delivery Rules: " + (err.response?.data?.detail || err.message));
    }
  });

  const updateTimingsMutation = useMutation({
    mutationFn: async () => {
      return api.put("/vendors/me/store/timings", {
        store_timings: storeTimings
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
      success("Store operating hours updated successfully!");
    },
    onError: (err: any) => {
      showError("Update Failed", "Failed to update store timings: " + (err.response?.data?.detail || err.message));
    }
  });

  const handleTimingChange = (day: string, field: string, value: any) => {
    setStoreTimings((prev: any) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const metrics = metricsData || {
    total_sales: 0,
    total_orders: 0,
    wallet_balance: 0,
    pending_balance: 0
  };

  const recentOrders = recentOrdersData || [];
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-[#090d10] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <VendorLayout title="Store Dashboard">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-205 dark:border-slate-800 p-6 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Sales</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50">₹{metrics.total_sales}</h3>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600 dark:text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-205 dark:border-slate-800 p-6 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Orders</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50">{metrics.total_orders}</h3>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-blue-600 dark:text-blue-400">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-205 dark:border-slate-800 p-6 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Wallet Balance</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50">₹{metrics.wallet_balance}</h3>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-amber-500 dark:text-amber-400">
            <Award className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-205 dark:border-slate-800 p-6 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Balance</p>
            <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">₹{metrics.pending_balance}</h3>
          </div>
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl text-rose-600 dark:text-rose-400">
            <RefreshCw className="w-6 h-6 animate-spin-slow" />
          </div>
        </div>
      </div>

      {/* Main Grid: Service Area & Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Service Area Map */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Store Service Area Map
              </h3>
              <p className="text-[10px] text-slate-500">Specify center point coordinates and active range radius on the map.</p>
            </div>
            <button
              onClick={() => {
                if (typeof window !== "undefined" && navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setCenterLat(pos.coords.latitude);
                      setCenterLng(pos.coords.longitude);
                      success("Store GPS obtained!");
                    },
                    () => showError("GPS Access Failed"),
                    { enableHighAccuracy: true }
                  );
                }
              }}
              className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-black border border-blue-150 dark:border-blue-900/50 flex items-center gap-1 cursor-pointer transition-all uppercase"
            >
              <Navigation className="w-3.5 h-3.5" /> GPS Locate Store
            </button>
          </div>

          <div ref={mapContainerRef} className="h-[300px] rounded-2xl border border-slate-205 dark:border-slate-800 overflow-hidden relative shadow-inner" style={{ zIndex: 1 }} />

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-150 dark:border-slate-800 text-[10px]">
            <div className="flex gap-4 font-mono text-slate-500">
              <div>Lat: <span className="font-bold text-slate-800 dark:text-slate-100">{centerLat.toFixed(6)}</span></div>
              <div>Lng: <span className="font-bold text-slate-800 dark:text-slate-100">{centerLng.toFixed(6)}</span></div>
            </div>
            <div className="flex gap-2 items-center">
              <span className="font-bold text-slate-500">Radius:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{radius.toFixed(1)} km</span>
            </div>
          </div>
        </div>

        {/* Range and Pricing Rules */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">Service Range Radius</h4>
            <div className="space-y-2">
              <input
                type="range"
                min="0.5"
                max="15.0"
                step="0.5"
                value={radius}
                onChange={(e) => setRadius(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
            </div>
            <button
              onClick={() => saveServiceAreaMutation.mutate()}
              disabled={saveServiceAreaMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {saveServiceAreaMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Active Range
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">Delivery Billing Rules</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-500 uppercase">Base Charge (₹)</label>
                <input
                  type="number"
                  value={baseCharge}
                  onChange={(e) => setBaseCharge(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-500 uppercase">Per-KM Fee (₹)</label>
                <input
                  type="number"
                  value={perKmCharge}
                  onChange={(e) => setPerKmCharge(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-500 uppercase">Min Order (₹)</label>
                <input
                  type="number"
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-500 uppercase">Free Delivery Above (₹)</label>
                <input
                  type="number"
                  placeholder="Optional"
                  value={freeAbove}
                  onChange={(e) => setFreeAbove(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="font-bold text-slate-500 uppercase">Packaging Fee (₹)</label>
                <input
                  type="number"
                  value={packagingFee}
                  onChange={(e) => setPackagingFee(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="font-bold text-slate-500 uppercase">Exempt Platform Fee Above Subtotal (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 500 (Free platform fee above ₹500)"
                  value={freePlatformFeeAbove}
                  onChange={(e) => setFreePlatformFeeAbove(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <button
              onClick={() => saveDeliveryRulesMutation.mutate()}
              disabled={saveDeliveryRulesMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {saveDeliveryRulesMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Delivery Rules
            </button>
          </div>
        </div>
      </div>

      {/* Timings & Recent Orders Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Timing Config */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div>
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Store Operating Hours
            </h4>
            <p className="text-[10px] text-slate-500">Define days and timings when store is open and accepting order dispatches.</p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateTimingsMutation.mutate();
            }}
            className="space-y-3 text-xs"
          >
            <div className="divide-y divide-slate-100 dark:divide-slate-850">
              {days.map((day) => {
                const timing = storeTimings[day] || { open: "09:00", close: "21:00", is_closed: false };
                return (
                  <div key={day} className="py-2 flex items-center justify-between gap-4 capitalize">
                    <span className="font-bold w-16 text-slate-600 dark:text-slate-400">{day}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="time"
                        disabled={timing.is_closed}
                        value={timing.open}
                        onChange={e => handleTimingChange(day, "open", e.target.value)}
                        className="px-1.5 py-0.5 rounded-lg border dark:border-slate-800 bg-transparent font-semibold font-mono text-[10px] disabled:opacity-30 text-slate-900 dark:text-white"
                      />
                      <span className="text-slate-400 font-mono text-[9px]">to</span>
                      <input
                        type="time"
                        disabled={timing.is_closed}
                        value={timing.close}
                        onChange={e => handleTimingChange(day, "close", e.target.value)}
                        className="px-1.5 py-0.5 rounded-lg border dark:border-slate-800 bg-transparent font-semibold font-mono text-[10px] disabled:opacity-30 text-slate-900 dark:text-white"
                      />
                    </div>

                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={timing.is_closed}
                        onChange={e => handleTimingChange(day, "is_closed", e.target.checked)}
                        className="rounded accent-rose-500 w-3 h-3"
                      />
                      <span className={`text-[9px] font-bold ${timing.is_closed ? "text-rose-500" : "text-slate-400"}`}>
                        Closed
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>

            <button
              type="submit"
              disabled={updateTimingsMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl transition-all shadow flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {updateTimingsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Operating Hours
            </button>
          </form>
        </div>

        {/* Recent Orders Overview */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">Last 5 Orders</h4>
            <a href="/vendor/orders" className="text-emerald-600 dark:text-emerald-400 hover:underline text-[10px] font-bold">Go to Orders Board →</a>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {recentOrders.length > 0 ? (
              recentOrders.map((order: any) => (
                <div key={order.id} className="py-3 flex justify-between items-center gap-4">
                  <div>
                    <h5 className="font-extrabold text-slate-800 dark:text-slate-150">#Order {order.order_number}</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">₹{order.total_amount} • {order.payment_method.toUpperCase()}</p>
                  </div>
                  <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                    order.status === "pending"
                      ? "bg-amber-100 dark:bg-amber-955/40 text-amber-800 dark:text-amber-400"
                      : order.status === "confirmed"
                        ? "bg-purple-100 dark:bg-purple-955/40 text-purple-800 dark:text-purple-400"
                        : order.status === "accepted"
                          ? "bg-teal-100 dark:bg-teal-955/40 text-teal-800 dark:text-teal-400"
                          : "bg-emerald-100 dark:bg-emerald-955/40 text-emerald-800 dark:text-emerald-400"
                  }`}>
                    {order.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400">No recent orders.</div>
            )}
          </div>
        </div>
      </div>
    </VendorLayout>
  );
}
