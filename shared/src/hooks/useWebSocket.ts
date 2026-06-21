import { useState, useEffect, useRef } from "react";
import { api } from "../api-client";

export function useWebSocket(onMessage?: (msg: any) => void, enabled: boolean = true) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const [authTrigger, setAuthTrigger] = useState(0);

  useEffect(() => {
    const handleAuthChange = () => setAuthTrigger(v => v + 1);
    window.addEventListener("sw_auth_changed", handleAuthChange);
    return () => window.removeEventListener("sw_auth_changed", handleAuthChange);
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("sw_access_token") : null;
    if (!token) return;

    let reconnectTimeout: any;
    let pingInterval: any;

    const connectWS = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
        return;
      }

      const apiBase = api.client.defaults.baseURL || "/api/v1";
      let baseHost = window.location.host;
      let protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

      if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
        try {
          const url = new URL(apiBase);
          baseHost = url.host;
          protocol = url.protocol === "https:" ? "wss:" : "ws:";
        } catch (e) {
          console.error("Invalid API URL", e);
        }
      }
      
      const ws = new WebSocket(`${protocol}//${baseHost}/api/v1/ws?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Start ping interval to keep connection alive
        pingInterval = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "ping" }));
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "pong") return; // Ignore pongs
          if (onMessage) onMessage(message);
        } catch (err) {
          console.error("Error parsing WS message:", err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        if (pingInterval) clearInterval(pingInterval);
        reconnectTimeout = setTimeout(connectWS, 5000); // Reconnect in 5s
      };

      ws.onerror = (err) => {
        console.warn("WS connection error:", err);
        ws.close();
      };
    };

    const handleResume = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connectWS();
      }
    };

    window.addEventListener("focus", handleResume);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleResume();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    let capacitorListener: any = null;
    if (typeof window !== "undefined" && (window as any).Capacitor?.Plugins?.App) {
      try {
        const App = (window as any).Capacitor.Plugins.App;
        App.addListener("appStateChange", (state: any) => {
          if (state.isActive) {
            handleResume();
          }
        }).then((listener: any) => {
          capacitorListener = listener;
        }).catch(() => {});
      } catch (err) {
        console.warn("Failed to attach Capacitor app state listener", err);
      }
    }

    connectWS();

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect logic on unmount
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pingInterval) clearInterval(pingInterval);
      window.removeEventListener("focus", handleResume);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (capacitorListener) {
        capacitorListener.remove();
      }
    };
  }, [onMessage, enabled, authTrigger]);

  const sendMessage = (msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  return { isConnected, sendMessage };
}
