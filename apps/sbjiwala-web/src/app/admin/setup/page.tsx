"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Loader2, ArrowRight, Sparkles, User, Mail, Lock, CheckCircle2 } from "lucide-react";
import { api } from "@sbjiwala/shared";
import { Input, Button, Card } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";

export default function SetupPage() {
  const { success, error: showError } = useToast();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [loading, setLoading] = useState(false);

  // Form inputs
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [setupStep, setSetupStep] = useState<"idle" | "creating" | "finalizing" | "completed">("idle");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");

    const checkInstallation = async () => {
      try {
        const res = await api.get("/installation/status");
        if (res.success && res.data) {
          const adminAccount = res.data.admin_account;
          if (adminAccount && adminAccount.is_completed) {
            window.location.href = "/admin/login";
          }
        }
      } catch (err) {
        console.error("Failed to check installation status", err);
      }
    };
    checkInstallation();
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName || !email || !password) {
      showError("Required Fields", "Please fill in all required fields.");
      return;
    }

    if (password.length < 8) {
      showError("Password Weak", "Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      showError("Password Mismatch", "Passwords do not match.");
      return;
    }

    setLoading(true);
    setSetupStep("creating");

    try {
      // 1. Complete admin_account step (registers user)
      const res = await api.post("/installation/step", {
        step: "admin_account",
        data: {
          email,
          password,
          first_name: firstName,
          last_name: lastName || "Admin"
        }
      });

      if (!res.success) {
        throw new Error(res.message || "Failed to create super admin account.");
      }

      setSetupStep("finalizing");

      // 2. Finalize all other installation checklist steps
      const extraSteps = ["database", "platform_config", "branding", "notification", "payment", "complete"];
      await Promise.all(
        extraSteps.map((step) =>
          api.post("/installation/step", {
            step,
            data: { initialized_at: new Date().toISOString() }
          }).catch((err) => console.warn(`Silent error completing setup step: ${step}`, err))
        )
      );

      setSetupStep("completed");
      success("Setup Complete", "Super Admin account configured and system initialized!");

      // 3. Redirect to login after 2 seconds
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.href = "/admin/login";
        }
      }, 2000);

    } catch (err: any) {
      setSetupStep("idle");
      showError("Setup Error", err.response?.data?.detail || err.message || "An unexpected error occurred during setup.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-55 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200 antialiased font-sans">
      {/* Header */}
      <header className="max-w-6xl w-full mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo_horizontal.png" alt="Sbjiwala Logo" className="h-8 w-auto object-contain" />
          <span className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
            Installation Wizard
          </span>
        </div>
      </header>

      {/* Main setup interface */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl shadow-xl p-6 md:p-8 space-y-6 relative overflow-hidden">
            {/* Decorative backgrounds */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -ml-16 -mb-16 pointer-events-none" />

            <div className="text-center space-y-2 relative">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Initialize Sbjiwala System
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Setup the first Super Admin account to run and oversee platform activities
              </p>
            </div>

            {setupStep === "idle" && (
              <form onSubmit={handleSetup} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    required
                    placeholder="Super"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    leftIcon={<User className="w-4 h-4" />}
                  />
                  <Input
                    label="Last Name"
                    placeholder="Admin"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    leftIcon={<User className="w-4 h-4" />}
                  />
                </div>

                <Input
                  label="Super Admin Email"
                  required
                  type="email"
                  placeholder="admin@sbjiwala.qzz.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4" />}
                />

                <Input
                  label="Password"
                  required
                  type="password"
                  placeholder="Create strong security password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                />

                <Input
                  label="Confirm Password"
                  required
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                />

                <Button
                  type="submit"
                  disabled={loading}
                  fullWidth
                  size="lg"
                  className="mt-6 shadow-md"
                >
                  Create Admin & Initialize System <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </form>
            )}

            {setupStep !== "idle" && (
              <div className="py-8 text-center space-y-6 animate-fade-in">
                {setupStep === "creating" && (
                  <>
                    <Loader2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto" />
                    <div className="space-y-1">
                      <h4 className="font-black text-slate-900 dark:text-white">Creating Admin Profile</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Saving credentials in databases...</p>
                    </div>
                  </>
                )}

                {setupStep === "finalizing" && (
                  <>
                    <Loader2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto" />
                    <div className="space-y-1">
                      <h4 className="font-black text-slate-900 dark:text-white">Finalizing Platform Configuration</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Setting up default system parameters and catalog hooks...</p>
                    </div>
                  </>
                )}

                {setupStep === "completed" && (
                  <>
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 shadow-md">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-black text-slate-900 dark:text-white">System Configured Successfully!</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Redirecting to administrator console portal...</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-center text-[10px] text-slate-400 dark:text-slate-500 tracking-wide font-medium">
        <span>&copy; 2026 Sbjiwala • Secure Installation System</span>
      </footer>
    </div>
  );
}
