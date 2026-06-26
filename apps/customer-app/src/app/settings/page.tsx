"use client";

import React, { useState } from "react";
import { Moon, Sun, Zap, Bell, BellOff, Shield, Lock, Trash2, Globe, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Button, Card } from "@/components/ui/index";
import versionInfo from "@/app/version.json";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-emerald-600" : "bg-slate-200 dark:bg-slate-700"}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function SettingRow({ icon: Icon, label, desc, children }: { icon: any; label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl flex-shrink-0">
        <Icon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 dark:text-white">{label}</p>
        {desc && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { success } = useToast();
  const [theme, setTheme] = useState<"light" | "dark" | "amoled">(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("sw_theme") as any) || "light";
    return "light";
  });
  const [orderNotifs, setOrderNotifs] = useState(true);
  const [promoNotifs, setPromoNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(false);

  const applyTheme = (t: "light" | "dark" | "amoled") => {
    setTheme(t);
    localStorage.setItem("sw_theme", t);
    document.documentElement.classList.remove("dark", "amoled");
    if (t === "dark") document.documentElement.classList.add("dark");
    if (t === "amoled") document.documentElement.classList.add("dark", "amoled");
    success(`${t.charAt(0).toUpperCase() + t.slice(1)} theme applied`);
  };

  const themes: { id: "light" | "dark" | "amoled"; icon: any; label: string; desc: string }[] = [
    { id: "light", icon: Sun, label: "Light", desc: "Bright & clean" },
    { id: "dark", icon: Moon, label: "Dark", desc: "Easy on eyes" },
    { id: "amoled", icon: Zap, label: "AMOLED", desc: "Pure black — battery saving" },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white">Settings</h1>

      {/* Theme */}
      <div>
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Appearance</h2>
        <div className="grid grid-cols-3 gap-2">
          {themes.map(t => {
            const Icon = t.icon;
            const isActive = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => applyTheme(t.id)}
                className={`card p-4 flex flex-col items-center gap-2 transition-all ${isActive ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "hover:border-slate-300"}`}
              >
                <Icon className={`w-6 h-6 ${isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`} />
                <div>
                  <p className={`text-xs font-black ${isActive ? "text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"}`}>{t.label}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{t.desc}</p>
                </div>
                {isActive && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications */}
      <div>
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Notifications</h2>
        <Card padding="none" className="divide-y divide-slate-100 dark:divide-slate-800">
          <SettingRow icon={Bell} label="Order Updates" desc="Delivery and status notifications">
            <Toggle checked={orderNotifs} onChange={setOrderNotifs} />
          </SettingRow>
          <SettingRow icon={Bell} label="Offers & Promotions" desc="Deals, coupons, and special offers">
            <Toggle checked={promoNotifs} onChange={setPromoNotifs} />
          </SettingRow>
          <SettingRow icon={Bell} label="SMS Notifications" desc="Receive updates via SMS">
            <Toggle checked={smsNotifs} onChange={setSmsNotifs} />
          </SettingRow>
        </Card>
      </div>

      {/* Privacy */}
      <div>
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Privacy & Security</h2>
        <Card padding="none" className="divide-y divide-slate-100 dark:divide-slate-800">
          <SettingRow icon={Lock} label="Change Password" desc="Update your account password">
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </SettingRow>
          <SettingRow icon={Shield} label="Two-Factor Authentication" desc="Add extra security to your account">
            <Toggle checked={false} onChange={() => success("Coming soon!")} />
          </SettingRow>
          <SettingRow icon={Globe} label="Data & Privacy" desc="Manage your data preferences">
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </SettingRow>
        </Card>
      </div>

      {/* Danger Zone */}
      <div>
        <h2 className="text-sm font-black uppercase tracking-wider text-rose-500 mb-2">Danger Zone</h2>
        <Card>
          <p className="text-sm font-bold text-slate-900 dark:text-white">Delete Account</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <Button variant="danger" size="sm" leftIcon={<Trash2 className="w-3.5 h-3.5" />}>
            Delete My Account
          </Button>
        </Card>
      </div>

      {/* App Info */}
      <div className="text-center space-y-1">
        <p className="text-xs text-slate-400 dark:text-slate-500">Sbjiwala v{process.env.NEXT_PUBLIC_APP_VERSION || versionInfo.version || "1.0.0"}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">© 2025 Sbjiwala · All rights reserved</p>
      </div>
    </div>
  );
}
