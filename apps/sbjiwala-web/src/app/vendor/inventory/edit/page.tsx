import React, { Suspense } from "react";
import EditProductClient from "./EditProductClient";

export default function EditProductPage() {
  return (
    <Suspense fallback={
      <div className="py-20 flex flex-col items-center justify-center gap-2">
        <span className="text-xs text-slate-500">Loading catalog editor...</span>
      </div>
    }>
      <EditProductClient />
    </Suspense>
  );
}
