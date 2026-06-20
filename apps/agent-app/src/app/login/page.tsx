"use client";

import React, { useState } from "react";
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

        <div className="text-center pt-2">
          <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
            Authorized Support Personnel Only. All activities are audited under system audit logs.
          </p>
        </div>
      </div>
    </div>
  );
}
