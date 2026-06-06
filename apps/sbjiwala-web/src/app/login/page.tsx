"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ArrowRight, Phone, Lock, Mail, User, CheckCircle2, Loader2, ChevronLeft, Leaf, ShoppingBag, Truck, Shield } from "lucide-react";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import { Button, Input, Divider } from "@/components/ui/index";
import { useForm } from "react-hook-form";
import { z } from "zod";

// ==================== GUEST CART SYNC UTILITY ====================
const syncGuestCart = async () => {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("sw_guest_cart");
    if (!raw) return;
    const cart = JSON.parse(raw);
    if (!cart.items || cart.items.length === 0) return;

    // Send items sequentially to the backend
    for (const item of cart.items) {
      await api.post("/cart/items", {
        product_id: item.product_id,
        vendor_id: item.vendor_id,
        quantity: item.quantity
      });
    }
    // Clear guest cart
    localStorage.removeItem("sw_guest_cart");
    window.dispatchEvent(new Event("sw_cart_updated"));
  } catch (err) {
    console.error("Failed to sync guest cart", err);
  }
};

// ==================== SCHEMAS ====================
const otpLoginSchema = z.object({
  phone: z.string().min(10, "Enter valid 10-digit mobile number").max(10, "Enter valid 10-digit mobile number").regex(/^\d+$/, "Only digits allowed"),
});
const passwordLoginSchema = z.object({
  email: z.string().email("Enter valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
const registerSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter valid email"),
  phone: z.string().length(10, "Enter 10-digit mobile number").regex(/^\d+$/, "Only digits allowed"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, { message: "Passwords don't match", path: ["confirm_password"] });

type OTPMode = "phone" | "otp";
type ActiveTab = "otp" | "password" | "register";

// ==================== OTP TAB ====================
function OTPLoginTab({ selectedRole }: { selectedRole: "customer" | "vendor" | "delivery" | "admin" }) {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [mode, setMode] = useState<OTPMode>("phone"); // phone refers to first input stage (email)
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const startResendTimer = () => {
    setResendTimer(30);
    const interval = setInterval(() => {
      setResendTimer(t => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const sendOTP = async () => {
    if (!email || !email.includes("@")) { showError("Invalid email", "Enter a valid email address"); return; }
    setLoading(true);
    try {
      const res = await api.post("/auth/otp/send", { email, purpose: "login" });
      setMode("otp");
      startResendTimer();
      
      // Auto-fill OTP in debug mode if present in metadata
      if (res.meta?.otp) {
        const otpDigits = String(res.meta.otp).split("").slice(0, 6);
        const nextOtp = ["", "", "", "", "", ""];
        otpDigits.forEach((d, i) => { nextOtp[i] = d; });
        setOtp(nextOtp);
        success("OTP Sent (Debug)", `Verification code ${res.meta.otp} auto-filled`);
      } else {
        success("OTP Sent", `Verification code sent to ${email}`);
      }
    } catch (err: any) {
      showError("Failed to send OTP", err.response?.data?.detail || err.message);
    } finally { setLoading(false); }
  };

  const verifyOTP = async () => {
    const code = otp.join("");
    if (code.length !== 6) { showError("Invalid OTP", "Enter the 6-digit code"); return; }
    setLoading(true);
    try {
      const res = await api.post("/auth/otp/verify", { email, otp: code, purpose: "login" });
      const { access_token, refresh_token } = res.meta || {};
      
      // Role validation
      const userType = res.data?.user_type;
      const isAuthorized = 
        (selectedRole === "customer" && userType === "customer") ||
        (selectedRole === "vendor" && (userType === "vendor" || userType === "vendor_manager")) ||
        (selectedRole === "delivery" && userType === "delivery_boy") ||
        (selectedRole === "admin" && (userType === "admin" || userType === "super_admin"));
      
      if (!isAuthorized) {
        throw new Error(`Account is not registered as a ${selectedRole.replace("_", " ")}.`);
      }

      api.setTokens(access_token, refresh_token);
      success("Welcome back!", "Login successful");
      await syncGuestCart();

      // Redirect based on role
      let redirect = "/";
      if (selectedRole === "vendor") {
        try {
          const vProfile = await api.get("/vendors/me");
          if (vProfile.data?.status === "approved") {
            redirect = "/vendor";
          } else {
            redirect = "/kyc";
          }
        } catch {
          redirect = "/kyc";
        }
      } else if (selectedRole === "delivery") {
        redirect = "/delivery";
      } else if (selectedRole === "admin") {
        redirect = "/admin";
      } else {
        redirect = new URLSearchParams(window.location.search).get("redirect") || "/";
      }
      
      router.replace(redirect);
    } catch (err: any) {
      showError("Login failed", err.response?.data?.detail || err.message || "Invalid OTP code");
    } finally { setLoading(false); }
  };

  const handleOtpChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (!digit && idx > 0) otpRefs.current[idx - 1]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) otpRefs.current[idx - 1]?.focus();
  };

  if (mode === "otp") {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-1">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-base font-black text-slate-900 dark:text-white">Enter Verification Code</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sent to <span className="font-bold text-slate-700 dark:text-slate-300">{email}</span>
          </p>
        </div>

        <div className="flex gap-2 justify-center">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={el => { otpRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleOtpChange(i, e.target.value)}
              onKeyDown={e => handleOtpKeyDown(i, e)}
              className="w-11 h-13 text-center text-xl font-black border-2 rounded-xl input-base transition-all"
              style={{ width: "44px", height: "52px" }}
            />
          ))}
        </div>

        <Button fullWidth loading={loading} onClick={verifyOTP} size="lg">
          Verify & Continue <ArrowRight className="w-4 h-4" />
        </Button>

        <div className="text-center space-y-2">
          <button
            onClick={() => setMode("phone")}
            className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 mx-auto"
          >
            <ChevronLeft className="w-4 h-4" /> Change email
          </button>
          {resendTimer > 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Resend in <span className="font-bold text-emerald-600">{resendTimer}s</span></p>
          ) : (
            <button onClick={sendOTP} className="text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
              Resend OTP
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 font-sans">Email Address</label>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input-base px-4 py-3 text-sm flex-1 font-sans"
            onKeyDown={e => e.key === "Enter" && sendOTP()}
          />
        </div>
      </div>
      <Button fullWidth loading={loading} onClick={sendOTP} size="lg">
        Send OTP <ArrowRight className="w-4 h-4" />
      </Button>
      <p className="text-xs text-center text-slate-500 dark:text-slate-400">
        By continuing you agree to our{" "}
        <Link href="/terms" className="text-emerald-600 font-semibold hover:underline">Terms</Link>
        {" & "}
        <Link href="/privacy" className="text-emerald-600 font-semibold hover:underline">Privacy Policy</Link>
      </p>
    </div>
  );
}

// ==================== PASSWORD TAB ====================
function PasswordLoginTab({ selectedRole }: { selectedRole: "customer" | "vendor" | "delivery" | "admin" }) {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email: data.email, password: data.password });
      const { access_token, refresh_token } = res.data;

      // Role validation
      const userType = res.data?.user_type;
      const isAuthorized = 
        (selectedRole === "customer" && userType === "customer") ||
        (selectedRole === "vendor" && (userType === "vendor" || userType === "vendor_manager")) ||
        (selectedRole === "delivery" && userType === "delivery_boy") ||
        (selectedRole === "admin" && (userType === "admin" || userType === "super_admin"));
      
      if (!isAuthorized) {
        throw new Error(`Account is not registered as a ${selectedRole}.`);
      }

      api.setTokens(access_token, refresh_token);
      success("Welcome back!", "Login successful");
      await syncGuestCart();

      // Redirect based on role
      let redirect = "/";
      if (selectedRole === "vendor") {
        try {
          const vProfile = await api.get("/vendors/me");
          if (vProfile.data?.status === "approved") {
            redirect = "/vendor";
          } else {
            redirect = "/kyc";
          }
        } catch {
          redirect = "/kyc";
        }
      } else if (selectedRole === "delivery") {
        redirect = "/delivery";
      } else if (selectedRole === "admin") {
        redirect = "/admin";
      } else {
        redirect = new URLSearchParams(window.location.search).get("redirect") || "/";
      }
      
      router.replace(redirect);
    } catch (err: any) {
      showError("Login failed", err.response?.data?.detail || err.message || "Invalid email or password");
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Input
        label="Email Address"
        type="email"
        placeholder="you@example.com"
        leftIcon={<Mail className="w-4 h-4" />}
        error={errors.email?.message}
        {...register("email", { required: "Email is required", pattern: { value: /\S+@\S+\.\S+/, message: "Invalid email" } })}
      />
      <div>
        <Input
          label="Password"
          type={showPwd ? "text" : "password"}
          placeholder="Enter your password"
          leftIcon={<Lock className="w-4 h-4" />}
          rightIcon={
            <button type="button" onClick={() => setShowPwd(p => !p)}>
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
          error={errors.password?.message}
          {...register("password", { required: "Password is required" })}
        />
        <div className="flex justify-end mt-1.5">
          <Link href="/forgot-password" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
            Forgot password?
          </Link>
        </div>
      </div>
      <Button type="submit" fullWidth loading={loading} size="lg">
        Sign In <ArrowRight className="w-4 h-4" />
      </Button>
    </form>
  );
}

// ==================== REGISTER TAB ====================
// ==================== REGISTER TAB ====================
function RegisterTab() {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { full_name: "", email: "", phone: "", password: "", confirm_password: "" },
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const parts = (data.full_name || "").trim().split(/\s+/);
      const first_name = parts[0] || "";
      const last_name = parts.slice(1).join(" ") || "";

      const res = await api.post("/auth/register", {
        first_name,
        last_name,
        email: data.email,
        phone: "+91" + data.phone,
        password: data.password,
        role: "customer",
      });
      const { access_token, refresh_token } = res.data;
      api.setTokens(access_token, refresh_token);
      success("Account created! 🎉", "Welcome to Sbjiwala!");
      await syncGuestCart();
      const redirect = new URLSearchParams(window.location.search).get("redirect") || "/";
      router.replace(redirect);
    } catch (err: any) {
      showError("Registration failed", err.response?.data?.detail || err.message);
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Full Name" placeholder="Rahul Sharma" leftIcon={<User className="w-4 h-4" />}
        error={errors.full_name?.message}
        {...register("full_name", { required: "Name is required", minLength: { value: 2, message: "At least 2 chars" } })} />
      <Input label="Email" type="email" placeholder="you@example.com" leftIcon={<Mail className="w-4 h-4" />}
        error={errors.email?.message}
        {...register("email", { required: "Email is required", pattern: { value: /\S+@\S+\.\S+/, message: "Invalid email" } })} />
      <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Mobile Number</label>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-sm font-bold flex-shrink-0">🇮🇳 +91</div>
          <input type="tel" maxLength={10} placeholder="9876543210" className="input-base px-4 py-3 text-sm flex-1"
            {...register("phone", { required: true, pattern: /^\d{10}$/ })} />
        </div>
        {errors.phone && <p className="text-xs text-rose-500 mt-1">Enter valid 10-digit number</p>}
      </div>
      <Input label="Password" type={showPwd ? "text" : "password"} placeholder="Min. 8 characters" leftIcon={<Lock className="w-4 h-4" />}
        rightIcon={<button type="button" onClick={() => setShowPwd(p => !p)}>{showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>}
        error={errors.password?.message}
        {...register("password", { required: "Password required", minLength: { value: 8, message: "Min 8 chars" } })} />
      <Input label="Confirm Password" type="password" placeholder="Re-enter password" leftIcon={<Lock className="w-4 h-4" />}
        error={errors.confirm_password?.message}
        {...register("confirm_password", { required: "Please confirm password" })} />
      <Button type="submit" fullWidth loading={loading} size="lg">
        Create Account <ArrowRight className="w-4 h-4" />
      </Button>
      <p className="text-xs text-center text-slate-500 dark:text-slate-400">
        By signing up you agree to our <Link href="/terms" className="text-emerald-600 font-semibold hover:underline">Terms</Link> & <Link href="/privacy" className="text-emerald-600 font-semibold hover:underline">Privacy Policy</Link>
      </p>
    </form>
  );
}

// ==================== PAGE ====================
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

function LoginPageContent() {
  const router = useRouter();
  const [tab, setTab] = useState<ActiveTab>("otp");
  const [selectedRole, setSelectedRole] = useState<"customer" | "vendor" | "delivery" | "admin">("customer");

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("sw_access_token")) {
      const userType = getStoredUserType();
      if (userType === "vendor" || userType === "vendor_manager") {
        router.replace("/vendor");
      } else if (userType === "delivery_boy") {
        router.replace("/delivery");
      } else if (userType === "admin" || userType === "super_admin") {
        router.replace("/admin");
      } else {
        router.replace("/");
      }
    }
  }, [router]);

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: "otp", label: "OTP Login" },
    { id: "password", label: "Password" },
    { id: "register", label: "Register" },
  ];

  return (
    <div className="min-h-screen flex animate-fade-in">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] gradient-brand p-12 text-white">
        <div>
          <img src="/logo_horizontal.png" alt="Sbjiwala" className="h-10 w-auto object-contain brightness-0 invert" />
        </div>
        <div className="space-y-6">
          <div className="text-5xl">🥦🍅🥕</div>
          <h1 className="text-4xl font-black leading-tight">
            Fresh Vegetables<br />Delivered in<br />
            <span className="text-yellow-300">10 Minutes</span>
          </h1>
          <p className="text-emerald-100 text-lg max-w-xs">
            Join thousands of happy customers getting farm-fresh produce delivered daily.
          </p>
          <div className="flex flex-col gap-3">
            {["100% Farm Fresh", "Hygienic Packing", "10-Minute Express", "24/7 Support"].map(f => (
              <div key={f} className="flex items-center gap-2 text-emerald-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                <span className="text-sm font-semibold">{f}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-emerald-300/60 text-xs">© 2025 Sbjiwala — All rights reserved</p>
      </div>

      {/* Right Panel — Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 dark:bg-[#090d10]">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <img src="/logo_vertical.png" alt="Sbjiwala" className="h-20 w-auto object-contain" />
          </div>

          <div className="card p-8">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 gradient-brand rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Leaf className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Welcome Back</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sign in or create your account</p>
            </div>

            {/* Role Selector */}
            <div className="mb-6">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5 text-center">
                I want to log in as:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: "customer", label: "Customer", icon: ShoppingBag, color: "from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
                  { id: "vendor", label: "Vendor Partner", icon: Leaf, color: "from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
                  { id: "delivery", label: "Delivery Partner", icon: Truck, color: "from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
                  { id: "admin", label: "Administrator", icon: Shield, color: "from-rose-500/10 to-red-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" }
                ].map(r => {
                  const Icon = r.icon;
                  const isSelected = selectedRole === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRole(r.id as any)}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                        isSelected
                          ? `bg-gradient-to-br ${r.color.split(" ")[0]} ${r.color.split(" ")[1]} border-current shadow-md scale-[1.02] font-black`
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                      style={{ color: isSelected ? undefined : "" }}
                    >
                      <Icon className={`w-5 h-5 mb-1.5 transition-transform ${isSelected ? "animate-pulse" : ""}`} />
                      <span className="text-[11px] font-black tracking-tight">{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab switcher */}
            <div className="flex bg-slate-100 dark:bg-slate-800/60 rounded-2xl p-1 mb-6 border border-slate-200 dark:border-slate-700">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${tab === t.id
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400"
                    }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {tab === "otp" && <OTPLoginTab selectedRole={selectedRole} />}
            {tab === "password" && <PasswordLoginTab selectedRole={selectedRole} />}
            {tab === "register" && <RegisterTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-[#090d10] flex items-center justify-center"><Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" /></div>}>
      <LoginPageContent />
    </Suspense>
  );
}
