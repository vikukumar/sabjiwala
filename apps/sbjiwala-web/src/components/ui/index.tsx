"use client";

import React from "react";
import { Loader2 } from "lucide-react";

// ==================== BUTTON ====================
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "xl";
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const buttonVariants = {
  primary: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md active:scale-95 disabled:bg-emerald-400",
  secondary: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900/50",
  ghost: "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400",
  danger: "bg-rose-600 hover:bg-rose-700 text-white shadow-sm hover:shadow-md active:scale-95 disabled:bg-rose-400",
  outline: "bg-transparent border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800",
};

const buttonSizes = {
  sm: "px-3 py-1.5 text-xs gap-1.5 rounded-lg",
  md: "px-5 py-2.5 text-sm gap-2 rounded-xl",
  lg: "px-6 py-3 text-base gap-2 rounded-xl",
  xl: "px-8 py-4 text-base gap-2 rounded-2xl",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center font-bold transition-all duration-200 cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed select-none
        ${buttonVariants[variant]}
        ${buttonSizes[size]}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : leftIcon ? (
        <span className="flex-shrink-0">{leftIcon}</span>
      ) : null}
      {children}
      {rightIcon && !loading && <span className="flex-shrink-0">{rightIcon}</span>}
    </button>
  );
}

// ==================== INPUT ====================
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  inputSize?: "sm" | "md" | "lg";
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  inputSize = "md",
  className = "",
  id,
  ...props
}: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).slice(2)}`;
  const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-3 text-sm",
    lg: "px-4 py-3.5 text-base",
  };
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          className={`
            input-base
            ${sizes[inputSize]}
            ${leftIcon ? "pl-10" : ""}
            ${rightIcon ? "pr-10" : ""}
            ${error ? "border-rose-400 dark:border-rose-500 focus:border-rose-500 focus:shadow-[0_0_0_3px_rgb(225_29_72/0.1)]" : ""}
            ${className}
          `}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-rose-500 dark:text-rose-400 font-medium">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

// ==================== BADGE ====================
interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "pending" | "outline";
  size?: "sm" | "md";
  className?: string;
}

const badgeVariants = {
  default: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  success: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  danger: "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400",
  info: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
  pending: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  outline: "border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-transparent",
};

export function Badge({ children, variant = "default", size = "md", className = "" }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center font-bold uppercase tracking-wide rounded-full
        ${size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs"}
        ${badgeVariants[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

// ==================== CARD ====================
interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({ children, className = "", hover = false, onClick, padding = "md" }: CardProps) {
  const paddings = { none: "", sm: "p-4", md: "p-6", lg: "p-8" };
  return (
    <div
      onClick={onClick}
      className={`
        card ${paddings[padding]}
        ${hover ? "card-hover cursor-pointer" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

// ==================== SKELETON ====================
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonCard() {
  return (
    <Card>
      <Skeleton className="h-32 w-full mb-4" />
      <Skeleton className="h-4 w-3/4 mb-2" />
      <Skeleton className="h-4 w-1/2" />
    </Card>
  );
}

// ==================== SPINNER ====================
export function Spinner({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizes = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" };
  return (
    <Loader2 className={`animate-spin text-emerald-600 dark:text-emerald-400 ${sizes[size]} ${className}`} />
  );
}

// ==================== EMPTY STATE ====================
interface EmptyStateProps {
  emoji?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ emoji = "📭", title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-4">
      <div className="text-5xl animate-bounce-in">{emoji}</div>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">{title}</h3>
        {description && <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">{description}</p>}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

// ==================== DIVIDER ====================
export function Divider({ label, className = "" }: { label?: string; className?: string }) {
  if (!label) return <hr className={`border-slate-200 dark:border-slate-800 ${className}`} />;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <hr className="flex-1 border-slate-200 dark:border-slate-800" />
      <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
      <hr className="flex-1 border-slate-200 dark:border-slate-800" />
    </div>
  );
}

// ==================== AVATAR ====================
export function Avatar({ name, src, size = "md", className = "" }: { name?: string; src?: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizes = { sm: "w-7 h-7 text-xs", md: "w-9 h-9 text-sm", lg: "w-12 h-12 text-base", xl: "w-16 h-16 text-lg" };
  const initials = name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "?";
  if (src) return <img src={src} alt={name || "avatar"} className={`rounded-full object-cover flex-shrink-0 ${sizes[size]} ${className}`} />;
  return (
    <div className={`rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white font-bold flex items-center justify-center flex-shrink-0 ${sizes[size]} ${className}`}>
      {initials}
    </div>
  );
}

// ==================== SECTION HEADER ====================
export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-50 tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ==================== STAT CARD ====================
export function StatCard({
  title,
  value,
  icon,
  iconBg = "bg-emerald-50 dark:bg-emerald-950/30",
  iconColor = "text-emerald-600 dark:text-emerald-400",
  change,
  changePositive,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  change?: string;
  changePositive?: boolean;
}) {
  return (
    <Card className="flex items-center justify-between">
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-2xl font-black text-slate-900 dark:text-slate-50">{value}</p>
        {change && (
          <p className={`text-xs font-semibold ${changePositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
            {changePositive ? "↑" : "↓"} {change}
          </p>
        )}
      </div>
      <div className={`p-3.5 rounded-2xl ${iconBg} ${iconColor} flex-shrink-0`}>
        {icon}
      </div>
    </Card>
  );
}

// ==================== TABS ====================
interface TabsProps {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className = "" }: TabsProps) {
  return (
    <div className={`flex bg-slate-100 dark:bg-slate-800/60 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold capitalize transition-all
            ${active === tab.id
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }
          `}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              active === tab.id
                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
            }`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
