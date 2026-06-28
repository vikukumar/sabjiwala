"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Mail, Phone, ArrowRight, ShieldCheck, Loader2, Sparkles, User, Lock } from "lucide-react";
import { api } from "@sbjiwala/shared";
import { encryptPayload } from "@/components/ui/crypto";

import { useRouter } from "next/navigation";

const formatError = (err: any): string => {
  if (!err) return "";
  if (typeof err === "string") return err;
  const detail = err.response?.data?.detail ?? err.detail ?? err;
  if (detail && typeof detail === "object") {
    const msg = detail.message || detail.msg || "";
    const issues = Array.isArray(detail.issues)
      ? detail.issues.join(", ")
      : detail.issues
      ? String(detail.issues)
      : "";
    if (msg && issues) return `${msg}: ${issues}`;
    if (msg) return String(msg);
    if (issues) return String(issues);
    try {
      return JSON.stringify(detail);
    } catch {
      return String(detail);
    }
  }
  return err.message || String(err);
};

export default function LoginPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [loginTab, setLoginTab] = useState<"otp" | "password">("otp");

  // Login Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);

  // Loading States
  const [otpLoading, setOtpLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Status Messages
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [isNativeApp, setIsNativeApp] = useState(false);
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

  const getStoredUserType = () => {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem("sw_access_token");
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload).user_type;
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
    // Detect Capacitor native app (Android/iOS) — hide cross-portal links
    if (typeof window !== "undefined") {
      const cap = (window as any).Capacitor;
      setIsNativeApp(cap?.isNativePlatform?.() === true);
    }

    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const accessToken = searchParams.get("access_token");
      const refreshToken = searchParams.get("refresh_token");
      if (accessToken) {
        api.setTokens(accessToken, refreshToken || "");
        setSuccessMsg("Logged in successfully!");
        
        // Clean URL parameters
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        const role = getStoredUserType() || "vendor";
        if (role === "vendor" || role === "vendor_manager") router.replace("/vendor");
        else if (role === "delivery_boy") router.replace("/delivery");
        else if (role === "admin" || role === "super_admin") router.replace("/admin");
        else router.replace("/");
        return;
      }
    }

    if (typeof window !== "undefined" && localStorage.getItem("sw_access_token")) {
      const role = getStoredUserType() || "vendor";
      const isUnified = process.env.NEXT_PUBLIC_APP_MODE === "unified";
      const isStandaloneCustomer = !isUnified && (process.env.NEXT_PUBLIC_APP_MODE === "customer" || window.location.port === "3000");
      const isStandaloneVendor = !isUnified && (process.env.NEXT_PUBLIC_APP_MODE === "vendor" || window.location.port === "3001" || window.location.host.startsWith("vendor."));
      const isStandaloneDelivery = !isUnified && (process.env.NEXT_PUBLIC_APP_MODE === "delivery" || window.location.port === "3002" || window.location.host.startsWith("delivery."));
      const isStandaloneAdmin = !isUnified && (process.env.NEXT_PUBLIC_APP_MODE === "admin" || window.location.port === "3003" || window.location.host.startsWith("admin."));

      if (isStandaloneCustomer || isStandaloneVendor || isStandaloneDelivery || isStandaloneAdmin) {
        router.replace("/");
      } else {
        if (role === "vendor" || role === "vendor_manager") router.replace("/vendor");
        else if (role === "delivery_boy") router.replace("/delivery");
        else if (role === "admin" || role === "super_admin") router.replace("/admin");
        else router.replace("/");
      }
    }
  }, [router]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("sw_theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const getBackendUrl = (path: string) => {
    const apiBase = api.client.defaults.baseURL || "/api/v1";
    if (apiBase.startsWith("/")) {
      if (typeof window !== "undefined") {
        return `${window.location.origin}${apiBase}${path}`;
      }
      return `/api/v1${path}`;
    }
    return `${apiBase}${path}`;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!email) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setOtpLoading(true);
    try {
      const res = await api.post("/auth/otp/send", {
        email,
        purpose: "login"
      });

      if (res.success) {
        setIsOtpSent(true);
        setCountdown(60);
        setSuccessMsg(res.message || "OTP sent successfully to your email.");
      } else {
        setErrorMsg(res.message || "Failed to send OTP.");
      }
    } catch (err: any) {
      setErrorMsg(formatError(err) || "Something went wrong.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!otp || otp.length !== 6) {
      setErrorMsg("Please enter a valid 6-digit OTP code.");
      return;
    }

    setSubmitLoading(true);
    try {
      const encrypted = await encryptPayload({
        email,
        otp,
        purpose: "login",
        role: "vendor"
      });
      const res = await api.post("/auth/otp/verify", encrypted);

      if (res.success && res.meta) {
        api.setTokens(res.meta.access_token, res.meta.refresh_token);
        setSuccessMsg("Logged in successfully! Redirecting...");
        handleSuccessfulLoginRedirect(res.meta.role || "vendor");
      } else {
        setErrorMsg(res.message || "Invalid OTP code.");
      }
    } catch (err: any) {
      setErrorMsg(formatError(err) || "Verification failed.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!email || !password) {
      setErrorMsg("Please enter your email and password.");
      return;
    }

    setSubmitLoading(true);
    try {
      const encrypted = await encryptPayload({ email, password, role: "vendor" });
      const res = await api.post("/auth/login", encrypted);
      if (res.success && res.meta) {
        api.setTokens(res.meta.access_token, res.meta.refresh_token);
        setSuccessMsg("Logged in successfully! Redirecting...");
        handleSuccessfulLoginRedirect(res.meta.role || "vendor");
      } else {
        setErrorMsg(res.message || "Invalid login credentials.");
      }
    } catch (err: any) {
      setErrorMsg(formatError(err) || "Login failed.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSocialLogin = (provider: "google" | "facebook") => {
    const isNative = typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform?.() === true;
    const scheme = "in.sbjiwala.vendor://login";
    const redirectBackUrl = isNative ? scheme : window.location.origin + window.location.pathname;
    const redirectUrl = getBackendUrl(`/auth/${provider}?state=${encodeURIComponent(redirectBackUrl)}`);
    if (isNative) {
      window.open(redirectUrl, "_system");
    } else {
      window.location.href = redirectUrl;
    }
  };

  const handleSuccessfulLoginRedirect = (role: string) => {
    setTimeout(() => {
      if (typeof window !== "undefined") {
        const isUnified = process.env.NEXT_PUBLIC_APP_MODE === "unified";
        const isStandaloneCustomer = !isUnified && (process.env.NEXT_PUBLIC_APP_MODE === "customer" || window.location.port === "3000");
        const isStandaloneVendor = !isUnified && (process.env.NEXT_PUBLIC_APP_MODE === "vendor" || window.location.port === "3001" || window.location.host.startsWith("vendor."));
        const isStandaloneDelivery = !isUnified && (process.env.NEXT_PUBLIC_APP_MODE === "delivery" || window.location.port === "3002" || window.location.host.startsWith("delivery."));
        const isStandaloneAdmin = !isUnified && (process.env.NEXT_PUBLIC_APP_MODE === "admin" || window.location.port === "3003" || window.location.host.startsWith("admin."));

        if (isStandaloneCustomer || isStandaloneVendor || isStandaloneDelivery || isStandaloneAdmin) {
          router.replace("/");
        } else {
          if (role === "vendor" || role === "vendor_manager") router.replace("/vendor");
          else if (role === "delivery_boy") router.replace("/delivery");
          else if (role === "admin" || role === "super_admin") router.replace("/admin");
          else router.replace("/");
        }
      }
    }, 1000);
  };


  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200 antialiased font-sans">
      {/* Header */}
      <header className="max-w-6xl w-full mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo_horizontal.png" alt="Sbjiwala Logo" className="h-8 w-auto object-contain" />
          <span className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full">Secure Auth</span>
        </div>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-350 hover:scale-105 active:scale-95 transition-all shadow-sm border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/30"
        >
          {theme === "light" ? "🍆" : "🍋"}
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl shadow-xl p-6 md:p-8 space-y-6 relative overflow-hidden">
          {/* Decorative gradients */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -ml-16 -mb-16 pointer-events-none"></div>

          {/* Banner Logo */}
          <div className="text-center space-y-2 relative">
            <img src="/logo_horizontal.png" alt="Sbjiwala Logo" className="h-12 w-auto mx-auto mb-2" />
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Welcome Back!
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Log in to manage orders, catalog, and deliveries
            </p>
          </div>

          {/* Messages */}
          {errorMsg && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-455 rounded-2xl text-xs font-semibold leading-relaxed">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-2xl text-xs font-semibold leading-relaxed">
              {successMsg}
            </div>
          )}

          {/* Sign In View */}
          <div className="space-y-4">
            {/* Login Method Tab (OTP vs Password) */}
            <div className="flex justify-center gap-4 text-xs font-bold border-b border-slate-100 dark:border-slate-800 pb-2">
              <button
                onClick={() => setLoginTab("otp")}
                className={`pb-1 transition-all ${loginTab === "otp"
                  ? "text-emerald-600 dark:text-emerald-455 border-b-2 border-emerald-600 dark:border-emerald-455"
                  : "text-slate-400 hover:text-slate-650"
                  }`}
              >
                Email OTP Login
              </button>
              <button
                onClick={() => setLoginTab("password")}
                className={`pb-1 transition-all ${loginTab === "password"
                  ? "text-emerald-600 dark:text-emerald-455 border-b-2 border-emerald-600 dark:border-emerald-455"
                  : "text-slate-400 hover:text-slate-650"
                  }`}
              >
                Password Login
              </button>
            </div>

            {loginTab === "otp" ? (
              /* OTP FORM */
              !isOtpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Email Address</label>
                    <div className="flex items-center border border-slate-200 dark:border-slate-800 bg-slate-55/50 dark:bg-slate-950 rounded-2xl px-4 py-3 focus-within:border-emerald-500 transition-all">
                      <Mail className="w-5 h-5 text-slate-400 mr-3" />
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-transparent border-none outline-none w-full text-sm text-slate-800 dark:text-white placeholder-slate-400"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={otpLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white font-extrabold py-3 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    {otpLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Sending OTP...
                      </>
                    ) : (
                      <>
                        Send Verification OTP <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Verification Code</label>
                      <span className="text-xs text-slate-400 font-semibold">{email}</span>
                    </div>
                    <div className="flex items-center border border-slate-200 dark:border-slate-800 bg-slate-55/50 dark:bg-slate-950 rounded-2xl px-4 py-3 focus-within:border-emerald-500 transition-all">
                      <ShieldCheck className="w-5 h-5 text-slate-400 mr-3" />
                      <input
                        type="text"
                        required
                        maxLength={6}
                        placeholder="Enter 6-digit OTP"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="bg-transparent border-none outline-none w-full text-sm text-slate-800 dark:text-white tracking-widest placeholder-slate-400 text-center font-bold"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold px-1">
                    <button type="button" onClick={() => setIsOtpSent(false)} className="text-slate-500 hover:underline">
                      Change Email
                    </button>
                    {countdown > 0 ? (
                      <span className="text-slate-400">Resend in {countdown}s</span>
                    ) : (
                      <button type="button" onClick={handleSendOtp} className="text-emerald-600 dark:text-emerald-455 hover:underline">
                        Resend Code
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white font-extrabold py-3 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    {submitLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Logging in...
                      </>
                    ) : (
                      <>
                        Verify & Login <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )
            ) : (
              /* PASSWORD FORM */
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Email Address</label>
                  <div className="flex items-center border border-slate-200 dark:border-slate-800 bg-slate-55/50 dark:bg-slate-950 rounded-2xl px-4 py-3 focus-within:border-emerald-500 transition-all">
                    <Mail className="w-5 h-5 text-slate-455 mr-3" />
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-transparent border-none outline-none w-full text-sm text-slate-850 dark:text-white placeholder-slate-400"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Password</label>
                  <div className="flex items-center border border-slate-200 dark:border-slate-800 bg-slate-55/50 dark:bg-slate-950 rounded-2xl px-4 py-3 focus-within:border-emerald-500 transition-all">
                    <Lock className="w-5 h-5 text-slate-455 mr-3" />
                    <input
                      type="password"
                      required
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-transparent border-none outline-none w-full text-sm text-slate-850 dark:text-white placeholder-slate-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white font-extrabold py-3 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {submitLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Logging in...
                    </>
                  ) : (
                    <>
                      Verify & Login <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="text-center text-xs font-semibold text-slate-555 dark:text-slate-400 pt-2">
              Want to partner with us?{" "}
              <Link href={process.env.NEXT_PUBLIC_APP_MODE === "unified" ? "/vendor/register" : "/register"} className="text-emerald-655 dark:text-emerald-400 hover:underline font-extrabold">
                Register as a Vendor here
              </Link>
            </div>

            {!isNativeApp && (
              <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 dark:text-slate-500 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
                <a href={process.env.NEXT_PUBLIC_APP_MODE === "unified" ? "/app/login" : "http://localhost:3000/login"} className="hover:text-emerald-655 dark:hover:text-emerald-400 flex items-center gap-1">
                  ← Customer Portal
                </a>
                <a href={process.env.NEXT_PUBLIC_APP_MODE === "unified" ? "/delivery/login" : "http://localhost:3002/login"} className="hover:text-emerald-655 dark:hover:text-emerald-400 flex items-center gap-1">
                  Deliver with Us →
                </a>
              </div>
            )}
          </div>

          {/* Social login section */}
          {(socialSettings.google_client_id || socialSettings.facebook_client_id) && (
            <>
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                <span className="flex-shrink mx-4 text-slate-400 text-[10px] font-bold uppercase tracking-wider">Or Connect With</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              </div>

              <div className={`grid gap-4 ${socialSettings.google_client_id && socialSettings.facebook_client_id ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {socialSettings.google_client_id && (
                  <button
                    onClick={() => handleSocialLogin("google")}
                    className="flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-slate-55/50 dark:bg-slate-950/40 rounded-2xl py-2.5 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] text-slate-700 dark:text-slate-300"
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
                    className="flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-slate-55/50 dark:bg-slate-950/40 rounded-2xl py-2.5 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] text-slate-700 dark:text-slate-300"
                  >
                    <svg className="w-4 h-4 fill-[#1877F2]" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    <span>Facebook</span>
                  </button>
                )}
              </div>
            </>
          )}


        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-center text-[10px] text-slate-400 dark:text-slate-500 tracking-wide font-medium">
        <span>&copy; 2026 Sbjiwala • Secure Authentication System</span>
      </footer>
    </div>
  );
}
