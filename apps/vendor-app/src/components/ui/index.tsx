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
  const defaultId = React.useId();
  const inputId = id || defaultId;
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

// ==================== CHECKBOX ====================
interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  error?: string;
}

export function Checkbox({ label, error, className = "", id, ...props }: CheckboxProps) {
  const defaultId = React.useId();
  const checkboxId = id || defaultId;
  return (
    <div className="space-y-1">
      <label htmlFor={checkboxId} className="inline-flex items-center gap-2.5 cursor-pointer select-none text-sm font-semibold text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          id={checkboxId}
          className={`
            w-4 h-4 rounded border-slate-350 text-emerald-650 focus:ring-emerald-500
            dark:border-slate-700 dark:bg-slate-900 transition-colors
            cursor-pointer ${className}
          `}
          {...props}
        />
        {label && <span>{label}</span>}
      </label>
      {error && <p className="text-xs text-rose-500 dark:text-rose-400 font-medium">{error}</p>}
    </div>
  );
}

// ==================== RADIO & RADIO GROUP ====================
interface RadioGroupProps {
  children: React.ReactNode;
  value?: string;
  onChange?: (val: string) => void;
  name?: string;
  className?: string;
}

interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  label?: React.ReactNode;
  value: string;
}

const RadioGroupContext = React.createContext<{
  value?: string;
  onChange?: (val: string) => void;
  name?: string;
}>({});

export function RadioGroup({ children, value, onChange, name, className = "" }: RadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ value, onChange, name }}>
      <div className={`space-y-2 ${className}`} role="radiogroup">
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export function Radio({ label, value, className = "", id, ...props }: RadioProps) {
  const context = React.useContext(RadioGroupContext);
  const defaultId = React.useId();
  const radioId = id || defaultId;
  const isChecked = context.value !== undefined ? context.value === value : props.checked;

  return (
    <label htmlFor={radioId} className="inline-flex items-center gap-2.5 cursor-pointer select-none text-sm font-semibold text-slate-700 dark:text-slate-300">
      <input
        type="radio"
        id={radioId}
        name={context.name || props.name}
        value={value}
        checked={isChecked}
        onChange={(e) => context.onChange?.(e.target.value)}
        className={`
          w-4 h-4 border-slate-350 text-emerald-650 focus:ring-emerald-500
          dark:border-slate-700 dark:bg-slate-900 transition-colors
          cursor-pointer ${className}
        `}
        {...props}
      />
      {label && <span>{label}</span>}
    </label>
  );
}

// ==================== SELECT ====================
interface SelectProps {
  label?: string;
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  options: { value: string; label: string }[];
  error?: string;
  className?: string;
}

export function Select({ label, value, onChange, placeholder = "Select option", options, error, className = "" }: SelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="space-y-1.5 relative w-full" ref={containerRef}>
      {label && (
        <label className="block text-sm font-semibold text-slate-705 dark:text-slate-300">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center justify-between input-base px-4 py-3 text-sm text-left w-full
          ${error ? "border-rose-450 dark:border-rose-500" : ""}
          ${className}
        `}
      >
        <span className={selectedOption ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="text-slate-400 dark:text-slate-500 text-xs">▼</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto dropdown-enter py-1">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange?.(opt.value);
                setIsOpen(false);
              }}
              className={`
                w-full text-left px-4 py-2.5 text-xs font-bold transition-all
                ${opt.value === value 
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-rose-550 dark:text-rose-400 font-medium">{error}</p>}
    </div>
  );
}

// ==================== DROPDOWN ====================
interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}

export function Dropdown({ trigger, children, align = "right", className = "" }: DropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">{trigger}</div>
      {isOpen && (
        <div
          className={`
            absolute mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg z-50 py-2 min-w-[160px] dropdown-enter
            ${align === "right" ? "right-0" : "left-0"}
            ${className}
          `}
          onClick={() => setIsOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ==================== TABLE ====================
interface TableColumn<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  searchKey?: keyof T;
  filterComponent?: React.ReactNode;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function Table<T extends { id: string | number }>({
  columns,
  data,
  searchKey,
  filterComponent,
  pageSize = 5,
  onRowClick,
  className = "",
}: TableProps<T>) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);

  // Filter logic
  const filteredData = React.useMemo(() => {
    if (!searchKey || !searchQuery) return data;
    return data.filter((row) => {
      const val = row[searchKey];
      return String(val).toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [data, searchKey, searchQuery]);

  // Pagination logic
  const paginatedData = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search & Filter Header */}
      {(searchKey || filterComponent) && (
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {searchKey && (
            <div className="relative w-full sm:max-w-xs">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-base pl-10 pr-4 py-2 text-xs font-semibold"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs">🔍</span>
            </div>
          )}
          {filterComponent && <div className="w-full sm:w-auto">{filterComponent}</div>}
        </div>
      )}

      {/* Table Structure */}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-slate-900">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/50">
              {columns.map((col, idx) => (
                <th key={idx} className="px-6 py-4 text-xs font-extrabold uppercase tracking-wider text-slate-450 dark:text-slate-400">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {paginatedData.length > 0 ? (
              paginatedData.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  className={`
                    transition-colors
                    ${onRowClick ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30" : ""}
                  `}
                >
                  {columns.map((col, idx) => (
                    <td key={idx} className="px-6 py-4 text-slate-700 dark:text-slate-200 align-middle font-medium">
                      {col.render ? col.render(row) : (row[col.key as keyof T] as any)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-sm font-semibold text-slate-400">
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== DIALOG (MODAL) ====================
interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ isOpen, onClose, title, children, className = "" }: DialogProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm overlay-enter" onClick={onClose} />
      
      {/* Content */}
      <div className={`relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full animate-scale-in text-slate-800 dark:text-white space-y-4 shadow-2xl z-10 ${className}`}>
        {title && (
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-black tracking-tight">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 transition-colors">
              ✕
            </button>
          </div>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
}

// ==================== CONFIRM / ALERT / INPUT DIALOGS ====================
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
}: ConfirmDialogProps) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        <h3 className="text-lg font-black text-slate-900 dark:text-white">{title}</h3>
        <p className="text-sm text-slate-550 dark:text-slate-400 leading-relaxed">{message}</p>
        <div className="flex gap-3 pt-2">
          <Button variant="outline" fullWidth onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            fullWidth
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonLabel?: string;
}

export function AlertDialog({
  isOpen,
  onClose,
  title,
  message,
  buttonLabel = "OK",
}: AlertDialogProps) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        <h3 className="text-lg font-black text-slate-900 dark:text-white">{title}</h3>
        <p className="text-sm text-slate-550 dark:text-slate-400 leading-relaxed">{message}</p>
        <div className="pt-2">
          <Button variant="primary" fullWidth onClick={onClose}>
            {buttonLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

interface InputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (val: string) => void;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
}

export function InputDialog({
  isOpen,
  onClose,
  onSubmit,
  title,
  placeholder = "Enter value...",
  defaultValue = "",
  submitLabel = "Submit",
}: InputDialogProps) {
  const [val, setVal] = React.useState(defaultValue);

  React.useEffect(() => {
    if (isOpen) setVal(defaultValue);
  }, [isOpen, defaultValue]);

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        <h3 className="text-lg font-black text-slate-900 dark:text-white">{title}</h3>
        <Input
          placeholder={placeholder}
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />
        <div className="flex gap-3 pt-2">
          <Button variant="outline" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={() => {
              onSubmit(val);
              onClose();
            }}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

