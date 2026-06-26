"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  DollarSign, ShoppingBag, Award, RefreshCw, Clock, MapPin, Loader2, Navigation, Save,
  TrendingUp, BarChart3, Check, X, Package, Truck, CheckCircle2
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/index";
import Link from "next/link";
import VendorLayout, { resolveVendorLink } from "@/components/VendorLayout";

// =========== OTP & Image Upload Modal ===========
function OtpPromptModal({
  isOpen, title, message, onConfirm, onCancel, loading
}: {
  isOpen: boolean; title: string; message: string;
  onConfirm: (otp: string, images: string[]) => void; onCancel: () => void; loading?: boolean;
}) {
  const [otp, setOtp] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { success, error: showError } = useToast();

  useEffect(() => {
    if (isOpen) {
      setOtp("");
      setImages([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploadedUrls: string[] = [...images];
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);
        const res = await api.post("/storage/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        const resAny = res as any;
        const url = resAny.url || resAny.data?.url || resAny.data?.data?.url;
        if (url) {
          uploadedUrls.push(url);
        }
      }
      setImages(uploadedUrls);
      success("Success", "Photos uploaded successfully!");
    } catch (err: any) {
      showError("Upload Failed", err.response?.data?.detail || err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, idx) => idx !== index));
  };

  return (
    <div className="fixed inset-0 md:left-64 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-in text-center shadow-2xl text-slate-850 dark:text-white">
        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center mx-auto">
          <Package className="w-7 h-7 text-emerald-600 dark:text-emerald-450" />
        </div>
        <h3 className="text-base font-black uppercase tracking-wider">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">{message}</p>

        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-slate-400 uppercase text-left mb-1">Enter Customer OTP</label>
          <input
            type="text" maxLength={4} pattern="[0-9]*" inputMode="numeric"
            value={otp} onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-full text-center tracking-[1.5em] pl-[1.5em] py-2 text-2xl font-black border-2 border-slate-200 dark:border-slate-700 rounded-2xl bg-transparent focus:outline-none focus:border-emerald-500 transition-colors"
            placeholder="••••" disabled={loading}
          />
        </div>

        <div className="space-y-2 text-left">
          <div className="flex justify-between items-center">
            <label className="block text-[10px] font-bold text-slate-400 uppercase">
              Upload Proof Pics ({images.length}/2 minimum)
            </label>
            {images.length < 2 && (
              <span className="text-[9px] font-black text-rose-500 uppercase animate-pulse">Required</span>
            )}
          </div>

          <input
            type="file" multiple accept="image/*"
            ref={fileInputRef} onChange={handleFileUpload}
            className="hidden" disabled={loading || uploading}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || uploading}
            className="w-full py-2.5 border-2 border-dashed border-slate-205 dark:border-slate-800 hover:border-emerald-500 rounded-2xl text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
            ) : (
              <span>📷 Upload Verification Photos</span>
            )}
          </button>

          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-2 pt-1">
              {images.map((url, idx) => (
                <div key={idx} className="relative aspect-square border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden group">
                  <img src={url} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-0.5 hover:bg-rose-600 shadow-sm"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="primary"
            onClick={() => { if (otp.length === 4 && images.length >= 2) onConfirm(otp, images); }}
            disabled={otp.length !== 4 || images.length < 2 || loading || uploading}
            loading={loading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold"
          >
            Verify & Deliver
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={loading || uploading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function VendorDashboard() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [selectedOrderForDeliveryOption, setSelectedOrderForDeliveryOption] = useState<any>(null);
  const [otpConfirmOrder, setOtpConfirmOrder] = useState<any>(null);

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

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ["vendorAnalytics"],
    queryFn: async () => {
      const res = await api.get("/vendors/me/analytics", { params: { period: "7d" } });
      return res.data;
    }
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status, notes, deliveryOption, otp, images }: { orderId: string, status: string, notes?: string, deliveryOption?: string, otp?: string, images?: string[] }) => {
      return api.patch(`/orders/${orderId}/status`, {
        status,
        notes: notes || `Updated to ${status} via Dashboard`,
        delivery_option: deliveryOption || "auto",
        otp,
        images
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorRecentOrders"] });
      queryClient.invalidateQueries({ queryKey: ["vendorMetrics"] });
      queryClient.invalidateQueries({ queryKey: ["vendorAnalytics"] });
      success("Order status updated successfully!");
    },
    onError: (err: any) => {
      showError("Status Update Failed", err.response?.data?.detail || err.message);
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
    } else if (areasData && areasData.length === 0) {
      if (typeof window !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCenterLat(pos.coords.latitude);
            setCenterLng(pos.coords.longitude);
          },
          (err) => {
            console.warn("Auto GPS locator failed", err);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }
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

      map = L.map(mapContainerRef.current!, { attributionControl: false }).setView([centerLat, centerLng], 13);
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

      const storeIcon = L.divIcon({
        html: `
          <div style="filter: drop-shadow(0 4px 10px rgba(239, 68, 68, 0.4)); position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px;">
            <span style="position: absolute; width: 42px; height: 42px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); animation: ping 1.8s infinite; display: block; box-sizing: border-box;"></span>
            <div style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.15); z-index: 2; box-sizing: border-box;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                <path d="m2 7 4.41-3.67A2 2 0 0 1 7.73 3h8.54a2 2 0 0 1 1.32.33L22 7"/>
                <path d="M4 12V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/>
                <path d="M12 12A4 4 0 0 0 4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a4 4 0 0 0-8 0Z"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        className: "bg-transparent border-none shadow-none"
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
      <div className="fixed inset-0 z-[9999] bg-[#090d10] flex flex-col items-center justify-center space-y-6">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 w-32 h-32 rounded-full border-[3px] border-slate-800 animate-ping opacity-20" style={{ animationDuration: '2s' }} />
          <div className="w-28 h-28 rounded-[2rem] bg-gradient-to-tr from-emerald-600/20 to-teal-500/20 backdrop-blur-md border border-emerald-500/30 flex items-center justify-center p-4 shadow-[0_0_80px_rgba(16,185,129,0.25)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite]" />
            <img
              src={"/icon.png"}
              alt="Vendor Portal"
              className="w-full h-full object-contain drop-shadow-2xl animate-pulse"
              style={{ animationDuration: '2.5s' }}
              onError={(e) => { e.currentTarget.src = "/icon.png"; }}
            />
          </div>
        </div>
        <div className="text-center space-y-3 mt-8">
          <h2 className="text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-emerald-100 to-emerald-400">
            Sbjiwala VENDOR
          </h2>
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-[0.3em]">Preparing Dashboard</p>
            <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full animate-[progress_1.5s_ease-in-out_infinite_alternate] w-1/2" />
            </div>
          </div>
        </div>
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

      {/* Analytics Trend Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-105 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Sales Trend (Last 7 Days)
              </h3>
              <p className="text-[10px] text-slate-500">Daily store earnings trend overview</p>
            </div>
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-full">
              ₹{(analyticsData?.revenue_trend || []).reduce((sum: number, d: any) => sum + (d.revenue || 0), 0).toFixed(2)} Total
            </span>
          </div>

          <div className="relative w-full h-[200px] flex items-center justify-center">
            {analyticsLoading ? (
              <div className="flex items-center gap-2 text-slate-450"><Loader2 className="w-4 h-4 animate-spin" /> Loading trend...</div>
            ) : (
              (() => {
                const trendData = analyticsData?.revenue_trend || [
                  { date: "Mon", revenue: 0 },
                  { date: "Tue", revenue: 0 },
                  { date: "Wed", revenue: 0 },
                  { date: "Thu", revenue: 0 },
                  { date: "Fri", revenue: 0 },
                  { date: "Sat", revenue: 0 },
                  { date: "Sun", revenue: 0 }
                ];
                const maxRevenue = Math.max(...trendData.map((d: any) => d.revenue || 0), 100);
                const revenuePoints = trendData.map((d: any, i: number) => {
                  const x = 40 + i * (460 - 40) / Math.max(1, trendData.length - 1);
                  const y = 170 - ((d.revenue || 0) / maxRevenue) * (170 - 30);
                  return { x, y, val: d.revenue || 0, date: d.date };
                });

                const linePath = revenuePoints.reduce((acc: string, p: any, i: number) => {
                  return acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
                }, "");
                const areaPath = linePath ? (linePath + ` L ${revenuePoints[revenuePoints.length - 1].x} 170 L ${revenuePoints[0].x} 170 Z`) : "";

                const formatTrendDate = (dateStr: string) => {
                  try {
                    const d = new Date(dateStr);
                    if (isNaN(d.getTime())) return dateStr;
                    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                  } catch { return dateStr; }
                };

                return (
                  <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient id="salesAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                      const y = 30 + p * (170 - 30);
                      return (
                        <line key={i} x1="40" y1={y} x2="460" y2={y} stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeDasharray="3 3" />
                      );
                    })}
                    <text x="35" y="35" textAnchor="end" className="fill-slate-400 text-[9px] font-mono">₹{Math.round(maxRevenue)}</text>
                    <text x="35" y="100" textAnchor="end" className="fill-slate-400 text-[9px] font-mono">₹{Math.round(maxRevenue / 2)}</text>
                    <text x="35" y="170" textAnchor="end" className="fill-slate-400 text-[9px] font-mono">₹0</text>

                    {areaPath && <path d={areaPath} fill="url(#salesAreaGrad)" />}
                    {linePath && <path d={linePath} fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />}

                    {revenuePoints.map((p: any, i: number) => (
                      <g key={i} className="group/dot cursor-pointer">
                        <circle cx={p.x} cy={p.y} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2" className="transition-all group-hover/dot:r-7" />
                        <g className="opacity-0 group-hover/dot:opacity-100 transition-opacity duration-200 pointer-events-none">
                          <rect x={Math.max(10, p.x - 45)} y={p.y - 35} width="90" height="24" rx="6" fill="#1e293b" />
                          <text x={p.x} y={p.y - 20} textAnchor="middle" fill="#ffffff" className="text-[9px] font-bold">₹{p.val.toFixed(0)}</text>
                        </g>
                      </g>
                    ))}

                    {revenuePoints.map((p: any, i: number) => (
                      <text key={i} x={p.x} y="190" textAnchor="middle" className="fill-slate-450 dark:fill-slate-500 text-[9px] font-bold">
                        {formatTrendDate(p.date)}
                      </text>
                    ))}
                  </svg>
                );
              })()
            )}
          </div>
        </div>

        {/* Orders Trend Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-105 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Orders Trend (Last 7 Days)
              </h3>
              <p className="text-[10px] text-slate-500">Daily processed orders volume overview</p>
            </div>
            <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-2.5 py-1 rounded-full">
              {(analyticsData?.orders_trend || []).reduce((sum: number, d: any) => sum + (d.orders || 0), 0)} Orders
            </span>
          </div>

          <div className="relative w-full h-[200px] flex items-center justify-center">
            {analyticsLoading ? (
              <div className="flex items-center gap-2 text-slate-450"><Loader2 className="w-4 h-4 animate-spin" /> Loading trend...</div>
            ) : (
              (() => {
                const ordersData = analyticsData?.orders_trend || [
                  { date: "Mon", orders: 0 },
                  { date: "Tue", orders: 0 },
                  { date: "Wed", orders: 0 },
                  { date: "Thu", orders: 0 },
                  { date: "Fri", orders: 0 },
                  { date: "Sat", orders: 0 },
                  { date: "Sun", orders: 0 }
                ];
                const maxOrders = Math.max(...ordersData.map((d: any) => d.orders || 0), 5);

                const formatTrendDate = (dateStr: string) => {
                  try {
                    const d = new Date(dateStr);
                    if (isNaN(d.getTime())) return dateStr;
                    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                  } catch { return dateStr; }
                };

                return (
                  <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient id="ordersBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#1d4ed8" />
                      </linearGradient>
                    </defs>
                    {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                      const y = 30 + p * (170 - 30);
                      return (
                        <line key={i} x1="40" y1={y} x2="460" y2={y} stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeDasharray="3 3" />
                      );
                    })}
                    <text x="35" y="35" textAnchor="end" className="fill-slate-400 text-[9px] font-mono">{Math.round(maxOrders)}</text>
                    <text x="35" y="100" textAnchor="end" className="fill-slate-400 text-[9px] font-mono">{Math.round(maxOrders / 2)}</text>
                    <text x="35" y="170" textAnchor="end" className="fill-slate-400 text-[9px] font-mono">0</text>

                    {ordersData.map((d: any, i: number) => {
                      const barWidth = 24;
                      const x = 50 + i * (450 - 50) / Math.max(1, ordersData.length - 1) - barWidth / 2;
                      const barHeight = ((d.orders || 0) / maxOrders) * 140;
                      const y = 170 - barHeight;
                      return (
                        <g key={i} className="group/bar cursor-pointer">
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            rx={5}
                            fill="url(#ordersBarGrad)"
                            className="transition-all group-hover/bar:opacity-85"
                          />
                          <g className="opacity-0 group-hover/bar:opacity-100 transition-opacity duration-200 pointer-events-none">
                            <rect x={Math.max(10, x - 28)} y={y - 30} width="80" height="22" rx="6" fill="#1e293b" />
                            <text x={x + barWidth / 2} y={y - 16} textAnchor="middle" fill="#ffffff" className="text-[9px] font-bold">{d.orders} orders</text>
                          </g>
                        </g>
                      );
                    })}

                    {ordersData.map((d: any, i: number) => {
                      const x = 50 + i * (450 - 50) / Math.max(1, ordersData.length - 1);
                      return (
                        <text key={i} x={x} y="190" textAnchor="middle" className="fill-slate-450 dark:fill-slate-500 text-[9px] font-bold">
                          {formatTrendDate(d.date)}
                        </text>
                      );
                    })}
                  </svg>
                );
              })()
            )}
          </div>
        </div>
      </div>

      {/* Service Area & Map Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-105 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Service Area Configuration
            </h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Delivery Area Radius (km)</label>
              <input
                type="number"
                step="0.5"
                value={radius}
                onChange={(e) => setRadius(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div className="relative w-full h-[300px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
              <div ref={mapContainerRef} className="absolute inset-0 z-0"></div>
              {/* Watermark */}
              <div className="absolute bottom-4 left-4 z-[400] pointer-events-none opacity-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-full border border-slate-200/50 shadow-sm flex items-center gap-2">
                <span className="text-xl">🥦</span>
                <span className="text-xs font-black tracking-widest text-slate-800 dark:text-slate-200">Sbjiwala</span>
              </div>
            </div>
            <Button onClick={() => saveServiceAreaMutation.mutate()} loading={saveServiceAreaMutation.isPending} className="w-full text-xs font-bold py-2.5">
              Save Delivery Zone
            </Button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-105 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Delivery Pricing Rules
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Base Delivery Charge (₹)</label>
              <input type="number" step="1" value={baseCharge} onChange={(e) => setBaseCharge(e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Per KM Charge (₹)</label>
              <input type="number" step="0.5" value={perKmCharge} onChange={(e) => setPerKmCharge(e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Min Order Amount (₹)</label>
              <input type="number" step="1" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Free Delivery Above (₹)</label>
              <input type="number" step="1" value={freeAbove} onChange={(e) => setFreeAbove(e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-emerald-500" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Packaging Fee (₹)</label>
              <input type="number" step="1" value={packagingFee} onChange={(e) => setPackagingFee(e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Free Platform Fee Above (₹)</label>
              <input type="number" step="1" value={freePlatformFeeAbove} onChange={(e) => setFreePlatformFeeAbove(e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-emerald-500" placeholder="Optional" />
            </div>
          </div>
          <Button onClick={() => saveDeliveryRulesMutation.mutate()} loading={saveDeliveryRulesMutation.isPending} className="w-full text-xs font-bold py-2.5 mt-2">
            Save Pricing Rules
          </Button>
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
            <Link href={resolveVendorLink("/orders")} className="text-emerald-600 dark:text-emerald-400 hover:underline text-[10px] font-bold">Go to Orders Board →</Link>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {recentOrders.length > 0 ? (
              recentOrders.map((order: any) => (
                <div key={order.id} className="py-3 flex justify-between items-center gap-4">
                  <div>
                    <h5 className="font-extrabold text-slate-800 dark:text-slate-150">#Order {order.order_number}</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">₹{order.total_amount} • {order.payment_method.toUpperCase()}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${order.status === "pending"
                      ? "bg-amber-100 dark:bg-amber-955/40 text-amber-800 dark:text-amber-400"
                      : order.status === "confirmed"
                        ? "bg-purple-100 dark:bg-purple-955/40 text-purple-800 dark:text-purple-400"
                        : order.status === "accepted"
                          ? "bg-teal-100 dark:bg-teal-955/40 text-teal-800 dark:text-teal-400"
                          : order.status === "packed"
                            ? "bg-blue-100 dark:bg-blue-955/40 text-blue-800 dark:text-blue-400"
                            : order.status === "out_for_delivery"
                              ? "bg-orange-100 dark:bg-orange-955/40 text-orange-850 dark:text-orange-400"
                              : "bg-emerald-100 dark:bg-emerald-955/40 text-emerald-800 dark:text-emerald-400"
                      }`}>
                      {order.status}
                    </span>

                    <div className="flex gap-1.5">
                      {(order.status === "pending" || order.status === "confirmed") && (
                        <>
                          <button
                            onClick={() => setSelectedOrderForDeliveryOption(order)}
                            disabled={updateOrderStatus.isPending}
                            className="bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-950/30 dark:hover:bg-emerald-600 dark:text-emerald-400 dark:hover:text-white text-[10px] font-black px-2.5 py-1 rounded-lg border border-emerald-250 dark:border-emerald-900/40 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => updateOrderStatus.mutate({ orderId: order.id, status: "cancelled", notes: "Cancelled by vendor" })}
                            disabled={updateOrderStatus.isPending}
                            className="bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white dark:bg-rose-950/30 dark:hover:bg-rose-600 dark:text-rose-400 dark:hover:text-white text-[10px] font-black px-2.5 py-1 rounded-lg border border-rose-250 dark:border-rose-900/40 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {order.status === "accepted" && (
                        <button
                          onClick={() => updateOrderStatus.mutate({ orderId: order.id, status: "packed" })}
                          disabled={updateOrderStatus.isPending}
                          className="bg-purple-50 hover:bg-purple-655 text-purple-700 hover:text-white dark:bg-purple-950/30 dark:hover:bg-purple-600 dark:text-purple-450 dark:hover:text-white text-[10px] font-black px-2.5 py-1 rounded-lg border border-purple-250 dark:border-purple-900/40 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          Pack Order
                        </button>
                      )}
                      {order.status === "packed" && (
                        <button
                          onClick={() => updateOrderStatus.mutate({ orderId: order.id, status: "out_for_delivery" })}
                          disabled={updateOrderStatus.isPending}
                          className="bg-blue-50 hover:bg-blue-655 text-blue-700 hover:text-white dark:bg-blue-950/30 dark:hover:bg-blue-600 dark:text-blue-450 dark:hover:text-white text-[10px] font-black px-2.5 py-1 rounded-lg border border-blue-250 dark:border-blue-900/40 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          Ship / Out
                        </button>
                      )}
                      {order.status === "out_for_delivery" && (
                        <button
                          onClick={() => setOtpConfirmOrder(order)}
                          disabled={updateOrderStatus.isPending}
                          className="bg-emerald-50 hover:bg-emerald-655 text-emerald-700 hover:text-white dark:bg-emerald-950/30 dark:hover:bg-emerald-600 dark:text-emerald-455 dark:hover:text-white text-[10px] font-black px-2.5 py-1 rounded-lg border border-emerald-250 dark:border-emerald-900/40 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          Deliver
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400">No recent orders.</div>
            )}
          </div>
        </div>
      </div>

      {/* Delivery Option Selection Modal */}
      {selectedOrderForDeliveryOption && (
        <div className="fixed inset-0 md:left-64 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedOrderForDeliveryOption(null)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-scale-in space-y-6 text-slate-850 dark:text-white">
            <div className="space-y-1">
              <h3 className="text-base font-black uppercase tracking-wider">Accept Order #{selectedOrderForDeliveryOption.order_number}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Choose how this order will be delivered before you start packing.</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => {
                  updateOrderStatus.mutate({
                    orderId: selectedOrderForDeliveryOption.id,
                    status: "accepted",
                    notes: "Order accepted by vendor with Platform Delivery",
                    deliveryOption: "auto"
                  });
                  setSelectedOrderForDeliveryOption(null);
                }}
                className="flex flex-col items-start p-4 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] text-left cursor-pointer group"
              >
                <span className="font-extrabold text-xs text-slate-850 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                  🚲 Platform Delivery Partner
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                  Our system will automatically search and assign a delivery boy based on proximity to match order destination.
                </span>
              </button>

              <button
                onClick={() => {
                  updateOrderStatus.mutate({
                    orderId: selectedOrderForDeliveryOption.id,
                    status: "accepted",
                    notes: "Order accepted by vendor with Self Delivery",
                    deliveryOption: "self"
                  });
                  setSelectedOrderForDeliveryOption(null);
                }}
                className="flex flex-col items-start p-4 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] text-left cursor-pointer group"
              >
                <span className="font-extrabold text-xs text-slate-850 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                  🎒 Store Self Delivery
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                  Deliver using your own store runner or personal courier. No platform delivery partner will be dispatched.
                </span>
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSelectedOrderForDeliveryOption(null)}
                className="flex-1 py-3 border border-slate-205 dark:border-slate-850 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OTP Confirmation Modal */}
      <OtpPromptModal
        isOpen={!!otpConfirmOrder}
        title="Delivery OTP Verification"
        message={`Enter 4-digit OTP and upload proof photos to deliver Order #${otpConfirmOrder?.order_number}`}
        loading={updateOrderStatus.isPending}
        onConfirm={(otp, images) => {
          updateOrderStatus.mutate({
            orderId: otpConfirmOrder.id,
            status: "delivered",
            otp,
            images,
            notes: "Order marked delivered by vendor (Self Delivery Verification)"
          });
          setOtpConfirmOrder(null);
        }}
        onCancel={() => setOtpConfirmOrder(null)}
      />
    </VendorLayout>
  );
}
