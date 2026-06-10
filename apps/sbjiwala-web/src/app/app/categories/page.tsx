"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/index";

const CATEGORY_EMOJIS: Record<string, string> = {
  Vegetables: "🥦", Fruits: "🍎", "Leafy Greens": "🥬", "Root Vegetables": "🥕",
  Herbs: "🌿", Dairy: "🥛", Grains: "🌾", Spices: "🌶️", Exotics: "🥑",
};

const CATEGORY_COLORS = [
  "from-green-50 to-emerald-100 dark:from-green-950/30 dark:to-emerald-950/30",
  "from-orange-50 to-amber-100 dark:from-orange-950/30 dark:to-amber-950/30",
  "from-green-50 to-teal-100 dark:from-green-950/30 dark:to-teal-950/30",
  "from-red-50 to-orange-100 dark:from-red-950/30 dark:to-orange-950/30",
  "from-blue-50 to-indigo-100 dark:from-blue-950/30 dark:to-indigo-950/30",
  "from-purple-50 to-violet-100 dark:from-purple-950/30 dark:to-violet-950/30",
];

export default function CategoriesPage() {
  const { data: categories = [], isLoading } = useQuery<any[]>({
    queryKey: ["categories"],
    queryFn: async () => { const r = await api.get("/catalog/categories"); return r.data || []; },
    staleTime: 5 * 60_000,
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-5">All Categories</h1>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {categories.map((cat: any, i: number) => {
            const emoji = CATEGORY_EMOJIS[cat.name] || "🥗";
            const gradient = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
            return (
              <Link
                key={cat.id}
                href={`/search?category=${encodeURIComponent(cat.name)}`}
                className="group card overflow-hidden hover:shadow-lg transition-all hover:border-emerald-400"
              >
                <div className={`h-24 bg-gradient-to-br ${gradient} flex items-center justify-center text-5xl group-hover:scale-110 transition-transform duration-300 -mx-6 -mt-6`}>
                  {emoji}
                </div>
                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <p className="font-black text-sm text-slate-900 dark:text-white">{cat.name}</p>
                    {cat.product_count !== undefined && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{cat.product_count} items</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
