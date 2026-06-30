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
          console.log("Capacitor App deep link url opened:", urlStr);
          if (!urlStr) return;

          // Check for access_token logins
          if (urlStr.includes("access_token=")) {
            const queryStart = urlStr.indexOf("?");
            const queryString = queryStart !== -1 ? urlStr.substring(queryStart) : "";
            const params = new URLSearchParams(queryString);
            const accessToken = params.get("access_token");
            const refreshToken = params.get("refresh_token");
            if (accessToken) {
              api.setTokens(accessToken, refreshToken || "");
              window.location.href = "/";
              return;
            }
          }

          // Handle standard path routing (e.g. launcher shortcuts)
          try {
            const parsedUrl = new URL(urlStr);
            let pathAndSearch = "";
            if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
              pathAndSearch = parsedUrl.pathname + parsedUrl.search;
            } else {
              // Custom scheme support (e.g. in.sbjiwala.customer://cart)
              const hostPart = parsedUrl.hostname;
              const pathPart = parsedUrl.pathname === "/" ? "" : parsedUrl.pathname;
              pathAndSearch = `/${hostPart}${pathPart}${parsedUrl.search}`;
            }
            if (pathAndSearch && pathAndSearch !== "/") {
              console.log("Routing deep link to:", pathAndSearch);
              window.location.href = pathAndSearch;
            }
          } catch (urlParseErr) {
            console.warn("Failed to parse deep link URL, using regex fallback:", urlParseErr);
            const match = urlStr.match(/\/\/[^\/]+(\/.*)/) || urlStr.match(/:\/\/[^\/]+(\/.*)/);
            if (match && match[1]) {
              console.log("Routing regex matched deep link to:", match[1]);
              window.location.href = match[1];
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
