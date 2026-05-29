"use client";

import React, { useState, useEffect } from "react";
import { Mail, Phone, ArrowRight, ShieldCheck, Loader2, Sparkles } from "lucide-react";
import { api } from "@sabjiwala/shared";

export default function LoginPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  // Countdown timer for resending OTP
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
    if (typeof window !== "undefined") {
      const isNextDev = window.location.port === "3000" || window.location.port === "3001" || window.location.port === "3002";
      const backendUrl = isNextDev ? "http://localhost:8000" : window.location.origin;
      return `${backendUrl}/api/v1${path}`;
    }
    return `/api/v1${path}`;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    
    if (loginMethod === "phone") {
      setErrorMsg("Mobile number login is temporarily disabled. Please use Email OTP login.");
      return;
    }

    if (!email) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setOtpLoading(true);
    try {
      // Overwrite axios base URL temporarily if in dev
      const isNextDev = typeof window !== "undefined" && (window.location.port === "3000" || window.location.port === "3001" || window.location.port === "3002");
      if (isNextDev) {
        (api as any).client.defaults.baseURL = "http://localhost:8000/api/v1";
      } else {
        (api as any).client.defaults.baseURL = "/api/v1";
      }

      const res = await api.post("/auth/otp/send", {
        email,
        purpose: "login"
      });

      if (res.success) {
        setIsOtpSent(true);
        setCountdown(60);
        setSuccessMsg(res.message || "OTP sent successfully to your email.");
        
        // Auto-fill OTP in debug mode
        if (res.meta?.otp) {
          setOtp(res.meta.otp);
          setSuccessMsg(`${res.meta.message} (Auto-filled OTP: ${res.meta.otp})`);
        }
      } else {
        setErrorMsg(res.message || "Failed to send OTP.");
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || err.message || "Something went wrong.");
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

    setVerifyLoading(true);
    try {
      const isNextDev = typeof window !== "undefined" && (window.location.port === "3000" || window.location.port === "3001" || window.location.port === "3002");
      if (isNextDev) {
        (api as any).client.defaults.baseURL = "http://localhost:8000/api/v1";
      } else {
        (api as any).client.defaults.baseURL = "/api/v1";
      }

      const res = await api.post("/auth/otp/verify", {
        email,
        otp,
        purpose: "login"
      });

      if (res.success && res.meta) {
        api.setTokens(res.meta.access_token, res.meta.refresh_token);
        setSuccessMsg("Logged in successfully! Redirecting...");
        setTimeout(() => {
          window.location.href = "/";
        }, 1000);
      } else {
        setErrorMsg(res.message || "Invalid OTP code.");
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || err.message || "Verification failed.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleSocialLogin = (provider: "google" | "facebook") => {
    const redirectUrl = getBackendUrl(`/auth/${provider}`);
    window.location.href = redirectUrl;
  };

  const handleDeveloperBypass = async (role: "customer" | "vendor" | "delivery" | "admin") => {
    setErrorMsg("");
    setSuccessMsg("");
    setOtpLoading(true);
    
    let credentials = { email: "", password: "" };
    if (role === "customer") credentials = { email: "customer@sabjiwala.in", password: "customer123" };
    if (role === "vendor") credentials = { email: "vendor@sabjiwala.in", password: "vendor123" };
    if (role === "delivery") credentials = { email: "delivery@sabjiwala.in", password: "delivery123" };
    if (role === "admin") credentials = { email: "admin@sabjiwala.in", password: "admin123" };

    try {
      const isNextDev = typeof window !== "undefined" && (window.location.port === "3000" || window.location.port === "3001" || window.location.port === "3002");
      if (isNextDev) {
        (api as any).client.defaults.baseURL = "http://localhost:8000/api/v1";
      } else {
        (api as any).client.defaults.baseURL = "/api/v1";
      }

      const res = await api.post("/auth/login", credentials);
      if (res.success && res.meta) {
        api.setTokens(res.meta.access_token, res.meta.refresh_token);
        setSuccessMsg(`Bypassed as ${role.toUpperCase()} successfully!`);
        setTimeout(() => {
          // Redirect based on role path
          if (role === "customer") window.location.href = "/";
          else if (role === "vendor") window.location.href = "/vendor";
          else if (role === "delivery") window.location.href = "/delivery";
          else if (role === "admin") window.location.href = "/admin";
        }, 800);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || err.message || "Bypass failed.");
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200 antialiased font-sans">
      {/* Header */}
      <header className="max-w-6xl w-full mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">SabjiWala</span>
          <span className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-full">Secure Portal</span>
        </div>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-350 hover:scale-105 active:scale-95 transition-all shadow-sm border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/30"
        >
          {theme === "light" ? "🍆" : "🍋"}
        </button>
      </header>

      {/* Main Form container */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl shadow-xl p-8 space-y-6 relative overflow-hidden">
          {/* Background decorations */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -ml-16 -mb-16 pointer-events-none"></div>

          {/* Heading */}
          <div className="text-center space-y-2 relative">
            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-2 animate-bounce">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Welcome to SabjiWala</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Log in to manage orders, catalog, and deliveries</p>
          </div>

          {/* Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/60 text-sm font-semibold">
            <button
              onClick={() => { setLoginMethod("email"); setErrorMsg(""); }}
              className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 ${
                loginMethod === "email"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md border border-slate-200/20"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Email OTP</span>
            </button>
            <button
              onClick={() => { setLoginMethod("phone"); setErrorMsg(""); }}
              className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 ${
                loginMethod === "phone"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md border border-slate-200/20"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Phone className="w-4 h-4" />
              <span>Mobile OTP</span>
            </button>
          </div>

          {/* Alert messages */}
          {errorMsg && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl text-xs font-semibold leading-relaxed">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-2xl text-xs font-semibold leading-relaxed">
              {successMsg}
            </div>
          )}

          {/* Forms */}
          {!isOtpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              {loginMethod === "email" ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Email Address</label>
                  <div className="flex items-center border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 rounded-2xl px-4 py-3 focus-within:border-emerald-500 transition-all">
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
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Mobile Number</label>
                  <div className="flex items-center border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 rounded-2xl px-4 py-3 focus-within:border-emerald-500 transition-all">
                    <span className="text-sm font-bold text-slate-400 dark:text-slate-500 mr-2">+91</span>
                    <input
                      type="tel"
                      placeholder="98200 12345"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="bg-transparent border-none outline-none w-full text-sm text-slate-800 dark:text-white placeholder-slate-400"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={otpLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white font-extrabold py-3.5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {otpLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending OTP...
                  </>
                ) : (
                  <>
                    Send verification OTP <ArrowRight className="w-4 h-4" />
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
                <div className="flex items-center border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 rounded-2xl px-4 py-3 focus-within:border-emerald-500 transition-all">
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
                <button
                  type="button"
                  onClick={() => setIsOtpSent(false)}
                  className="text-slate-500 dark:text-slate-400 hover:underline"
                >
                  Change Email
                </button>
                
                {countdown > 0 ? (
                  <span className="text-slate-400">Resend in {countdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="text-emerald-600 dark:text-emerald-450 hover:underline"
                  >
                    Resend Code
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={verifyLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white font-extrabold py-3.5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {verifyLoading ? (
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

          {/* Social Logins divider */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            <span className="flex-shrink mx-4 text-slate-400 text-xs font-bold uppercase tracking-wider">Or Connect With</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          </div>

          {/* Social buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleSocialLogin("google")}
              className="flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl py-3 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.2-5.136 4.2A5.626 5.626 0 0 1 8.28 13a5.626 5.626 0 0 1 5.711-5.6c1.554 0 2.973.57 4.073 1.503l3.24-3.24C19.336 3.793 15.938 2.5 12.24 2.5a10.5 10.5 0 0 0 0 21c5.82 0 10.5-4.2 10.5-10.5 0-.756-.098-1.485-.26-2.215H12.24z"
                />
              </svg>
              <span>Google</span>
            </button>
            <button
              onClick={() => handleSocialLogin("facebook")}
              className="flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl py-3 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="w-4.5 h-4.5 fill-[#1877F2]" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>Facebook</span>
            </button>
          </div>

          {/* Developer Bypass section */}
          <div className="border-t border-dashed border-slate-200 dark:border-slate-800/80 pt-6 space-y-3">
            <h4 className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider text-center flex items-center justify-center gap-1.5">
              <span>🔧</span> Developer Bypass Accounts
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <button
                onClick={() => handleDeveloperBypass("customer")}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-500 transition-colors py-2 rounded-xl"
              >
                Customer
              </button>
              <button
                onClick={() => handleDeveloperBypass("vendor")}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-500 transition-colors py-2 rounded-xl"
              >
                Vendor
              </button>
              <button
                onClick={() => handleDeveloperBypass("delivery")}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-500 transition-colors py-2 rounded-xl"
              >
                Delivery
              </button>
              <button
                onClick={() => handleDeveloperBypass("admin")}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-500 transition-colors py-2 rounded-xl"
              >
                Super Admin
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-center text-[10px] text-slate-400 dark:text-slate-500 tracking-wide font-medium">
        <span>&copy; 2026 SabjiWala.in • Secure Authentication System</span>
      </footer>
    </div>
  );
}
