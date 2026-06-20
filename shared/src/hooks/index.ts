"use client";

import { useState, useEffect } from "react";
import { api } from "../api-client";
import { User } from "../types";

// ==================== USE LOCAL STORAGE ====================
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(error);
    }
  };

  return [storedValue, setValue] as const;
}

// ==================== USE THEME ====================
export function useTheme() {
  const [theme, setThemeState] = useState<"light" | "dark" | "amoled">("light");

  useEffect(() => {
    const stored = localStorage.getItem("sw_theme") as "light" | "dark" | "amoled" | null;
    if (stored) setThemeState(stored);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setThemeState("dark");
  }, []);

  const setTheme = (t: "light" | "dark" | "amoled") => {
    setThemeState(t);
    localStorage.setItem("sw_theme", t);
    document.documentElement.classList.remove("dark", "amoled");
    if (t === "dark") document.documentElement.classList.add("dark");
    if (t === "amoled") document.documentElement.classList.add("dark", "amoled");
  };

  return { theme, setTheme };
}

// ==================== USE AUTH ====================
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const token = typeof window !== "undefined" ? localStorage.getItem("sw_access_token") : null;
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get<User>("/auth/me");
        if (res.success && res.data) {
          setUser(res.data);
        }
      } catch (err) {
        console.error("Failed to load user info", err);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const logout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("sw_access_token");
      localStorage.removeItem("sw_refresh_token");
      const isCapacitor = window.location.hostname === 'localhost' && (window.location.port === '' || window.location.protocol.startsWith('capacitor'));
      if (isCapacitor) {
        window.location.reload();
      } else {
        window.location.href = "/login";
      }
    }
  };

  return { user, loading, logout, isAuthenticated: !!user };
}

export * from "./useWebSocket";
