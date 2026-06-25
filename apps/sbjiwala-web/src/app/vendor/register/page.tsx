"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Phone, ArrowRight, ShieldCheck, Loader2, User, Lock, Gift, Building2 } from "lucide-react";
import { api } from "@sbjiwala/shared";

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

export default function VendorRegisterPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [countdown, setCountdown] = useState(0);
  const [otpMode, setOtpMode] = useState<"register" | "verification">("register");

  // Form States
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regReferral, setRegReferral] = useState("");

  // Vendor business details
  const [regBusinessName, setRegBusinessName] = useState("");
  const [regBusinessType, setRegBusinessType] = useState("individual");
  const [regPanNumber, setRegPanNumber] = useState("");
  const [regGstNumber, setRegGstNumber] = useState("");
  const [regFssaiNumber, setRegFssaiNumber] = useState("");
  const [regDescription, setRegDescription] = useState("");

  // OTP Verification States
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Status Messages
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const getStoredUserType = () => {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem("sw_access_token");
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!regFirstName || !regEmail) {
      setErrorMsg("First Name and Email are required.");
      return;
    }
    if (!regBusinessName) {
      setErrorMsg("Business Name is required.");
      return;
    }
    if (!regPanNumber) {
      setErrorMsg("PAN Number is required.");
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await api.post("/auth/register", {
        email: regEmail,
        phone: regPhone ? "+91" + regPhone : undefined,
        first_name: regFirstName,
        last_name: regLastName,
        password: regPassword || undefined,
        referral_code: regReferral || undefined,
        role: "vendor",
        business_name: regBusinessName,
        business_type: regBusinessType,
        pan_number: regPanNumber,
        gst_number: regGstNumber || undefined,
        fssai_number: regFssaiNumber || undefined,
        description: regDescription || undefined
      });

      if (res.success) {
        setSuccessMsg("Registration initiated successfully!");
        setOtpMode("verification");
        setCountdown(60);

        if (res.meta?.otp) {
          setOtp(res.meta.otp);
          setSuccessMsg(`Registration initiated! (Auto-filled OTP: ${res.meta.otp})`);
        }
      } else {
        setErrorMsg(res.message || "Registration failed.");
      }
    } catch (err: any) {
      setErrorMsg(formatError(err) || "Registration failed.");
    } finally {
      setSubmitLoading(false);
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
      const res = await api.post("/auth/otp/verify", {
        email: regEmail,
        otp,
        purpose: "register",
        role: "vendor"
      });

      if (res.success && res.meta) {
        api.setTokens(res.meta.access_token, res.meta.refresh_token);
        setSuccessMsg("Registration complete & logged in successfully! Redirecting...");
        setTimeout(() => {
          const isUnified = process.env.NEXT_PUBLIC_APP_MODE === "unified";
          router.replace(isUnified ? "/vendor" : "/");
        }, 1000);
      } else {
        setErrorMsg(res.message || "Invalid OTP code.");
      }
    } catch (err: any) {
      setErrorMsg(formatError(err) || "Verification failed.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setOtpLoading(true);
    try {
      const res = await api.post("/auth/otp/send", {
        email: regEmail,
        purpose: "register"
      });
      if (res.success) {
        setCountdown(60);
        setSuccessMsg(res.message || "OTP sent successfully.");
        if (res.meta?.otp) {
          setOtp(res.meta.otp);
        }
      } else {
        setErrorMsg(res.message || "Failed to send OTP.");
      }
    } catch (err: any) {
      setErrorMsg(formatError(err) || "Failed to send OTP.");
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200 antialiased font-sans py-6">
      {/* Header */}
      <header className="max-w-6xl w-full mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo_horizontal.png" alt="Sbjiwala Logo" className="h-8 w-auto object-contain" />
          <span className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full">Vendor Registration</span>
        </div>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-355 hover:scale-105 active:scale-95 transition-all shadow-sm border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/30"
        >
          {theme === "light" ? "🍆" : "🍋"}
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl shadow-xl p-6 md:p-8 space-y-6 relative overflow-hidden my-4">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>
          
          <div className="text-center space-y-2">
            <Building2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {otpMode === "register" ? "Become a Vendor" : "Verify Your Account"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {otpMode === "register" ? "Register your store and start accepting orders" : "Enter OTP sent to " + regEmail}
            </p>
          </div>

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

          {otpMode === "register" ? (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">First Name</label>
                  <div className="flex items-center border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 rounded-xl px-3.5 py-2.5 focus-within:border-emerald-500 transition-all">
                    <User className="w-4 h-4 text-slate-455 mr-2" />
                    <input
                      type="text"
                      required
                      placeholder="Rahul"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                      className="bg-transparent border-none outline-none w-full text-xs text-slate-850 dark:text-white"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Last Name</label>
                  <div className="flex items-center border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 rounded-xl px-3.5 py-2.5 focus-within:border-emerald-500 transition-all">
                    <User className="w-4 h-4 text-slate-455 mr-2" />
                    <input
                      type="text"
                      placeholder="Sharma"
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                      className="bg-transparent border-none outline-none w-full text-xs text-slate-850 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Email Address</label>
                <div className="flex items-center border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 rounded-xl px-3.5 py-2.5 focus-within:border-emerald-500 transition-all">
                  <Mail className="w-4 h-4 text-slate-455 mr-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="bg-transparent border-none outline-none w-full text-xs text-slate-850 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Mobile Number (Optional)</label>
                <div className="flex items-center border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 rounded-xl px-3.5 py-2.5 focus-within:border-emerald-500 transition-all">
                  <Phone className="w-4 h-4 text-slate-455 mr-2.5" />
                  <input
                    type="tel"
                    placeholder="9820012345"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="bg-transparent border-none outline-none w-full text-xs text-slate-850 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Password (Optional)</label>
                <div className="flex items-center border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 rounded-xl px-3.5 py-2.5 focus-within:border-emerald-500 transition-all">
                  <Lock className="w-4 h-4 text-slate-455 mr-2.5" />
                  <input
                    type="password"
                    placeholder="Create secure password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="bg-transparent border-none outline-none w-full text-xs text-slate-850 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Referral Code (Optional)</label>
                <div className="flex items-center border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 rounded-xl px-3.5 py-2.5 focus-within:border-emerald-500 transition-all">
                  <Gift className="w-4 h-4 text-slate-455 mr-2.5" />
                  <input
                    type="text"
                    placeholder="e.g. WELCOME100"
                    value={regReferral}
                    onChange={(e) => setRegReferral(e.target.value.toUpperCase())}
                    className="bg-transparent border-none outline-none w-full text-xs text-slate-850 dark:text-white tracking-widest"
                  />
                </div>
              </div>

              <div className="space-y-3 p-4 rounded-2xl border border-blue-500/20 bg-blue-50/10 dark:bg-blue-955/10 text-left">
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Business Settings</p>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Business Name</label>
                  <div className="flex items-center border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 rounded-xl px-3.5 py-2.5 focus-within:border-emerald-500 transition-all">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Fresh Veggies Mart"
                      value={regBusinessName}
                      onChange={(e) => setRegBusinessName(e.target.value)}
                      className="bg-transparent border-none outline-none w-full text-xs text-slate-850 dark:text-white placeholder-slate-400"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-350">Business Type</label>
                  <select
                    value={regBusinessType}
                    onChange={(e) => setRegBusinessType(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500 transition-all"
                  >
                    <option value="individual">Individual / Sole Proprietor</option>
                    <option value="partnership">Partnership Firm</option>
                    <option value="company">Private Limited Company</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">PAN Number</label>
                  <div className="flex items-center border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 rounded-xl px-3.5 py-2.5 focus-within:border-emerald-500 transition-all">
                    <input
                      type="text"
                      required
                      placeholder="e.g. ABCDE1234F"
                      value={regPanNumber}
                      onChange={(e) => setRegPanNumber(e.target.value.toUpperCase())}
                      className="bg-transparent border-none outline-none w-full text-xs text-slate-850 dark:text-white placeholder-slate-400"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">GST Number (Optional)</label>
                  <div className="flex items-center border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 rounded-xl px-3.5 py-2.5 focus-within:border-emerald-500 transition-all">
                    <input
                      type="text"
                      placeholder="e.g. 22AAAAA1111A1Z1"
                      value={regGstNumber}
                      onChange={(e) => setRegGstNumber(e.target.value.toUpperCase())}
                      className="bg-transparent border-none outline-none w-full text-xs text-slate-850 dark:text-white placeholder-slate-400"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">FSSAI Number (Optional)</label>
                  <div className="flex items-center border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 rounded-xl px-3.5 py-2.5 focus-within:border-emerald-500 transition-all">
                    <input
                      type="text"
                      placeholder="e.g. 12345678901234"
                      value={regFssaiNumber}
                      onChange={(e) => setRegFssaiNumber(e.target.value)}
                      className="bg-transparent border-none outline-none w-full text-xs text-slate-850 dark:text-white placeholder-slate-400"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Store Description (Optional)</label>
                  <div className="flex items-center border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 rounded-xl px-3.5 py-2.5 focus-within:border-emerald-500 transition-all">
                    <input
                      type="text"
                      placeholder="Describe your store offerings..."
                      value={regDescription}
                      onChange={(e) => setRegDescription(e.target.value)}
                      className="bg-transparent border-none outline-none w-full text-xs text-slate-850 dark:text-white placeholder-slate-400"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white font-extrabold py-3 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 text-xs disabled:opacity-50 mt-2"
              >
                {submitLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Creating Account...
                  </>
                ) : (
                  <>
                    Create & Register Account <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Verification OTP Code</label>
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
                <button type="button" onClick={() => setOtpMode("register")} className="text-slate-500 hover:underline">
                  Go Back
                </button>
                {countdown > 0 ? (
                  <span className="text-slate-400">Resend in {countdown}s</span>
                ) : (
                  <button type="button" onClick={handleResendOtp} className="text-emerald-600 dark:text-emerald-455 hover:underline">
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
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    Verify & Register <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {otpMode === "register" && (
            <div className="text-center text-xs font-semibold text-slate-550 dark:text-slate-400 mt-4">
              Already registered?{" "}
              <Link href={process.env.NEXT_PUBLIC_APP_MODE === "unified" ? "/vendor/login" : "/login"} className="text-emerald-655 dark:text-emerald-400 hover:underline font-extrabold">
                Login here
              </Link>
            </div>
          )}

          <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 dark:text-slate-500 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
            <a href={process.env.NEXT_PUBLIC_APP_MODE === "unified" ? "/login" : "http://localhost:3000/login"} className="hover:text-emerald-655 dark:hover:text-emerald-400 flex items-center gap-1">
              ← Customer Portal
            </a>
            <a href={process.env.NEXT_PUBLIC_APP_MODE === "unified" ? "/delivery/login" : "http://localhost:3002/login"} className="hover:text-emerald-655 dark:hover:text-emerald-400 flex items-center gap-1">
              Deliver with Us →
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-center text-[10px] text-slate-400 dark:text-slate-500 tracking-wide font-medium">
        <span>&copy; 2026 Sbjiwala • Secure Authentication System</span>
      </footer>
    </div>
  );
}
