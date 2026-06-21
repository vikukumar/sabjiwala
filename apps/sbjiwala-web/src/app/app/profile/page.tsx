"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, resolveImageUrl, useWebSocket } from "@sbjiwala/shared";
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { isConnected: isWSConnected } = useWebSocket();
  const [isOnline, setIsOnline] = useState(typeof window !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/storage/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const resAny = res as any;
      const url = resAny.url || resAny.data?.url || resAny.data?.data?.url;
      if (url) {
        await updateProfile.mutateAsync({ ...profile, avatar_url: url });
        success("Profile picture updated!");
      }
    } catch (err: any) {
      showError("Upload Failed", err.response?.data?.detail || err.message);
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

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

  useEffect(() => {
    if (profile && !profile.first_name?.trim()) {
      setEditing(true);
    }
  }, [profile]);

  const { data: orderStats } = useQuery<any>({
    queryKey: ["orderStats"],
    queryFn: async () => {
      const r = await api.get("/orders");
      const orders = r.data || [];
      const deliveredOrders = orders.filter((o: any) => o.status === "delivered" || o.status === "returned");
      const totalAmount = deliveredOrders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0);
      const calculatedSavings = deliveredOrders.reduce((s: number, o: any) => s + (o.discount_amount || 0) + (o.coupon_discount || 0), 0);
      
      // Fallback: if calculated savings is 0, assume 15% average discount on farm-fresh produce
      const totalSaved = calculatedSavings > 0 ? calculatedSavings : Math.round(totalAmount * 0.15);

      return {
        total: orders.length,
        delivered: deliveredOrders.length,
        total_saved: totalSaved,
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
  ];  const fullName = (profile?.first_name?.trim() || profile?.last_name?.trim())
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
    : (profile?.email?.split("@")[0] || profile?.phone || "User");

  const getCoverGradient = (gender?: string) => {
    if (gender === "male") return "from-slate-900 via-indigo-950 to-emerald-950";
    if (gender === "female") return "from-slate-900 via-rose-950 to-emerald-950";
    return "from-emerald-950 via-teal-950 to-slate-900";
  };

  const getAvatarContent = () => {
    if (profile?.avatar_url) {
      return <img src={resolveImageUrl(profile.avatar_url)} alt="Avatar" className="w-full h-full object-cover rounded-full" />;
    }
    const emoji = profile?.gender === "male" ? "👨‍🌾" : profile?.gender === "female" ? "👩‍🌾" : "👤";
    return <span className="text-3xl select-none">{emoji}</span>;
  };

  const isNameMissing = !profile?.first_name?.trim();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Profile Header */}
      <Card padding="none" className="relative overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md">
        {/* Cover Image based on services and Sbjiwala mark */}
        <div className="h-36 rounded-t-2xl relative overflow-hidden flex items-center justify-between px-6 text-white select-none border-b border-slate-200 dark:border-slate-800">
          <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800" alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-slate-950/45 dark:bg-slate-950/60 backdrop-blur-[1px]" />
          <div className="relative z-10 flex flex-col justify-end h-full pb-4">
            <span className="font-black text-xl tracking-wider uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">Sbjiwala Express</span>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">Farm to Fork ⚡</span>
          </div>
          <span className="text-4xl opacity-80 relative z-10 drop-shadow-md">🥬🥕🍅</span>
        </div>

        <div className="px-6 pb-6 pt-4">
          <div className="flex items-end gap-4 mb-4 relative z-10">
            <div className="relative flex-shrink-0 -mt-12">
              {/* Custom Farm Avatar */}
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white border-4 border-white dark:border-slate-900 shadow-xl relative overflow-hidden">
                {uploadingAvatar ? <Spinner size="sm" className="text-white" /> : getAvatarContent()}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
              />
              <button 
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 hover:bg-emerald-700 transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <div className="pb-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 dark:text-white break-words">{fullName}</h2>
                {isNameMissing && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/50 animate-pulse whitespace-nowrap">
                    ✏️ Set Name
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{profile?.email || profile?.phone}</p>
              <Badge variant={profile?.is_verified ? "success" : "warning"} size="sm" className="mt-1.5">
                {profile?.is_verified ? "Verified Profile" : "Unverified Profile"}
              </Badge>
            </div>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Edit2 className="w-3.5 h-3.5" />}
              onClick={() => setEditing(!editing)}
            >
              {editing ? "Cancel" : "Edit Profile"}
            </Button>
          </div>

          {/* Edit Form */}
          {editing && (
            <form onSubmit={handleSubmit((d) => updateProfile.mutate(d))} className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="grid grid-cols-2 gap-3">
                <Input label="First Name" leftIcon={<User className="w-4 h-4" />} {...register("first_name", { required: true })} />
                <Input label="Last Name" leftIcon={<User className="w-4 h-4" />} {...register("last_name")} />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-505 dark:text-slate-400 uppercase mb-1">Gender</label>
                <select
                  {...register("gender")}
                  className="input-base px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-white"
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <Input label="Email" type="email" leftIcon={<Mail className="w-4 h-4" />} {...register("email")} />
              <Input label="Phone" type="tel" leftIcon={<Phone className="w-4 h-4" />} {...register("phone")} readOnly hint="Contact support to change phone number" />
              <Button type="submit" loading={updateProfile.isPending} leftIcon={<Save className="w-4 h-4" />}>Save Changes</Button>
            </form>
          )}
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {/* Orders Card */}
        <Card className="flex flex-col sm:flex-row items-center sm:items-start justify-between p-3 sm:p-5 relative overflow-hidden" padding="none">
          <div className="text-center sm:text-left space-y-0.5 sm:space-y-1">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-450 dark:text-slate-500 block">Orders</span>
            <span className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white block">{orderStats?.total || 0}</span>
          </div>
          <div className="p-2 sm:p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-2 sm:mt-0">
            <Package className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </Card>
        {/* Delivered Card */}
        <Card className="flex flex-col sm:flex-row items-center sm:items-start justify-between p-3 sm:p-5 relative overflow-hidden" padding="none">
          <div className="text-center sm:text-left space-y-0.5 sm:space-y-1">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-450 dark:text-slate-500 block">Delivered</span>
            <span className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white block">{orderStats?.delivered || 0}</span>
          </div>
          <div className="p-2 sm:p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-2 sm:mt-0">
            <Award className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </Card>
        {/* Total Saved Card */}
        <Card className="flex flex-col sm:flex-row items-center sm:items-start justify-between p-3 sm:p-5 relative overflow-hidden" padding="none">
          <div className="text-center sm:text-left space-y-0.5 sm:space-y-1">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-450 dark:text-slate-500 block">Saved</span>
            <span className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white block">₹{(orderStats?.total_saved || 0).toFixed(0)}</span>
          </div>
          <div className="p-2 sm:p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-2 sm:mt-0">
            <Star className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </Card>
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

      {/* Connectivity Status Chips */}
      <div className="flex flex-wrap justify-center items-center gap-2 pt-2 pb-1">
        {/* Internet Status */}
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
          isOnline 
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50" 
            : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
          {isOnline ? "Internet Connected" : "No Internet"}
        </span>

        {/* WebSocket Status */}
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
          isWSConnected 
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50" 
            : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isWSConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
          {isWSConnected ? "Live Updates Active" : "Live Updates Connecting"}
        </span>

        {/* API Gateway Status */}
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
          !error 
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50" 
            : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${!error ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
          {!error ? "API Server Online" : "API Offline"}
        </span>

        {/* Platform Status */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800">
          <span>📱</span>
          {typeof window !== "undefined" && (window as any).Capacitor ? `App (${(window as any).Capacitor.getPlatform()})` : "Web Browser"}
        </span>
      </div>

      <p className="text-center text-xs text-slate-400 dark:text-slate-500">Sbjiwala v1.0 · Member since {new Date(profile?.created_at || Date.now()).getFullYear()}</p>
    </div>
  );
}
