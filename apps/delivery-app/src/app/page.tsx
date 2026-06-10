"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Navigation, CheckCircle2, AlertCircle, ShoppingBag,
  MapPin, ToggleLeft, ToggleRight, Wallet, Loader2, Clock,
  Home, History, IndianRupee, User, ArrowRight, ArrowUpRight,
  Bike, Star, BadgeCheck, X, ChevronRight, Phone, Building,
  CreditCard, Send, Package, AlertTriangle, RefreshCw
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import versionInfo from "./version.json";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/index";

// =========== OTP MODAL ===========
function OtpPromptModal({
  isOpen, title, message, onConfirm, onCancel, loading
}: {
  isOpen: boolean; title: string; message: string;
  onConfirm: (otp: string) => void; onCancel: () => void; loading?: boolean;
}) {
  const [otp, setOtp] = useState("");
  useEffect(() => { if (isOpen) setOtp(""); }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-in text-center shadow-2xl text-slate-800 dark:text-white">
        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center mx-auto">
          <Package className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-base font-black uppercase tracking-wider">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">{message}</p>
        <div className="space-y-1.5">
          <input
            type="text" maxLength={4} pattern="[0-9]*" inputMode="numeric"
            value={otp} onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-full text-center tracking-[1.5em] pl-[1.5em] py-3 text-2xl font-black border-2 border-slate-200 dark:border-slate-700 rounded-2xl bg-transparent focus:outline-none focus:border-emerald-500 transition-colors"
            placeholder="••••" disabled={loading}
          />
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="primary" onClick={() => { if (otp.length === 4) onConfirm(otp); }}
            disabled={otp.length !== 4 || loading} loading={loading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold">
            Verify & Deliver
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={loading}
            className="flex-1 py-3 text-xs cursor-pointer font-bold">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// =========== DELIVERY TRACKING MAP ===========
function DeliveryTrackingMap({ order, currentPos, simulationMode, setSimulationMode, distanceInfo }: {
  order: any; currentPos: [number, number]; simulationMode: boolean;
  setSimulationMode: (val: boolean) => void; distanceInfo: string;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapObj, setMapObj] = useState<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const pathLineRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current || !order) return;
    let map: any = null;
    let active = true;
    import("leaflet").then((L) => {
      if (!active || !mapContainerRef.current) return;
      if ((mapContainerRef.current as any)._leaflet_id) return;
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });
      const customerLat = order.delivery_address?.latitude || 19.0735;
      const customerLng = order.delivery_address?.longitude || 72.9985;
      const storeLat = 19.0760; const storeLng = 72.9977;
      map = L.map(mapContainerRef.current!).setView([storeLat, storeLng], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);
      const homeIcon = L.divIcon({ html: '<div style="background:#ef4444;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🏠</div>', iconSize: [32, 32], iconAnchor: [16, 16] });
      L.marker([customerLat, customerLng], { icon: homeIcon }).addTo(map).bindPopup("Delivery Address");
      const storeIcon = L.divIcon({ html: '<div style="background:#3b82f6;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🏪</div>', iconSize: [32, 32], iconAnchor: [16, 16] });
      L.marker([storeLat, storeLng], { icon: storeIcon }).addTo(map).bindPopup("Store");
      const driverIcon = L.divIcon({ html: '<div style="background:#10b981;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3)">🛵</div>', iconSize: [36, 36], iconAnchor: [18, 18] });
      const driverMarker = L.marker(currentPos, { icon: driverIcon }).addTo(map);
      driverMarkerRef.current = driverMarker;
      L.polyline([[storeLat, storeLng], [customerLat, customerLng]], { color: "#cbd5e1", weight: 2, dashArray: "4 4" }).addTo(map);
      pathLineRef.current = L.polyline([currentPos, [customerLat, customerLng]], { color: "#10b981", weight: 4 }).addTo(map);
      map.fitBounds([[storeLat, storeLng], [customerLat, customerLng]], { padding: [40, 40] });
      setMapObj(map);
    });
    return () => { active = false; if (map) map.remove(); };
  }, [order]);

  useEffect(() => {
    if (mapObj && driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng(currentPos);
      if (pathLineRef.current && order) {
        const customerLat = order.delivery_address?.latitude || 19.0735;
        const customerLng = order.delivery_address?.longitude || 72.9985;
        pathLineRef.current.setLatLngs([currentPos, [customerLat, customerLng]]);
      }
    }
  }, [currentPos, mapObj, order]);

  return (
    <div className="space-y-3">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 flex-wrap gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
          <Navigation className="w-4 h-4 text-emerald-600 dark:text-emerald-450 animate-bounce" />
          <span>{distanceInfo}</span>
        </div>
        <button onClick={() => setSimulationMode(!simulationMode)}
          className={`px-3 py-1 rounded-xl font-bold transition-all border ${simulationMode
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          } cursor-pointer`}>
          {simulationMode ? "Simulated GPS 🛰️" : "Device GPS 📍"}
        </button>
      </div>
      <div ref={mapContainerRef} className="h-48 rounded-2xl border border-slate-200 dark:border-slate-800 relative shadow-inner overflow-hidden" style={{ zIndex: 1 }} />
    </div>
  );
}

