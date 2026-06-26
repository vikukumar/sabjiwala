"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import Link from "next/link";
import { ChevronRight, Search, Star, ShoppingBag, Plus, Minus, Loader2, Navigation } from "lucide-react";
import { Skeleton } from "@/components/ui/index";
import ProductCard from "@/components/ProductCard";
import { useToast } from "@/components/ui/Toast";

const CATEGORY_EMOJIS: Record<string, string> = {
  Vegetables: "🥦", Fruits: "🍎", "Leafy Greens": "🥬", "Root Vegetables": "🥕",
  Herbs: "🌿", Dairy: "🥛", Grains: "🌾", Spices: "🌶️", Exotics: "🥑",
  Onion: "🧅", Garlic: "🧄", Tomato: "🍅", Potato: "🥔", Mushroom: "🍄",
  Corn: "🌽", Pepper: "🫑", Brinjal: "🍆", Lemon: "🍋", Mango: "🥭",
  Banana: "🍌", Apple: "🍎", Grapes: "🍇", Watermelon: "🍉", Coconut: "🥥",
};

// Guest Cart Local Helpers
const getLocalGuestCart = () => {
  if (typeof window === "undefined") return { items: [] as any[], subtotal: 0 };
  const val = localStorage.getItem("sw_guest_cart");
  return val ? JSON.parse(val) : { items: [] as any[], subtotal: 0 };
};

const saveLocalGuestCart = (cart: any) => {
  if (typeof window === "undefined") return;
  localStorage.setItem("sw_guest_cart", JSON.stringify(cart));
  window.dispatchEvent(new Event("sw_cart_updated"));
};

