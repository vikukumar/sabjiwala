import React, { Suspense } from "react";
import { Metadata } from "next";
import ProductDetailClient from "./ProductDetailClient";

export const metadata: Metadata = {
  title: "Product Details | Sbjiwala",
  description: "Buy fresh vegetables and fruits online from Sbjiwala.",
};

export default function ProductDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[300px] text-slate-550 font-bold">Loading product details...</div>}>
      <ProductDetailClient />
    </Suspense>
  );
}
