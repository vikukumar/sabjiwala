import React, { Suspense } from "react";
import OrderDetailClient from "./OrderDetailClient";

// NOTE: This route is intentionally kept for backward compat but navigation
// has been migrated to /orders/detail?id=UUID to support Next.js static export.
// In static export mode, this page won't be pre-rendered (no generateStaticParams),
// so direct links to /orders/[id] won't work in the exported app — use /orders/detail?id=UUID instead.
// In development (no static export), this route works normally via client-side routing.

export default function OrderDetailPage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <div className="h-48 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <div className="h-32 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
      </div>
    }>
      <OrderDetailClient />
    </Suspense>
  );
}
