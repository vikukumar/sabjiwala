"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { api } from "@sabjiwala/shared";

function GoogleCallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("Exchanging Google credentials...");
  const [error, setError] = useState("");

  useEffect(() => {
    const exchangeCode = async () => {
      const code = searchParams.get("code");
      if (!code) {
        setError("Authorization code is missing from Google redirect.");
        return;
      }

      try {
        setStatus("Verifying authorization with SabjiWala backend...");
        // Set API base URL to FastAPI if in dev
        const isNextDev = window.location.port === "3000" || window.location.port === "3001" || window.location.port === "3002";
        if (isNextDev) {
          // @ts-ignore
          api.client.defaults.baseURL = "http://localhost:8000/api/v1";
        } else {
          // @ts-ignore
          api.client.defaults.baseURL = "/api/v1";
        }

        const res = await api.get("/auth/google/callback", {
          params: { code }
        });

        if (res.success && res.meta) {
          api.setTokens(res.meta.access_token, res.meta.refresh_token);
          setStatus("Authentication successful! Loading dashboard...");
          setTimeout(() => {
            router.push("/");
          }, 800);
        } else {
          setError(res.message || "Failed to log in with Google.");
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || err.message || "Network error during Google callback.");
      }
    };

    exchangeCode();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-xl">
          <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white">Authentication Failed</h3>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{error}</p>
          <button
            onClick={() => router.push("/login")}
            className="w-full bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white font-extrabold py-3 rounded-2xl text-xs transition-all shadow-md"
          >
            Go Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-xl">
        <Loader2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto" />
        <h3 className="text-lg font-black text-slate-900 dark:text-white">Logging in via Google</h3>
        <p className="text-xs text-slate-500 dark:text-slate-450">{status}</p>
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] flex items-center justify-center font-sans">
        <div className="text-center space-y-2">
          <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto" />
          <span className="text-sm font-semibold text-slate-400">Loading auth handler...</span>
        </div>
      </div>
    }>
      <GoogleCallbackHandler />
    </Suspense>
  );
}
