"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { MapPin, Plus, Edit2, Trash2, CheckCircle2, Home, Briefcase, Navigation, Star, Loader2 } from "lucide-react";
import { Button, Badge, EmptyState, Skeleton } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";
import { useForm } from "react-hook-form";

function AddressCard({ addr, onEdit, onDelete, onDefault }: {
  addr: any;
  onEdit: (a: any) => void;
  onDelete: (id: string) => void;
  onDefault: (id: string) => void;
}) {
  return (
    <div className={`relative card p-5 space-y-2 border transition-all ${addr.is_default ? "border-emerald-500 shadow-md ring-1 ring-emerald-500/20" : "border-slate-200 dark:border-slate-800"}`}>
      {addr.is_default && (
        <div className="absolute top-3 right-3">
          <Badge variant="success" size="sm">Default</Badge>
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${addr.label === "Home" ? "bg-blue-50 dark:bg-blue-950/30" : "bg-amber-50 dark:bg-amber-950/30"}`}>
          {addr.label === "Home" ? <Home className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <Briefcase className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
        </div>
        <span className="font-bold text-sm text-slate-900 dark:text-white">{addr.label}</span>
      </div>
      <div>
        <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{addr.full_name}</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {addr.address_line_1}{addr.address_line_2 ? `, ${addr.address_line_2}` : ""}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">{addr.city}, {addr.postal_code}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">📞 {addr.phone}</p>
        <p className="text-[10px] text-slate-400 font-mono mt-0.5">🌐 Coordinates: {addr.latitude?.toFixed(4)}, {addr.longitude?.toFixed(4)}</p>
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" size="sm" leftIcon={<Edit2 className="w-3 h-3" />} onClick={() => onEdit(addr)}>Edit</Button>
        <Button variant="ghost" size="sm" leftIcon={<Trash2 className="w-3 h-3" />} className="text-rose-500 hover:text-rose-700" onClick={() => onDelete(addr.id)}>Delete</Button>
        {!addr.is_default && (
          <Button variant="ghost" size="sm" leftIcon={<Star className="w-3 h-3" />} onClick={() => onDefault(addr.id)}>Set Default</Button>
        )}
      </div>
    </div>
  );
}

function AddressFormModal({ existing, onSave, onClose }: { existing?: any; onSave: () => void; onClose: () => void }) {
  const { error: showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: existing?.latitude || 19.076,
    lng: existing?.longitude || 72.877
  });
  
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapObj, setMapObj] = useState<any>(null);
  const markerRef = useRef<any>(null);
  const { register, handleSubmit, setValue } = useForm({
    defaultValues: existing || {
      label: "Home",
      full_name: "",
      phone: "",
      address_line_1: "",
      city: "",
      state: "Maharashtra",
      postal_code: ""
    }
  });

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;

    import("leaflet").then((L) => {
      // Fix default icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const initLat = coords.lat;
      const initLng = coords.lng;

      const map = L.map(mapRef.current!).setView([initLat, initLng], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
      }).addTo(map);

      const pinIcon = L.divIcon({
        html: '<div style="background:#10b981;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">📍</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([initLat, initLng], { draggable: true, icon: pinIcon }).addTo(map);
      markerRef.current = marker;

      // Update coordinates on marker drag
      marker.on("dragend", () => {
        const position = marker.getLatLng();
        setCoords({ lat: position.lat, lng: position.lng });
      });

      // Update coordinates on map click
      map.on("click", (e: any) => {
        marker.setLatLng(e.latlng);
        setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      setMapObj(map);
    });
  }, []);

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
      // Fill address details using OSM reverse geocoding
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.address) {
            const road = data.address.road || data.address.suburb || "";
            const city = data.address.city || data.address.town || data.address.suburb || "";
            const postcode = data.address.postcode || "";
            setValue("address_line_1", data.display_name || "");
            setValue("city", city);
            setValue("postal_code", postcode);
          }
        });
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
      if (existing?.id) {
        await api.put(`/users/addresses/${existing.id}`, payload);
      } else {
        await api.post("/users/addresses", payload);
      }
      onSave();
    } catch (err: any) {
      showError("Failed", err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit(onSubmit)} className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-black text-slate-900 dark:text-white">
          {existing ? "Edit Address" : "Add New Address"}
        </h3>
        
        {/* Leaflet CSS */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
        
        {/* Interactive map picker */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Select exact location on map *</span>
            <button
              type="button"
              onClick={handleLocateMe}
              className="flex items-center gap-1 text-emerald-600 dark:text-emerald-450 hover:underline cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5" /> Locate Me
            </button>
          </div>
          <div ref={mapRef} className="h-44 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 relative" style={{ zIndex: 1 }} />
          <span className="text-[10px] text-slate-400 font-mono block text-right">
            Lat: {coords.lat.toFixed(6)}, Lng: {coords.lng.toFixed(6)}
          </span>
        </div>

        <div className="flex gap-2">
          {["Home", "Work", "Other"].map(l => (
            <label key={l} className="flex-1">
              <input type="radio" value={l} {...register("label")} className="sr-only peer" defaultChecked={l === (existing?.label || "Home")} />
              <div className="text-center py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all peer-checked:border-emerald-500 peer-checked:bg-emerald-50 dark:peer-checked:bg-emerald-950/30 peer-checked:text-emerald-700 border-slate-200 dark:border-slate-800 text-slate-500">
                {l}
              </div>
            </label>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Full Name *</label>
            <input {...register("full_name", { required: true })} className="input-base px-3 py-2.5 text-sm" placeholder="Recipient name" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Phone *</label>
            <input {...register("phone", { required: true })} className="input-base px-3 py-2.5 text-sm" type="tel" placeholder="Mobile number" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Address Line 1 *</label>
            <input {...register("address_line_1", { required: true })} className="input-base px-3 py-2.5 text-sm" placeholder="Flat/House number, building name" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Landmark / Area</label>
            <input {...register("address_line_2")} className="input-base px-3 py-2.5 text-sm" placeholder="Landmark (optional)" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">City *</label>
            <input {...register("city", { required: true })} className="input-base px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">PIN Code *</label>
            <input {...register("postal_code", { required: true })} className="input-base px-3 py-2.5 text-sm" maxLength={6} placeholder="400001" />
          </div>
        </div>
        
        <label className="flex items-center gap-2 cursor-pointer py-1">
          <input type="checkbox" {...register("is_default")} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Set as default address</span>
        </label>
        
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-2xl text-xs transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Address"}
          </button>
          <button
            type="button"
            className="px-6 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-all"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AddressesPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingAddr, setEditingAddr] = useState<any>(null);

  const { data: addresses = [], isLoading } = useQuery<any[]>({
    queryKey: ["addresses"],
    queryFn: async () => { const r = await api.get("/users/addresses"); return r.data || []; },
  });

  const deleteAddr = useMutation({
    mutationFn: (id: string) => api.delete(`/users/addresses/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["addresses"] }); success("Address removed"); },
    onError: (err: any) => showError("Delete failed", err.response?.data?.detail || err.message),
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => api.patch(`/users/addresses/${id}`, { is_default: true }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["addresses"] }); success("Default address updated"); },
  });

  const handleSave = () => {
    queryClient.invalidateQueries({ queryKey: ["addresses"] });
    setShowForm(false);
    setEditingAddr(null);
    success(editingAddr ? "Address updated" : "Address saved");
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {(showForm || editingAddr) && (
        <AddressFormModal
          existing={editingAddr}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingAddr(null); }}
        />
      )}

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Saved Addresses</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Manage your exact geolocated delivery addresses</p>
        </div>
        <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowForm(true)}>Add New</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}</div>
      ) : addresses.length === 0 ? (
        <EmptyState
          emoji="📍"
          title="No saved addresses"
          description="Add a precise delivery address for rapid 10-minute order routing."
          action={<Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>Add Address</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {addresses.map((addr: any) => (
            <AddressCard
              key={addr.id}
              addr={addr}
              onEdit={a => setEditingAddr(a)}
              onDelete={id => { if (confirm("Remove this address?")) deleteAddr.mutate(id); }}
              onDefault={id => setDefault.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
