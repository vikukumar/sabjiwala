"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MapPin, Bell, Camera, Smartphone, ShieldCheck, Check, Loader2 } from "lucide-react";
import { api } from "@sbjiwala/shared";

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [geoState, setGeoState] = useState<"default" | "granted" | "denied">("default");
  const [notifState, setNotifState] = useState<"default" | "granted" | "denied">("default");
  const [cameraState, setCameraState] = useState<"default" | "granted" | "denied">("default");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Skip auth/permissions check for login and setup routes
    const isLoginOrSetup = pathname.includes("/login") || pathname.includes("/setup");
    if (isLoginOrSetup) {
      setIsAuthed(true);
      return;
    }

    const token = localStorage.getItem("sw_access_token");
    if (!token) {
      setIsAuthed(false);
      // Determine the login route
      const loginRoute = pathname.startsWith("/admin") ? "/admin/login" : "/login";
      router.replace(loginRoute);
    } else {
      setIsAuthed(true);
      checkPermissions();
    }
  }, [pathname, router]);

  const checkPermissions = async () => {
    if (typeof window === "undefined" || !navigator.permissions) return;

    try {
      const geo = await navigator.permissions.query({ name: "geolocation" as any });
      setGeoState(geo.state as any);
      
      const notif = await navigator.permissions.query({ name: "notifications" as any });
      setNotifState(notif.state as any);

      const cam = await navigator.permissions.query({ name: "camera" as any });
      setCameraState(cam.state as any);

      // Show modal if any of the permissions are not granted
      if (geo.state !== "granted" || notif.state !== "granted" || cam.state !== "granted") {
        setShowPermissionsModal(true);
      }

      // Listen for changes
      geo.onchange = () => setGeoState(geo.state as any);
      notif.onchange = () => setNotifState(notif.state as any);
      cam.onchange = () => setCameraState(cam.state as any);
    } catch (e) {
      // Fallback for browsers that don't support query all permissions
      if ("Notification" in window) {
        setNotifState(Notification.permission as any);
      }
      setShowPermissionsModal(true);
    }
  };

  const requestGeo = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGeoState("granted");
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        localStorage.setItem("sw_latitude", String(lat));
        localStorage.setItem("sw_longitude", String(lon));

        try {
          const res = await api.get("/maps/reverse-geocode", { params: { lat, lon } });
          if (res.success && res.data?.formatted_address) {
            localStorage.setItem("sw_location_name", res.data.formatted_address);
          }
        } catch (err) {
          console.error("Admin reverse geocoding failed:", err);
        }
      },
      () => setGeoState("denied")
    );
  };

  const requestNotif = () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    Notification.requestPermission().then((permission) => {
      setNotifState(permission as any);
    });
  };

  const requestCamera = async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraState("granted");
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setCameraState("denied");
    }
  };

  if (isAuthed === null) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
      </div>
    );
  }

  const isLoginOrSetup = pathname.includes("/login") || pathname.includes("/setup");

  return (
    <>
      {children}

      {showPermissionsModal && !isLoginOrSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowPermissionsModal(false)}
          />

          {/* Modal Content */}
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full animate-scale-in text-slate-800 dark:text-white space-y-4 shadow-2xl">
            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black tracking-tight">Essential Admin Permissions 🛡️</h3>
              <p className="text-xs text-slate-505 dark:text-slate-400 leading-relaxed">
                Sbjiwala Admin App requires location, alerts, and camera permissions to verify vendors, sync dispatches, and coordinate liveops.
              </p>
            </div>

            <div className="space-y-3">
              {/* Geolocation */}
              <div className="flex items-center justify-between p-3 bg-slate-55/40 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-2.5 min-w-0">
                  <MapPin className="w-4.5 h-4.5 text-emerald-605 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-905 dark:text-slate-100">Location Services</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">For vendor store audits & mapping</p>
                  </div>
                </div>
                {geoState === "granted" ? (
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-black">ACTIVE</span>
                ) : (
                  <button 
                    onClick={requestGeo} 
                    className="text-[10px] bg-emerald-605 hover:bg-emerald-500 text-white font-extrabold px-3 py-1.5 rounded-lg transition-all"
                  >
                    ENABLE
                  </button>
                )}
              </div>

              {/* Notifications */}
              <div className="flex items-center justify-between p-3 bg-slate-55/40 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Bell className="w-4.5 h-4.5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-905 dark:text-slate-100">Oversight Alerts</p>
                    <p className="text-[10px] text-slate-505 dark:text-slate-400 truncate">Immediate ticket & order escalations</p>
                  </div>
                </div>
                {notifState === "granted" ? (
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-black">ACTIVE</span>
                ) : (
                  <button 
                    onClick={requestNotif} 
                    className="text-[10px] bg-emerald-605 hover:bg-emerald-500 text-white font-extrabold px-3 py-1.5 rounded-lg transition-all"
                  >
                    ALLOW
                  </button>
                )}
              </div>

              {/* Camera */}
              <div className="flex items-center justify-between p-3 bg-slate-55/40 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Camera className="w-4.5 h-4.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-905 dark:text-slate-100">Camera & Documents</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">For capturing live verification documents</p>
                  </div>
                </div>
                {cameraState === "granted" ? (
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-black">ACTIVE</span>
                ) : (
                  <button 
                    onClick={requestCamera} 
                    className="text-[10px] bg-emerald-605 hover:bg-emerald-500 text-white font-extrabold px-3 py-1.5 rounded-lg transition-all"
                  >
                    ALLOW
                  </button>
                )}
              </div>

              {/* Background Sync */}
              <div className="flex items-center justify-between p-3 bg-slate-55/40 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Smartphone className="w-4.5 h-4.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-905 dark:text-slate-100">Sync Pipeline</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">WebSocket backplane operational</p>
                  </div>
                </div>
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full font-black">ENABLED</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="flex-1 py-3 text-xs font-black text-slate-500 hover:text-slate-650 dark:hover:text-slate-400 text-center uppercase tracking-wider cursor-pointer"
              >
                Skip for now
              </button>
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 rounded-xl text-xs transition-all shadow-md shadow-emerald-900/20 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
