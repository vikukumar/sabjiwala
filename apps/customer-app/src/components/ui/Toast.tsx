"use client";

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from "react";
import { CheckCircle2, XCircle, AlertCircle, Info, X } from "lucide-react";

// ==================== TYPES ====================
export type ToastType = "success" | "error" | "warning" | "info";
export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}
type ToastAction =
  | { type: "ADD"; toast: Toast }
  | { type: "REMOVE"; id: string };

// ==================== REDUCER ====================
function toastReducer(state: Toast[], action: ToastAction): Toast[] {
  switch (action.type) {
    case "ADD": return [...state, action.toast];
    case "REMOVE": return state.filter((t) => t.id !== action.id);
    default: return state;
  }
}

// ==================== CONTEXT ====================
const ToastContext = createContext<{
  toast: (opts: Omit<Toast, "id">) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
} | null>(null);

// ==================== PROVIDER ====================
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);
  const timerRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const removeToast = useCallback((id: string) => {
    dispatch({ type: "REMOVE", id });
    clearTimeout(timerRefs.current[id]);
    delete timerRefs.current[id];
  }, []);

  const addToast = useCallback((opts: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    dispatch({ type: "ADD", toast: { ...opts, id } });
    timerRefs.current[id] = setTimeout(() => removeToast(id), opts.duration ?? 4000);
  }, [removeToast]);

  const success = useCallback((title: string, message?: string) => addToast({ type: "success", title, message }), [addToast]);
  const error = useCallback((title: string, message?: string) => addToast({ type: "error", title, message, duration: 6000 }), [addToast]);
  const warning = useCallback((title: string, message?: string) => addToast({ type: "warning", title, message }), [addToast]);
  const info = useCallback((title: string, message?: string) => addToast({ type: "info", title, message }), [addToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// ==================== TOAST ITEM ====================
const toastConfig = {
  success: {
    icon: CheckCircle2,
    bg: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60",
    icon_cls: "text-emerald-600 dark:text-emerald-400",
    title_cls: "text-emerald-900 dark:text-emerald-100",
  },
  error: {
    icon: XCircle,
    bg: "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/60",
    icon_cls: "text-rose-600 dark:text-rose-400",
    title_cls: "text-rose-900 dark:text-rose-100",
  },
  warning: {
    icon: AlertCircle,
    bg: "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60",
    icon_cls: "text-amber-600 dark:text-amber-400",
    title_cls: "text-amber-900 dark:text-amber-100",
  },
  info: {
    icon: Info,
    bg: "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/60",
    icon_cls: "text-blue-600 dark:text-blue-400",
    title_cls: "text-blue-900 dark:text-blue-100",
  },
};

const ensureString = (val: any): string => {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    if (Array.isArray(val)) {
      return val.map(v => ensureString(v)).join(", ");
    }
    if (val.message) {
      const msg = ensureString(val.message);
      const issues = val.issues && Array.isArray(val.issues) ? val.issues.join(", ") : "";
      return issues ? `${msg}: ${issues}` : msg;
    }
    if (val.msg) return ensureString(val.msg);
    if (val.detail) return ensureString(val.detail);
    try {
      return JSON.stringify(val);
    } catch (e) {
      return String(val);
    }
  }
  return String(val);
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const cfg = toastConfig[toast.type];
  const Icon = cfg.icon;
  const titleStr = ensureString(toast.title);
  const messageStr = toast.message ? ensureString(toast.message) : undefined;
  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-2xl border shadow-lg backdrop-blur-sm max-w-sm w-full toast-enter ${cfg.bg}`}
      role="alert"
    >
      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${cfg.icon_cls}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${cfg.title_cls}`}>{titleStr}</p>
        {messageStr && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{messageStr}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
      >
        <X className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
      </button>
    </div>
  );
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}
