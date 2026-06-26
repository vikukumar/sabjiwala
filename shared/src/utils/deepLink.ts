import { api } from "../api-client";

export function setupDeepLinkListener() {
  if (typeof window === "undefined") return;

  const isNative = (window as any).Capacitor?.isNativePlatform?.() === true || (window as any).Capacitor;
  if (!isNative) return;

  const AppPlugin = (window as any).Capacitor?.Plugins?.App;
  if (AppPlugin) {
    try {
      AppPlugin.addListener("appUrlOpen", (event: any) => {
        try {
          const urlStr = event.url;
          if (urlStr && urlStr.includes("access_token=")) {
            const queryStart = urlStr.indexOf("?");
            const queryString = queryStart !== -1 ? urlStr.substring(queryStart) : "";
            const params = new URLSearchParams(queryString);
            const accessToken = params.get("access_token");
            const refreshToken = params.get("refresh_token");
            if (accessToken) {
              api.setTokens(accessToken, refreshToken || "");
              window.location.href = "/";
            }
          }
        } catch (e) {
          console.error("Error handling deep link:", e);
        }
      });
    } catch (err) {
      console.warn("Failed to register Capacitor appUrlOpen listener", err);
    }
  } else {
    console.warn("Capacitor App plugin not found on window.Capacitor.Plugins");
  }
}
