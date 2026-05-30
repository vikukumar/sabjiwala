"use client";

import React, { useState, useEffect } from "react";
import { Search, MapPin, ShoppingBag, User, Plus, Minus, ArrowRight, Star, Loader2, X, ClipboardList, XCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sabjiwala/shared";
import versionInfo from "./version.json";

export default function Home() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);

  // Fetch customer past orders
  const { data: myOrders = [], isLoading: myOrdersLoading } = useQuery<any[]>({
    queryKey: ["myOrders"],
    queryFn: async () => {
      const res = await api.get("/orders");
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return api.post(`/orders/${orderId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      alert("Order cancelled successfully!");
    },
    onError: (err: any) => {
      alert("Failed to cancel order: " + (err.response?.data?.detail || err.message));
    }
  });

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("sw_theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // 1. Route Protection check
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("sw_access_token")) {
      window.location.href = "/login";
    }
  }, []);

  // 2. Fetch categories
  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.get("/catalog/categories");
      return res.data || [];
    }
  });

  // 3. Fetch products based on category and search
  const selectedCategoryObj = categories.find(c => c.name === selectedCategory);
  const { data: products = [], isLoading: productsLoading } = useQuery<any[]>({
    queryKey: ["products", selectedCategory, searchQuery],
    queryFn: async () => {
      const res = await api.get("/catalog/products", {
        params: {
          category_id: selectedCategoryObj?.id || undefined,
          search: searchQuery || undefined
        }
      });
      return res.data || [];
    }
  });

  // 4. Fetch Cart
  const { data: cartData } = useQuery<any>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await api.get("/cart");
      return res.data || { items: [], subtotal: 0, item_count: 0 };
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // 5. Add to Cart Mutation
  const addToCartMutation = useMutation({
    mutationFn: async (productId: string) => {
      const prod = products.find(p => p.id === productId);
      const vendorId = prod?.attributes?.vendor_id || "v101"; // Fallback to seeded vendor
      return api.post("/cart/items", {
        product_id: productId,
        vendor_id: vendorId,
        quantity: 1
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    }
  });

  // 6. Update Cart Item Quantity Mutation
  const updateCartQtyMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      if (quantity <= 0) {
        return api.delete(`/cart/items/${itemId}`);
      }
      return api.patch(`/cart/items/${itemId}`, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    }
  });

  // 7. Checkout / Order Placement Mutation
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      // Get addresses
      const addrRes = await api.get("/users/addresses");
      const addresses = addrRes.data || [];
      let addressId = addresses[0]?.id;

      if (!addressId) {
        const newAddr = await api.post("/users/addresses", {
          label: "Home",
          full_name: "Rahul Sharma",
          phone: "9820012345",
          address_line_1: "Flat 402, Shiv Shakti Tower",
          city: "Navi Mumbai",
          state: "Maharashtra",
          country: "India",
          postal_code: "400703",
          latitude: 19.0735,
          longitude: 72.9985,
          is_default: true
        });
        addressId = newAddr.data?.id;
      }

      const cartItems = cartData?.items || [];
      if (cartItems.length === 0) throw new Error("Your cart is empty!");

      const firstItem = cartItems[0];
      return api.post("/orders", {
        address_id: addressId,
        payment_method: "cod",
        use_wallet: false
      }, {
        params: {
          vendor_id: firstItem.vendor_id
        }
      });
    },
    onSuccess: (res) => {
      alert(`Order placed successfully! Order Number: ${res.data?.order_number}`);
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (err: any) => {
      alert(`Failed to checkout: ${err.response?.data?.detail || err.message}`);
    }
  });

  const cartItemCount = cartData?.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
  const cartTotal = cartData?.subtotal || 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 antialiased font-sans transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 shadow-sm border-b border-slate-100 dark:border-slate-800 transition-colors duration-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo_horizontal.png" alt="SabjiWala Logo" className="h-8 w-auto object-contain" />
            <span className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full">Express</span>
          </div>

          <div className="flex-1 max-w-md hidden md:flex items-center bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-2 border border-slate-200 dark:border-slate-700">
            <Search className="w-5 h-5 text-slate-400 mr-2" />
            <input
              type="text"
              placeholder="Search farm fresh vegetables..."
              className="bg-transparent border-none outline-none w-full text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-350 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Mumbai, MH</span>
            </div>

            {/* Custom Theme Switcher */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-500/30"
              title={theme === "light" ? "Switch to Dark Soil Mode" : "Switch to Light Veggie Mode"}
            >
              {theme === "light" ? (
                <span className="text-sm" role="img" aria-label="light mode">🍋</span>
              ) : (
                <span className="text-sm" role="img" aria-label="dark mode">🍆</span>
              )}
            </button>

            <button className="relative p-2 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              <ShoppingBag className="w-6 h-6" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-emerald-600 dark:bg-emerald-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-bounce">
                  {cartItemCount}
                </span>
              )}
            </button>

            <button 
              onClick={() => setIsOrdersOpen(true)}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              title="My Orders"
            >
              <User className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="bg-gradient-to-r from-emerald-600 to-teal-700 dark:from-emerald-950/80 dark:to-teal-950/80 text-white py-12 px-4 shadow-inner">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
            Fresh Vegetables & Fruits <br/>
            Delivered in <span className="underline decoration-yellow-400 dark:decoration-yellow-500 decoration-wavy">10 Minutes</span>
          </h2>
          <p className="text-emerald-50 dark:text-emerald-250/90 text-base md:text-lg max-w-xl mx-auto">
            Directly from local farms to your doorstep. Cleaned, sorted, and packed with hygienic care.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Search Mobile */}
        <div className="flex md:hidden items-center bg-white dark:bg-slate-900 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-800 shadow-sm">
          <Search className="w-5 h-5 text-slate-400 mr-2" />
          <input
            type="text"
            placeholder="Search farm fresh vegetables..."
            className="bg-transparent border-none outline-none w-full text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Categories */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Browse by Category</h3>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory("All")}
              className={`px-6 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all border ${
                selectedCategory === "All"
                  ? "bg-emerald-600 dark:bg-emerald-500 text-white border-emerald-600 dark:border-emerald-500 shadow-sm"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              All
            </button>
            {categories.map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-6 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all border ${
                  selectedCategory === cat.name
                    ? "bg-emerald-600 dark:bg-emerald-500 text-white border-emerald-600 dark:border-emerald-500 shadow-sm"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Fresh Produce</h3>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-205 dark:bg-slate-800 px-2.5 py-1 rounded-full">
              {products.length} items
            </span>
          </div>

          {productsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 animate-spin" />
              <span className="text-sm text-slate-500 dark:text-slate-400 font-semibold">Loading fresh veggies...</span>
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {products.map((prod: any) => {
                const cartItem = cartData?.items?.find((item: any) => item.product_id === prod.id);
                const emoji = prod.attributes?.image_emoji || "🥬";
                const price = prod.attributes?.price || 30;

                return (
                  <div key={prod.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 hover:border-emerald-250 dark:hover:border-emerald-500/50 hover:shadow-md transition-all p-4 flex flex-col justify-between gap-3 relative overflow-hidden group">
                    <div className="text-5xl h-24 flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 rounded-xl group-hover:scale-110 transition-transform duration-300">
                      {emoji}
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs font-semibold text-amber-500">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>4.7</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 line-clamp-1">{prod.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-450">{prod.unit}</p>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-base font-extrabold text-slate-900 dark:text-slate-50">₹{price}</span>
                      
                      {cartItem ? (
                        <div className="flex items-center bg-emerald-600 dark:bg-emerald-500 text-white rounded-full px-1 py-0.5 shadow-sm">
                          <button
                            onClick={() => updateCartQtyMutation.mutate({ itemId: cartItem.id, quantity: cartItem.quantity - 1 })}
                            className="p-1 hover:bg-emerald-700 dark:hover:bg-emerald-600 rounded-full transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2.5 text-sm font-bold">{cartItem.quantity}</span>
                          <button
                            onClick={() => updateCartQtyMutation.mutate({ itemId: cartItem.id, quantity: cartItem.quantity + 1 })}
                            className="p-1 hover:bg-emerald-700 dark:hover:bg-emerald-600 rounded-full transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCartMutation.mutate(prod.id)}
                          className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-500 dark:hover:text-white transition-all font-bold text-xs px-4 py-2 rounded-full border border-emerald-100 dark:border-emerald-900/30 shadow-sm"
                        >
                          ADD
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800 text-slate-400 dark:text-slate-500 space-y-2">
              <span className="text-4xl block">🧺</span>
              <h4 className="text-base font-bold text-slate-700 dark:text-slate-350">No vegetables found</h4>
              <p className="text-xs text-slate-450 dark:text-slate-500">Try modifying your search or choosing another category.</p>
            </div>
          )}
        </div>
      </main>

      {/* Floating Cart Footer */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-[90%] max-w-md bg-slate-900 dark:bg-slate-950 text-white rounded-2xl shadow-xl px-5 py-4 flex items-center justify-between border border-slate-850 dark:border-slate-800 animate-slide-up z-40">
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-slate-400 dark:text-slate-450">{cartItemCount} Items Added</span>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-black">₹{cartTotal}</span>
              <span className="text-[10px] text-slate-400 bg-slate-800 dark:bg-slate-900 px-2 py-0.5 rounded-full font-bold">
                COD / ONLINE
              </span>
            </div>
          </div>
          <button 
            onClick={() => checkoutMutation.mutate()}
            disabled={checkoutMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 font-bold px-6 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 text-sm tracking-wide disabled:opacity-50"
          >
            {checkoutMutation.isPending ? "Placing Order..." : "Checkout"} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sliding Drawer for My Orders */}
      {isOrdersOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOrdersOpen(false)}
          ></div>

          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col transition-all transform duration-300">
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">My Orders</h3>
                </div>
                <button 
                  onClick={() => setIsOrdersOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-slate-100 dark:divide-slate-800">
                {myOrdersLoading ? (
                  <div className="h-40 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Fetching your orders...</span>
                  </div>
                ) : myOrders && myOrders.length > 0 ? (
                  myOrders.map((order: any) => (
                    <div key={order.id} className="py-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-extrabold text-slate-900 dark:text-white text-sm">
                            #Order {order.order_number}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                            {new Date(order.created_at).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </p>
                        </div>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          order.status === "pending"
                            ? "bg-amber-100 dark:bg-amber-955/40 text-amber-800 dark:text-amber-400"
                            : order.status === "confirmed" || order.status === "accepted" || order.status === "packed"
                            ? "bg-blue-100 dark:bg-blue-955/40 text-blue-800 dark:text-blue-400"
                            : order.status === "delivered"
                            ? "bg-emerald-100 dark:bg-emerald-955/40 text-emerald-800 dark:text-emerald-400"
                            : "bg-rose-100 dark:bg-rose-955/40 text-rose-800 dark:text-rose-455"
                        }`}>
                          {order.status}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs font-semibold text-slate-600 dark:text-slate-350">
                        <span>Payment: {order.payment_method?.toUpperCase()}</span>
                        <span className="text-slate-400 dark:text-slate-500">•</span>
                        <span>Status: {order.payment_status?.toUpperCase()}</span>
                      </div>

                      <div className="flex justify-between items-center pt-1">
                        <span className="text-base font-black text-slate-900 dark:text-white">₹{order.total_amount}</span>
                        {(order.status === "pending" || order.status === "confirmed") && (
                          <button
                            onClick={() => {
                              if (confirm("Are you sure you want to cancel this order?")) {
                                cancelOrderMutation.mutate(order.id);
                              }
                            }}
                            disabled={cancelOrderMutation.isPending}
                            className="text-xs bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-rose-955/20 dark:hover:bg-rose-650 dark:text-rose-450 dark:hover:text-white font-bold px-3.5 py-1.5 rounded-xl border border-rose-100 dark:border-rose-900/30 transition-all flex items-center gap-1 disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Cancel Order
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
                    <span className="text-3xl block">📦</span>
                    <p className="text-sm font-bold">No orders placed yet</p>
                    <p className="text-xs text-slate-455 dark:text-slate-550">Your order history will appear here once you place an order.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
