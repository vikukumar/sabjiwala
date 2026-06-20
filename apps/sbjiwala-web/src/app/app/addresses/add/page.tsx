"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@sbjiwala/shared";
import { MapPin, Navigation, Home, Briefcase, ChevronRight, ArrowLeft, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";
import { useForm } from "react-hook-form";
import { resolveLink } from "@/components/AppShell";

export default function AddAddressPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addressId = searchParams.get("id");

  const { success, error: showError } = useToast();
  
  // State for step: 1 (Map Picker), 2 (Form Details)
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingGeocode, setLoadingGeocode] = useState(false);
  
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 19.076,
    lng: 72.877
  });
  
  const [reverseAddress, setReverseAddress] = useState("");

  const mapRef = useRef<HTMLDivElement>(null);
  const [mapObj, setMapObj] = useState<any>(null);
  const markerRef = useRef<any>(null);

  const { register, handleSubmit, setValue, reset } = useForm({
    defaultValues: {
      label: "Home",
      full_name: "",
      phone: "",
      address_line_1: "",
      city: "",
      state: "Maharashtra",
      postal_code: "",
      is_default: false
    }
  });

  // Load existing address details if in edit mode
  useEffect(() => {
    if (!addressId) {
      // Try to load current user location if available in localStorage as fallback
      if (typeof window !== "undefined") {
        const storedLat = localStorage.getItem("sw_latitude");
        const storedLng = localStorage.getItem("sw_longitude");
        const storedName = localStorage.getItem("sw_location_name");
        if (storedLat && storedLng) {
          setCoords({ lat: parseFloat(storedLat), lng: parseFloat(storedLng) });
        }
        if (storedName) {
          setReverseAddress(storedName);
        }
      }
      return;
    }

    const fetchExisting = async () => {
      try {
        const res = await api.get(`/users/me/addresses`);
        if (res.success && Array.isArray(res.data)) {
          const addr = res.data.find((a: any) => String(a.id) === String(addressId));
          if (addr) {
            setCoords({ lat: parseFloat(addr.latitude), lng: parseFloat(addr.longitude) });
            reset({
              label: addr.label || "Home",
              full_name: addr.full_name || "",
              phone: addr.phone || "",
              address_line_1: addr.address_line_1 || "",
              city: addr.city || "",
              state: addr.state || "Maharashtra",
              postal_code: addr.postal_code || "",
              is_default: !!addr.is_default
            });
            // If address_line_2 exists on API, set address_line_2
            if (addr.address_line_2) {
              setValue("address_line_2" as any, addr.address_line_2);
            }
          }
        }
      } catch (err) {
        console.error("Error loading address to edit:", err);
      }
    };
    fetchExisting();
  }, [addressId, reset]);

  // Leaflet Map Init (only in step 1)
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current || step !== 1) return;

    let map: any = null;
    let active = true;

    import("leaflet").then((L) => {
      if (!active || !mapRef.current) return;

      if ((mapRef.current as any)._leaflet_id) {
        return;
      }

      // Fix default icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const initLat = coords.lat;
      const initLng = coords.lng;

      map = L.map(mapRef.current!).setView([initLat, initLng], 15);
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

      const pinIcon = L.divIcon({
        html: `
          <div style="filter: drop-shadow(0 4px 10px rgba(16,185,129,0.35)); position: relative;">
            <span style="position: absolute; top: -4px; left: -4px; width: 40px; height: 40px; border-radius: 50%; background: rgba(16,185,129,0.15); animation: ping 1.5s infinite;"></span>
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.15)">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        className: "leaflet-custom-icon"
      });

      const marker = L.marker([initLat, initLng], { draggable: true, icon: pinIcon }).addTo(map);
      markerRef.current = marker;

      // Geocoding helper on coordinate updates
      const triggerReverseGeocode = (latitude: number, longitude: number) => {
        setLoadingGeocode(true);
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
          .then(res => res.json())
          .then(data => {
            if (data && data.display_name) {
              setReverseAddress(data.display_name);
              
              // Automatically extract address fields for step 2
              if (data.address) {
                const city = data.address.city || data.address.town || data.address.suburb || "";
                const postcode = data.address.postcode || "";
                const state = data.address.state || "";
                setValue("city", city);
                setValue("state", state);
                setValue("postal_code", postcode);
              }
            }
          })
          .catch(() => {})
          .finally(() => setLoadingGeocode(false));
      };

      // Trigger initial geocode
      if (!reverseAddress) {
        triggerReverseGeocode(initLat, initLng);
      }

      // Update coordinates on marker drag
      marker.on("dragend", () => {
        const position = marker.getLatLng();
        setCoords({ lat: position.lat, lng: position.lng });
        triggerReverseGeocode(position.lat, position.lng);
      });

      // Update coordinates on map click
      map.on("click", (e: any) => {
        marker.setLatLng(e.latlng);
        setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
        triggerReverseGeocode(e.latlng.lat, e.latlng.lng);
      });

      setMapObj(map);
    });

    return () => {
      active = false;
      if (map) {
        map.remove();
      }
    };
  }, [step]);

  // Synchronize map center and marker when coords change (e.g. loaded from localStorage or edit API)
  useEffect(() => {
    if (mapObj && markerRef.current) {
      mapObj.setView([coords.lat, coords.lng]);
      markerRef.current.setLatLng([coords.lat, coords.lng]);
    }
  }, [coords.lat, coords.lng, mapObj]);

  const handleLocateMe = () => {
    if (typeof window === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      setCoords({ lat: latitude, lng: longitude });
      if (mapObj) {
        mapObj.setView([latitude, longitude], 16);
      }
      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      }
      
      setLoadingGeocode(true);
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.display_name) {
            setReverseAddress(data.display_name);
            if (data.address) {
              const city = data.address.city || data.address.town || data.address.suburb || "";
              const postcode = data.address.postcode || "";
              const state = data.address.state || "";
              setValue("city", city);
              setValue("state", state);
              setValue("postal_code", postcode);
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoadingGeocode(false));
    });
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const payload = {
        ...data,
        latitude: coords.lat,
        longitude: coords.lng
      };
      
      if (addressId) {
        await api.put(`/users/me/addresses/${addressId}`, payload);
        success("Success", "Address updated successfully!");
      } else {
        await api.post("/users/me/addresses", payload);
        success("Success", "Address saved successfully!");
      }
      
      router.push(resolveLink("/addresses"));
    } catch (err: any) {
      showError("Failed to save address", err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 font-sans">

      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (step === 2) {
              setStep(1);
            } else {
              router.push(resolveLink("/addresses"));
            }
          }}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="space-y-0.5">
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            {addressId ? "Edit Address" : "Add Address"}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {step === 1 ? "Step 1: Choose delivery location on map" : "Step 2: Enter exact house/flat details"}
          </p>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex gap-2">
        <div className={`h-1.5 flex-1 rounded-full transition-all ${step >= 1 ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"}`} />
        <div className={`h-1.5 flex-1 rounded-full transition-all ${step >= 2 ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"}`} />
      </div>

      {/* Step 1: Map Picker */}
      {step === 1 && (
        <div className="space-y-4 animate-fade-in">
          <div className="relative border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div ref={mapRef} className="h-96 w-full relative" style={{ zIndex: 1 }} />
            
            {/* Locate Me overlay */}
            <button
              onClick={handleLocateMe}
              className="absolute bottom-4 right-4 z-10 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 p-3 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 font-bold text-xs cursor-pointer"
            >
              <Navigation className="w-4 h-4" /> Locate Me
            </button>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 space-y-3 shadow-sm">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-5 h-5 text-emerald-505 mt-0.5 flex-shrink-0 animate-bounce" />
              <div className="space-y-0.5 flex-1 min-w-0">
                <h4 className="text-xs font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider">Confirmed Location</h4>
                {loadingGeocode ? (
                  <div className="flex items-center gap-2 py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    <span className="text-[11px] text-slate-400 font-semibold">Reverse geocoding coordinates...</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-semibold line-clamp-2">
                    {reverseAddress || `Coordinates: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`}
                  </p>
                )}
              </div>
            </div>

            <Button
              fullWidth
              size="lg"
              disabled={loadingGeocode}
              rightIcon={<ChevronRight className="w-4 h-4" />}
              onClick={() => {
                if (reverseAddress) {
                  setValue("address_line_1", reverseAddress.split(",").slice(0, 2).join(","));
                }
                setStep(2);
              }}
            >
              Confirm Location & Proceed
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Details Form */}
      {step === 2 && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 animate-slide-up">
          {/* Label selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Address Label</label>
            <div className="flex gap-3">
              {[
                { name: "Home", icon: Home },
                { name: "Work", icon: Briefcase },
                { name: "Other", icon: MapPin }
              ].map(l => (
                <label key={l.name} className="flex-1">
                  <input type="radio" value={l.name} {...register("label")} className="sr-only peer" />
                  <div className="text-center py-3 rounded-2xl border text-xs font-black cursor-pointer transition-all peer-checked:border-emerald-500 peer-checked:bg-emerald-50 dark:peer-checked:bg-emerald-950/30 peer-checked:text-emerald-700 dark:peer-checked:text-emerald-400 border-slate-200 dark:border-slate-800 text-slate-500 flex items-center justify-center gap-1.5">
                    <l.icon className="w-4 h-4" /> {l.name}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Recipient Full Name *</label>
              <input {...register("full_name", { required: true })} className="input-base px-4 py-3 text-sm rounded-2xl" placeholder="Full name of receiver" required />
            </div>
            
            <div className="col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Mobile Number *</label>
              <input {...register("phone", { required: true })} className="input-base px-4 py-3 text-sm rounded-2xl" type="tel" placeholder="10-digit mobile number" required />
            </div>

            <div className="col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Flat / House No. / Building Name *</label>
              <input {...register("address_line_1", { required: true })} className="input-base px-4 py-3 text-sm rounded-2xl" placeholder="Enter house/flat number, floor, building details" required />
            </div>

            <div className="col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Landmark / Locality (Optional)</label>
              <input {...register("address_line_2" as any)} className="input-base px-4 py-3 text-sm rounded-2xl" placeholder="Nearby landmark, area name" />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">City *</label>
              <input {...register("city", { required: true })} className="input-base px-4 py-3 text-sm rounded-2xl" required />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">State *</label>
              <input {...register("state", { required: true })} className="input-base px-4 py-3 text-sm rounded-2xl" placeholder="e.g. Maharashtra" required />
            </div>

            <div className="col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Postal Code / PIN Code *</label>
              <input {...register("postal_code", { required: true })} className="input-base px-4 py-3 text-sm rounded-2xl" maxLength={6} placeholder="400001" required />
            </div>
          </div>

          {/* Set default checkbox */}
          <label className="flex items-center gap-2.5 cursor-pointer py-1">
            <input type="checkbox" {...register("is_default")} className="w-4 h-4 rounded border-slate-350 text-emerald-600 focus:ring-emerald-500 bg-transparent" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Set as default delivery address</span>
          </label>

          {/* Submit button */}
          <div className="flex gap-4 pt-2">
            <Button
              type="submit"
              disabled={loading}
              loading={loading}
              className="flex-1 py-4 text-xs font-black uppercase tracking-wider"
            >
              Save Address Details
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => setStep(1)}
              className="px-6 py-4 text-xs font-black uppercase tracking-wider"
            >
              Go Back
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
