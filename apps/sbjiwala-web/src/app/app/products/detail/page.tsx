import React from "react";
import { Metadata } from "next";
import ProductDetailClient from "./ProductDetailClient";

interface Props {
  searchParams: Promise<{ id?: string }> | { id?: string };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const resolvedParams = await searchParams;
  const id = resolvedParams?.id;
  if (!id) {
    return {
      title: "Product Details | Sbjiwala",
      description: "Buy fresh vegetables and fruits online from Sbjiwala.",
    };
  }

  try {
    const res = await fetch(`https://sbjiwala.qzz.io/api/v1/catalog/products/${id}`);
    const data = await res.json();
    const product = data?.data || data;

    if (!product) {
      return {
        title: "Product Not Found | Sbjiwala",
      };
    }

    const title = `${product.name} - Buy Fresh at Sbjiwala`;
    const description = product.description || `Buy fresh ${product.name} online at the best price from Sbjiwala. Farm-fresh quality delivered to your doorstep.`;
    const imageUrl = product.primary_image_url 
      ? (product.primary_image_url.startsWith("http") ? product.primary_image_url : `https://sbjiwala.qzz.io${product.primary_image_url}`)
      : "https://sbjiwala.qzz.io/logo_horizontal.png";

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: [{ url: imageUrl }],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [imageUrl],
      },
    };
  } catch (error) {
    console.error("Failed to fetch product metadata for SEO:", error);
    return {
      title: "Product Details | Sbjiwala",
      description: "Buy fresh vegetables and fruits online from Sbjiwala.",
    };
  }
}

export default function ProductDetailPage() {
  return <ProductDetailClient />;
}
