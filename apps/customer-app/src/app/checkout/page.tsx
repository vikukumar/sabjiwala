"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useRouter } from "next/navigation";
import { resolveLink } from "@/components/AppShell";
import {
  MapPin, Plus, CheckCircle2, CreditCard, Wallet, Banknote, ArrowRight,
  Loader2, Home, Briefcase, Star, Package, Truck, Shield, X, ChevronDown, Navigation
} from "lucide-react";
import { Button, Badge, Spinner, EmptyState } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";
import { useForm } from "react-hook-form";
import { createLocationPinIcon, createGPSLocationIcon } from "@sbjiwala/shared";

// ==================== CONFIG CHECK ====================
// Cashfree is enabled only when NEXT_PUBLIC_CASHFREE_APP_ID is set in env
const CASHFREE_APP_ID = process.env.NEXT_PUBLIC_CASHFREE_APP_ID || "";
const CASHFREE_ENABLED = Boolean(CASHFREE_APP_ID);

// ==================== ADDRESS FORM ====================
function AddressForm({ onSave, onCancel, existing }: {
  onSave: (data: any) => void; onCancel: () => void; existing?: any;
}) {
  const [step, setStep] = useState<"map" | "details">(existing ? "details" : "map");
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: existing?.latitude || 19.076,
    lng: existing?.longitude || 72.877
  });
  const [isLocating, setIsLocating] = useState(false);
  const [resolvedAddressText, setResolvedAddressText] = useState("");

  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const gpsMarkerRef = useRef<any>(null);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    defaultValues: existing || {
      label: "Home",
      full_name: "",
      phone: "",
      address_line_1: "",
      address_line_2: "",
      city: "",
      state: "Maharashtra",
      postal_code: "",
      is_default: false
    },
  });
  const [loading, setLoading] = useState(false);
  const { error: showError } = useToast();

  const reverseGeocode = (latitude: number, longitude: number) => {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
      .then(res => res.json())
      .then(data => {
        if (data) {
          setResolvedAddressText(data.display_name || "Custom Pin Location");
          if (data.address) {
            const road = data.address.road || data.address.suburb || data.address.neighbourhood || "";
            const city = data.address.city || data.address.town || data.address.suburb || "";
            const postcode = data.address.postcode || "";
            const state = data.address.state || "";

            setValue("address_line_1", data.display_name || "");
            setValue("city", city);
            setValue("state", state);
            setValue("postal_code", postcode);
          }
        }
      })
      .catch((err) => console.error("Reverse geocoding error:", err));
  };

  useEffect(() => {
    if (step !== "map" || typeof window === "undefined" || !mapRef.current) return;

    let map: any = null;
    let active = true;

    import("leaflet").then((L) => {
      if (!active || !mapRef.current) return;

      if ((mapRef.current as any)._leaflet_id) {
        return;
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      map = L.map(mapRef.current!, { attributionControl: false }).setView([coords.lat, coords.lng], 14);
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

      const pinIcon = createLocationPinIcon(L);

      const marker = L.marker([coords.lat, coords.lng], { draggable: true, icon: pinIcon }).addTo(map);
      markerRef.current = marker;

      marker.on("dragend", () => {
        const position = marker.getLatLng();
        setCoords({ lat: position.lat, lng: position.lng });
        reverseGeocode(position.lat, position.lng);
      });

      map.on("click", (e: any) => {
        marker.setLatLng(e.latlng);
        setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
        reverseGeocode(e.latlng.lat, e.latlng.lng);
      });

      // Watermark
      const watermarkControl = (L.control as any)({ position: 'bottomright' });
      watermarkControl.onAdd = function () {
        const div = L.DomUtil.create('div', 'watermark-overlay');
        div.innerHTML = '<span style="font-weight: 900; font-size: 2.5rem; opacity: 0.15; user-select: none; pointer-events: none; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">Sbjiwala</span>';
        div.style.padding = '10px';
        return div;
      };
      watermarkControl.addTo(map);

      mapObj.current = map;

      // Auto locate immediately on mount
      if (navigator.geolocation && !existing) {
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!active) return;
            const { latitude, longitude } = pos.coords;
            setCoords({ lat: latitude, lng: longitude });
            map.setView([latitude, longitude], 16);
            marker.setLatLng([latitude, longitude]);

            const gpsIcon = createGPSLocationIcon(L);
            if (!gpsMarkerRef.current) {
              gpsMarkerRef.current = L.marker([latitude, longitude], { icon: gpsIcon }).addTo(map);
            } else {
              gpsMarkerRef.current.setLatLng([latitude, longitude]);
            }

            reverseGeocode(latitude, longitude);
            setIsLocating(false);
          },
          (err) => {
            console.warn("Geolocation permission error", err);
            reverseGeocode(coords.lat, coords.lng);
            setIsLocating(false);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      } else {
        reverseGeocode(coords.lat, coords.lng);
      }
    });

    return () => {
      active = false;
      if (map) {
        map.remove();
      }
    };
  }, [step]);

  const handleLocateMe = () => {
    if (typeof window === "undefined" || !navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        if (mapObj.current) {
          mapObj.current.setView([latitude, longitude], 16);
        }
        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        }

        import("leaflet").then((L) => {
          const gpsIcon = createGPSLocationIcon(L);
          if (!gpsMarkerRef.current && mapObj.current) {
            gpsMarkerRef.current = L.marker([latitude, longitude], { icon: gpsIcon }).addTo(mapObj.current);
          } else if (gpsMarkerRef.current) {
            gpsMarkerRef.current.setLatLng([latitude, longitude]);
          }
        });

        reverseGeocode(latitude, longitude);
        setIsLocating(false);
      },
      (err) => {
        console.warn("Geolocation locate error", err);
        showError("Location Access Failed", "Please enable GPS/Location services or pin manually.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const payload = {
        ...data,
        latitude: coords.lat,
        longitude: coords.lng
      };
      let res;
      if (existing?.id) {
        res = await api.put(`/users/me/addresses/${existing.id}`, payload);
      } else {
        res = await api.post("/users/me/addresses", payload);
      }
      onSave(res.data);
    } catch (err: any) {
      showError("Failed to save address", err.response?.data?.detail || err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center px-4 pb-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />

      {/* Leaflet CSS */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />

      <form onSubmit={handleSubmit(onSubmit)} className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-base font-black text-slate-900 dark:text-white">
            {existing ? "Edit Address" : "Add Delivery Address"}
          </h3>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === "map" ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400">
                <span>Pin exact location on map</span>
                <button
                  type="button"
                  onClick={handleLocateMe}
                  className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5" /> Locate Me
                </button>
              </div>

              <div className="relative h-60 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800" style={{ zIndex: 1 }}>
                <div ref={mapRef} className="w-full h-full" />
                {isLocating && (
                  <div className="absolute inset-0 bg-slate-900/20 dark:bg-slate-950/40 backdrop-blur-[2px] flex items-center justify-center z-[1000]">
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl flex items-center gap-2 shadow-lg border border-slate-100 dark:border-slate-800">
                      <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Locating...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {resolvedAddressText && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/50 rounded-2xl flex gap-2.5 items-start">
                <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-450 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Pin Location Address</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed mt-0.5 break-words line-clamp-2">{resolvedAddressText}</p>
                </div>
              </div>
            )}

            <Button
              type="button"
              fullWidth
              onClick={() => setStep("details")}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Confirm Location & Proceed
            </Button>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            <button
              type="button"
              onClick={() => setStep("map")}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-450 transition-colors cursor-pointer"
            >
              ← Back to map location
            </button>

            <div className="flex gap-2">
              {["Home", "Work", "Other"].map(l => (
                <label key={l} className="flex-1">
                  <input type="radio" value={l} {...register("label")} className="sr-only peer" />
                  <div className="text-center py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all peer-checked:border-emerald-500 peer-checked:bg-emerald-50 dark:peer-checked:bg-emerald-950/20 peer-checked:text-emerald-700 dark:peer-checked:text-emerald-400 border-slate-200 dark:border-slate-800 text-slate-500">
                    {l === "Home" ? "🏠" : l === "Work" ? "💼" : "📍"} {l}
                  </div>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Full Name *</label>
                <input {...register("full_name", { required: true })} className="input-base px-3 py-2.5 text-sm" placeholder="e.g. Rahul Sharma" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Phone Number *</label>
                <input {...register("phone", { required: true })} className="input-base px-3 py-2.5 text-sm" placeholder="e.g. 9876543210" type="tel" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Flat / House / House No. *</label>
              <input {...register("address_line_1", { required: true })} className="input-base px-3 py-2.5 text-sm" placeholder="Flat/House No, Floor, Building Name" />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Street / Area / Landmark (Optional)</label>
              <input {...register("address_line_2")} className="input-base px-3 py-2.5 text-sm" placeholder="Nearby landmark or area name" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">City *</label>
                <input {...register("city", { required: true })} className="input-base px-3 py-2.5 text-sm" placeholder="Mumbai" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">State *</label>
                <input {...register("state", { required: true })} className="input-base px-3 py-2.5 text-sm" placeholder="Maharashtra" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">PIN Code *</label>
                <input {...register("postal_code", { required: true })} className="input-base px-3 py-2.5 text-sm" placeholder="400001" maxLength={6} />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer py-1">
              <input type="checkbox" {...register("is_default")} className="w-4 h-4 rounded accent-emerald-500" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Set as default delivery address</span>
            </label>

            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={loading} className="flex-1">Save & Select Address</Button>
              <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

// ==================== PAYMENT METHOD CARD ====================
function PaymentMethodCard({ selected, id, icon: Icon, label, desc, badge, onClick }: {
  selected: boolean; id: string; icon: any; label: string; desc: string; badge?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left cursor-pointer ${selected ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
      }`}>
      <div className={`p-2.5 rounded-xl ${selected ? "bg-emerald-100 dark:bg-emerald-950/40" : "bg-slate-100 dark:bg-slate-800"}`}>
        <Icon className={`w-5 h-5 ${selected ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-slate-900 dark:text-white">{label}</p>
          {badge && <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">{badge}</span>}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
      </div>
      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${selected ? "border-emerald-500 bg-emerald-500" : "border-slate-300 dark:border-slate-600"}`}>
        {selected && <div className="w-full h-full rounded-full flex items-center justify-center"><div className="w-2 h-2 bg-white rounded-full" /></div>}
      </div>
    </button>
  );
}

// ==================== PAGE ====================
export default function CheckoutPage() {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online" | "wallet">("cod");
  const [useWallet, setUseWallet] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any>(null);
  const [cashfreeLoading, setCashfreeLoading] = useState(false);
  const queryClient = useQueryClient();

  const isUnified = process.env.NEXT_PUBLIC_APP_MODE === "unified";

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sw_access_token") : null;
    if (!token) {
      router.replace(resolveLink(`/login?redirect=${isUnified ? "/app/checkout" : "/checkout"}`));
    }
  }, [router, isUnified]);

  // Load Cashfree SDK if enabled
  useEffect(() => {
    if (!CASHFREE_ENABLED || typeof window === "undefined") return;
    if ((window as any).Cashfree) return;
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    document.body.appendChild(script);
    return () => { try { document.body.removeChild(script); } catch { } };
  }, []);

  const { data: addresses = [], isLoading: addrLoading, refetch: refetchAddr } = useQuery<any[]>({
    queryKey: ["addresses"],
    queryFn: async () => { const r = await api.get("/users/me/addresses"); return r.data || []; },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
  });

  const { data: cartData } = useQuery<any>({
    queryKey: ["cart"],
    queryFn: async () => {
      const r = await api.get("/cart");
      if (Array.isArray(r.data)) return r.data[0] || { items: [], subtotal: 0, item_count: 0 };
      return r.data || { items: [], subtotal: 0, item_count: 0 };
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
    staleTime: 0,
  });

  const { data: walletData } = useQuery<any>({
    queryKey: ["wallet"],
    queryFn: async () => { const r = await api.get("/wallets/me"); return r.data || {}; },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
  });

  const { data: previewData } = useQuery<any>({
    queryKey: ["orderPreview", selectedAddress, paymentMethod, useWallet, cartData?.items, cartData?.coupon_code],
    queryFn: async () => {
      if (!cartData?.items?.length) return null;
      const vendorId = cartData.items[0]?.vendor_id;
      const res = await api.post("/orders/preview", {
        address_id: selectedAddress || null,
        payment_method: paymentMethod,
        use_wallet: useWallet,
        coupon_code: cartData?.coupon_code || null,
      }, { params: { vendor_id: vendorId } });
      return res.data;
    },
    enabled: typeof window !== "undefined" && !!cartData?.items?.length,
  });

  useEffect(() => {
    if (addresses.length > 0 && !selectedAddress) {
      const def = addresses.find((a: any) => a.is_default) || addresses[0];
      setSelectedAddress(def.id);
    }
  }, [addresses, selectedAddress]);

  const items = cartData?.items || [];
  const localSubtotal = React.useMemo(() => {
    return items.reduce((acc: number, item: any) => {
      const rawPrice = item.price || item.product?.attributes?.price || 30;
      const markedUpPrice = Math.round(rawPrice * 1.045 * 100) / 100;
      return acc + (markedUpPrice * item.quantity);
    }, 0);
  }, [items]);

  const subtotal = previewData ? previewData.subtotal : localSubtotal;
  const freeDeliveryAbove = previewData?.free_delivery_above ?? 199;
  const deliveryFee = previewData ? previewData.delivery_charge : (subtotal >= freeDeliveryAbove ? 0 : 20);
  const packagingCharge = previewData ? previewData.packaging_charge : 5.0;
  const platformFee = previewData ? previewData.platform_fee || 0 : 0.0;
  const convenienceFee = previewData ? previewData.convenience_fee || 0 : 0.0;

  const couponDiscount = previewData ? previewData.coupon_discount : 0.0;
  const taxableAmount = Math.max(0, subtotal + deliveryFee + packagingCharge + platformFee + convenienceFee - couponDiscount);
  const taxAmount = previewData ? previewData.tax_amount : Math.round(taxableAmount * 0.05 * 100) / 100;

  const walletBalance = walletData?.balance || 0;
  const walletDeduction = previewData ? previewData.wallet_deduction : (useWallet ? Math.round(Math.min(walletBalance, subtotal + deliveryFee + taxAmount + packagingCharge + platformFee + convenienceFee - couponDiscount) * 100) / 100 : 0);
  const finalTotal = previewData ? previewData.total_amount : Math.round(Math.max(0, subtotal + deliveryFee + taxAmount + packagingCharge + platformFee + convenienceFee - couponDiscount - walletDeduction) * 100) / 100;

  const savings = React.useMemo(() => {
    let itemSavings = 0;
    const items = cartData?.items || [];
    items.forEach((item: any) => {
      const p = item.product || item;
      const rawPrice = p.attributes?.price ?? p.price ?? 30;
      const rawMrp = p.attributes?.mrp ?? p.mrp;
      if (rawMrp && rawMrp > rawPrice) {
        const markedUpPrice = Math.round(rawPrice * 1.045 * 100) / 100;
        const markedUpMrp = Math.round(rawMrp * 1.045 * 100) / 100;
        itemSavings += (markedUpMrp - markedUpPrice) * item.quantity;
      }
    });
    itemSavings += couponDiscount;
    const freeDeliveryAbove = previewData?.free_delivery_above ?? 199;
    if (deliveryFee === 0 && subtotal >= freeDeliveryAbove) {
      itemSavings += parseFloat(previewData?.original_delivery_charge ?? 25.0);
    }
    if (packagingCharge === 0) {
      itemSavings += parseFloat(previewData?.original_packaging_charge ?? 10.0);
    }
    // Also consider if platform fee is exempted
    if (platformFee === 0 && previewData?.original_platform_fee) {
      // Wait, we didn't add original_platform_fee to backend, so we skip it.
    }
    return Math.max(0, itemSavings);
  }, [cartData?.items, couponDiscount, deliveryFee, packagingCharge, previewData, subtotal, platformFee]);

  const launchCashfree = async (orderData: any) => {
    const { payment_session_id, cashfree_order_id } = orderData;
    if (!payment_session_id) { showError("Payment Error", "Payment session not created. Try COD instead."); return; }
    setCashfreeLoading(true);
    try {
      const cashfree = new (window as any).Cashfree({ mode: process.env.NEXT_PUBLIC_CASHFREE_ENV === "production" ? "production" : "sandbox" });
      const checkoutOptions = {
        paymentSessionId: payment_session_id,
        returnUrl: `${window.location.origin}${resolveLink(`/orders/detail?id=${orderData.id}&payment=success`)}`,
      };
      await cashfree.checkout(checkoutOptions);
      success("Payment Successful! 🎉", "Your order has been confirmed.");
      router.push(resolveLink(`/orders/detail?id=${orderData.id}&new=1`));
    } catch (err: any) {
      showError("Payment Failed", "Cashfree payment could not be completed. Try Cash on Delivery.");
    } finally {
      setCashfreeLoading(false);
    }
  };

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!selectedAddress) throw new Error("Please select a delivery address");
      const items = cartData?.items || [];
      if (!items.length) throw new Error("Cart is empty");
      const vendorId = items[0]?.vendor_id;
      // For online via Cashfree, send "cashfree" as payment_method
      const backendPaymentMethod = paymentMethod === "online" && CASHFREE_ENABLED ? "cashfree" : paymentMethod;
      return api.post("/orders", {
        address_id: selectedAddress,
        payment_method: backendPaymentMethod,
        use_wallet: useWallet,
        coupon_code: cartData?.coupon_code || null,
      }, { params: { vendor_id: vendorId } });
    },
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });

      // Retrieve nested order and payment details
      const orderDetails = res.data?.order || res.data;
      const paymentDetails = res.data?.payment || {};
      const mergedOrderData = { ...orderDetails, ...paymentDetails };

      if (paymentMethod === "cod" || finalTotal <= 0) {
        success("Order Placed! 🎉", `Order #${mergedOrderData?.order_number} confirmed. Pay on delivery.`);
        router.push(resolveLink(`/orders/detail?id=${mergedOrderData?.id}&new=1`));
      } else if (paymentMethod === "wallet" && walletDeduction >= finalTotal) {
        success("Paid via Wallet! 🎉", `₹${walletDeduction.toFixed(2)} deducted from wallet.`);
        router.push(resolveLink(`/orders/detail?id=${mergedOrderData?.id}&new=1`));
      } else if (paymentMethod === "online" && CASHFREE_ENABLED) {
        await launchCashfree(mergedOrderData);
      } else {
        // Fallback: COD
        success("Order Placed! 🎉", `Order #${mergedOrderData?.order_number} confirmed.`);
        router.push(resolveLink(`/orders/detail?id=${mergedOrderData?.id}&new=1`));
      }
    },
    onError: (err: any) => showError("Order failed", err.response?.data?.detail || err.message),
  });

  const payMethods = [
    { id: "cod", icon: Banknote, label: "Cash on Delivery", desc: "Pay when your order arrives", badge: "Always Available" },
    ...(CASHFREE_ENABLED ? [{ id: "online", icon: CreditCard, label: "Online Payment", desc: "UPI, Cards, Netbanking via Cashfree" }] : []),
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Checkout</h1>
        <p className="text-xs text-slate-500 mt-0.5">Review your order and choose payment</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left Panel */}
        <div className="lg:col-span-3 space-y-4">
          {/* Delivery Address */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="font-black text-slate-900 dark:text-white text-sm">Delivery Address</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowAddForm(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>
                Add New
              </Button>
            </div>

            {showAddForm && (
              <AddressForm
                existing={editingAddress}
                onSave={(newAddr) => {
                  refetchAddr().then(() => {
                    if (newAddr?.id) {
                      setSelectedAddress(newAddr.id);
                    }
                  });
                  setShowAddForm(false);
                  setEditingAddress(null);
                }}
                onCancel={() => { setShowAddForm(false); setEditingAddress(null); }}
              />
            )}

            {addrLoading ? (
              <div className="flex justify-center py-6"><Spinner /></div>
            ) : addresses.length === 0 && !showAddForm ? (
              <div className="text-center py-6 space-y-3">
                <MapPin className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-sm text-slate-500">No saved addresses</p>
                <Button variant="secondary" size="sm" onClick={() => setShowAddForm(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>
                  Add Address
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {addresses.map((addr: any) => (
                  <div
                    key={addr.id}
                    onClick={() => setSelectedAddress(addr.id)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left cursor-pointer ${selectedAddress === addr.id ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 ${selectedAddress === addr.id ? "border-emerald-500 bg-emerald-500" : "border-slate-300"}`}>
                      {selectedAddress === addr.id && <div className="w-full h-full flex items-center justify-center"><div className="w-2.5 h-2.5 bg-white rounded-full" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-black text-slate-800 dark:text-white">
                          {addr.label === "Home" ? "🏠" : addr.label === "Work" ? "💼" : "📍"} {addr.label}
                        </span>
                        <div className="flex items-center gap-2">
                          {addr.is_default && <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">Default</span>}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingAddress(addr);
                              setShowAddForm(true);
                            }}
                            className="text-[10px] font-black text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 px-1.5 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{addr.full_name}</p>
                      <p className="text-xs text-slate-550 dark:text-slate-400 leading-snug">
                        {addr.address_line_1}{addr.address_line_2 ? `, ${addr.address_line_2}` : ""}, {addr.city} – {addr.postal_code}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">📞 {addr.phone}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="font-black text-slate-900 dark:text-white text-sm">Payment Method</h2>
            </div>

            <div className="space-y-2">
              {payMethods.map((pm) => (
                <PaymentMethodCard
                  key={pm.id}
                  selected={paymentMethod === pm.id}
                  id={pm.id}
                  icon={pm.icon}
                  label={pm.label}
                  desc={pm.desc}
                  badge={(pm as any).badge}
                  onClick={() => setPaymentMethod(pm.id as any)}
                />
              ))}
              {!CASHFREE_ENABLED && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-xl">
                  <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">Online payments via Cashfree will be available soon. Use COD for now.</p>
                </div>
              )}
            </div>

            {/* Wallet Toggle */}
            {walletBalance > 0 && paymentMethod !== "wallet" && (
              <label className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-xl cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-950/40 rounded-lg flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Use Wallet Balance</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Available: ₹{walletBalance.toFixed(2)}</p>
                  </div>
                </div>
                <input type="checkbox" checked={useWallet} onChange={e => setUseWallet(e.target.checked)} className="w-4 h-4 accent-emerald-500 rounded" />
              </label>
            )}
          </div>

          {/* Delivery Promise */}
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-2xl p-4 flex items-center gap-3">
            <Truck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-black text-emerald-900 dark:text-emerald-100">Instant Delivery Guarantee</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">Fresh vegetables delivered in Instant guaranteed!</p>
            </div>
          </div>
        </div>

        {/* Right: Order Summary */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 lg:sticky lg:top-24">
            <h2 className="font-black text-slate-900 dark:text-white">Order Summary</h2>

            {/* Cart Items */}
            <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-hide">
              {(cartData?.items || []).map((item: any) => {
                const rawPrice = item.price || item.product?.attributes?.price || 30;
                const markedUpPrice = Math.round(rawPrice * 1.045 * 100) / 100;
                const emoji = item.attributes?.image_emoji || item.product?.attributes?.image_emoji || "🥬";
                return (
                  <div key={item.id} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{emoji}</span>
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-white line-clamp-1">{item.product_name || item.name}</p>
                        <p className="text-[10px] text-slate-400">×{item.quantity}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-800 dark:text-white flex-shrink-0">₹{(markedUpPrice * item.quantity).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* Price Breakdown */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Delivery</span>
                <span className={deliveryFee === 0 ? "text-emerald-600 font-bold" : ""}>
                  {deliveryFee === 0 ? (
                    <>
                      {previewData?.original_delivery_charge && previewData.original_delivery_charge > 0 && (
                        <span className="line-through text-slate-400 mr-1.5 font-normal">
                          ₹{parseFloat(previewData.original_delivery_charge).toFixed(2)}
                        </span>
                      )}
                      FREE 🎉
                    </>
                  ) : `₹${deliveryFee.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Packaging</span>
                <span className={packagingCharge === 0 ? "text-emerald-600 font-bold" : ""}>
                  {packagingCharge === 0 ? (
                    <>
                      {previewData?.original_packaging_charge && previewData.original_packaging_charge > 0 && (
                        <span className="line-through text-slate-400 mr-1.5 font-normal">
                          ₹{parseFloat(previewData.original_packaging_charge).toFixed(2)}
                        </span>
                      )}
                      FREE 🎉
                    </>
                  ) : `₹${packagingCharge.toFixed(2)}`}
                </span>
              </div>
              {platformFee > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Platform Fee</span>
                  <span>₹{platformFee.toFixed(2)}</span>
                </div>
              )}
              {convenienceFee > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Convenience Fee</span>
                  <span>₹{convenienceFee.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Taxes (5%)</span><span>₹{taxAmount.toFixed(2)}</span></div>
              {couponDiscount > 0 && <div className="flex justify-between text-emerald-600"><span className="font-semibold">Coupon</span><span className="font-bold">-₹{couponDiscount.toFixed(2)}</span></div>}
              {walletDeduction > 0 && <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><span className="font-bold">Wallet</span><span className="font-bold">-₹{walletDeduction.toFixed(2)}</span></div>}
              <hr className="border-slate-200 dark:border-slate-800" />
              <div className="flex justify-between">
                <span className="font-black text-slate-900 dark:text-white text-sm">Total</span>
                <span className="font-black text-xl text-slate-900 dark:text-white">₹{finalTotal.toFixed(2)}</span>
              </div>
              {savings > 0 && (
                <div className="text-xs text-emerald-650 dark:text-emerald-400 font-semibold text-center py-1.5">
                  You save ₹{savings.toFixed(2)} on this order!
                </div>
              )}
              {paymentMethod === "cod" && (
                <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] font-bold text-orange-700 dark:text-orange-400">💵 Pay ₹{finalTotal.toFixed(2)} on delivery</p>
                </div>
              )}
            </div>

            <Button
              fullWidth size="lg"
              onClick={() => placeOrder.mutate()}
              loading={placeOrder.isPending || cashfreeLoading}
              disabled={!selectedAddress || !(cartData?.items?.length) || placeOrder.isPending || cashfreeLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {paymentMethod === "cod" ? "Place Order (COD)" : paymentMethod === "wallet" ? "Pay with Wallet" : "Pay Now"}
            </Button>

            <p className="text-[10px] text-center text-slate-400">
              By placing this order you agree to our <a href={resolveLink("/terms")} className="text-emerald-600 hover:underline">Terms</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
