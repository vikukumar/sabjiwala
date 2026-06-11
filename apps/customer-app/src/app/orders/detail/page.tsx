import React, { Suspense } from "react";
import OrderDetailClient from "./OrderDetailClient";

export default function OrderDetailPage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <div className="h-48 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
      </div>
    }>
      <OrderDetailClient />
    </Suspense>
  );
}
