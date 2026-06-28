"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowRight, Phone, Lock, Mail, User, CheckCircle2, 
  Loader2, ChevronLeft, Leaf, Sparkles
} from "lucide-react";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import { Button, Input } from "@/components/ui/index";
import { useForm } from "react-hook-form";
import { resolveLink } from "@/components/AppShell";

function RegisterPageContent() {
  const router = useRouter();
  const { success, error: showError, info } = useToast();
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [otpMode, setOtpMode] = useState<"register" | "verification">("register");

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
    if (typeof window !== "undefined" && localStorage.getItem("sw_access_token")) {
      const role = getStoredUserType() || "customer";
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
  const [otpIdentifier, setOtpIdentifier] = useState("");
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const otpRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  // Register state (RHF)
  const { register: regForm, handleSubmit: handleRegSubmit, formState: { errors: regErrors } } = useForm({
    defaultValues: {
      username: "",
      email: "",
      phone: "",
      first_name: "",
      last_name: "",
      password: "",
      confirm_password: "",
      referral_code: ""
    }
  });

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const startOtpResendTimer = () => {
    setCountdown(60);
  };

  const onRegisterSubmit = async (data: any) => {
    if (!data.email && !data.phone) {
      showError("Fields Required", "Please provide at least email or phone number for verification");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        username: data.username || undefined,
        email: data.email || undefined,
        phone: data.phone ? "+91" + data.phone : undefined,
        first_name: data.first_name,
        last_name: data.last_name,
        password: data.password || undefined,
        referral_code: data.referral_code || undefined,
        role: "customer",
      };

      const res = await api.post("/auth/register", payload);
      
      // Auto routing based on what verification target was used
      const target = res.meta?.verification_identifier;
      success("Registration Complete", res.message || "OTP verification required to activate account");

      // Pre-fill details for verification
      setOtpIdentifier(target);
      setOtpMode("verification");
      startOtpResendTimer();
    } catch (err: any) {
      showError("Registration failed", err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    const code = otpCode.join("");
    if (code.length !== 6) {
      showError("Invalid OTP", "Enter the full 6-digit code");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/otp/verify", {
        identifier: otpIdentifier,
        otp: code,
        purpose: "register",
        role: "customer"
      });

      const { access_token, refresh_token } = res.meta || {};
      api.setTokens(access_token, refresh_token);
      success("Welcome to Sbjiwala!", "Account activated and logged in successfully!");
      router.replace("/");
    } catch (err: any) {
      showError("Verification failed", err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpDigitChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otpCode];
    next[idx] = digit;
    setOtpCode(next);
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (!digit && idx > 0) otpRefs.current[idx - 1]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpCode[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleSendOTP = async () => {
    if (!otpIdentifier) return;
    setLoading(true);
    try {
      const res = await api.post("/auth/otp/send", {
        identifier: otpIdentifier,
        purpose: "register"
      });
      startOtpResendTimer();
      success("OTP Sent", `Verification code sent to your registered contact details`);
    } catch (err: any) {
      showError("Failed to send OTP", err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex animate-fade-in font-sans">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] gradient-brand p-12 text-white">
        <div>
          <img src="/logo_horizontal.png" alt="Sbjiwala" className="h-10 w-auto object-contain brightness-0 invert" />
        </div>
        <div className="space-y-6">
          <div className="text-5xl">🥦🍅🥕</div>
          <h1 className="text-4xl font-black leading-tight">
            Farm-Fresh Produce<br />Delivered to Your Door<br />
            <span className="text-yellow-300">In Instant</span>
          </h1>
          <p className="text-emerald-100 text-lg max-w-xs">
            Join thousands of happy customers eating fresh every single day.
          </p>
          <div className="flex flex-col gap-3">
            {["100% Organic Quality", "Hygienic Storage", "Express Super Fast Delivery", "Instant Wallet Refunds"].map(f => (
              <div key={f} className="flex items-center gap-2 text-emerald-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                <span className="text-sm font-semibold">{f}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-emerald-300/60 text-xs">© 2026 Sbjiwala — Platform Ecosystem</p>
      </div>

      {/* Right Panel — Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-55 dark:bg-[#090d10] overflow-y-auto min-h-screen py-12">
        <div className="w-full max-w-md space-y-6">
          
          {/* Logo on mobile */}
          <div className="lg:hidden flex justify-center mb-4">
            <img src="/logo_vertical.png" alt="Sbjiwala" className="h-16 w-auto object-contain" />
          </div>

          <div className="card p-8 shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 gradient-brand rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Leaf className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                {otpMode === "register" ? "Create Account" : "Verify OTP"}
              </h2>
              <p className="text-sm text-slate-550 dark:text-slate-400 mt-1">
                {otpMode === "register" ? "Register to start ordering fresh organic food" : "Enter the verification code to activate account"}
              </p>
            </div>

            {otpMode === "register" ? (
              <form onSubmit={handleRegSubmit(onRegisterSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input 
                    label="First Name" 
                    placeholder="John" 
                    error={regErrors.first_name?.message}
                    {...regForm("first_name", { required: "First name is required" })}
                  />
                  <Input 
                    label="Last Name" 
                    placeholder="Doe" 
                    error={regErrors.last_name?.message}
                    {...regForm("last_name")}
                  />
                </div>
                <Input 
                  label="Username (Optional)" 
                  placeholder="johndoe123" 
                  leftIcon={<User className="w-4 h-4" />}
                  error={regErrors.username?.message}
                  {...regForm("username")}
                />
                <Input 
                  label="Email" 
                  type="email" 
                  placeholder="you@example.com" 
                  leftIcon={<Mail className="w-4 h-4" />}
                  error={regErrors.email?.message}
                  {...regForm("email")}
                />
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Mobile Number</label>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-sm font-bold flex-shrink-0">🇮🇳 +91</div>
                    <input 
                      type="tel" 
                      maxLength={10} 
                      placeholder="9876543210" 
                      className="input-base px-4 py-3 text-sm flex-1 font-sans"
                      {...regForm("phone", { pattern: /^\d{10}$/ })} 
                    />
                  </div>
                  {regErrors.phone && <p className="text-xs text-rose-500 mt-1">Enter valid 10-digit number</p>}
                </div>
                <Input 
                  label="Password" 
                  type="password" 
                  placeholder="Min. 8 characters" 
                  leftIcon={<Lock className="w-4 h-4" />}
                  error={regErrors.password?.message}
                  {...regForm("password", { required: "Password is required" })} 
                />
                <Input 
                  label="Referral Code (Optional)" 
                  placeholder="REFCODE12" 
                  leftIcon={<Sparkles className="w-4 h-4" />}
                  error={regErrors.referral_code?.message}
                  {...regForm("referral_code")}
                />

                <Button type="submit" fullWidth loading={loading} size="lg">
                  Submit Registration <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="text-center space-y-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    OTP sent for <span className="font-bold">{otpIdentifier}</span>
                  </p>
                </div>

                <div className="flex gap-2 justify-center">
                  {otpCode.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpDigitChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      className="w-10 h-12 text-center text-lg font-black border-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-emerald-500 transition-colors"
                    />
                  ))}
                </div>

                <Button fullWidth loading={loading} onClick={handleVerifyOTP} size="lg">
                  Verify & Log In <ArrowRight className="w-4 h-4" />
                </Button>

                <div className="text-center space-y-2">
                  <button
                    onClick={() => setOtpMode("register")}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mx-auto font-semibold"
                  >
                    <ChevronLeft className="w-4 h-4" /> Go back
                  </button>
                  {countdown > 0 ? (
                    <p className="text-[11px] text-slate-550 dark:text-slate-400">Resend in <span className="font-bold text-emerald-600">{countdown}s</span></p>
                  ) : (
                    <button onClick={handleSendOTP} className="text-xs font-bold text-emerald-600 hover:underline">
                      Resend Verification OTP
                    </button>
                  )}
                </div>
              </div>
            )}

            {otpMode === "register" && (
              <div className="text-center text-xs font-semibold text-slate-550 dark:text-slate-400 mt-6">
                Already have an account?{" "}
                <Link href={resolveLink("/login")} className="text-emerald-650 dark:text-emerald-400 hover:underline font-extrabold">
                  Login here
                </Link>
              </div>
            )}

            <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 mt-6 leading-relaxed">
              By proceeding, you agree to our <Link href="/terms" className="text-emerald-600 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-emerald-600 hover:underline">Privacy Policy</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
      </div>
    }>
      <RegisterPageContent />
    </Suspense>
  );
}
