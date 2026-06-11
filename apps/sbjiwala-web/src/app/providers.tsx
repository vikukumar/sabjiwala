"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { ToastProvider } from "@/components/ui/Toast";
import AppShell from "@/components/AppShell";
import AdminGuard from "@/components/AdminGuard";

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: (failureCount, error: any) => {
              if (error?.response?.status === 401) return false;
              return failureCount < 2;
            },
          },
        },
      })
  );

  const isAdminRoute = (pathname.startsWith("/admin") || pathname.startsWith("/users")) && 
                       !pathname.includes("/login") && 
                       !pathname.includes("/setup");

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AppShell>
          {isAdminRoute ? <AdminGuard>{children}</AdminGuard> : children}
        </AppShell>
      </ToastProvider>
    </QueryClientProvider>
  );
}