// =========== ACTIVE ORDERS TAB ===========
function ActiveOrdersTab({ assignments, assignmentsLoading, isOnline, globalPos, simulationMode, setSimulationMode, distanceInfo, handleUpdateStatus, pickupOrderMutation, deliverOrderMutation }: any) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
          Active Deliveries ({assignments.length})
        </h3>
        {!isOnline && (
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 px-2 py-0.5 rounded-full flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> Go Online to get orders
          </span>
        )}
      </div>
      <div className="space-y-4">
        {assignmentsLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
            <span className="text-sm text-slate-500 font-semibold">Checking assignments...</span>
          </div>
        ) : isOnline && assignments.length > 0 ? (
          assignments.map((task: any) => {
            const destAddr = task.delivery_address || {};
            const formattedAddr = destAddr.formatted_address || `${destAddr.address_line_1 || ""}, ${destAddr.city || ""}`;
            const isCOD = task.payment_method === "cod";
            return (
              <div key={task.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400">#{task.order_number}</span>
                      <h4 className="font-extrabold text-slate-900 dark:text-slate-50">{destAddr.full_name || "Customer"}</h4>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                        task.status === "assigned" || task.status === "packed"
                          ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400"
                          : "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400"
                      }`}>{task.status}</span>
                      {isCOD && (
                        <span className="text-[10px] font-bold bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full">
                          💵 COD ₹{task.total_amount}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-350">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{destAddr.address_line_1 || "Pickup Store"}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-450 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-500 dark:text-slate-400">{formattedAddr}</span>
                    </div>
                  </div>

                  {task.status === "out_for_delivery" && (
                    <DeliveryTrackingMap
                      order={task} currentPos={globalPos}
                      simulationMode={simulationMode} setSimulationMode={setSimulationMode}
                      distanceInfo={distanceInfo}
                    />
                  )}

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        {isCOD ? "Collect Cash" : "Prepaid"}
                      </span>
                      <span className="font-black text-slate-900 dark:text-slate-50 text-sm">
                        {isCOD ? `₹${task.total_amount}` : "✓ Online Paid"}
                      </span>
                    </div>
                    <button
                      onClick={() => handleUpdateStatus(task.id, task.status)}
                      disabled={
                        pickupOrderMutation.isPending ||
                        deliverOrderMutation.isPending ||
                        (task.status === "assigned" || task.status === "accepted" || task.status === "confirmed")
                      }
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 flex items-center gap-1.5"
                    >
                      {task.status === "assigned" || task.status === "accepted" || task.status === "confirmed"
                        ? "Waiting for store to pack"
                        : task.status === "packed"
                          ? <><Package className="w-3.5 h-3.5" /> Confirm Pickup</>
                          : <><CheckCircle2 className="w-3.5 h-3.5" /> Verify OTP & Deliver</>}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
              <ShoppingBag className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-sm text-slate-500 font-medium">
              {isOnline ? "No active assignments right now." : "Toggle Online to start receiving orders."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// =========== HISTORY TAB ===========
function HistoryTab() {
  const { data: history = [], isLoading } = useQuery<any[]>({
    queryKey: ["deliveryHistory"],
    queryFn: async () => {
      const res = await api.get("/delivery/history");
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
  });

  if (isLoading) {
    return (
      <div className="py-16 flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <span className="text-sm text-slate-500">Loading history...</span>
      </div>
    );
  }

  if (!history.length) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
          <History className="w-8 h-8 text-slate-300 dark:text-slate-600" />
        </div>
        <p className="text-sm text-slate-500 font-medium">No completed deliveries yet.</p>
        <p className="text-xs text-slate-400">Your delivery history will appear here once you complete orders.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-base font-black text-slate-800 dark:text-slate-100 px-1">
        Delivery History ({history.length})
      </h3>
      <div className="space-y-2">
        {history.map((item: any) => (
          <div key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">#{item.order_number}</p>
                <p className="text-xs text-slate-500">{item.delivery_address?.city || "Delivery"}</p>
                <p className="text-[10px] text-slate-400">{item.delivered_at ? new Date(item.delivered_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">₹{item.total_amount}</p>
              <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">Delivered</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =========== EARNINGS TAB ===========
function EarningsTab({ profile }: { profile: any }) {
  const walletBalance = profile?.wallet_balance ?? 0;
  const cashInHand = profile?.cash_in_hand ?? 0;
  const todayEarnings = profile?.today_earnings ?? 0;
  const totalDeliveries = profile?.total_deliveries ?? 0;

  const { data: transactions = [] } = useQuery<any[]>({
    queryKey: ["deliveryEarnings"],
    queryFn: async () => {
      const res = await api.get("/delivery/earnings");
      return res.data || [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
  });

  return (
    <div className="space-y-4">
      <h3 className="text-base font-black text-slate-800 dark:text-slate-100 px-1">Earnings Overview</h3>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white">
          <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-wider">Wallet Balance</p>
          <p className="text-2xl font-black mt-1">₹{walletBalance.toFixed(2)}</p>
          <p className="text-emerald-200 text-[10px] mt-1">Available to withdraw</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Cash In Hand</p>
          <p className="text-2xl font-black mt-1 text-slate-900 dark:text-white">₹{cashInHand.toFixed(2)}</p>
          <p className="text-slate-400 text-[10px] mt-1">COD collected</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Today's Earnings</p>
          <p className="text-lg font-black text-amber-600 dark:text-amber-400">₹{todayEarnings.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Deliveries</p>
          <p className="text-lg font-black text-blue-600 dark:text-blue-400">{totalDeliveries}</p>
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-2 px-1">Recent Transactions</h4>
        {transactions.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
            <IndianRupee className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No transactions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((txn: any) => (
              <div key={txn.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${txn.type === "credit" ? "bg-emerald-100 dark:bg-emerald-950/30" : "bg-rose-100 dark:bg-rose-950/30"}`}>
                    <IndianRupee className={`w-4 h-4 ${txn.type === "credit" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-white">{txn.description || "Delivery Earning"}</p>
                    <p className="text-[10px] text-slate-400">{new Date(txn.created_at).toLocaleDateString("en-IN")}</p>
                  </div>
                </div>
                <p className={`text-sm font-black ${txn.type === "credit" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {txn.type === "credit" ? "+" : "-"}₹{txn.amount?.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =========== PAYOUT TAB ===========
function PayoutTab({ profile }: { profile: any }) {
  const { success, error: showError } = useToast();
  const walletBalance = profile?.wallet_balance ?? 0;
  const [payoutMethod, setPayoutMethod] = useState<"upi" | "bank">("upi");
  const [upiId, setUpiId] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePayout = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      showError("Invalid Amount", "Please enter a valid payout amount.");
      return;
    }
    if (parseFloat(amount) > walletBalance) {
      showError("Insufficient Balance", "Payout amount exceeds your wallet balance.");
      return;
    }
    if (payoutMethod === "upi" && !upiId) {
      showError("UPI Required", "Please enter your UPI ID.");
      return;
    }
    if (payoutMethod === "bank" && (!accountNo || !ifscCode || !accountName)) {
      showError("Bank Details Required", "Please fill all bank details.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/delivery/payout", {
        amount: parseFloat(amount),
        method: payoutMethod,
        upi_id: payoutMethod === "upi" ? upiId : undefined,
        bank_name: payoutMethod === "bank" ? bankName : undefined,
        account_number: payoutMethod === "bank" ? accountNo : undefined,
        ifsc_code: payoutMethod === "bank" ? ifscCode : undefined,
        account_holder_name: payoutMethod === "bank" ? accountName : undefined,
      });
      success("Payout Requested! 🎉", `₹${amount} payout request submitted. Usually processed within 24–48 hrs.`);
      setAmount("");
    } catch (err: any) {
      showError("Payout Failed", err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Withdraw Earnings</h3>
        <p className="text-xs text-slate-500 mt-0.5">Transfer your wallet balance to your bank account or UPI</p>
      </div>

      {/* Available Balance */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white">
        <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider">Available to Withdraw</p>
        <p className="text-3xl font-black mt-1">₹{walletBalance.toFixed(2)}</p>
        <p className="text-emerald-200 text-xs mt-1">Wallet Balance</p>
      </div>

      {/* Amount Input */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
        <label className="text-xs font-bold text-slate-500 uppercase">Withdrawal Amount (₹)</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-500">₹</span>
          <input
            type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00" min={1} max={walletBalance}
            className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-lg font-black text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex gap-2">
          {[100, 200, 500].filter(p => p <= walletBalance).map(p => (
            <button key={p} onClick={() => setAmount(String(p))}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${parseFloat(amount) === p ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"}`}>
              ₹{p}
            </button>
          ))}
          {walletBalance > 0 && (
            <button onClick={() => setAmount(String(walletBalance.toFixed(2)))}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${parseFloat(amount) === walletBalance ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"}`}>
              All
            </button>
          )}
        </div>
      </div>

      {/* Method Toggle */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {(["upi", "bank"] as const).map(method => (
            <button key={method} onClick={() => setPayoutMethod(method)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${payoutMethod === method ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"}`}>
              {method === "upi" ? "📱 UPI" : "🏦 Bank Transfer"}
            </button>
          ))}
        </div>

        {payoutMethod === "upi" ? (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">UPI ID</label>
            <input type="text" value={upiId} onChange={e => setUpiId(e.target.value)}
              placeholder="yourname@upi"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Account Holder Name</label>
                <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)}
                  placeholder="Full Name" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Bank Name</label>
                <input type="text" value={bankName} onChange={e => setBankName(e.target.value)}
                  placeholder="e.g. SBI" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Account Number</label>
              <input type="text" value={accountNo} onChange={e => setAccountNo(e.target.value)}
                placeholder="Enter account number"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">IFSC Code</label>
              <input type="text" value={ifscCode} onChange={e => setIfscCode(e.target.value.toUpperCase())}
                placeholder="e.g. SBIN0001234" maxLength={11}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 uppercase" />
            </div>
          </div>
        )}

        <button onClick={handlePayout} disabled={loading || !amount || parseFloat(amount) <= 0}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {loading ? "Processing..." : "Request Payout"}
        </button>
        <p className="text-[10px] text-center text-slate-400">Payouts are processed within 24–48 hours on business days.</p>
      </div>
    </div>
  );
}

// =========== PROFILE TAB ===========
function ProfileTab({ profile, onLogout }: { profile: any; onLogout: () => void }) {
  const vehicleTypes: Record<string, string> = {
    scooty: "🛵 Scooty",
    bike: "🏍️ Bike",
    bicycle: "🚲 Bicycle",
    truck: "🚚 Truck",
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    approved: { label: "Verified ✓", color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400" },
    pending: { label: "Pending Review", color: "text-amber-600 bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400" },
    rejected: { label: "Action Required", color: "text-rose-600 bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400" },
  };

  const status = statusConfig[profile?.kyc_status || "pending"];
  const rating = profile?.average_rating ?? 4.8;
  const totalDeliveries = profile?.total_deliveries ?? 0;

  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-3xl">
            🧑‍🦱
          </div>
          <div>
            <h3 className="text-lg font-black">{profile?.full_name || "Delivery Partner"}</h3>
            <p className="text-slate-400 text-xs">{profile?.phone || ""}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs font-bold bg-white/10 px-2 py-0.5 rounded-full">
                {vehicleTypes[profile?.vehicle_type || "scooty"] || "🛵 Scooty"}
              </span>
              {profile?.vehicle_number && (
                <span className="text-xs font-mono text-slate-300">{profile.vehicle_number}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Star className="w-4 h-4 text-amber-500 fill-current" />
            <span className="text-lg font-black text-slate-900 dark:text-white">{rating.toFixed(1)}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase">Rating</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-center">
          <p className="text-lg font-black text-slate-900 dark:text-white">{totalDeliveries}</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase">Deliveries</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-center">
          <div className={`text-xs font-bold px-2 py-1 rounded-lg ${status.color}`}>
            {status.label}
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">KYC</p>
        </div>
      </div>

      {/* Info List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
        {[
          { icon: Phone, label: "Phone", value: profile?.phone || "Not set" },
          { icon: Bike, label: "Vehicle", value: vehicleTypes[profile?.vehicle_type || "scooty"] || "Scooty" },
          { icon: BadgeCheck, label: "KYC Status", value: status.label },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Icon className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-white">{value}</span>
          </div>
        ))}
      </div>

      {/* Logout */}
      <button onClick={onLogout}
        className="w-full bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-bold py-3 rounded-2xl border border-rose-200 dark:border-rose-900/40 transition-all text-sm">
        Log Out
      </button>

      <p className="text-center text-[10px] text-slate-400 font-mono">Sbjiwala Delivery v{versionInfo.version}</p>
    </div>
  );
}

// =========== MAIN DASHBOARD ===========
export default function DeliveryAgentDashboard() {
  const { success, error: showError } = useToast();
  const [otpPromptConfig, setOtpPromptConfig] = useState<{ isOpen: boolean; orderId: string } | null>(null);
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeTab, setActiveTab] = useState<"orders" | "history" | "earnings" | "payout" | "profile">("orders");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [globalPos, setGlobalPos] = useState<[number, number]>([19.0760, 72.9977]);
  const [simulationMode, setSimulationMode] = useState(true);
  const [distanceInfo, setDistanceInfo] = useState<string>("Offline");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isNative = !!(window as any).Capacitor;
    if (isNative) return;
    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" as any }).then((result) => {
        if (result.state !== "granted") setShowPermissionModal(true);
      }).catch(() => { });
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("sw_theme", nextTheme);
    if (nextTheme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  };

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("sw_access_token")) {
      window.location.href = "/delivery/login";
    }
  }, []);

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<any[]>({
    queryKey: ["deliveryAssignments"],
    queryFn: async () => { const res = await api.get("/delivery/assignments"); return res.data || []; },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
  });

  const { data: profileData } = useQuery<any>({
    queryKey: ["deliveryProfile"],
    queryFn: async () => { const res = await api.get("/delivery/me"); return res.data; },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("sw_access_token"),
  });

  // GPS / Simulation
  useEffect(() => {
    if (!isOnline) { setDistanceInfo("Offline"); return; }
    const activeDelivery = assignments.find((a: any) => a.status === "out_for_delivery");
    if (simulationMode) {
      if (activeDelivery) {
        const storeLat = 19.0760; const storeLng = 72.9977;
        const customerLat = activeDelivery.delivery_address?.latitude || 19.0735;
        const customerLng = activeDelivery.delivery_address?.longitude || 72.9985;
        let step = 0;
        const interval = setInterval(() => {
          step = (step + 1) % 31;
          const ratio = step / 30;
          setGlobalPos([storeLat + (customerLat - storeLat) * ratio, storeLng + (customerLng - storeLng) * ratio]);
          setDistanceInfo(`${(2.4 * (1 - ratio)).toFixed(2)} km left to customer`);
        }, 3050);
        return () => clearInterval(interval);
      } else {
        const interval = setInterval(() => {
          setGlobalPos(([lat, lng]) => {
            const nl = lat + (Math.random() - 0.5) * 0.0003;
            const nn = lng + (Math.random() - 0.5) * 0.0003;
            if (Math.abs(nl - 19.0760) > 0.015 || Math.abs(nn - 72.9977) > 0.015) return [19.0760, 72.9977];
            return [nl, nn];
          });
          setDistanceInfo("Simulating GPS...");
        }, 4000);
        return () => clearInterval(interval);
      }
    } else {
      if (typeof window === "undefined" || !navigator.geolocation) return;
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setGlobalPos([pos.coords.latitude, pos.coords.longitude]);
          setDistanceInfo("Streaming live GPS...");
        },
        () => setDistanceInfo("GPS error"),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [simulationMode, isOnline, assignments]);

  // WebSocket
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sw_access_token") : null;
    if (!isOnline || !token || typeof window === "undefined") {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      return;
    }
    let ws: WebSocket; let reconnectTimeout: any;
    const connectWS = () => {
      const apiBase = api.client.defaults.baseURL || "/api/v1";
      let baseHost = ""; let protocol = "ws:";
      if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
        const url = new URL(apiBase);
        baseHost = url.host; protocol = url.protocol === "https:" ? "wss:" : "ws:";
      } else {
        baseHost = window.location.host;
        protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      }
      ws = new WebSocket(`${protocol}//${baseHost}/ws?token=${token}`);
      wsRef.current = ws;
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "order_status_update") {
            queryClient.invalidateQueries({ queryKey: ["deliveryAssignments"] });
            if (message.data?.status === "assigned") {
              success("New Delivery Assigned! 🛵", `Order #${message.data?.order_number || ""} has been assigned to you.`);
            } else if (message.data?.status === "packed") {
              success("Order Packed! 📦", `Order #${message.data?.order_number || ""} is now ready for pickup.`);
            }
          }
        } catch (err) {
          console.error("Error parsing delivery WS message:", err);
        }
      };
      ws.onclose = () => { reconnectTimeout = setTimeout(connectWS, 5000); };
      ws.onerror = () => ws.close();
    };
    connectWS();
    return () => { if (ws) ws.close(); if (reconnectTimeout) clearTimeout(reconnectTimeout); wsRef.current = null; };
  }, [isOnline]);

  // Send location via WS
  useEffect(() => {
    if (!isOnline || !wsRef.current) return;
    const interval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const activeDelivery = assignments?.find((a: any) => a.status === "out_for_delivery");
        wsRef.current.send(JSON.stringify({
          type: "location_update",
          data: {
            latitude: globalPos[0],
            longitude: globalPos[1],
            accuracy: 10,
            speed: 5,
            heading: 0,
            order_id: activeDelivery ? activeDelivery.id : null
          }
        }));
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [globalPos, isOnline, assignments]);

  const toggleOnlineMutation = useMutation({
    mutationFn: async (online: boolean) => api.patch("/delivery/availability", { is_available: online }),
    onSuccess: (_, online) => { setIsOnline(online); queryClient.invalidateQueries({ queryKey: ["deliveryAssignments"] }); }
  });

  const pickupOrderMutation = useMutation({
    mutationFn: async (orderId: string) => api.post(`/delivery/orders/${orderId}/pickup`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["deliveryAssignments"] }); success("Picked up! Now out for delivery."); },
    onError: (err: any) => showError("Pickup Failed", err.response?.data?.detail || err.message)
  });

  const deliverOrderMutation = useMutation({
    mutationFn: async ({ orderId, otp }: { orderId: string; otp: string }) =>
      api.post(`/delivery/orders/${orderId}/deliver`, { order_id: orderId, otp }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryAssignments"] });
      queryClient.invalidateQueries({ queryKey: ["deliveryEarnings"] });
      queryClient.invalidateQueries({ queryKey: ["deliveryProfile"] });
      success("Order delivered! Payment captured.");
      setOtpPromptConfig(null);
    },
    onError: (err: any) => showError("Delivery Failed", err.response?.data?.detail || err.message)
  });

  const handleUpdateStatus = (id: string, currentStatus: string) => {
    if (currentStatus === "assigned" || currentStatus === "packed" || currentStatus === "accepted") {
      pickupOrderMutation.mutate(id);
    } else {
      setOtpPromptConfig({ isOpen: true, orderId: id });
    }
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("sw_access_token");
      localStorage.removeItem("sw_refresh_token");
      window.location.href = "/login";
    }
  };

  const profile = profileData || null;

  const TABS = [
    { id: "orders", icon: Home, label: "Orders", badge: isOnline ? assignments.length : 0 },
    { id: "history", icon: History, label: "History" },
    { id: "earnings", icon: IndianRupee, label: "Earnings" },
    { id: "payout", icon: ArrowUpRight, label: "Payout" },
    { id: "profile", icon: User, label: "Profile" },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 antialiased font-sans flex flex-col transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-lg">🛵</span>
            </div>
            <div>
              <p className="text-xs font-black text-slate-900 dark:text-white leading-none">Sbjiwala</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Delivery Partner</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:scale-105 transition-all">
              <span className="text-sm">{theme === "light" ? "🌙" : "☀️"}</span>
            </button>
            {/* Online toggle */}
            <button onClick={() => toggleOnlineMutation.mutate(!isOnline)}
              disabled={toggleOnlineMutation.isPending}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                isOnline
                  ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
              } disabled:opacity-50`}>
              {isOnline
                ? <><ToggleRight className="w-4 h-4" /> ONLINE</>
                : <><ToggleLeft className="w-4 h-4" /> OFFLINE</>
              }
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md w-full mx-auto px-4 py-4 space-y-4 flex-1 pb-24">
        {activeTab === "orders" && (
          <ActiveOrdersTab
            assignments={assignments} assignmentsLoading={assignmentsLoading}
            isOnline={isOnline} globalPos={globalPos}
            simulationMode={simulationMode} setSimulationMode={setSimulationMode}
            distanceInfo={distanceInfo} handleUpdateStatus={handleUpdateStatus}
            pickupOrderMutation={pickupOrderMutation} deliverOrderMutation={deliverOrderMutation}
          />
        )}
        {activeTab === "history" && <HistoryTab />}
        {activeTab === "earnings" && <EarningsTab profile={profile} />}
        {activeTab === "payout" && <PayoutTab profile={profile} />}
        {activeTab === "profile" && <ProfileTab profile={profile} onLogout={handleLogout} />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 safe-area-pb">
        <div className="max-w-md mx-auto flex">
          {TABS.map((tab) => {
          const { id, icon: Icon, label } = tab;
          const badge = (tab as any).badge as number | undefined;
          return (
            <button key={id} onClick={() => setActiveTab(id as any)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 relative transition-colors ${
                activeTab === id
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-400 dark:text-slate-500"
              }`}>
              <div className="relative">
                <Icon className={`w-5 h-5 ${activeTab === id ? "stroke-[2.5]" : ""}`} />
                {badge && badge > 0 ? (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-[9px] font-bold ${activeTab === id ? "" : ""}`}>{label}</span>
              {activeTab === id && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full" />
              )}
            </button>
          );
          })}
        </div>
      </nav>

      {/* Location Permission Modal */}
      {showPermissionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full animate-scale-in text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/40 rounded-2xl flex items-center justify-center mx-auto">
              <Navigation className="w-8 h-8 text-rose-600 dark:text-rose-400 animate-bounce" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Location Required 🛵</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Enable location to receive order assignments, navigate routes, and earn location-based incentives.
            </p>
            <button onClick={() => {
              if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                  () => { setShowPermissionModal(false); window.location.reload(); },
                  () => showError("Denied", "Enable location in browser settings.")
                );
              }
            }} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-2xl text-sm transition-all">
              Enable Location Access
            </button>
          </div>
        </div>
      )}

      <OtpPromptModal
        isOpen={!!otpPromptConfig?.isOpen}
        title="Delivery OTP"
        message="Enter the 4-digit OTP from the customer to confirm delivery."
        loading={deliverOrderMutation.isPending}
        onConfirm={(otp) => { if (otpPromptConfig?.orderId) deliverOrderMutation.mutate({ orderId: otpPromptConfig.orderId, otp }); }}
        onCancel={() => setOtpPromptConfig(null)}
      />
    </div>
  );
}
