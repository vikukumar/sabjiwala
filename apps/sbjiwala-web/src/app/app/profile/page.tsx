"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { User, Mail, Phone, Edit2, Save, Camera, LogOut, Shield, Bell, Palette, ChevronRight, Award, Package, Star, Heart } from "lucide-react";
import { Button, Input, Card, Badge, StatCard, Spinner } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

export default function ProfilePage() {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: profile, isLoading, error } = useQuery<any>({
    queryKey: ["profile"],
    queryFn: async () => { const r = await api.get("/users/me"); return r.data; },
    retry: false,
  });

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sw_access_token") : null;
    if (!token || error) {
      if (error) {
        localStorage.removeItem("sw_access_token");
        localStorage.removeItem("sw_refresh_token");
      }
      router.replace("/login?redirect=/profile");
    }
  }, [router, error]);

  const { data: orderStats } = useQuery<any>({
    queryKey: ["orderStats"],
    queryFn: async () => {
      const r = await api.get("/orders");
      const orders = r.data || [];
      return {
        total: orders.length,
        delivered: orders.filter((o: any) => o.status === "delivered").length,
        total_spent: orders.filter((o: any) => o.status === "delivered").reduce((s: number, o: any) => s + (o.total_amount || 0), 0),
      };
    },
  });

  const { register, handleSubmit, formState: { errors } } = useForm({ values: profile });

  const updateProfile = useMutation({
    mutationFn: (data: any) => api.put("/users/me", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setEditing(false);
      success("Profile updated!");
    },
    onError: (err: any) => showError("Update failed", err.response?.data?.detail || err.message),
  });

  const handleLogout = () => {
    localStorage.removeItem("sw_access_token");
    localStorage.removeItem("sw_refresh_token");
    router.replace("/login");
  };

  if (isLoading) return <div className="flex justify-center items-center py-20"><Spinner size="lg" /></div>;

  const quickLinks = [
    { icon: Package, label: "My Orders", href: "/orders", badge: null },
    { icon: Heart, label: "Wishlist", href: "/wishlist", badge: null },
    { icon: Star, label: "My Reviews", href: "/reviews", badge: null },
    { icon: Award, label: "Referrals", href: "/referrals", badge: "Earn ₹50" },
    { icon: Bell, label: "Notifications", href: "/notifications", badge: null },
    { icon: Shield, label: "Privacy & Security", href: "/settings", badge: null },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Profile Header */}
      <Card className="relative overflow-hidden">
        <div className="h-20 gradient-brand rounded-t-2xl -mx-6 -mt-6 mb-0" />
        <div className="flex items-end gap-4 -mt-10 mb-4">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-3xl font-black border-4 border-white dark:border-slate-900 shadow-lg">
              {profile?.full_name?.[0] || "U"}
            </div>
            <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 hover:bg-emerald-700 transition-colors">
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="pb-1 flex-1 min-w-0">
            <h2 className="text-lg font-black text-slate-900 dark:text-white truncate">{profile?.full_name}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{profile?.email}</p>
            <Badge variant={profile?.is_verified ? "success" : "warning"} size="sm" className="mt-1">
              {profile?.is_verified ? "Verified" : "Unverified"}
            </Badge>
          </div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Edit2 className="w-3.5 h-3.5" />}
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Cancel" : "Edit"}
          </Button>
        </div>

        {/* Edit Form */}
        {editing && (
          <form onSubmit={handleSubmit((d) => updateProfile.mutate(d))} className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Input label="Full Name" leftIcon={<User className="w-4 h-4" />} {...register("full_name", { required: true })} />
            <Input label="Email" type="email" leftIcon={<Mail className="w-4 h-4" />} {...register("email")} />
            <Input label="Phone" type="tel" leftIcon={<Phone className="w-4 h-4" />} {...register("phone")} readOnly hint="Contact support to change phone number" />
            <Button type="submit" loading={updateProfile.isPending} leftIcon={<Save className="w-4 h-4" />}>Save Changes</Button>
          </form>
        )}
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard title="Orders" value={orderStats?.total || 0} icon={<Package className="w-5 h-5" />} />
        <StatCard title="Delivered" value={orderStats?.delivered || 0} icon={<Award className="w-5 h-5" />} iconBg="bg-blue-50 dark:bg-blue-950/30" iconColor="text-blue-600 dark:text-blue-400" />
        <StatCard
          title="Total Spent"
          value={`₹${(orderStats?.total_spent || 0).toFixed(0)}`}
          icon={<Star className="w-5 h-5" />}
          iconBg="bg-amber-50 dark:bg-amber-950/30"
          iconColor="text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Quick Links */}
      <Card className="divide-y divide-slate-100 dark:divide-slate-800" padding="none">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <Icon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
              <span className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{link.label}</span>
              {link.badge && <Badge variant="success" size="sm">{link.badge}</Badge>}
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
          );
        })}
      </Card>

      {/* Logout */}
      <Button variant="danger" fullWidth onClick={handleLogout} leftIcon={<LogOut className="w-4 h-4" />} size="lg">
        Sign Out
      </Button>

      <p className="text-center text-xs text-slate-400 dark:text-slate-500">Sbjiwala v1.0 · Member since {new Date(profile?.created_at || Date.now()).getFullYear()}</p>
    </div>
  );
}
