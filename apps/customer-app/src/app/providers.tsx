"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import AppShell from "@/components/AppShell";
import { initFirebaseAnalyticsAndCrashlytics } from "@sbjiwala/shared";

export default function Providers({ children }: { children: React.ReactNode }) {
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

  useEffect(() => {
    initFirebaseAnalyticsAndCrashlytics().catch(err => {
      console.warn("Failed to initialize Firebase Analytics/Crashlytics on mount:", err);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </QueryClientProvider>
  );
}

