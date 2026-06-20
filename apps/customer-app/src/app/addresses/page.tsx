"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { MapPin, Plus, Edit2, Trash2, CheckCircle2, Home, Briefcase, Navigation, Star, Loader2 } from "lucide-react";
import { Button, Badge, EmptyState, Skeleton } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";
import { useForm } from "react-hook-form";

import { useRouter } from "next/navigation";

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

function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-in text-center shadow-2xl">
        <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">{title}</h3>
        <p className="text-xs text-slate-555 dark:text-slate-400 leading-normal">{message}</p>
        <div className="flex gap-3 pt-2">
          <Button
            variant="danger"
            onClick={onConfirm}
            className="flex-1 py-3 text-xs cursor-pointer font-bold"
          >
            Yes, Remove
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 py-3 text-xs cursor-pointer font-bold"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AddressesPage() {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: addresses = [], isLoading } = useQuery<any[]>({
    queryKey: ["addresses"],
    queryFn: async () => { const r = await api.get("/users/me/addresses"); return r.data || []; },
  });

  const deleteAddr = useMutation({
    mutationFn: (id: string) => api.delete(`/users/me/addresses/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["addresses"] }); success("Address removed"); },
    onError: (err: any) => showError("Delete failed", err.response?.data?.detail || err.message),
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => api.patch(`/users/me/addresses/${id}`, { is_default: true }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["addresses"] }); success("Default address updated"); },
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Saved Addresses</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Manage your exact geolocated delivery addresses</p>
        </div>
        <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => router.push("/addresses/add")}>Add New</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}</div>
      ) : addresses.length === 0 ? (
        <EmptyState
          emoji="📍"
          title="No saved addresses"
          description="Add a precise delivery address for rapid 10-minute order routing."
          action={<Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => router.push("/addresses/add")}>Add Address</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {addresses.map((addr: any) => (
            <AddressCard
              key={addr.id}
              addr={addr}
              onEdit={a => router.push(`/addresses/add?id=${a.id}`)}
              onDelete={id => setConfirmDeleteId(id)}
              onDefault={id => setDefault.mutate(id)}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Remove Address?"
        message="Are you sure you want to remove this saved address? This action cannot be undone."
        onConfirm={() => {
          if (confirmDeleteId) {
            deleteAddr.mutate(confirmDeleteId);
            setConfirmDeleteId(null);
          }
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}

