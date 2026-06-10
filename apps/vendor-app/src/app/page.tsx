"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  TrendingUp, Users, ShoppingBag, DollarSign,
  Settings, Award, RefreshCw, Clock, MapPin, Loader2, Menu, X,
  Plus, Trash2, ArrowLeft, Save, Search, Navigation, Upload, Star, Image
} from "lucide-react";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useWebSocket } from "@sbjiwala/shared";
import versionInfo from "./version.json";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/index";

function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  loading
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-in text-center shadow-2xl">
        <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">{title}</h3>
        <p className="text-xs text-slate-550 dark:text-slate-400 leading-normal">{message}</p>
        <div className="flex gap-3 pt-2">
          <Button
            variant="danger"
            onClick={onConfirm}
            loading={loading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold"
          >
            Yes, Remove
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function ServiceAreaPanel() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapObj, setMapObj] = useState<any>(null);
  const [markerObj, setMarkerObj] = useState<any>(null);
  const [circleObj, setCircleObj] = useState<any>(null);

  const [centerLat, setCenterLat] = useState(19.0760);
  const [centerLng, setCenterLng] = useState(72.9977);
  const [radius, setRadius] = useState(5.0);
  
  const [minOrder, setMinOrder] = useState("0.00");
  const [freeAbove, setFreeAbove] = useState("199.00");
  const [baseCharge, setBaseCharge] = useState("30.00");
  const [perKmCharge, setPerKmCharge] = useState("10.00");
  const [packagingFee, setPackagingFee] = useState("0.00");

  const { data: areasData } = useQuery<any>({
    queryKey: ["myServiceAreas"],
    queryFn: async () => {
      const res = await api.get("/vendors/me/service-areas");
      return res.data || [];
    }
  });

  const { data: rulesData } = useQuery<any>({
    queryKey: ["myDeliveryRules"],
    queryFn: async () => {
      const res = await api.get("/vendors/me/delivery-rules");
      return res.data || [];
    }
  });

  useEffect(() => {
    if (areasData && areasData.length > 0) {
      const activeArea = areasData[0];
      if (activeArea.center_latitude) setCenterLat(activeArea.center_latitude);
      if (activeArea.center_longitude) setCenterLng(activeArea.center_longitude);
      if (activeArea.radius_km) setRadius(activeArea.radius_km);
    }
  }, [areasData]);

  useEffect(() => {
    if (rulesData && rulesData.length > 0) {
      const activeRule = rulesData[0];
      setMinOrder(activeRule.min_order_amount.toString());
      setFreeAbove(activeRule.free_delivery_above ? activeRule.free_delivery_above.toString() : "");
      setBaseCharge(activeRule.base_delivery_charge.toString());
      setPerKmCharge(activeRule.per_km_charge.toString());
      setPackagingFee(activeRule.packaging_fee ? activeRule.packaging_fee.toString() : "0.00");
    }
  }, [rulesData]);

  const saveServiceAreaMutation = useMutation({
    mutationFn: async () => {
      return api.post("/vendors/me/service-areas", {
        name: "Main Delivery Zone",
        radius_km: radius,
        center_latitude: centerLat,
        center_longitude: centerLng,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myServiceAreas"] });
      success("Service Area updated successfully!");
    },
    onError: (err: any) => {
      showError("Update Failed", "Failed to update Service Area: " + (err.response?.data?.detail || err.message));
    }
  });

  const saveDeliveryRulesMutation = useMutation({
    mutationFn: async () => {
      return api.post("/vendors/me/delivery-rules", {
        min_order_amount: parseFloat(minOrder) || 0.0,
        free_delivery_above: freeAbove ? parseFloat(freeAbove) : null,
        base_delivery_charge: parseFloat(baseCharge) || 0.0,
        per_km_charge: parseFloat(perKmCharge) || 0.0,
        max_delivery_distance_km: radius,
        packaging_fee: parseFloat(packagingFee) || 0.0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myDeliveryRules"] });
      success("Delivery Rules updated successfully!");
    },
    onError: (err: any) => {
      showError("Update Failed", "Failed to update Delivery Rules: " + (err.response?.data?.detail || err.message));
    }
  });

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let map: any = null;
    let active = true;

    import("leaflet").then((L) => {
      if (!active || !mapContainerRef.current) return;

      if ((mapContainerRef.current as any)._leaflet_id) {
        return;
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      map = L.map(mapContainerRef.current!).setView([centerLat, centerLng], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
      }).addTo(map);

      const storeIcon = L.divIcon({
        html: '<div style="background:#3b82f6;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3)">🏪</div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      const marker = L.marker([centerLat, centerLng], { icon: storeIcon, draggable: true }).addTo(map);
      setMarkerObj(marker);

      const circle = L.circle([centerLat, centerLng], {
        color: "#10b981",
        fillColor: "#10b981",
        fillOpacity: 0.15,
        radius: radius * 1000 
      }).addTo(map);
      setCircleObj(circle);

      marker.on("dragend", (event: any) => {
        const position = event.target.getLatLng();
        setCenterLat(position.lat);
        setCenterLng(position.lng);
        circle.setLatLng(position);
      });

      map.on("click", (event: any) => {
        const position = event.latlng;
        setCenterLat(position.lat);
        setCenterLng(position.lng);
        marker.setLatLng(position);
        circle.setLatLng(position);
      });

      setMapObj(map);
    });

    return () => {
      active = false;
      if (map) map.remove();
    };
  }, []);

  useEffect(() => {
    if (circleObj) {
      circleObj.setRadius(radius * 1000);
      if (mapObj) {
        mapObj.fitBounds(circleObj.getBounds(), { padding: [20, 20] });
      }
    }
  }, [radius, circleObj, mapObj]);

  // Sync Leaflet map centering and marker positions reactively with lat/lng state updates
  useEffect(() => {
    if (mapObj && markerObj && circleObj) {
      const currentMarkerLatLng = markerObj.getLatLng();
      if (Math.abs(currentMarkerLatLng.lat - centerLat) > 0.00001 || Math.abs(currentMarkerLatLng.lng - centerLng) > 0.00001) {
        const latlng = [centerLat, centerLng] as [number, number];
        mapObj.setView(latlng, mapObj.getZoom());
        markerObj.setLatLng(latlng);
        circleObj.setLatLng(latlng);
      }
    }
  }, [centerLat, centerLng, mapObj, markerObj, circleObj]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in text-slate-800 dark:text-slate-100">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-450" /> Configure Store & Delivery Zone
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Drag the store pin or click on the map to set the center of your delivery area.</p>
            </div>
          </div>

          <div ref={mapContainerRef} className="h-[380px] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative shadow-inner" style={{ zIndex: 1 }} />
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-150 dark:border-slate-800">
            <div className="flex gap-4 text-xs font-mono text-slate-500">
              <div>Latitude: <span className="font-bold text-slate-800 dark:text-slate-100">{centerLat.toFixed(6)}</span></div>
              <div>Longitude: <span className="font-bold text-slate-800 dark:text-slate-100">{centerLng.toFixed(6)}</span></div>
            </div>
            <button
              onClick={() => {
                if (typeof window === "undefined" || !navigator.geolocation) {
                  showError("Not Supported", "Geolocation is not supported by your browser");
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    setCenterLat(position.coords.latitude);
                    setCenterLng(position.coords.longitude);
                  },
                  (error) => {
                    showError("Acquisition Failed", "GPS position acquisition failed. Please enable location permissions.");
                  },
                  { enableHighAccuracy: true }
                );
              }}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl text-[11px] font-black border border-blue-150 dark:border-blue-900/50 flex items-center gap-1 cursor-pointer transition-all uppercase tracking-wider"
            >
              <Navigation className="w-3.5 h-3.5" /> Locate Store GPS
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">Delivery Range Configuration</h4>
            <p className="text-xs text-slate-500">Configure how far your delivery boys are allowed to travel from your store.</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span>Max Service Distance</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">{radius.toFixed(1)} km</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="15.0"
              step="0.5"
              value={radius}
              onChange={(e) => setRadius(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
          </div>

          <button
            onClick={() => saveServiceAreaMutation.mutate()}
            disabled={saveServiceAreaMutation.isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {saveServiceAreaMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Service Area Center & Radius
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="space-y-1">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">Delivery Cost Rules</h4>
            <p className="text-xs text-slate-500">Configure how delivery charges are calculated for customers.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Base Delivery Charge (₹)</label>
              <input
                type="number"
                value={baseCharge}
                onChange={(e) => setBaseCharge(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Per-KM Charge (₹)</label>
              <input
                type="number"
                value={perKmCharge}
                onChange={(e) => setPerKmCharge(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Min Order Amount (₹)</label>
              <input
                type="number"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Free Delivery Above (₹)</label>
              <input
                type="number"
                placeholder="Optional"
                value={freeAbove}
                onChange={(e) => setFreeAbove(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Packaging & Handling Fee (₹)</label>
              <input
                type="number"
                value={packagingFee}
                onChange={(e) => setPackagingFee(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            onClick={() => saveDeliveryRulesMutation.mutate()}
            disabled={saveDeliveryRulesMutation.isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {saveDeliveryRulesMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Delivery Pricing Rules
          </button>
        </div>
      </div>
    </div>
  );
}


function InventoryPanel({ vendorId }: { vendorId: string }) {
  const { success, error: showError } = useToast();
  const [productToDelete, setProductToDelete] = useState<any | null>(null);
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<"list" | "add-product" | "add-category">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");

  // Form states for adding product
  const [newProdName, setNewProdName] = useState("");
  const [newProdDesc, setNewProdDesc] = useState("");
  const [newProdCategoryId, setNewProdCategoryId] = useState("");
  const [newProdUnit, setNewProdUnit] = useState("kg");
  const [newProdUnitValue, setNewProdUnitValue] = useState("1.0");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdComparePrice, setNewProdComparePrice] = useState("");
  const [newProdEmoji, setNewProdEmoji] = useState("🥬");
  const [newProdInitialStock, setNewProdInitialStock] = useState("50.0");
  const [newProdImageUrl, setNewProdImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/storage/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data?.url || res.data?.file_url || "";
      if (url) setNewProdImageUrl(url);
      else showError("Upload Failed", "No URL returned from server");
    } catch (err: any) {
      showError("Upload Failed", err.response?.data?.detail || err.message);
    } finally {
      setImageUploading(false);
    }
  };


  // Form states for adding category/subcategory
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newCatParentId, setNewCatParentId] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("");

  // Edit Pricing / Stock states for selected product
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editComparePrice, setEditComparePrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [stockChangeType, setStockChangeType] = useState<"add" | "remove" | "set">("set");

  // Queries
  const { data: productsData, isLoading: productsLoading } = useQuery<any>({
    queryKey: ["vendorCatalog", vendorId, searchQuery, selectedCategoryFilter],
    queryFn: async () => {
      const res = await api.get("/catalog/products", {
        params: {
          vendor_id: vendorId,
          search: searchQuery || undefined,
          category_id: selectedCategoryFilter || undefined,
          page_size: 100,
        }
      });
      return res.data || [];
    },
    enabled: !!vendorId
  });

  const { data: categoriesData } = useQuery<any>({
    queryKey: ["allCategories"],
    queryFn: async () => {
      const res = await api.get("/catalog/categories", {
        params: { all_levels: true }
      });
      return res.data || [];
    }
  });

  // Mutations
  const addCategoryMutation = useMutation({
    mutationFn: async () => {
      return api.post("/products/categories", {
        name: newCatName,
        description: newCatDesc || null,
        parent_id: newCatParentId || null,
        icon: newCatIcon || null,
        is_active: true,
        sort_order: 0
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allCategories"] });
      success("Category created successfully!");
      setNewCatName("");
      setNewCatDesc("");
      setNewCatParentId("");
      setNewCatIcon("");
      setActiveSubTab("list");
    },
    onError: (err: any) => {
      showError("Creation Failed", "Failed to create category: " + (err.response?.data?.detail || err.message));
    }
  });

  const addProductMutation = useMutation({
    mutationFn: async () => {
      // Create product
      const res = await api.post("/products", {
        name: newProdName,
        description: newProdDesc || null,
        category_id: newProdCategoryId,
        unit: newProdUnit,
        unit_value: parseFloat(newProdUnitValue) || 1.0,
        price: parseFloat(newProdPrice) || 0.0,
        compare_at_price: newProdComparePrice ? parseFloat(newProdComparePrice) : null,
        attributes: {
          image_emoji: newProdEmoji,
          image_url: newProdImageUrl || undefined,
        }
      });

      
      const createdProd = res.data;
      // Set initial stock if specified and > 0
      const initialStockVal = parseFloat(newProdInitialStock) || 0.0;
      const prodId = createdProd?.id;
      if (prodId && initialStockVal > 0) {
        await api.post(`/products/${prodId}/inventory`, null, {
          params: {
            quantity: initialStockVal,
            change_type: "set",
            notes: "Initial inventory setup"
          }
        });
      }
      return createdProd;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorCatalog"] });
      queryClient.invalidateQueries({ queryKey: ["vendorMetrics"] });
      success("Product added to catalog successfully!");
      setNewProdName("");
      setNewProdDesc("");
      setNewProdCategoryId("");
      setNewProdPrice("");
      setNewProdComparePrice("");
      setNewProdInitialStock("50.0");
      setNewProdEmoji("🥬");
      setNewProdImageUrl("");
      setActiveSubTab("list");

    },
    onError: (err: any) => {
      showError("Add Failed", "Failed to add product: " + (err.response?.data?.detail || err.message));
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: async () => {
      // Update Price (via patch product)
      await api.patch(`/products/${editingProduct.id}`, {
        price: parseFloat(editPrice) || 0.0,
        compare_at_price: editComparePrice ? parseFloat(editComparePrice) : null
      });

      // Update Stock (via POST inventory)
      const stockVal = parseFloat(editStock);
      if (!isNaN(stockVal)) {
        await api.post(`/products/${editingProduct.id}/inventory`, null, {
          params: {
            quantity: stockVal,
            change_type: stockChangeType,
            notes: "Manual vendor catalog adjustment"
          }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorCatalog"] });
      queryClient.invalidateQueries({ queryKey: ["vendorMetrics"] });
      success("Product pricing and stock updated successfully!");
      setEditingProduct(null);
    },
    onError: (err: any) => {
      showError("Update Failed", "Failed to update product details: " + (err.response?.data?.detail || err.message));
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (prodId: string) => {
      return api.delete(`/products/${prodId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorCatalog"] });
      success("Product removed from catalog successfully!");
    },
    onError: (err: any) => {
      showError("Deletion Failed", "Failed to delete product: " + (err.response?.data?.detail || err.message));
    }
  });

  const categories = categoriesData || [];
  const products = productsData || [];

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-5 rounded-3xl shadow-sm">
        <div>
          <h3 className="text-base font-black flex items-center gap-2">
            🥦 Store Catalog & Inventory
          </h3>
          <p className="text-xs text-slate-550 mt-0.5">Manage products, adjust stock quantities, configure pricing, and add categories.</p>
        </div>
        <div className="flex gap-2">
          {activeSubTab !== "list" ? (
            <button
              onClick={() => setActiveSubTab("list")}
              className="bg-slate-100 dark:bg-slate-850 text-slate-700 dark:text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back to List
            </button>
          ) : (
            <>
              <button
                onClick={() => setActiveSubTab("add-category")}
                className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 text-xs font-black px-4 py-2.5 rounded-xl cursor-pointer hover:bg-emerald-100/50"
              >
                + New Category
              </button>
              <button
                onClick={() => {
                  if (categories.length === 0) {
                    showError("Category Required", "Please add a category first!");
                    return;
                  }
                  setActiveSubTab("add-product");
                }}
                className="bg-emerald-600 hover:bg-emerald-505 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-md cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add Product
              </button>
            </>
          )}
        </div>
      </div>

      {activeSubTab === "add-category" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-sm max-w-xl mx-auto space-y-4">
          <h4 className="text-sm font-black border-b pb-2">Add New Catalog Category / Subcategory</h4>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newCatName.trim()) return;
              addCategoryMutation.mutate();
            }}
            className="space-y-4 text-xs"
          >
            <div className="space-y-1.5">
              <label className="font-bold text-slate-550 uppercase">Category Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Exotic Veggies, Root Vegetables"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="font-bold text-slate-550 uppercase">Parent Category (Optional)</label>
              <select
                value={newCatParentId}
                onChange={e => setNewCatParentId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              >
                <option value="">None (Creates a Top-Level Parent Category)</option>
                {categories.filter((c: any) => c.parent_id === null).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400">Select a parent category if you are adding a subcategory.</p>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-550 uppercase">Description</label>
              <textarea
                placeholder="Brief description of category..."
                value={newCatDesc}
                onChange={e => setNewCatDesc(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-20 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-550 uppercase">Category Icon/Emoji (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 🥦, 🍎, 🥕"
                value={newCatIcon}
                onChange={e => setNewCatIcon(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={addCategoryMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {addCategoryMutation.isPending ? "Creating Category..." : "Create Category / Subcategory"}
            </button>
          </form>
        </div>
      )}

      {activeSubTab === "add-product" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-sm max-w-2xl mx-auto space-y-4">
          <h4 className="text-sm font-black border-b pb-2">Add New Product to Shop Catalog</h4>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newProdCategoryId) {
                showError("Category Required", "Please select a category!");
                return;
              }
              addProductMutation.mutate();
            }}
            className="space-y-4 text-xs"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Organic Red Tomatoes"
                  value={newProdName}
                  onChange={e => setNewProdName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Category / Subcategory *</label>
                <select
                  required
                  value={newProdCategoryId}
                  onChange={e => setNewProdCategoryId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                >
                  <option value="">Select Category</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.parent_id ? `└── ${c.name} (Subcategory)` : `${c.name}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-550 uppercase">Description</label>
              <textarea
                placeholder="Product description and details..."
                value={newProdDesc}
                onChange={e => setNewProdDesc(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-20 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Unit Type</label>
                <select
                  value={newProdUnit}
                  onChange={e => setNewProdUnit(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                >
                  <option value="kg">kg</option>
                  <option value="gram">gram</option>
                  <option value="piece">piece</option>
                  <option value="dozen">dozen</option>
                  <option value="bunch">bunch</option>
                  <option value="packet">packet</option>
                  <option value="litre">litre</option>
                  <option value="ml">ml</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Unit Value</label>
                <input
                  type="number"
                  step="0.01"
                  value={newProdUnitValue}
                  onChange={e => setNewProdUnitValue(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Representative Emoji</label>
                <select
                  value={newProdEmoji}
                  onChange={e => setNewProdEmoji(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                >
                  <option value="🥬">🥬 Greens</option>
                  <option value="🍅">🍅 Tomato</option>
                  <option value="🥔">🥔 Potato</option>
                  <option value="🧅">🧅 Onion</option>
                  <option value="🥦">🥦 Broccoli</option>
                  <option value="🥕">🥕 Carrot</option>
                  <option value="🍎">🍎 Apple</option>
                  <option value="🥭">🥭 Mango</option>
                  <option value="🍌">🍌 Banana</option>
                  <option value="🌶️">🌶️ Chilli</option>
                  <option value="🌿">🌿 Herb</option>
                  <option value="🍊">🍊 Orange</option>
                </select>
              </div>
            </div>

            {/* Image Upload Field */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-550 uppercase">Product Photo (Optional)</label>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={imageUploading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-slate-50 dark:bg-slate-950/50 text-slate-600 dark:text-slate-400 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                  {imageUploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                  ) : (
                    <><Upload className="w-4 h-4" /> {newProdImageUrl ? "Change Image" : "Upload Product Image"}</>
                  )}
                </button>
                {newProdImageUrl && (
                  <div className="flex items-center gap-2">
                    <img src={newProdImageUrl} alt="Product" className="w-12 h-12 object-cover rounded-xl border border-slate-200 dark:border-slate-700" />
                    <button type="button" onClick={() => setNewProdImageUrl("")} className="text-rose-500 text-xs font-bold hover:underline">Remove</button>
                  </div>
                )}
                {!newProdImageUrl && !imageUploading && (
                  <p className="text-[10px] text-slate-400">Emoji above will be used as fallback icon.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Price (₹) *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  placeholder="Selling Price"
                  value={newProdPrice}
                  onChange={e => setNewProdPrice(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Compare At Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="MRP/Original Price"
                  value={newProdComparePrice}
                  onChange={e => setNewProdComparePrice(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-550 uppercase">Initial Stock Quantity</label>
                <input
                  type="number"
                  step="0.1"
                  value={newProdInitialStock}
                  onChange={e => setNewProdInitialStock(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={addProductMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-505 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {addProductMutation.isPending ? "Adding Product..." : "Save Product to Catalog"}
            </button>
          </form>
        </div>
      )}

      {activeSubTab === "list" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search catalog products..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-955 text-xs focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <select
                value={selectedCategoryFilter}
                onChange={e => setSelectedCategoryFilter(e.target.value)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              >
                <option value="">All Categories</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.parent_id ? `└── ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Product Items Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {productsLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
                <span className="text-xs text-slate-500">Loading catalog items...</span>
              </div>
            ) : products.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-850/50 text-slate-400 uppercase font-black tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <th className="p-4 w-16 text-center">Image</th>
                      <th className="p-4">Product Info</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Sell Price (₹)</th>
                      <th className="p-4 text-center">Rating</th>
                      <th className="p-4 text-center">Available Stock</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>

                  </thead>
                  <tbody className="divide-y divide-slate-150 dark:divide-slate-850">
                    {products.map((p: any) => {
                      const attrs = p.attributes || {};
                      const isLowStock = parseFloat(attrs.quantity || 0) < 10;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                          <td className="p-4 text-center">
                            {attrs.image_url ? (
                              <img src={attrs.image_url} alt={p.name} className="w-10 h-10 object-cover rounded-xl border border-slate-200 dark:border-slate-700 mx-auto" />
                            ) : (
                              <span className="text-3xl">{attrs.image_emoji || "🥬"}</span>
                            )}
                          </td>

                          <td className="p-4">
                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{p.name}</h4>
                            <p className="text-slate-500 mt-0.5">{p.unit_value} {p.unit}</p>
                            <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 max-w-[200px]">{p.description}</p>
                          </td>
                          <td className="p-4">
                            <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full font-bold text-[10px] text-slate-600 dark:text-slate-350">
                              {p.category?.name || "Uncategorized"}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="font-black text-sm text-slate-900 dark:text-white">₹{attrs.price}</span>
                            {attrs.compare_at_price && (
                              <span className="text-slate-400 line-through ml-1.5">₹{attrs.compare_at_price}</span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star key={i} className={`w-3 h-3 ${i < Math.round(parseFloat(attrs.rating || "4")) ? "text-amber-400 fill-current" : "text-slate-300 dark:text-slate-600"}`} />
                              ))}
                              <span className="text-[10px] text-slate-400 ml-0.5">{attrs.rating ? parseFloat(attrs.rating).toFixed(1) : "4.0"}</span>
                            </div>
                          </td>

                          <td className="p-4 text-center">
                            <span className={`inline-block px-3 py-1 rounded-full font-black text-[10px] ${
                              isLowStock
                                ? "bg-rose-500/10 text-rose-550 border border-rose-500/20"
                                : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            }`}>
                              {attrs.quantity || 0} {p.unit}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => {
                                setEditingProduct(p);
                                setEditPrice(String(attrs.price));
                                setEditComparePrice(attrs.compare_at_price ? String(attrs.compare_at_price) : "");
                                setEditStock("");
                                setStockChangeType("set");
                              }}
                              className="px-3 py-1.5 border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer text-slate-800 dark:text-white"
                            >
                              Edit Stock/Price
                            </button>
                            <button
                              onClick={() => {
                                setProductToDelete(p);
                              }}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-955/20 rounded-lg transition-all cursor-pointer inline-flex items-center"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-20 text-center text-slate-400 dark:text-slate-500 text-sm">
                No catalog items found. Click "Add Product" to add your first vegetable or fruit item!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Product Price/Stock Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingProduct(null)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full animate-scale-in text-slate-800 dark:text-white space-y-4 shadow-2xl text-left">
            <div>
              <h3 className="text-base font-black">Edit Pricing & Stock: {editingProduct.name}</h3>
              <p className="text-xs text-slate-550">Configure catalog price details and stock quantity changes.</p>
            </div>
            
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateProductMutation.mutate();
              }}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase">Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editPrice}
                    onChange={e => setEditPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase">Compare At Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editComparePrice}
                    onChange={e => setEditComparePrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="border-t dark:border-slate-800 pt-3 space-y-3">
                <h4 className="font-bold text-slate-550 uppercase">Adjust Inventory Stock</h4>
                
                <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border dark:border-slate-850">
                  {["set", "add", "remove"].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setStockChangeType(mode as any)}
                      className={`py-1.5 rounded-lg text-[10px] capitalize font-bold transition-all ${
                        stockChangeType === mode
                          ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-100 dark:border-slate-800"
                          : "text-slate-450 hover:text-slate-700"
                      }`}
                    >
                      {mode === "set" ? "Set Stock" : mode === "add" ? "+ Add Stock" : "- Deduct"}
                    </button>
                  ))}
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-550 uppercase">Stock Quantity ({editingProduct.unit})</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder={stockChangeType === "set" ? "e.g. 50" : "Quantity change amount"}
                    value={editStock}
                    onChange={e => setEditStock(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-800 rounded-xl bg-transparent text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 border dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateProductMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow cursor-pointer"
                >
                  {updateProductMutation.isPending ? "Saving..." : "Save Modifications"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deletion Confirm Modal */}
      <ConfirmModal
        isOpen={!!productToDelete}
        title="Remove Product?"
        message={productToDelete ? `Remove "${productToDelete.name}" from your catalog?` : ""}
        loading={deleteProductMutation.isPending}
        onConfirm={async () => {
          if (productToDelete) {
            await deleteProductMutation.mutateAsync(productToDelete.id);
            setProductToDelete(null);
          }
        }}
        onCancel={() => setProductToDelete(null)}
      />
    </div>
  );
}

function SettingsPanel({ vendor }: { vendor: any }) {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [bizName, setBizName] = useState(vendor?.business_name || "");
  const [bizType, setBizType] = useState(vendor?.business_type || "individual");
  const [desc, setDesc] = useState(vendor?.description || "");
  const [email, setEmail] = useState(vendor?.contact_email || "");
  const [phone, setPhone] = useState(vendor?.contact_phone || "");
  const [gst, setGst] = useState(vendor?.gst_number || "");
  const [pan, setPan] = useState(vendor?.pan_number || "");
  const [fssai, setFssai] = useState(vendor?.fssai_number || "");

  // Timings states
  const [storeTimings, setStoreTimings] = useState<any>({
    monday: { open: "09:00", close: "21:00", is_closed: false },
    tuesday: { open: "09:00", close: "21:00", is_closed: false },
    wednesday: { open: "09:00", close: "21:00", is_closed: false },
    thursday: { open: "09:00", close: "21:00", is_closed: false },
    friday: { open: "09:00", close: "21:00", is_closed: false },
    saturday: { open: "09:00", close: "21:00", is_closed: false },
    sunday: { open: "09:00", close: "21:00", is_closed: false },
  });

  useEffect(() => {
    if (vendor?.store?.store_timings) {
      setStoreTimings(vendor.store.store_timings);
    }
  }, [vendor]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      return api.patch("/vendors/me", {
        business_name: bizName,
        business_type: bizType,
        description: desc,
        contact_email: email,
        contact_phone: phone,
        gst_number: gst,
        pan_number: pan,
        fssai_number: fssai
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
      success("Business settings updated successfully!");
    },
    onError: (err: any) => {
      showError("Update Failed", "Failed to update business settings: " + (err.response?.data?.detail || err.message));
    }
  });

  const updateTimingsMutation = useMutation({
    mutationFn: async () => {
      return api.put("/vendors/me/store/timings", {
        store_timings: storeTimings
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorProfile"] });
      success("Store operating hours updated successfully!");
    },
    onError: (err: any) => {
      showError("Update Failed", "Failed to update store timings: " + (err.response?.data?.detail || err.message));
    }
  });

  const handleTimingChange = (day: string, field: string, value: any) => {
    setStoreTimings((prev: any) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in text-slate-800 dark:text-slate-100">
      {/* Profile Info */}
      <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-sm space-y-6">
        <div>
          <h3 className="text-base font-black">🏪 Shop Profile Settings</h3>
          <p className="text-xs text-slate-550 mt-0.5">Manage business credentials, contact details, and regulatory codes.</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateProfileMutation.mutate();
          }}
          className="space-y-4 text-xs"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <label className="font-bold text-slate-500 uppercase">Store / Business Name *</label>
              <input
                type="text"
                required
                value={bizName}
                onChange={e => setBizName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase">Contact Phone</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase">Contact Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="font-bold text-slate-550 uppercase">Business Description</label>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="Describe your fresh produce products and services..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-24 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="border-t dark:border-slate-800 pt-4 space-y-4">
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">Regulatory Credentials</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase">PAN Code</label>
                <input
                  type="text"
                  placeholder="Permanent Account Num"
                  value={pan}
                  onChange={e => setPan(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase">GST Registration</label>
                <input
                  type="text"
                  placeholder="Goods & Services Tax"
                  value={gst}
                  onChange={e => setGst(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase">FSSAI Licence</label>
                <input
                  type="text"
                  placeholder="Food Safety Licence"
                  value={fssai}
                  onChange={e => setFssai(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={updateProfileMutation.isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer text-xs"
          >
            {updateProfileMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Profile Credentials
          </button>
        </form>
      </div>

      {/* Timings */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-black">⏰ Store Operating Hours</h3>
          <p className="text-xs text-slate-550 mt-0.5">Define when your store is active and accepting courier collections.</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateTimingsMutation.mutate();
          }}
          className="space-y-4 text-xs"
        >
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {days.map((day) => {
              const timing = storeTimings[day] || { open: "09:00", close: "21:00", is_closed: false };
              return (
                <div key={day} className="py-2.5 flex items-center justify-between gap-4 capitalize">
                  <span className="font-bold w-20 text-slate-700 dark:text-slate-350">{day}</span>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      disabled={timing.is_closed}
                      value={timing.open}
                      onChange={e => handleTimingChange(day, "open", e.target.value)}
                      className="px-2 py-1 rounded-lg border dark:border-slate-850 bg-transparent font-semibold font-mono text-[11px] disabled:opacity-30 text-slate-900 dark:text-white"
                    />
                    <span className="text-slate-400 font-mono text-[10px]">to</span>
                    <input
                      type="time"
                      disabled={timing.is_closed}
                      value={timing.close}
                      onChange={e => handleTimingChange(day, "close", e.target.value)}
                      className="px-2 py-1 rounded-lg border dark:border-slate-850 bg-transparent font-semibold font-mono text-[11px] disabled:opacity-30 text-slate-900 dark:text-white"
                    />
                  </div>

                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={timing.is_closed}
                      onChange={e => handleTimingChange(day, "is_closed", e.target.checked)}
                      className="rounded accent-rose-500"
                    />
                    <span className={`text-[10px] font-bold ${timing.is_closed ? "text-rose-550" : "text-slate-400"}`}>
                      Closed
                    </span>
                  </label>
                </div>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={updateTimingsMutation.isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer text-xs"
          >
            {updateTimingsMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Update Operating Hours
          </button>
        </form>
      </div>
    </div>
  );
}

export default function VendorDashboard() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [currentView, setCurrentView] = useState("dashboard");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    // Fast auth check — don't wait for anything else
    const token = typeof window !== "undefined" ? localStorage.getItem("sw_access_token") : null;
    if (!token) {
      // Use replace so native back button doesn't loop
      window.location.replace("/vendor/login");
      return;
    }
    setIsAuthed(true);
    setIsMounted(true);
  }, []);

  useWebSocket((message) => {
    if (message.type === "order_status_update") {
      queryClient.invalidateQueries({ queryKey: ["vendorOrders"] });
      queryClient.invalidateQueries({ queryKey: ["vendorMetrics"] });
      if (message.data?.status === "confirmed" || message.data?.status === "assigned") {
        success("New Order! 🔔", `Order #${message.data?.order_number || ""} received. Click to Accept.`);
      }
    }
  }, !!isAuthed);

  useEffect(() => {
    if (!isMounted) return;
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, [isMounted]);

  // Check location permission on start — only for web browsers, skip native
  useEffect(() => {
    if (!isMounted || typeof window === "undefined") return;

    // Skip if running on native mobile platform (Capacitor handles permissions natively)
    const isNative = !!(window as any).Capacitor;
    if (isNative) return;

    // Small delay so it doesn't block initial render
    const timer = setTimeout(() => {
      if (navigator.permissions) {
        navigator.permissions.query({ name: "geolocation" as any }).then((result) => {
          if (result.state !== "granted") {
            setShowPermissionModal(true);
          }
        }).catch(() => {});
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [isMounted]);

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


  // 2. Fetch metrics
  const { data: metricsData } = useQuery<any>({
    queryKey: ["vendorMetrics"],
    queryFn: async () => {
      const res = await api.get("/vendors/me/metrics");
      return res.data;
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // 2b. Fetch vendor profile
  const { data: vendorProfileData } = useQuery<any>({
    queryKey: ["vendorProfile"],
    queryFn: async () => {
      const res = await api.get("/vendors/me");
      return res.data;
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // 3. Fetch incoming/recent orders
  const { data: ordersData, isLoading: ordersLoading } = useQuery<any>({
    queryKey: ["vendorOrders", activeTab],
    queryFn: async () => {
      const res = await api.get("/orders", {
        params: {
          status: activeTab !== "all" ? activeTab : undefined
        }
      });
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token")
  });

  // 4. Mutation to update order status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status, notes }: { orderId: string; status: string; notes: string }) => {
      return api.patch(`/orders/${orderId}/status`, {
        status,
        notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorOrders"] });
      queryClient.invalidateQueries({ queryKey: ["vendorMetrics"] });
      success("Order status updated successfully!");
    },
    onError: (err: any) => {
      showError("Update Failed", "Failed to update order: " + (err.response?.data?.detail || err.message));
    }
  });

  const vendorProfile = vendorProfileData || null;
  const businessName = vendorProfile?.business_name || "Green Grocers Ltd";
  const vendorStatus = vendorProfile?.status || "pending";

  const metrics = metricsData || {
    total_sales: 0,
    total_orders: 0,
    wallet_balance: 0,
    pending_balance: 0
  };

  const orders = ordersData || [];

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-[#090d10] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 antialiased font-sans flex transition-colors duration-200">
      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden font-sans">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          {/* Drawer Content */}
          <aside className="relative w-64 max-w-xs bg-slate-900 text-slate-300 flex flex-col justify-between p-6 border-r border-slate-800 h-full">
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="/logo_horizontal.png" alt="Sbjiwala Logo" className="h-6 w-auto object-contain brightness-0 invert" />
                  <span className="text-[9px] uppercase tracking-wider bg-slate-800 text-slate-400 font-bold px-1.5 py-0.5 rounded">
                    Vendor
                  </span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1">
                <button
                  onClick={() => { setCurrentView("dashboard"); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left font-medium text-sm transition-all cursor-pointer ${
                    currentView === "dashboard" ? "bg-slate-800 text-white" : "hover:bg-slate-800/50 hover:text-white text-slate-400"
                  }`}
                >
                  <ShoppingBag className="w-5 h-5" />
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={() => { setCurrentView("inventory"); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left font-medium text-sm transition-all cursor-pointer ${
                    currentView === "inventory" ? "bg-slate-800 text-white" : "hover:bg-slate-800/50 hover:text-white text-slate-400"
                  }`}
                >
                  <TrendingUp className="w-5 h-5" />
                  <span>Inventory</span>
                </button>
                <button
                  onClick={() => { setCurrentView("service-area"); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left font-medium text-sm transition-all cursor-pointer ${
                    currentView === "service-area" ? "bg-slate-800 text-white" : "hover:bg-slate-800/50 hover:text-white text-slate-400"
                  }`}
                >
                  <MapPin className="w-5 h-5" />
                  <span>Service Area</span>
                </button>
                <button
                  onClick={() => { setCurrentView("settings"); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left font-medium text-sm transition-all cursor-pointer ${
                    currentView === "settings" ? "bg-slate-800 text-white" : "hover:bg-slate-800/50 hover:text-white text-slate-400"
                  }`}
                >
                  <Settings className="w-5 h-5" />
                  <span>Settings</span>
                </button>
              </nav>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-850 rounded-xl p-4 space-y-1 border border-slate-800">
                <p className="text-xs text-slate-550">Log in as</p>
                <h4 className="text-sm font-bold text-white">{businessName}</h4>
                <span 
                  className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded cursor-pointer ${
                    vendorStatus === "approved"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : vendorStatus === "documents_submitted" || vendorStatus === "under_review"
                      ? "bg-blue-500/10 text-blue-400"
                      : "bg-rose-500/10 text-rose-400 hover:underline"
                  }`}
                  onClick={() => {
                    if (vendorStatus !== "approved") window.location.href = "/kyc";
                  }}
                >
                  {vendorStatus.toUpperCase()}
                </span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-slate-500 font-mono tracking-wider">
                  Sbjiwala v{versionInfo.version}
                </span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col justify-between p-6 border-r border-slate-800 flex-shrink-0">
        <div className="space-y-8">
          <div className="flex items-center gap-2">
            <img src="/logo_horizontal.png" alt="Sbjiwala Logo" className="h-6 w-auto object-contain brightness-0 invert" />
            <span className="text-[10px] uppercase tracking-wider bg-slate-800 text-slate-450 font-bold px-2 py-0.5 rounded">
              Vendor
            </span>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setCurrentView("dashboard")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left font-medium text-sm transition-all cursor-pointer ${
                currentView === "dashboard" ? "bg-slate-800 text-white" : "hover:bg-slate-800/50 hover:text-white text-slate-400"
              }`}
            >
              <ShoppingBag className="w-5 h-5" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setCurrentView("inventory")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left font-medium text-sm transition-all cursor-pointer ${
                currentView === "inventory" ? "bg-slate-800 text-white" : "hover:bg-slate-800/50 hover:text-white text-slate-400"
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              <span>Inventory</span>
            </button>
            <button
              onClick={() => setCurrentView("service-area")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left font-medium text-sm transition-all cursor-pointer ${
                currentView === "service-area" ? "bg-slate-800 text-white" : "hover:bg-slate-800/50 hover:text-white text-slate-400"
              }`}
            >
              <MapPin className="w-5 h-5" />
              <span>Service Area</span>
            </button>
            <button
              onClick={() => setCurrentView("settings")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left font-medium text-sm transition-all cursor-pointer ${
                currentView === "settings" ? "bg-slate-800 text-white" : "hover:bg-slate-800/50 hover:text-white text-slate-400"
              }`}
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        <div className="space-y-3">
          <div className="bg-slate-850 rounded-xl p-4 space-y-1 border border-slate-800">
            <p className="text-xs text-slate-550">Log in as</p>
            <h4 className="text-sm font-bold text-white">{businessName}</h4>
            <span 
              className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded cursor-pointer ${
                vendorStatus === "approved"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : vendorStatus === "documents_submitted" || vendorStatus === "under_review"
                  ? "bg-blue-500/10 text-blue-400"
                  : "bg-rose-500/10 text-rose-400 hover:underline"
              }`}
              onClick={() => {
                if (vendorStatus !== "approved") window.location.href = "/kyc";
              }}
            >
              {vendorStatus.toUpperCase()}
            </span>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-slate-500 font-mono tracking-wider">
              Sbjiwala v{versionInfo.version}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between shadow-sm transition-colors duration-200 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            {/* Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-355"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-2 md:hidden">
              <img src="/logo_horizontal.png" alt="Sbjiwala Logo" className="h-7 w-auto object-contain" />
              <span className="text-[9px] uppercase bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold px-1.5 py-0.5 rounded-full">
                Vendor
              </span>
            </div>

            <h2 className="text-base md:text-lg font-black text-slate-800 dark:text-slate-100 hidden md:block">
              Store Performance Overview
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
              <span>Accepting Orders: 09:00 AM - 09:00 PM</span>
            </div>

            {/* Custom Theme Switcher */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-500/30"
              title={theme === "light" ? "Switch to Dark Soil Mode" : "Switch to Light Veggie Mode"}
            >
              {theme === "light" ? (
                <span className="text-sm" role="img" aria-label="light mode">🍋</span>
              ) : (
                <span className="text-sm" role="img" aria-label="dark mode">🍆</span>
              )}
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-8 space-y-8 max-w-6xl w-full mx-auto overflow-x-hidden">
          {vendorStatus !== "approved" && (
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-amber-500/10 dark:from-amber-955/20 dark:to-amber-955/20 border border-amber-300 dark:border-amber-900/60 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm backdrop-blur-sm">
              <div className="space-y-1">
                <h4 className="text-sm font-black text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  ⚠️ Action Required: Complete Store KYC
                </h4>
                <p className="text-xs text-slate-600 dark:text-amber-400/80 mt-0.5">
                  {vendorStatus === "rejected"
                    ? `Verification rejected: "${vendorProfile?.rejection_reason || 'Please upload valid documents'}"`
                    : vendorStatus === "documents_submitted" || vendorStatus === "under_review"
                    ? "Your verification documents are currently being reviewed by admin officers."
                    : "Your store profile is pending document verification. Verify PAN, FSSAI, and business credentials."}
                </p>
              </div>
              {vendorStatus !== "documents_submitted" && vendorStatus !== "under_review" && (
                <a
                  href="/kyc"
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-black px-5 py-3 rounded-xl transition-all shadow-sm flex-shrink-0"
                >
                  Verify Documents Now
                </a>
              )}
            </div>
          )}

          {currentView === "dashboard" ? (
            <>
              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6 flex items-center justify-between shadow-sm transition-colors duration-200">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Sales</p>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50">₹{metrics.total_sales}</h3>
                  </div>
                  <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl text-emerald-600 dark:text-emerald-400">
                    <DollarSign className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6 flex items-center justify-between shadow-sm transition-colors duration-200">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Orders Fulfilled</p>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50">{metrics.total_orders}</h3>
                  </div>
                  <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 rounded-2xl text-blue-600 dark:text-blue-400">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6 flex items-center justify-between shadow-sm transition-colors duration-200">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Wallet Balance</p>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50">₹{metrics.wallet_balance}</h3>
                  </div>
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-2xl text-amber-500 dark:text-amber-400">
                    <Award className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6 flex items-center justify-between shadow-sm transition-colors duration-200">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Pending Balance</p>
                    <h3 className="text-2xl font-black text-rose-600 dark:text-rose-455">₹{metrics.pending_balance}</h3>
                  </div>
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 rounded-2xl text-rose-600 dark:text-rose-400">
                    <RefreshCw className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Orders Section */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-200">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-0.5">
                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Incoming Orders</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Real-time customer requests needing dispatch</p>
                  </div>

                  {/* Status Filter Tabs */}
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-full border border-slate-205 dark:border-slate-700 text-xs font-semibold">
                    {["all", "pending", "packed", "delivered"].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-1.5 rounded-full capitalize transition-all ${activeTab === tab
                          ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-205"
                          }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Orders List */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ordersLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
                      <span className="text-sm text-slate-500 dark:text-slate-400">Fetching store orders...</span>
                    </div>
                  ) : orders.length > 0 ? (
                    orders.map((order: any) => (
                      <div key={order.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-all">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 dark:text-slate-100">#Order {order.order_number}</span>
                            <span className="text-slate-400 dark:text-slate-550 text-xs">•</span>
                            <span className="text-xs text-slate-500 dark:text-slate-450">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Customer ID: {order.user_id.substring(0, 8)}...</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-450">Method: {order.payment_method.toUpperCase()} • Status: {order.payment_status}</p>
                        </div>

                        <div className="flex items-center gap-6 self-stretch md:self-auto justify-between">
                                                    <span className={`inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              order.status === "pending"
                                ? "bg-amber-100 dark:bg-amber-955/40 text-amber-800 dark:text-amber-400"
                                : order.status === "confirmed"
                                  ? "bg-purple-100 dark:bg-purple-955/40 text-purple-800 dark:text-purple-400"
                                  : order.status === "accepted"
                                    ? "bg-teal-100 dark:bg-teal-955/40 text-teal-800 dark:text-teal-400"
                                    : order.status === "packed"
                                      ? "bg-blue-100 dark:bg-blue-955/40 text-blue-800 dark:text-blue-400"
                                      : order.status === "assigned"
                                        ? "bg-indigo-100 dark:bg-indigo-955/40 text-indigo-800 dark:text-indigo-400"
                                        : "bg-emerald-100 dark:bg-emerald-955/40 text-emerald-800 dark:text-emerald-400"
                            }`}>
                              {order.status}
                            </span>
 
                          {order.status === "pending" && (
                            <button
                              disabled
                              className="bg-slate-100 dark:bg-slate-800 text-slate-405 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm"
                            >
                              Awaiting Payment
                            </button>
                          )}
                          {(order.status === "confirmed" || order.status === "assigned") && (
                            <button
                              onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: "accepted", notes: "Order accepted by vendor" })}
                              disabled={updateStatusMutation.isPending}
                              className="bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50"
                            >
                              {updateStatusMutation.isPending ? "Accepting..." : "Accept Order"}
                            </button>
                          )}
                          {order.status === "accepted" && (
                            <button
                              onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: "packed", notes: "Order packed by vendor" })}
                              disabled={updateStatusMutation.isPending}
                              className="bg-blue-600 hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50"
                            >
                              {updateStatusMutation.isPending ? "Packing..." : "Mark as Packed"}
                            </button>
                          )}
                          {order.status === "packed" && (
                            <span className="text-xs font-bold text-slate-500">Ready for Pickup</span>
                          )}
                          {order.status === "assigned" && (
                            <span className="text-xs font-bold text-indigo-500">Driver Assigned</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
                      No orders found matching this status.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : currentView === "service-area" ? (
            <ServiceAreaPanel />
          ) : currentView === "inventory" ? (
            <InventoryPanel vendorId={vendorProfile?.id} />
          ) : (
            <SettingsPanel vendor={vendorProfile} />
          )}
        </main>
      </div>

      {/* Geolocation Permission Request Modal */}
      {showPermissionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full animate-scale-in text-slate-800 dark:text-white space-y-4 shadow-2xl text-center font-sans">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-455 mx-auto">
              <MapPin className="w-8 h-8 animate-bounce" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black tracking-tight">Location Access Required 🏪</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Provide location access to pinpoint your shop address on OpenStreetMap and configure your active delivery service area accurately.
              </p>
            </div>
            
            <div className="text-xs font-semibold text-slate-655 dark:text-slate-355 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 text-left">
              <p className="flex items-center gap-2">
                <span className="text-emerald-500">✔</span>
                <span>Calibrate your store coordinates on Leaflet map picker</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="text-emerald-500">✔</span>
                <span>Determine service range radius overlays correctly</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="text-emerald-500">✔</span>
                <span>Inform couriers of precise pickup location point</span>
              </p>
            </div>

            <button
              onClick={() => {
                if (typeof window !== "undefined" && "geolocation" in navigator) {
                  navigator.geolocation.getCurrentPosition(
                    () => {
                      setShowPermissionModal(false);
                      window.location.reload();
                    },
                    () => {
                      showError("Permission Denied", "Location permission was denied. Please enable location permissions in browser site settings.");
                    }
                  );
                }
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-2xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer animate-pulse"
            >
              Enable Location Access
            </button>
            
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              Note: Geolocation permissions can be toggled any time in browser settings.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
