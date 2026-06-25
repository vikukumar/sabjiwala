"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Eye, EyeOff, ArrowRight, Phone, Lock, Mail, User, CheckCircle2, 
  Loader2, ChevronLeft, Leaf, ShoppingBag, Truck, Shield, Key, Sparkles, AlertCircle,
  Fingerprint, Smartphone
} from "lucide-react";
import { api } from "@sbjiwala/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import { Button, Input, Divider } from "@/components/ui/index";
import { encryptPayload } from "@/components/ui/crypto";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { resolveLink } from "@/components/AppShell";

// ==================== GUEST CART SYNC UTILITY ====================
const syncGuestCart = async (queryClient?: any) => {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("sw_guest_cart");
    if (!raw) return;
    const cart = JSON.parse(raw);
    if (!cart.items || cart.items.length === 0) return;

    // Clear backend cart first so guest cart overwrites it
    try {
      await api.delete("/cart");
    } catch (clearErr) {
      console.warn("Failed to clear backend cart prior to sync:", clearErr);
    }

    for (const item of cart.items) {
      await api.post("/cart/items", {
        product_id: item.product_id,
        vendor_id: item.vendor_id,
        quantity: item.quantity
      });
    }
    localStorage.removeItem("sw_guest_cart");
    window.dispatchEvent(new Event("sw_cart_updated"));
    if (queryClient) {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["cartPreview"] });
    }
  } catch (err) {
    console.error("Failed to sync guest cart", err);
  }
};

type ActiveTab = "otp" | "password" | "passkey" | "magic" | "register";

// Helper: Convert array buffer to base64url string
const bufferToBase64Url = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

