import React from "react";
import ProductDetailClient from "./ProductDetailClient";

export async function generateStaticParams() {
  return [{ id: "1" }];
}

export default function ProductDetailPage() {
  return <ProductDetailClient />;
}
