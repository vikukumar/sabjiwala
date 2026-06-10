"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import Link from "next/link";
import { Heart, ShoppingCart, Trash2, Plus, Minus } from "lucide-react";
import { Button, EmptyState, Skeleton, Badge } from "@/components/ui/index";
import { useToast } from "@/components/ui/Toast";

function WishlistItem({ item }: { item: any }) {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  const { data: cartData } = useQuery<any>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await api.get("/cart");
      return res.data || { items: [], item_count: 0 };
    },
    staleTime: 0,
  });
  const cartItem = cartData?.items?.find((i: any) => i.product_id === item.product_id);

  const removeFromWishlist = useMutation({
    mutationFn: () => api.delete(`/wishlist/${item.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["wishlist"] }); success("Removed from wishlist"); },
  });

  const addToCart = useMutation({
    mutationFn: () => api.post("/cart/items", { product_id: item.product_id, quantity: 1 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cart"] }); success("Added to cart! 🛒"); },
    onError: (err: any) => showError("Failed", err.response?.data?.detail || err.message),
  });

  const updateQty = useMutation({
    mutationFn: ({ itemId, qty }: { itemId: string; qty: number }) =>
      qty <= 0 ? api.delete(`/cart/items/${itemId}`) : api.patch(`/cart/items/${itemId}`, { quantity: qty }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const product = item.product || {};
  const price = product.attributes?.price || item.price || 30;
  const emoji = product.attributes?.image_emoji || "🥬";

  return (
    <div className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
      <Link href={`/products/${item.product_id}`} className="w-16 h-16 bg-gradient-to-br from-slate-50 to-emerald-50/20 dark:from-slate-800/50 dark:to-slate-900 rounded-xl flex items-center justify-center text-3xl flex-shrink-0">
        {emoji}
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/products/${item.product_id}`}>
          <h3 className="font-black text-sm text-slate-900 dark:text-white hover:text-emerald-700 dark:hover:text-emerald-400 line-clamp-1">{product.name || item.product_name}</h3>
        </Link>
        <p className="text-xs text-slate-500 dark:text-slate-400">{product.unit || "1 kg"}</p>
        <p className="font-black text-base text-slate-900 dark:text-white mt-1">₹{price}</p>
      </div>
      <div className="flex flex-col gap-2 flex-shrink-0">
        {cartItem ? (
          <div className="flex items-center gap-1 bg-emerald-600 text-white rounded-xl px-2 py-1.5">
            <button onClick={() => updateQty.mutate({ itemId: cartItem.id, qty: cartItem.quantity - 1 })} className="w-5 h-5 flex items-center justify-center hover:bg-emerald-700 rounded-lg">
              <Minus className="w-3 h-3" />
            </button>
            <span className="px-1 text-xs font-black">{cartItem.quantity}</span>
            <button onClick={() => updateQty.mutate({ itemId: cartItem.id, qty: cartItem.quantity + 1 })} className="w-5 h-5 flex items-center justify-center hover:bg-emerald-700 rounded-lg">
              <Plus className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => addToCart.mutate()}
            disabled={addToCart.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-xl transition-colors disabled:opacity-50"
            title="Add to Cart"
          >
            <ShoppingCart className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => removeFromWishlist.mutate()}
          disabled={removeFromWishlist.isPending}
          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all"
          title="Remove from wishlist"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function WishlistPage() {
  const { data: wishlist = [], isLoading } = useQuery<any[]>({
    queryKey: ["wishlist"],
    queryFn: async () => { const r = await api.get("/wishlist"); return r.data || []; },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-5">My Wishlist</h1>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : wishlist.length === 0 ? (
        <EmptyState
          emoji="💚"
          title="Your wishlist is empty"
          description="Save your favourite vegetables and fruits for later."
          action={<Link href="/"><Button>Browse Products</Button></Link>}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">{wishlist.length} item{wishlist.length !== 1 ? "s" : ""} saved</p>
          {wishlist.map((item: any) => <WishlistItem key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}