// Helper: Convert base64url string to Uint8Array
const base64UrlToBytes = (base64Url: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

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
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { success, error: showError, info } = useToast();
  
  const [tab, setTab] = useState<ActiveTab>("otp");
  const selectedRole = "customer";
  
  // Dynamic Views
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPasskeySetup, setShowPasskeySetup] = useState(false);

  // Common loader / state
  const [loading, setLoading] = useState(false);

  // 1. OTP State
  const [otpMode, setOtpMode] = useState<"identifier" | "verification">("identifier");
  const [otpIdentifier, setOtpIdentifier] = useState("");
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 2. Password Reset State
  const [resetStep, setResetStep] = useState<"request" | "verify" | "confirm">("request");
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // 3. Register state (RHF)
  const { register: regForm, handleSubmit: handleRegSubmit, formState: { errors: regErrors } } = useForm({
    defaultValues: {
      username: "",
      email: "",
      phone: "",
      first_name: "",
      last_name: "",
      password: "",
      confirm_password: "",
      referral_code: "",
      business_name: "",
      business_type: "individual",
      description: "",
      gst_number: "",
      pan_number: "",
      fssai_number: "",
      vehicle_type: "motorcycle",
      vehicle_number: "",
      license_number: ""
    }
  });

  // Check existing redirect session or verify magic tokens
  useEffect(() => {
    // Check if magic link verification query is present
    const magicToken = searchParams.get("magic_token");
    if (magicToken) {
      handleVerifyMagicLink(magicToken);
    }

    if (typeof window !== "undefined" && localStorage.getItem("sw_access_token")) {
      const userType = getStoredUserType();
      if (userType) {
        redirectBasedOnRole(userType);
      } else {
        localStorage.removeItem("sw_access_token");
        localStorage.removeItem("sw_refresh_token");
      }
    }
  }, [searchParams]);

  const redirectBasedOnRole = (role: string) => {
    let dest = "/";
    const isUnified = process.env.NEXT_PUBLIC_APP_MODE === "unified";
    if (role === "vendor" || role === "vendor_manager") {
      dest = "/vendor";
    } else if (role === "delivery_boy") {
      dest = "/delivery";
    } else if (role === "admin" || role === "super_admin") {
      dest = "/admin";
    } else {
      dest = searchParams.get("redirect") || (isUnified ? "/app" : "/");
    }
    if (isUnified && dest === "/") {
      dest = "/app";
    }
    router.replace(dest);
  };

  // Helper validation for role matching
  const validateUserRole = (userType: string) => {
    const isAuthorized = userType === "customer";
    if (!isAuthorized) {
      throw new Error("Your account does not have access privileges as a customer.");
    }
  };

  // ==================== 1. OTP ACTIONS ====================
  const startOtpResendTimer = () => {
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer(t => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async () => {
    if (!otpIdentifier.trim()) {
      showError("Error", "Please enter your username, email, or mobile number");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/otp/send", {
        identifier: otpIdentifier,
        purpose: "login"
      });
      setOtpMode("verification");
      startOtpResendTimer();
      
      if (res.meta?.otp) {
        const otpDigits = String(res.meta.otp).split("").slice(0, 6);
        const nextOtp = ["", "", "", "", "", ""];
        otpDigits.forEach((d, i) => { nextOtp[i] = d; });
        setOtpCode(nextOtp);
        success("OTP Sent (Debug)", `Verification code ${res.meta.otp} auto-filled`);
      } else {
        success("OTP Sent", `Verification code sent to your registered contact details`);
      }
    } catch (err: any) {
      showError("Failed to send OTP", err.response?.data?.detail || err.message);
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
      const encrypted = await encryptPayload({
        identifier: otpIdentifier,
        otp: code,
        purpose: "login",
        role: "customer"
      });
      const res = await api.post("/auth/otp/verify", encrypted);
      
      const userType = res.data?.user_type;
      validateUserRole(userType);

      const { access_token, refresh_token } = res.meta || {};
      api.setTokens(access_token, refresh_token);
      success("Welcome Back!", "Logged in successfully!");
      await syncGuestCart(queryClient);

      // Check if they want to register passkey, otherwise redirect
      setShowPasskeySetup(true);
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

  // ==================== 2. PASSWORD ACTIONS ====================
  const [passwordState, setPasswordState] = useState({ identifier: "", password: "", show: false });
  
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordState.identifier || !passwordState.password) {
      showError("Required", "Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const encrypted = await encryptPayload({
        identifier: passwordState.identifier,
        password: passwordState.password,
        role: "customer"
      });
      const res = await api.post("/auth/login", encrypted);

      const userType = res.data?.user_type;
      validateUserRole(userType);

      const { access_token, refresh_token } = res.meta || res.data || {};
      api.setTokens(access_token, refresh_token);
      success("Welcome Back!", "Logged in successfully!");
      await syncGuestCart(queryClient);

      setShowPasskeySetup(true);
    } catch (err: any) {
      showError("Login failed", err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== 3. PASSWORD RESET / FORGOT ACTIONS ====================
  const handleResetRequest = async () => {
    if (!resetIdentifier.trim()) {
      showError("Required", "Please enter your identifier");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/password/reset/request", {
        identifier: resetIdentifier
      });
      success("Reset OTP Sent", res.message || "Reset code sent successfully");
      setResetStep("verify");
      
      if (res.meta?.otp) {
        setResetOtp(res.meta.otp);
        info("Debug OTP", `Auto-filled reset OTP: ${res.meta.otp}`);
      }
    } catch (err: any) {
      showError("Request failed", err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetVerify = async () => {
    if (!resetOtp.trim()) {
      showError("Required", "Please enter the OTP");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/password/reset/verify", {
        identifier: resetIdentifier,
        otp: resetOtp
      });
      success("OTP Verified", "Please choose your new password");
      setResetToken(res.meta?.reset_token || "");
      setResetStep("confirm");
    } catch (err: any) {
      showError("Verification failed", err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetConfirm = async () => {
    if (newPassword.length < 8) {
      showError("Password Weak", "Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showError("Mismatch", "Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/password/reset/confirm", {
        token: resetToken,
        new_password: newPassword
      });
      success("Success", "Password updated successfully! Please login.");
      setShowForgotPassword(false);
      setResetStep("request");
      setResetIdentifier("");
      setResetOtp("");
      setResetToken("");
      setNewPassword("");
      setConfirmNewPassword("");
      setTab("password");
    } catch (err: any) {
      showError("Reset confirmation failed", err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== 4. PASSKEY (WEBAUTHN) ACTIONS ====================
  const [passkeyIdentifier, setPasskeyIdentifier] = useState("");
  
  const handlePasskeyLogin = async () => {
    if (!passkeyIdentifier.trim()) {
      showError("Required", "Please enter your username, email, or phone to fetch passkeys");
      return;
    }
    setLoading(true);
    try {
      // 1. Get options
      const optRes = await api.post("/auth/passkey/login/options", {
        identifier: passkeyIdentifier
      });
      
      const { challenge, allow_credentials } = optRes.data;

      // 2. Format challenge and allowCredentials for credential validation
      const challengeBytes = base64UrlToBytes(challenge).buffer as any;
      const allowCredentials = allow_credentials.map((id: string) => ({
        type: "public-key",
        id: base64UrlToBytes(id).buffer as any
      }));

      // 3. Trigger WebAuthn Assertion
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challengeBytes,
          allowCredentials,
          userVerification: "preferred",
          timeout: 60000
        } as any
      }) as PublicKeyCredential;

      if (!assertion) {
        throw new Error("Passkey reading failed or was cancelled");
      }

      const response = assertion.response as AuthenticatorAssertionResponse;

      // 4. Send verification back to backend
      const verifyRes = await api.post("/auth/passkey/login/verify", {
        credential_id: assertion.id,
        authenticator_data_b64: bufferToBase64Url(response.authenticatorData),
        client_data_json_b64: bufferToBase64Url(response.clientDataJSON),
        signature_b64: bufferToBase64Url(response.signature),
        identifier: passkeyIdentifier,
        role: "customer"
      });

      const userType = verifyRes.data?.user_type;
      validateUserRole(userType);

      const { access_token, refresh_token } = verifyRes.meta || {};
      api.setTokens(access_token, refresh_token);
      success("Welcome Back!", "Passkey verification successful");
      await syncGuestCart(queryClient);
      
      redirectBasedOnRole(userType);
    } catch (err: any) {
      showError("Passkey login failed", err.response?.data?.detail || err.message || "Signature check failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterPasskey = async () => {
    setLoading(true);
    try {
      // 1. Get options (needs auth token, which we have since we just verified OTP/Password)
      const optRes = await api.post("/auth/passkey/register/options", {
        device_name: navigator.userAgent.split(" ")[0] || "My Desktop/Mobile"
      });

      const { challenge, rp, user } = optRes.data;

      // 2. Format buffers
      const challengeBytes = base64UrlToBytes(challenge).buffer as any;
      // user.id is string UUID, encode to byte array
      const userBytes = new TextEncoder().encode(user.id).buffer as any;

      // 3. Trigger WebAuthn Registration
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challengeBytes,
          rp: { name: rp.name, id: rp.id },
          user: {
            id: userBytes,
            name: user.name,
            displayName: user.displayName
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },  // ES256
            { type: "public-key", alg: -257 } // RS256
          ],
          authenticatorSelection: {
            userVerification: "preferred",
            residentKey: "preferred"
          },
          timeout: 60000,
          attestation: "none"
        } as any
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error("Registration was cancelled");
      }

      // Convert SPKI public key to PEM string
      const response = credential.response as AuthenticatorAttestationResponse;
      const publicKeyBuffer = response.getPublicKey();
      if (!publicKeyBuffer) {
        throw new Error("Public key could not be extracted from credentials");
      }

      const base64PublicKey = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));
      const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${base64PublicKey.match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`;

      // 4. Send options back to verify
      await api.post("/auth/passkey/register/verify", {
        credential_id: credential.id,
        public_key_pem: publicKeyPem,
        device_name: "Web Browser (" + (navigator.platform || "Platform") + ")"
      });

      success("Success", "Passkey registered successfully! You can now log in securely using your fingerprint/face/PIN.");
      setShowPasskeySetup(false);
      
      const uType = getStoredUserType();
      redirectBasedOnRole(uType || "customer");
    } catch (err: any) {
      showError("Passkey setup failed", err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== 5. MAGIC LINK ACTIONS ====================
  const [magicIdentifier, setMagicIdentifier] = useState("");

  const handleSendMagicLink = async () => {
    if (!magicIdentifier.trim()) {
      showError("Required", "Please enter your username, email, or mobile number");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/magic-link/request", {
        identifier: magicIdentifier,
        role: selectedRole
      });
      success("Magic Link Dispatched", res.message || "Check your email or phone messages for the login link");
    } catch (err: any) {
      showError("Request failed", err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMagicLink = async (token: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/auth/magic-link/verify?token=${token}`);
      const { access_token, refresh_token } = res.meta || {};
      api.setTokens(access_token, refresh_token);
      success("Success", "Logged in via Magic Link!");
      await syncGuestCart(queryClient);
      
      const userType = res.data?.user_type;
      redirectBasedOnRole(userType);
    } catch (err: any) {
      showError("Magic Link Expired", err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== 6. SIGNUP / REGISTRATION ACTIONS ====================
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

      // Redirect into OTP tab and pre-fill details for verification
      setTab("otp");
      setOtpIdentifier(target);
      setOtpMode("verification");
      startOtpResendTimer();
      
      if (res.meta?.otp) {
        const otpDigits = String(res.meta.otp).split("").slice(0, 6);
        const nextOtp = ["", "", "", "", "", ""];
        otpDigits.forEach((d, i) => { nextOtp[i] = d; });
        setOtpCode(nextOtp);
        info("Debug OTP", `Auto-filled registration OTP: ${res.meta.otp}`);
      }
    } catch (err: any) {
      showError("Registration failed", err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== RENDER HELPER PANELS ====================
  if (showPasskeySetup) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-[#090d10] font-sans">
        <div className="card w-full max-w-md p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mx-auto shadow-md">
            <Key className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Enable Passkey Login</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Register this device as a Passkey for instant, secure logins using biometric scanning (fingerprint/face recognition) or PIN.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button fullWidth onClick={handleRegisterPasskey} loading={loading} size="lg">
              Set Up Passkey <Sparkles className="w-4 h-4 ml-1.5" />
            </Button>
            <Button 
              fullWidth 
              variant="outline" 
              onClick={() => {
                const role = getStoredUserType();
                redirectBasedOnRole(role || "customer");
              }}
              size="lg"
            >
              Skip for Now
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-[#090d10] font-sans">
        <div className="card w-full max-w-md p-8 space-y-6">
          <button 
            onClick={() => { setShowForgotPassword(false); setResetStep("request"); }}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Login
          </button>
          
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Reset Password</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Recover access using your registered contact details.
            </p>
          </div>

          {resetStep === "request" && (
            <div className="space-y-4">
              <Input 
                label="Identifier (Email, Phone, or Username)"
                placeholder="Enter email or mobile..."
                value={resetIdentifier}
                onChange={e => setResetIdentifier(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
              />
              <Button fullWidth loading={loading} onClick={handleResetRequest} size="lg">
                Send Reset Code <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {resetStep === "verify" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 text-center">
                Enter the verification code sent to your registered contact.
              </p>
              <Input 
                label="OTP Verification Code"
                placeholder="6-digit code..."
                maxLength={6}
                value={resetOtp}
                onChange={e => setResetOtp(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
              />
              <Button fullWidth loading={loading} onClick={handleResetVerify} size="lg">
                Verify Code <ArrowRight className="w-4 h-4" />
              </Button>
              <button onClick={handleResetRequest} className="text-xs font-semibold text-emerald-600 hover:underline block text-center mx-auto">
                Resend Code
              </button>
            </div>
          )}

          {resetStep === "confirm" && (
            <div className="space-y-4">
              <Input 
                label="New Password"
                type="password"
                placeholder="Min. 8 characters..."
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
              />
              <Input 
                label="Confirm New Password"
                type="password"
                placeholder="Repeat password..."
                value={confirmNewPassword}
                onChange={e => setConfirmNewPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
              />
              <Button fullWidth loading={loading} onClick={handleResetConfirm} size="lg">
                Update Password <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

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
            Experience premium service. Choose your custom role and start trading.
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
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 dark:bg-[#090d10]">
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
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Access Gateway</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Authenticate or register dynamic accounts</p>
            </div>



            {/* Tab Switched Header */}
            <div className="flex bg-slate-100 dark:bg-slate-800/60 rounded-2xl p-1 mb-6 border border-slate-200/50 dark:border-slate-700/50 overflow-x-auto gap-0.5">
              {[
                { id: "otp", label: "OTP", icon: Smartphone },
                { id: "password", label: "Password", icon: Lock },
                { id: "passkey", label: "Passkey", icon: Fingerprint },
                { id: "magic", label: "Magic", icon: Sparkles }
              ].map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id as ActiveTab)}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-black tracking-wider transition-all whitespace-nowrap px-2 flex items-center justify-center gap-1.5 ${tab === t.id
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200/20"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="hidden sm:inline">{t.label}</span>
                    <span className="sr-only">{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 1. OTP Login Tab */}
            {tab === "otp" && (
              <div className="space-y-4">
                {otpMode === "identifier" ? (
                  <div className="space-y-4">
                    <Input 
                      label="Identifier (Email, Mobile, or Username)"
                      placeholder="Enter details..."
                      value={otpIdentifier}
                      onChange={e => setOtpIdentifier(e.target.value)}
                      leftIcon={<User className="w-4 h-4" />}
                    />
                    <Button fullWidth loading={loading} onClick={handleSendOTP} size="lg">
                      Request OTP <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="text-center space-y-1">
                      <h3 className="text-base font-black text-slate-900 dark:text-white">Verify Your Code</h3>
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
                        onClick={() => setOtpMode("identifier")}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mx-auto font-semibold"
                      >
                        <ChevronLeft className="w-4 h-4" /> Change contact details
                      </button>
                      {resendTimer > 0 ? (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Resend in <span className="font-bold text-emerald-600">{resendTimer}s</span></p>
                      ) : (
                        <button onClick={handleSendOTP} className="text-xs font-bold text-emerald-600 hover:underline">
                          Resend Verification OTP
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. Password Login Tab */}
            {tab === "password" && (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <Input 
                  label="Identifier (Email, Mobile, or Username)"
                  placeholder="Enter details..."
                  value={passwordState.identifier}
                  onChange={e => setPasswordState(prev => ({ ...prev, identifier: e.target.value }))}
                  leftIcon={<User className="w-4 h-4" />}
                />
                <div>
                  <Input 
                    label="Password"
                    type={passwordState.show ? "text" : "password"}
                    placeholder="Enter security password"
                    value={passwordState.password}
                    onChange={e => setPasswordState(prev => ({ ...prev, password: e.target.value }))}
                    leftIcon={<Lock className="w-4 h-4" />}
                    rightIcon={
                      <button type="button" onClick={() => setPasswordState(prev => ({ ...prev, show: !prev.show }))}>
                        {passwordState.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />
                  <div className="flex justify-end mt-2">
                    <button 
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs font-bold text-emerald-600 hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </div>
                <Button type="submit" fullWidth loading={loading} size="lg">
                  Verify & Log In <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            )}

            {/* 3. Passkey Login Tab */}
            {tab === "passkey" && (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/10 rounded-2xl flex gap-3 text-xs text-emerald-700 dark:text-emerald-300 leading-normal">
                  <Key className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>Authenticate instantly and securely without typing passcodes or waiting for OTP codes.</span>
                </div>
                <Input 
                  label="Registered Identifier"
                  placeholder="Enter email, phone, or username..."
                  value={passkeyIdentifier}
                  onChange={e => setPasskeyIdentifier(e.target.value)}
                  leftIcon={<User className="w-4 h-4" />}
                />
                <Button fullWidth loading={loading} onClick={handlePasskeyLogin} size="lg">
                  Verify Credentials <Sparkles className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            )}

            {/* 4. Magic Link Login Tab */}
            {tab === "magic" && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-500/10 rounded-2xl flex gap-3 text-xs text-blue-700 dark:text-blue-300 leading-normal">
                  <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <span>Enter email/mobile, receive link, click to login instantly. Fast, passwordless, secure.</span>
                </div>
                <Input 
                  label="Registered Contact Address"
                  placeholder="Email or phone number..."
                  value={magicIdentifier}
                  onChange={e => setMagicIdentifier(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4" />}
                />
                <Button fullWidth loading={loading} onClick={handleSendMagicLink} size="lg">
                  Send Magic Link <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            <div className="text-center text-xs font-semibold text-slate-500 dark:text-slate-450 mt-6">
              Don't have an account?{" "}
              <Link href={resolveLink("/register")} className="text-emerald-655 dark:text-emerald-400 hover:underline font-extrabold">
                Register here
              </Link>
            </div>

            <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 mt-6 leading-relaxed">
              By proceeding, you agree to our <Link href="/terms" className="text-emerald-600 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-emerald-600 hover:underline">Privacy Policy</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
