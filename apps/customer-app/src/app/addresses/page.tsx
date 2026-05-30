"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sabjiwala/shared";
import { MapPin, Plus, Edit2, Trash2, CheckCircle2, Home, Briefcase, MoreVertical, Star } from "lucide-react";
import { Button, Badge, EmptyState, Skeleton } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";
import { useForm } from "react-hook-form";

function AddressCard({ addr, onEdit, onDelete, onDefault }: {
  addr: any;
  onEdit: (a: any) => void;
  onDelete: (id: string) => void;
  onDefault: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className={`relative card p-5 space-y-2 ${addr.is_default ? "border-emerald-400 dark:border-emerald-600" : ""}`}>
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
  const { register, handleSubmit } = useForm({ defaultValues: existing || { label: "Home", full_name: "", phone: "", address_line_1: "", city: "", state: "Maharashtra", postal_code: "" } });

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      if (existing?.id) await api.put(`/users/addresses/${existing.id}`, data);
      else await api.post("/users/addresses", { ...data, latitude: 19.076, longitude: 72.877 });
      onSave();
    } catch (err: any) {
      showError("Failed", err.response?.data?.detail || err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit(onSubmit)} className="relative bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-black text-slate-900 dark:text-white">{existing ? "Edit Address" : "Add New Address"}</h3>
        <div className="flex gap-2">
          {["Home", "Work", "Other"].map(l => (
            <label key={l} className="flex-1">
              <input type="radio" value={l} {...register("label")} className="sr-only peer" defaultChecked={l === (existing?.label || "Home")} />
              <div className="text-center py-2 rounded-xl border-2 text-sm font-bold cursor-pointer transition-all peer-checked:border-emerald-500 peer-checked:bg-emerald-50 dark:peer-checked:bg-emerald-950/30 peer-checked:text-emerald-700 border-slate-200 dark:border-slate-700 text-slate-600">
                {l}
              </div>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Full Name *</label>
            <input {...register("full_name", { required: true })} className="input-base px-3 py-2.5 text-sm" placeholder="Recipient name" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Phone *</label>
            <input {...register("phone", { required: true })} className="input-base px-3 py-2.5 text-sm" type="tel" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Address Line 1 *</label>
            <input {...register("address_line_1", { required: true })} className="input-base px-3 py-2.5 text-sm" placeholder="Flat/House, Street" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Landmark / Area</label>
            <input {...register("address_line_2")} className="input-base px-3 py-2.5 text-sm" placeholder="Landmark (optional)" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">City *</label>
            <input {...register("city", { required: true })} className="input-base px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">PIN Code *</label>
            <input {...register("postal_code", { required: true })} className="input-base px-3 py-2.5 text-sm" maxLength={6} />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register("is_default")} className="w-4 h-4" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Set as default</span>
        </label>
        <div className="flex gap-3">
          <Button type="submit" loading={loading} className="flex-1">Save Address</Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
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
    <div className="max-w-2xl mx-auto px-4 py-6">
      {(showForm || editingAddr) && (
        <AddressFormModal
          existing={editingAddr}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingAddr(null); }}
        />
      )}

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Saved Addresses</h1>
        <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowForm(true)}>Add New</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}</div>
      ) : addresses.length === 0 ? (
        <EmptyState
          emoji="📍"
          title="No saved addresses"
          description="Add a delivery address to get started."
          action={<Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>Add Address</Button>}
        />
      ) : (
        <div className="space-y-3">
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
