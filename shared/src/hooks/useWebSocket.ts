import { useState, useEffect, useRef } from "react";
import { api } from "../api-client";

// Global WebSocket Singleton State
let globalWs: WebSocket | null = null;
let globalIsConnected = false;
let globalReconnectTimeout: any = null;
let globalPingInterval: any = null;
let capacitorListener: any = null;
let nativeWsListener: any = null;
let nativeStateListener: any = null;

// Subscribers for pub/sub pattern
const subscribers = new Set<(msg: any) => void>();
const connectionSubscribers = new Set<(connected: boolean) => void>();

function notifySubscribers(message: any) {
  subscribers.forEach(sub => {
    try {
      sub(message);
    } catch (err) {
      console.error("Error in WS subscriber:", err);
    }
  });
}

function notifyConnectionSubscribers(connected: boolean) {
  globalIsConnected = connected;
  connectionSubscribers.forEach(sub => sub(connected));
}

function connectGlobalWS() {
  if (typeof window === "undefined") return;
  if (globalWs?.readyState === WebSocket.OPEN) {
    return;
  }
  // If socket is stuck connecting, forcefully close it to attempt a fresh connection
  if (globalWs?.readyState === WebSocket.CONNECTING) {
    globalWs.onclose = null;
    globalWs.onerror = null;
    globalWs.close();
    globalWs = null;
  }

  const token = localStorage.getItem("sw_access_token");
  if (!token) return;

  let apiBase = "";
  if (typeof window !== "undefined") {
    apiBase = localStorage.getItem("sw_api_base_url") || "";
  }
  if (!apiBase && process.env.NEXT_PUBLIC_API_URL) {
    apiBase = process.env.NEXT_PUBLIC_API_URL;
  }
  if (!apiBase) {
    apiBase = api.client.defaults.baseURL || "/api/v1";
  }

  let baseHost = "sbjiwala.qzz.io";
  let protocol = "wss:";
  let wsPath = "/api/v1/ws";

  if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
    try {
      const url = new URL(apiBase);
      baseHost = url.host;
      protocol = url.protocol === "https:" ? "wss:" : "ws:";
      let pathname = url.pathname;
      if (pathname.endsWith("/")) {
        pathname = pathname.slice(0, -1);
      }
      if (pathname.endsWith("/ws")) {
        wsPath = pathname;
      } else {
        wsPath = `${pathname}/ws`;
      }
    } catch (e) {
      console.error("Invalid API URL", e);
    }
  } else {
    if (typeof window !== "undefined") {
      const isCapacitor = (window as any).Capacitor?.isNativePlatform?.() === true || 
        (window as any).Capacitor ||
        (window.location.hostname === "localhost" && (window.location.port === "" || window.location.protocol.startsWith("capacitor") || window.location.protocol === "http:"));
      
      if (!isCapacitor) {
        baseHost = window.location.host;
        protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        let pathname = window.location.pathname;
        if (pathname.endsWith("/")) {
          pathname = pathname.slice(0, -1);
        }
        wsPath = `${pathname}/api/v1/ws`.replace(/\/+/g, "/");
      }
    }
  }

  const isCapacitor = typeof window !== "undefined" && (
    (window as any).Capacitor?.isNativePlatform?.() === true ||
    (window as any).Capacitor?.Plugins?.NativeWebSocket
  );

  if (isCapacitor) {
    const NativeWebSocket = (window as any).Capacitor?.Plugins?.NativeWebSocket;
    if (NativeWebSocket) {
      if (globalIsConnected) return;

      const fullUrl = `${protocol}//${baseHost}${wsPath}`;
      
      if (nativeWsListener) {
        try { nativeWsListener.remove(); } catch (e) {}
        nativeWsListener = null;
      }
      if (nativeStateListener) {
        try { nativeStateListener.remove(); } catch (e) {}
        nativeStateListener = null;
      }

      try {
        const msgListener = NativeWebSocket.addListener("message", (msg: any) => {
          try {
            const message = JSON.parse(msg.data);
            if (message.type === "pong") return;
            notifySubscribers(message);
          } catch (err) {
            console.error("Error parsing WS message from native:", err);
          }
        });
        if (msgListener && typeof msgListener.then === "function") {
          msgListener.then((listener: any) => { nativeWsListener = listener; }).catch(() => {});
        } else {
          nativeWsListener = msgListener;
        }
      } catch (err) {
        console.warn("Failed to add native WS message listener:", err);
      }

      try {
        const stateListener = NativeWebSocket.addListener("stateChange", (state: any) => {
          notifyConnectionSubscribers(state.connected);
        });
        if (stateListener && typeof stateListener.then === "function") {
          stateListener.then((listener: any) => { nativeStateListener = listener; }).catch(() => {});
        } else {
          nativeStateListener = stateListener;
        }
      } catch (err) {
        console.warn("Failed to add native WS stateChange listener:", err);
      }

      try {
        NativeWebSocket.connect({ url: fullUrl, token: token }).catch((err: any) => {
          console.error("Failed to connect native WS:", err);
        });
      } catch (err) {
        console.error("Native WS connect invocation crashed:", err);
      }
      return;
    }
  }

  const ws = new WebSocket(`${protocol}//${baseHost}${wsPath}?token=${token}`);
  globalWs = ws;

  ws.onopen = () => {
    notifyConnectionSubscribers(true);
    if (globalPingInterval) clearInterval(globalPingInterval);
    globalPingInterval = setInterval(() => {
      if (globalWs?.readyState === WebSocket.OPEN) {
        globalWs.send(JSON.stringify({ type: "ping" }));
      }
    }, 15000);
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === "pong") return;
      notifySubscribers(message);
    } catch (err) {
      console.error("Error parsing WS message:", err);
    }
  };

  ws.onclose = () => {
    notifyConnectionSubscribers(false);
    globalWs = null;
    if (globalPingInterval) clearInterval(globalPingInterval);
    if (globalReconnectTimeout) clearTimeout(globalReconnectTimeout);
    
    // Only reconnect if we still have a token
    if (localStorage.getItem("sw_access_token")) {
      globalReconnectTimeout = setTimeout(connectGlobalWS, 5000);
    }
  };

  ws.onerror = (err) => {
    console.warn("WS connection error:", err);
    ws.close();
  };
}

