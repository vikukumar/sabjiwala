"use client";

import React, { useState } from "react";
import { Users, Search, Loader2, Edit, CheckCircle2, XCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import AdminLayout from "@/components/AdminLayout";

export default function AdminUsersPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserRole, setEditUserRole] = useState("customer");

  // Users List
  const { data: usersData, isLoading: usersLoading } = useQuery<any>({
    queryKey: ["adminUsers", userRoleFilter, userSearch],
    queryFn: async () => {
      const res = await api.get("/admin/users", {
        params: {
          role: userRoleFilter || undefined,
          search: userSearch || undefined
        }
      });
      return res;
    }
  });

  const usersList = usersData?.data || [];

  // Toggle User Status
  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      return api.patch(`/admin/users/${id}/status`, { is_active: active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      success("User access status updated successfully!");
    },
    onError: (err: any) => {
      showError("Status Update Failed", err.response?.data?.detail || err.message);
    }
  });

  // Change User Role
  const changeUserRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      return api.patch(`/admin/users/${id}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      setEditingUserId(null);
      success("User role updated and profile initialized!");
    },
    onError: (err: any) => {
      showError("Role Change Failed", err.response?.data?.detail || err.message);
    }
  });

  return (
    <AdminLayout title="User Accounts Database">
      <div className="space-y-4 text-slate-800 dark:text-slate-100 font-sans">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, phone, email..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <select
              value={userRoleFilter}
              onChange={e => setUserRoleFilter(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
            >
              <option value="">All Roles</option>
              <option value="customer">Customer</option>
              <option value="vendor">Vendor</option>
              <option value="delivery_boy">Delivery Boy</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
          {usersLoading ? (
            <div className="py-16 text-center text-slate-400 flex justify-center items-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
          ) : usersList.length > 0 ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-850/50 text-slate-450 uppercase font-black tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th className="p-4">Name</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4">Username</th>
                  <th className="p-4">Role</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {usersList.map((user: any) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                    <td className="p-4 font-bold text-slate-900 dark:text-white">
                      {user.first_name} {user.last_name}
                    </td>
                    <td className="p-4">
                      <p>{user.email || "No Email"}</p>
                      <p className="text-slate-400 dark:text-slate-500 font-semibold mt-0.5">{user.phone || "No Phone"}</p>
                    </td>
                    <td className="p-4 font-mono text-slate-500">{user.username || "—"}</td>
                    <td className="p-4">
                      {editingUserId === user.id ? (
                        <div className="flex items-center gap-1">
                          <select
                            value={editUserRole}
                            onChange={e => setEditUserRole(e.target.value)}
                            className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                          >
                            <option value="customer">Customer</option>
                            <option value="vendor">Vendor</option>
                            <option value="delivery_boy">Delivery Boy</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button
                            onClick={() => changeUserRoleMutation.mutate({ id: user.id, role: editUserRole })}
                            className="p-1 text-emerald-600 hover:text-emerald-500 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingUserId(null)}
                            className="p-1 text-red-500 cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`inline-block px-2.5 py-1 rounded-full font-bold uppercase tracking-wider text-[9px] ${
                            user.user_type === "admin" || user.user_type === "super_admin"
                              ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                              : user.user_type === "vendor"
                              ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                              : user.user_type === "delivery_boy"
                              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                              : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                          }`}>
                            {user.user_type.replace("_", " ")}
                          </span>
                          <button
                            onClick={() => { setEditingUserId(user.id); setEditUserRole(user.user_type); }}
                            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded font-extrabold ${
                        user.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"
                      }`}>
                        {user.is_active ? "ACTIVE" : "BLOCKED"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => toggleUserStatusMutation.mutate({ id: user.id, active: !user.is_active })}
                        className={`px-3 py-1.5 rounded-lg border font-bold text-xs cursor-pointer ${
                          user.is_active
                            ? "border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500"
                            : "border-emerald-250 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-600"
                        }`}
                      >
                        {user.is_active ? "Block User" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-16 text-center text-slate-400 dark:text-slate-500">No users found matching search criteria.</div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
