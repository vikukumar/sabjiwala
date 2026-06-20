"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import AdminLayout from "@/components/AdminLayout";
import { useToast } from "@/components/ui/Toast";
import { Shield, Plus, Loader2, Mail, Key, UserPlus } from "lucide-react";
import { Button, Card } from "@/components/ui/index";

export default function AdminSupportAgents() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Queries
  const { data: agents = [], isLoading } = useQuery<any[]>({
    queryKey: ["supportAgentsList"],
    queryFn: async () => {
      const res = await api.get("/support/agents");
      return res.data || [];
    }
  });

  // Mutation
  const createAgentMutation = useMutation({
    mutationFn: async (body: any) => {
      return api.post("/admin/agents", body);
    },
    onSuccess: () => {
      setEmail("");
      setPassword("");
      setPhone("");
      setFirstName("");
      setLastName("");
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["supportAgentsList"] });
      success("Success", "Support Agent account created successfully!");
    },
    onError: (err: any) => {
      showError("Creation Failed", err.response?.data?.detail || "Could not create support agent account.");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !firstName || !lastName) {
      showError("Validation Error", "All fields except phone number are required");
      return;
    }
    createAgentMutation.mutate({
      email,
      password,
      phone,
      first_name: firstName,
      last_name: lastName
    });
  };

  return (
    <AdminLayout title="Manage Support Agents">
      <div className="space-y-6 font-sans">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-slate-500">Create agent profiles and track support availability.</p>
          </div>
          <Button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="bg-emerald-600 hover:bg-emerald-550 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer border-0"
          >
            <Plus className="w-4 h-4" /> Create Support Agent
          </Button>
        </div>

        {/* Create Agent form overlay */}
        {isFormOpen && (
          <Card className="p-6 border border-emerald-500/20 dark:border-slate-800 bg-white dark:bg-slate-900 max-w-lg shadow-lg rounded-3xl space-y-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus className="w-5 h-5 text-emerald-500" /> New Support Agent Account
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500 uppercase">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-909 dark:text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500 uppercase">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-909 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500 uppercase">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-909 dark:text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-505 uppercase">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-909 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase">Account Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-909 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  onClick={() => setIsFormOpen(false)}
                  variant="secondary"
                  className="border border-slate-200 dark:border-slate-850 text-slate-700 dark:text-white font-extrabold text-xs px-4 py-2.5 rounded-xl bg-transparent"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createAgentMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-550 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl border-0 shadow cursor-pointer"
                >
                  {createAgentMutation.isPending ? "Creating..." : "Save Agent Account"}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Support Agents List */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-5 h-5 text-emerald-500" /> Active Agents Board
          </h3>

          <div className="grid md:grid-cols-3 gap-4">
            {isLoading ? (
              <div className="col-span-3 py-10 text-center text-slate-400 text-xs flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
            ) : agents.length === 0 ? (
              <div className="col-span-3 py-10 text-center text-slate-400 text-xs">No support agents found. Create one above.</div>
            ) : (
              agents.map((agent: any) => (
                <Card
                  key={agent.id}
                  className="p-5 space-y-4 border border-slate-800 bg-slate-950/40 text-slate-100 rounded-2xl"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-white text-xs">{agent.first_name} {agent.last_name}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">{agent.email}</p>
                    </div>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                      agent.is_available
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-slate-800 text-slate-500"
                    }`}>
                      {agent.is_available ? "Online" : "Offline"}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