function handleResumeGlobal() {
  const isCapacitor = typeof window !== "undefined" && (
    (window as any).Capacitor?.isNativePlatform?.() === true ||
    (window as any).Capacitor?.Plugins?.NativeWebSocket
  );

  if (isCapacitor) {
    const NativeWebSocket = (window as any).Capacitor?.Plugins?.NativeWebSocket;
    if (NativeWebSocket && !globalIsConnected) {
      connectGlobalWS();
    }
    return;
  }

  if (!globalWs || globalWs.readyState !== WebSocket.OPEN) {
    connectGlobalWS();
  } else {
    try {
      globalWs.send(JSON.stringify({ type: "ping" }));
    } catch (err) {
      connectGlobalWS();
    }
  }
}

// Initialize Global Listeners exactly once on first use
let isGlobalInitialized = false;
function initGlobalWS() {
  if (isGlobalInitialized || typeof window === "undefined") return;
  isGlobalInitialized = true;

  window.addEventListener("sw_auth_changed", () => {
    if (!localStorage.getItem("sw_access_token")) {
      disconnectGlobalWS();
    } else {
      connectGlobalWS();
    }
  });

  window.addEventListener("focus", handleResumeGlobal);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      handleResumeGlobal();
    }
  });

  if ((window as any).Capacitor?.Plugins?.App) {
    try {
      const App = (window as any).Capacitor.Plugins.App;
      const listenerOrPromise = App.addListener("appStateChange", (state: any) => {
        if (state.isActive) handleResumeGlobal();
      });
      
      if (listenerOrPromise && typeof listenerOrPromise.then === "function") {
        listenerOrPromise.then((listener: any) => {
          capacitorListener = listener;
        }).catch(() => {});
      } else {
        capacitorListener = listenerOrPromise;
      }
    } catch (err) {
      console.warn("Failed to attach Capacitor app state listener", err);
    }
  }

  connectGlobalWS();
}

function disconnectGlobalWS() {
  const isCapacitor = typeof window !== "undefined" && (
    (window as any).Capacitor?.isNativePlatform?.() === true ||
    (window as any).Capacitor?.Plugins?.NativeWebSocket
  );

  if (isCapacitor) {
    const NativeWebSocket = (window as any).Capacitor?.Plugins?.NativeWebSocket;
    if (NativeWebSocket) {
      NativeWebSocket.disconnect().catch(() => {});
    }
    if (nativeWsListener) { nativeWsListener.remove(); nativeWsListener = null; }
    if (nativeStateListener) { nativeStateListener.remove(); nativeStateListener = null; }
  }

  if (globalWs) {
    globalWs.onclose = null;
    globalWs.close();
    globalWs = null;
  }
  if (globalReconnectTimeout) clearTimeout(globalReconnectTimeout);
  if (globalPingInterval) clearInterval(globalPingInterval);
  notifyConnectionSubscribers(false);
}

export function useWebSocket(onMessage?: (msg: any) => void, enabled: boolean = true) {
  const [isConnected, setIsConnected] = useState(globalIsConnected);

  useEffect(() => {
    if (!enabled) return;

    initGlobalWS();

    // Subscribe to connection state
    const connSub = (connected: boolean) => setIsConnected(connected);
    connectionSubscribers.add(connSub);
    setIsConnected(globalIsConnected);

    // Subscribe to messages
    if (onMessage) {
      subscribers.add(onMessage);
    }

    // Force connection attempt if not connected
    if (!globalWs || globalWs.readyState === WebSocket.CLOSED) {
      connectGlobalWS();
    }

    return () => {
      connectionSubscribers.delete(connSub);
      if (onMessage) {
        subscribers.delete(onMessage);
      }
    };
  }, [onMessage, enabled]);

  const sendMessage = (msg: any) => {
    const isCapacitor = typeof window !== "undefined" && (
      (window as any).Capacitor?.isNativePlatform?.() === true ||
      (window as any).Capacitor?.Plugins?.NativeWebSocket
    );

    if (isCapacitor) {
      const NativeWebSocket = (window as any).Capacitor?.Plugins?.NativeWebSocket;
      if (NativeWebSocket) {
        NativeWebSocket.send({ message: JSON.stringify(msg) }).catch((err: any) => {
          console.warn("Failed to send native WS message:", err);
        });
        return;
      }
    }

    if (globalWs && globalWs.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify(msg));
    }
  };

  return { isConnected, sendMessage };
}
