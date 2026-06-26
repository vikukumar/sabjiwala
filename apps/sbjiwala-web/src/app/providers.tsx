"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { initFirebaseAnalyticsAndCrashlytics, setupDeepLinkListener } from "@sbjiwala/shared";

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
    setupDeepLinkListener();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );
}
