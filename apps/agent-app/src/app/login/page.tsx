"use client";

import React, { useState, useEffect } from "react";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { Loader2, KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/index";
import { resolveAgentLink } from "@/components/AgentLayout";

export default function AgentLoginPage() {
  const { success, error: showError } = useToast();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [socialSettings, setSocialSettings] = useState<{ google_client_id?: string; facebook_client_id?: string }>({});

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get("/installation/public-settings");
        if (res.success && res.data) {
          setSocialSettings(res.data);
        }
      } catch (err) {
        console.error("Failed to load public settings", err);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const accessToken = searchParams.get("access_token");
      const refreshToken = searchParams.get("refresh_token");
      if (accessToken) {
        api.setTokens(accessToken, refreshToken || "");
        success("Login Successful", "Welcome back to Agent Console!");
        
        // Clean URL parameters
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        
        router.push(resolveAgentLink("/"));
        return;
      }
    }
  }, [router, success]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showError("Validation Error", "Please provide email and password");
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await api.post("/auth/login", {
        identifier: email,
        password: password,
        role: "support_agent"
      });
      
      const { access_token, refresh_token } = res.meta || {};
      if (access_token) {
        localStorage.setItem("sw_access_token", access_token);
        localStorage.setItem("sw_refresh_token", refresh_token || "");
        success("Login Successful", "Welcome back to Agent Console!");
        router.push(resolveAgentLink("/"));
      } else {
        showError("Authentication Failed", "Failed to retrieve access tokens");
      }
    } catch (err: any) {
      showError("Login Error", err.response?.data?.detail || err.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = (provider: "google" | "facebook") => {
    const isNative = typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform?.() === true;
    const scheme = "in.sbjiwala.agent://login";
    const redirectBackUrl = isNative ? scheme : window.location.origin + window.location.pathname;
    
    const apiBase = api.client.defaults.baseURL || "/api/v1";
    let backendUrl = "";
    if (apiBase.startsWith("http")) {
      backendUrl = `${apiBase}/auth/${provider}?state=${encodeURIComponent(redirectBackUrl)}`;
    } else {
      backendUrl = `${window.location.origin}${apiBase}/auth/${provider}?state=${encodeURIComponent(redirectBackUrl)}`;
    }
    
    if (isNative) {
      window.open(backendUrl, "_system");
    } else {
      window.location.href = backendUrl;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] flex items-center justify-center p-4 font-sans transition-colors duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full translate-x-1/3 -translate-y-1/3 blur-xl" />
        
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <KeyRound className="w-8 h-8" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Support Agent Portal
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Log in to manage live tickets, process returns, and call customers.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-455" />
              <input
                type="email"
                placeholder="agent@sbjiwala.qzz.io"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Password</label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-455" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <Button
            fullWidth
            type="submit"
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-550 text-white font-extrabold text-xs py-3 rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Authenticating...
              </>
            ) : (
              "Sign In to Support Console"
            )}
          </Button>
        </form>

        {/* Social login section */}
        {(socialSettings.google_client_id || socialSettings.facebook_client_id) && (
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              <span className="flex-shrink mx-4 text-slate-400 text-[10px] font-bold uppercase tracking-wider">Or Connect With</span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            </div>

            <div className={`grid gap-4 ${socialSettings.google_client_id && socialSettings.facebook_client_id ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {socialSettings.google_client_id && (
                <button
                  onClick={() => handleSocialLogin("google")}
                  className="flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-950/40 rounded-xl py-2.5 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] text-slate-700 dark:text-slate-300"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.2-5.136 4.2A5.626 5.626 0 0 1 8.28 13a5.626 5.626 0 0 1 5.711-5.6c1.554 0 2.973.57 4.073 1.503l3.24-3.24C19.336 3.793 15.938 2.5 12.24 2.5a10.5 10.5 0 0 0 0 21c5.82 0 10.5-4.2 10.5-10.5 0-.756-.098-1.485-.26-2.215H12.24z"
                    />
                  </svg>
                  <span>Google</span>
                </button>
              )}
              {socialSettings.facebook_client_id && (
                <button
                  onClick={() => handleSocialLogin("facebook")}
                  className="flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-950/40 rounded-xl py-2.5 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] text-slate-700 dark:text-slate-300"
                >
                  <svg className="w-4 h-4 fill-[#1877F2]" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  <span>Facebook</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="text-center pt-2">
          <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
            Authorized Support Personnel Only. All activities are audited under system audit logs.
          </p>
        </div>
      </div>
    </div>
  );
}
