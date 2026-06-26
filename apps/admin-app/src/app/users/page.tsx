"use client";

import React, { useState, useEffect } from "react";
import {
  Users, Search, Loader2, Edit, CheckCircle2, XCircle, ChevronDown,
  Shield, Ban, UserCheck, Trash2, X, Phone, Mail, User as UserIcon,
  CreditCard, MapPin, Package, Truck, Building2, Eye, RefreshCw,
  Calendar, BadgeCheck, AlertTriangle, FileText, Image as ImageIcon,
  Lock, Unlock, UserX, Star, ShoppingBag, Wallet
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import AdminLayout from "@/components/AdminLayout";

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-rose-500/15 text-rose-400 border border-rose-500/25",
  super_admin: "bg-rose-500/15 text-rose-400 border border-rose-500/25",
  vendor: "bg-blue-500/15 text-blue-400 border border-blue-500/25",
  delivery_boy: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  support_agent: "bg-purple-500/15 text-purple-400 border border-purple-500/25",
  customer: "bg-slate-500/15 text-slate-400 border border-slate-500/25",
};

const ROLE_ICON: Record<string, React.ReactNode> = {
  admin: <Shield className="w-3 h-3" />,
  super_admin: <Shield className="w-3 h-3" />,
  vendor: <Building2 className="w-3 h-3" />,
  delivery_boy: <Truck className="w-3 h-3" />,
  support_agent: <UserIcon className="w-3 h-3" />,
  customer: <Users className="w-3 h-3" />,
};

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U";
  const hue = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
      style={{ background: `hsl(${hue}, 60%, 45%)` }}
    >
      {initials}
    </div>
  );
}