// Haversine Distance Helper
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function CategoriesPage() {
  const { error: showError } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [activeSubcatId, setActiveSubcatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const [showClearCartModal, setShowClearCartModal] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<any>(null);

  const isGuest = typeof window !== "undefined" && !localStorage.getItem("sw_access_token");

  // Load user coordinates
  useEffect(() => {
    if (typeof window === "undefined") return;
    const lat = localStorage.getItem("sw_latitude");
    const lon = localStorage.getItem("sw_longitude");
    if (lat && lon) {
      setCoords({ lat: parseFloat(lat), lon: parseFloat(lon) });
    }
  }, []);

  // Fetch all categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<any[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const r = await api.get("/catalog/categories");
      return r.data || [];
    },
    staleTime: 5 * 60_000,
  });

  // Extract top-level categories
  const parentCategories = useMemo(() => {
    return categories.filter((c: any) => c.parent_id === null);
  }, [categories]);

  // Extract subcategories of selected parent category
  const subcategories = useMemo(() => {
    if (!selectedCatId) return [];
    return categories.filter((c: any) => c.parent_id === selectedCatId);
  }, [categories, selectedCatId]);

  // Set default selected category to first parent
  useEffect(() => {
    if (parentCategories.length > 0 && !selectedCatId) {
      setSelectedCatId(parentCategories[0].id);
    }
  }, [parentCategories, selectedCatId]);

  // Fetch products for selected parent category
  const { data: rawProducts = [], isLoading: productsLoading } = useQuery<any[]>({
    queryKey: ["categoryProducts", selectedCatId],
    queryFn: async () => {
      if (!selectedCatId) return [];
      const res = await api.get("/catalog/products", {
        params: { category_id: selectedCatId, limit: 100 }
      });
      return res.data || [];
    },
    enabled: !!selectedCatId,
    staleTime: 30_000
  });

  // Fetch active cart details
  const { data: serverCart } = useQuery<any>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await api.get("/cart");
      return res.data || { items: [], item_count: 0 };
    },
    enabled: typeof window !== "undefined" && !isGuest,
    staleTime: 0,
  });

  const [localCart, setLocalCart] = useState<any>(getLocalGuestCart());

  useEffect(() => {
    const handleUpdate = () => setLocalCart(getLocalGuestCart());
    window.addEventListener("sw_cart_updated", handleUpdate);
    return () => window.removeEventListener("sw_cart_updated", handleUpdate);
  }, []);

  const activeCatName = parentCategories.find((c: any) => c.id === selectedCatId)?.name || "Category";

  // Filter products down by distance/nearest-vendor, subcategory selection, and search query
  const { products, nearestVendorDistance, isOutofRange } = useMemo(() => {
    if (!rawProducts.length) return { products: [], nearestVendorDistance: null, isOutofRange: false };

    let mapped = rawProducts.map((p: any) => {
      const vLat = p.attributes?.vendor_latitude
        || p.attributes?.store_latitude
        || p.vendor?.store?.latitude
        || p.vendor_latitude
        || null;
      const vLon = p.attributes?.vendor_longitude
        || p.attributes?.store_longitude
        || p.vendor?.store?.longitude
        || p.vendor_longitude
        || null;
      const vRad = p.attributes?.vendor_radius_km || 10.0;
      
      const distance = (vLat && vLon && coords)
        ? getHaversineDistance(coords.lat, coords.lon, parseFloat(vLat), parseFloat(vLon))
        : 0;
      return { ...p, distance, vendor_radius: vRad };
    });

    const inRangeProducts = mapped.filter((p: any) => p.distance <= p.vendor_radius);
    
    let isOutofRange = false;
    let targetProducts = inRangeProducts;

    // Fallback if no vendors are in range
    if (inRangeProducts.length === 0 && mapped.length > 0 && coords) {
      isOutofRange = true;
      targetProducts = mapped;
    }

    if (targetProducts.length === 0) {
      targetProducts = mapped;
    }

    let storedVendorId: string | null = null;
    if (typeof window !== "undefined") {
      storedVendorId = localStorage.getItem("sw_nearest_vendor_id");
      if (storedVendorId === "null" || storedVendorId === "undefined" || !storedVendorId) {
        storedVendorId = null;
      }
    }

    let minDistance = Infinity;
    let activeVendor = storedVendorId;

    if (!activeVendor) {
      // Find the closest vendor among target products
      let nearestVendor: any = null;
      targetProducts.forEach((p: any) => {
        const vId = p.attributes?.vendor_id || p.vendor_id || p.vendor?.id;
        if (vId && p.distance < minDistance) {
          minDistance = p.distance;
          nearestVendor = vId;
        }
      });
      activeVendor = nearestVendor ? String(nearestVendor) : null;
      if (activeVendor && typeof window !== "undefined") {
        localStorage.setItem("sw_nearest_vendor_id", activeVendor);
      }
    } else {
      // Find distance of this active vendor for the banner display
      const activeProd = targetProducts.find((p: any) => {
        const vId = p.attributes?.vendor_id || p.vendor_id || p.vendor?.id;
        return String(vId) === String(activeVendor);
      });
      if (activeProd) {
        minDistance = activeProd.distance;
      }
    }

    let finalProds = targetProducts;
    if (activeVendor) {
      finalProds = targetProducts.filter((p: any) => {
        const vId = p.attributes?.vendor_id || p.vendor_id || p.vendor?.id;
        return String(vId) === String(activeVendor);
      });
    }

    if (activeSubcatId) {
      finalProds = finalProds.filter((p: any) => p.category_id === activeSubcatId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      finalProds = finalProds.filter((p: any) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }

    return {
      products: finalProds,
      nearestVendorDistance: minDistance === Infinity ? null : minDistance,
      isOutofRange
    };
  }, [rawProducts, coords, activeSubcatId, searchQuery]);

  // Mutations
  const addToCart = useMutation({
    mutationFn: async (product: any) => {
      const vendorId = product.attributes?.vendor_id || product.vendor_id || product.vendor?.id;
      return api.post("/cart/items", {
        product_id: product.id,
        ...(vendorId ? { vendor_id: vendorId } : {}),
        quantity: 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (err: any) => showError("Failed to add", err.response?.data?.detail || err.message),
  });

  const addToCartWithClear = useMutation({
    mutationFn: async (product: any) => {
      const vendorId = product.attributes?.vendor_id || product.vendor_id || product.vendor?.id;
      return api.post("/cart/items", {
        product_id: product.id,
        ...(vendorId ? { vendor_id: vendorId } : {}),
        quantity: 1,
        clear_other_carts: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      setShowClearCartModal(false);
      setPendingProduct(null);
    },
    onError: (err: any) => showError("Failed to add", err.response?.data?.detail || err.message),
  });

  const updateQty = useMutation({
    mutationFn: async ({ itemId, qty }: { itemId: string; qty: number }) => {
      if (qty <= 0) return api.delete(`/cart/items/${itemId}`);
      return api.patch(`/cart/items/${itemId}`, { quantity: qty });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const handleAddToCartAttempt = (product: any) => {
    const targetVendorId = product.attributes?.vendor_id || product.vendor_id || product.vendor?.id;
    const currentItems = isGuest ? localCart?.items : serverCart?.items;
    const differentVendor = currentItems?.length > 0 && currentItems.some((i: any) => i.vendor_id && String(i.vendor_id) !== String(targetVendorId));

    if (differentVendor) {
      setPendingProduct(product);
      setShowClearCartModal(true);
    } else {
      if (isGuest) {
        const current = getLocalGuestCart();
        const price = Math.round((product.attributes?.price ?? product.price ?? 30) * 1.045 * 100) / 100;
        const emoji = product.attributes?.image_emoji || "🥬";
        current.items.push({
          id: `guest-${product.id}`,
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit: product.unit || "1 kg",
          price: price,
          vendor_id: targetVendorId,
          attributes: { image_emoji: emoji }
        });
        current.subtotal = current.items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
        saveLocalGuestCart(current);
        if (current.items.length === 1) {
          window.dispatchEvent(new Event("trigger-notification-benefit"));
        }
      } else {
        addToCart.mutate(product);
      }
    }
  };

  const handleConfirmClearCart = () => {
    if (!pendingProduct) return;
    if (isGuest) {
      const emptyCart = { items: [] as any[], subtotal: 0 };
      saveLocalGuestCart(emptyCart);
      
      const targetVendorId = pendingProduct.attributes?.vendor_id || pendingProduct.vendor_id || pendingProduct.vendor?.id;
      const price = Math.round((pendingProduct.attributes?.price ?? pendingProduct.price ?? 30) * 1.045 * 100) / 100;
      const emoji = pendingProduct.attributes?.image_emoji || "🥬";
      
      emptyCart.items.push({
        id: `guest-${pendingProduct.id}`,
        product_id: pendingProduct.id,
        product_name: pendingProduct.name,
        quantity: 1,
        unit: pendingProduct.unit || "1 kg",
        price: price,
        vendor_id: targetVendorId,
        attributes: { image_emoji: emoji }
      });
      emptyCart.subtotal = price;
      saveLocalGuestCart(emptyCart);
      setShowClearCartModal(false);
      setPendingProduct(null);
    } else {
      addToCartWithClear.mutate(pendingProduct);
    }
  };

  const handleQtyChange = (product: any, newQty: number) => {
    const currentItems = isGuest ? localCart?.items : serverCart?.items;
    const cartItem = currentItems?.find((i: any) => i.product_id === product.id);
    if (!cartItem) return;

    if (isGuest) {
      const current = getLocalGuestCart();
      const idx = current.items.findIndex((i: any) => i.product_id === product.id);
      if (idx !== -1) {
        if (newQty <= 0) {
          current.items.splice(idx, 1);
        } else {
          current.items[idx].quantity = newQty;
        }
        current.subtotal = current.items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
        saveLocalGuestCart(current);
      }
    } else {
      updateQty.mutate({ itemId: cartItem.id, qty: newQty });
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden text-slate-800 dark:text-white font-sans bg-slate-50 dark:bg-[#090d10]">
      
      {/* 1. Left Vertical Sticky Menu */}
      <aside className="w-20 sm:w-24 flex-shrink-0 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-850 overflow-y-auto flex flex-col items-center py-4 gap-2 scrollbar-none select-none">
        {categoriesLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-900 animate-pulse mb-2" />
          ))
        ) : (
          parentCategories.map((cat: any) => {
            const emoji = cat.icon || CATEGORY_EMOJIS[cat.name] || "🥗";
            const isActive = selectedCatId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCatId(cat.id);
                  setActiveSubcatId(null);
                }}
                className={`w-16 sm:w-20 flex flex-col items-center text-center p-2 rounded-2xl transition-all cursor-pointer select-none border-l-4 ${
                  isActive
                    ? "bg-emerald-600/10 text-emerald-600 dark:text-emerald-450 font-black border-emerald-600"
                    : "hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-550 dark:text-slate-400 border-transparent"
                }`}
              >
                <span className="text-2xl mb-1">{emoji}</span>
                <span className="text-[9px] sm:text-[10px] leading-tight font-extrabold truncate w-full">{cat.name}</span>
              </button>
            );
          })
        )}
      </aside>

      {/* 2. Right Catalog Pane */}
      <section className="flex-1 flex flex-col h-full overflow-hidden p-4">
        {/* Top: Horizontal Subcategories Chips */}
        {subcategories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none flex-shrink-0">
            <button
              onClick={() => setActiveSubcatId(null)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black whitespace-nowrap uppercase tracking-wider cursor-pointer transition-all border ${
                activeSubcatId === null
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-sm"
                  : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              All {activeCatName}
            </button>
            {subcategories.map((sub: any) => (
              <button
                key={sub.id}
                onClick={() => setActiveSubcatId(sub.id)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black whitespace-nowrap uppercase tracking-wider cursor-pointer transition-all border ${
                  activeSubcatId === sub.id
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-sm"
                    : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400"
                }`}
              >
                {sub.name}
              </button>
            ))}
          </div>
        )}

        {/* Search Bar inside Category */}
        <div className="relative mb-3 flex-shrink-0">
          <input
            type="text"
            placeholder={`Search in ${activeCatName}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold focus:outline-none focus:border-emerald-500 text-slate-850 dark:text-white"
          />
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
        </div>

        {/* Product Grid scroll container */}
        <div className="flex-1 overflow-y-auto pr-1 pb-16 scrollbar-thin">
          {productsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-44 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 animate-pulse" />
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="space-y-4">
              {isOutofRange && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-3 text-amber-800 dark:text-amber-405 text-[10px] font-semibold flex items-center gap-2">
                  <Navigation className="w-3.5 h-3.5 text-amber-500 animate-pulse flex-shrink-0" />
                  <span>Showing preview catalog (Delivery currently unavailable to your location as nearest store is {(nearestVendorDistance ?? 0).toFixed(1)} km away).</span>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {products.map((prod: any) => (
                  <ProductCard key={prod.id} product={prod} />
                ))}
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-slate-400 text-xs font-semibold">
              No fresh items available in this category currently.
            </div>
          )}
        </div>
      </section>

      {/* 3. Replace Cart Interceptor Modal */}
      {showClearCartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowClearCartModal(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full text-slate-850 dark:text-white space-y-4 shadow-2xl animate-scale-in">
            <h3 className="text-lg font-black tracking-tight">Replace Cart Items? 🛒</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Your cart contains items from a different store. Since we offer Instant transit, orders must be sourced from a single vendor. Would you like to empty your cart and add this item?
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowClearCartModal(false)}
                className="flex-1 py-3 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClearCart}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 rounded-xl text-xs transition-all shadow-md shadow-emerald-900/20"
              >
                Replace Items
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
