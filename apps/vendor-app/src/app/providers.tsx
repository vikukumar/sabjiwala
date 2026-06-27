"use client";

import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/Toast";
import { initFirebaseAnalyticsAndCrashlytics, initFirebasePerformance, setupDeepLinkListener } from "@sbjiwala/shared";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  useEffect(() => {
    initFirebaseAnalyticsAndCrashlytics().catch(err => {
      console.warn("Failed to initialize Firebase Analytics/Crashlytics on mount:", err);
    });
    initFirebasePerformance().catch((err: any) => {
      console.warn("Failed to initialize Firebase Performance on mount:", err);
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