// ─── User Detail Drawer ─────────────────────────────────────────────────────
function UserDetailDrawer({
  userId,
  onClose,
}: {
  userId: string | null;
  onClose: () => void;
}) {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["adminUser", userId],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${userId}`);
      return res.data;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (data) {
      setEditForm({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        email: data.email || "",
        phone: data.phone || "",
        is_verified: data.is_verified,
      });
    }
  }, [data]);

  // Update profile mutation
  const updateMutation = useMutation({
    mutationFn: async (body: any) => api.put(`/admin/users/${userId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      queryClient.invalidateQueries({ queryKey: ["adminUser", userId] });
      success("User profile updated successfully!");
      setEditMode(false);
    },
    onError: (err: any) => showError("Update Failed", err.response?.data?.detail || err.message),
  });

  // Toggle status
  const statusMutation = useMutation({
    mutationFn: async ({ active }: { active: boolean }) =>
      api.patch(`/admin/users/${userId}/status`, { is_active: active }),
    onSuccess: (_, { active }) => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      queryClient.invalidateQueries({ queryKey: ["adminUser", userId] });
      success(`User ${active ? "activated" : "blocked"} successfully!`);
    },
    onError: (err: any) => showError("Status Update Failed", err.response?.data?.detail || err.message),
  });

  // Change role
  const roleMutation = useMutation({
    mutationFn: async (role: string) =>
      api.patch(`/admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      queryClient.invalidateQueries({ queryKey: ["adminUser", userId] });
      success("Role updated! New profile/wallet may have been initialized.");
    },
    onError: (err: any) => showError("Role Change Failed", err.response?.data?.detail || err.message),
  });

  // Delete user
  const deleteMutation = useMutation({
    mutationFn: async () => api.delete(`/admin/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      onClose();
      success("User deleted successfully.");
    },
    onError: (err: any) => showError("Delete Failed", err.response?.data?.detail || err.message),
  });

  if (!userId) return null;

  const user = data;
  const userType = user?.user_type || "customer";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      {/* Drawer */}
      <aside className="fixed right-0 top-0 h-full w-full max-w-xl bg-slate-950 border-l border-slate-800 z-50 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            {user && <Avatar name={`${user.first_name} ${user.last_name}`} />}
            <div>
              <p className="text-white font-bold text-sm">
                {isLoading ? "Loading..." : `${user?.first_name} ${user?.last_name}`}
              </p>
              <p className="text-slate-400 text-xs">{user?.email || user?.phone || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-24">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          ) : !user ? (
            <div className="p-8 text-center text-slate-500">User not found.</div>
          ) : (
            <div className="p-6 space-y-6">

              {/* Status Banner */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
                user.is_active
                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                  : "bg-red-500/10 border-red-500/25 text-red-400"
              }`}>
                {user.is_active ? <UserCheck className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
                <div className="flex-1">
                  <p className="font-bold text-sm">{user.is_active ? "Account Active" : "Account Blocked"}</p>
                  <p className="text-xs opacity-70">
                    {user.is_active ? "This user can log in and use the platform." : "This user cannot access the platform."}
                  </p>
                </div>
                <button
                  onClick={() => statusMutation.mutate({ active: !user.is_active })}
                  disabled={statusMutation.isPending}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50 ${
                    user.is_active
                      ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                      : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30"
                  }`}
                >
                  {statusMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : (user.is_active ? "Block" : "Activate")}
                </button>
              </div>

              {/* Core Info */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Account Details</h3>
                  <button
                    onClick={() => setEditMode(!editMode)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    {editMode ? "Cancel" : "Edit"}
                  </button>
                </div>

                {editMode ? (
                  <form
                    onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(editForm); }}
                    className="space-y-3"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">First Name</label>
                        <input
                          value={editForm.first_name}
                          onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
                          className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Last Name</label>
                        <input
                          value={editForm.last_name}
                          onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
                          className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Email</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Phone</label>
                      <input
                        value={editForm.phone}
                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700">
                      <input
                        type="checkbox"
                        id="is_verified"
                        checked={editForm.is_verified}
                        onChange={e => setEditForm({ ...editForm, is_verified: e.target.checked })}
                        className="accent-emerald-500 w-4 h-4"
                      />
                      <label htmlFor="is_verified" className="text-sm text-slate-300 cursor-pointer flex-1">Mark as Verified</label>
                      <BadgeCheck className={`w-4 h-4 ${editForm.is_verified ? "text-emerald-400" : "text-slate-600"}`} />
                    </div>
                    <button
                      type="submit"
                      disabled={updateMutation.isPending}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                      Save Changes
                    </button>
                  </form>
                ) : (
                  <div className="bg-slate-900 rounded-2xl divide-y divide-slate-800 border border-slate-800">
                    {[
                      { icon: <UserIcon className="w-4 h-4" />, label: "Full Name", value: `${user.first_name} ${user.last_name}` },
                      { icon: <Mail className="w-4 h-4" />, label: "Email", value: user.email || "—" },
                      { icon: <Phone className="w-4 h-4" />, label: "Phone", value: user.phone || "—" },
                      { icon: <UserIcon className="w-4 h-4" />, label: "Username", value: user.username || "—" },
                      { icon: <Calendar className="w-4 h-4" />, label: "Joined", value: formatDate(user.created_at) },
                      { icon: <BadgeCheck className="w-4 h-4" />, label: "Verified", value: user.is_verified ? "Yes" : "No" },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-3 px-4 py-3">
                        <span className="text-slate-500">{item.icon}</span>
                        <span className="text-xs text-slate-500 w-20 flex-shrink-0">{item.label}</span>
                        <span className="text-sm text-white font-medium">{item.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Role Management */}
              <section>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Role & Access</h3>
                <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {user.roles?.map((r: string) => (
                      <span key={r} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${ROLE_BADGE[r] || ROLE_BADGE.customer}`}>
                        {ROLE_ICON[r] || <UserIcon className="w-3 h-3" />}
                        {r.replace("_", " ")}
                      </span>
                    ))}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${ROLE_BADGE[userType] || ROLE_BADGE.customer}`}>
                      {ROLE_ICON[userType] || <UserIcon className="w-3 h-3" />}
                      {userType.replace("_", " ")} (primary)
                    </span>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Change Primary Role</label>
                    <div className="flex gap-2">
                      <select
                        id="role-select"
                        defaultValue={userType}
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:border-emerald-500 focus:outline-none appearance-none cursor-pointer"
                        onChange={e => roleMutation.mutate(e.target.value)}
                        disabled={roleMutation.isPending}
                      >
                        <option value="customer">Customer</option>
                        <option value="vendor">Vendor</option>
                        <option value="delivery_boy">Delivery Boy</option>
                        <option value="support_agent">Support Agent</option>
                        <option value="admin">Administrator</option>
                      </select>
                      {roleMutation.isPending && <Loader2 className="w-5 h-5 text-emerald-500 animate-spin self-center" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5">Changing the role may initialize new profile data (vendor store, delivery profile, etc.).</p>
                  </div>
                </div>
              </section>

              {/* Wallets */}
              {user.wallets?.length > 0 && (
                <section>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Wallets</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {user.wallets.map((w: any) => (
                      <div key={w.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{w.type.replace("_", " ")}</p>
                        <p className="text-lg font-black text-emerald-400 mt-1">₹{parseFloat(w.balance || 0).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Addresses */}
              {user.addresses?.length > 0 && (
                <section>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Saved Addresses</h3>
                  <div className="space-y-2">
                    {user.addresses.map((a: any) => (
                      <div key={a.id} className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex gap-3">
                        <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-white font-semibold">{a.label || "Address"}</p>
                          <p className="text-xs text-slate-400">{a.address_line_1}, {a.city} {a.postal_code}</p>
                          {a.is_default && <span className="text-[10px] text-emerald-400 font-bold">DEFAULT</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Vendor Profile */}
              {user.vendor_profile && (
                <section>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Vendor Profile</h3>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-white font-bold">{user.vendor_profile.business_name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        user.vendor_profile.status === "approved"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-amber-500/15 text-amber-400"
                      }`}>{user.vendor_profile.status}</span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono">ID: {user.vendor_profile.id}</p>
                  </div>
                </section>
              )}

              {/* Delivery Profile */}
              {user.delivery_profile && (
                <section>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Delivery Profile</h3>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-white font-bold">Delivery Partner</p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/15 text-amber-400">
                        {user.delivery_profile.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">Vehicle: {user.delivery_profile.vehicle_type || "—"}</p>
                  </div>
                </section>
              )}

              {/* Danger Zone */}
              <section>
                <h3 className="text-xs font-black text-red-400/70 uppercase tracking-wider mb-3">Danger Zone</h3>
                <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 space-y-3">
                  <p className="text-xs text-slate-400">These actions are irreversible. Please proceed with caution.</p>
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to permanently delete this user account? This action cannot be undone.")) {
                        deleteMutation.mutate();
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 text-sm font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete User Account
                  </button>
                </div>
              </section>

            </div>
          )}
        </div>
      </aside>

      {/* Image Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="Document" className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl" />
          <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 text-white p-2 rounded-xl bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [userSearch, setUserSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(userSearch), 350);
    return () => clearTimeout(t);
  }, [userSearch]);

  // Users List
  const { data: usersData, isLoading: usersLoading } = useQuery<any>({
    queryKey: ["adminUsers", userRoleFilter, debouncedSearch],
    queryFn: async () => {
      const res = await api.get("/admin/users", {
        params: {
          role: userRoleFilter || undefined,
          search: debouncedSearch || undefined,
        }
      });
      return res;
    }
  });

  const usersList: any[] = usersData?.data || [];

  return (
    <AdminLayout title="User Accounts">
      <div className="space-y-4 text-slate-800 dark:text-slate-100 font-sans">

        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="user-search-input"
              type="text"
              placeholder="Search by name, phone, email..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative">
              <select
                id="role-filter-select"
                value={userRoleFilter}
                onChange={e => setUserRoleFilter(e.target.value)}
                className="appearance-none pl-4 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="">All Roles</option>
                <option value="customer">Customer</option>
                <option value="vendor">Vendor</option>
                <option value="delivery_boy">Delivery Boy</option>
                <option value="support_agent">Support Agent</option>
                <option value="admin">Administrator</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Users", value: usersList.length, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Active", value: usersList.filter((u: any) => u.is_active).length, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: "Blocked", value: usersList.filter((u: any) => !u.is_active).length, color: "text-red-500", bg: "bg-red-500/10" },
            { label: "Verified", value: usersList.filter((u: any) => u.is_verified).length, color: "text-amber-500", bg: "bg-amber-500/10" },
          ].map(stat => (
            <div key={stat.label} className={`${stat.bg} rounded-2xl p-4 border border-slate-200 dark:border-slate-800`}>
              <p className="text-xs text-slate-500 font-semibold">{stat.label}</p>
              <p className={`text-2xl font-black mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {usersLoading ? (
            <div className="py-20 text-center flex justify-center items-center">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          ) : usersList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-850/50 text-slate-400 uppercase font-black tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <th className="p-4">User</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4">Role</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Verified</th>
                    <th className="p-4 text-center">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {usersList.map((user: any) => (
                    <tr
                      key={user.id}
                      onClick={() => setSelectedUserId(user.id)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition group"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={`${user.first_name} ${user.last_name}`} />
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                              {user.first_name} {user.last_name}
                            </p>
                            <p className="text-slate-400 font-mono text-[10px] mt-0.5">{user.username || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-slate-700 dark:text-slate-300">{user.email || "—"}</p>
                        <p className="text-slate-400 mt-0.5">{user.phone || "—"}</p>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider text-[9px] ${ROLE_BADGE[user.user_type] || ROLE_BADGE.customer}`}>
                          {ROLE_ICON[user.user_type] || <UserIcon className="w-3 h-3" />}
                          {(user.user_type || "customer").replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-extrabold text-[9px] uppercase ${
                          user.is_active ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-500"
                        }`}>
                          {user.is_active ? "Active" : "Blocked"}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {user.is_verified
                          ? <BadgeCheck className="w-4 h-4 text-emerald-500 mx-auto" />
                          : <AlertTriangle className="w-4 h-4 text-slate-400 mx-auto" />
                        }
                      </td>
                      <td className="p-4 text-center text-slate-400">
                        {formatDate(user.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-16 text-center text-slate-400 dark:text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              No users found matching search criteria.
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 text-center">Click any row to view full user details, edit profile, or manage access.</p>
      </div>

      {/* Slide-over drawer */}
      <UserDetailDrawer
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
      />
    </AdminLayout>
  );
}
