import { api } from "../api-client";

/**
 * Checks if the Capacitor StreamCall plugin is available on the current device.
 */
export function isStreamCallAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const Cap = (window as any).Capacitor;
  return !!(Cap?.Plugins?.StreamCall);
}

/**
 * Initializes and logs in the current user to the Stream Video Call system.
 * Fetches the JWT call token from the backend and registers the plugin client.
 */
export async function initStreamCall(profile: any): Promise<boolean> {
  if (!isStreamCallAvailable()) {
    console.warn("Capacitor StreamCall plugin is not available on this device.");
    return false;
  }

  try {
    const StreamCall = (window as any).Capacitor.Plugins.StreamCall;
    
    // Get Stream JWT token and API key from backend
    const res = await api.get("/users/me/stream-token");
    const { token, apiKey, userId } = res.data?.data || res.data || {};
    
    if (!token || !apiKey) {
      console.warn("Stream API credentials could not be fetched from backend.");
      return false;
    }

    const userName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Valued User";
    const avatarUrl = profile?.avatar_url || "";

    await StreamCall.login({
      apiKey: apiKey,
      user: {
        id: userId || String(profile?.id || "user"),
        name: userName,
        image: avatarUrl,
      },
      token: token,
    });

    console.log("Successfully logged in to StreamCall system for user:", userId);
    return true;
  } catch (err) {
    console.error("Error initializing StreamCall plugin:", err);
    return false;
  }
}

/**
 * Starts a native stream call to a target Call ID.
 */
export async function startStreamCall(callId: string, callType: "audio" | "video" = "audio"): Promise<boolean> {
  if (!isStreamCallAvailable()) return false;
  try {
    const StreamCall = (window as any).Capacitor.Plugins.StreamCall;
    await StreamCall.call({
      callId: callId,
      callType: callType,
    });
    console.log("StreamCall initiated with ID:", callId);
    return true;
  } catch (err) {
    console.error("Failed to start StreamCall:", err);
    return false;
  }
}

/**
 * Ends/hangs up the current active native stream call.
 */
export async function endStreamCall(): Promise<boolean> {
  if (!isStreamCallAvailable()) return false;
  try {
    const StreamCall = (window as any).Capacitor.Plugins.StreamCall;
    await StreamCall.endCall();
    console.log("StreamCall ended successfully.");
    return true;
  } catch (err) {
    console.error("Failed to end StreamCall:", err);
    return false;
  }
}

/**
 * Accepts an incoming native stream call.
 */
export async function acceptStreamCall(): Promise<boolean> {
  if (!isStreamCallAvailable()) return false;
  try {
    const StreamCall = (window as any).Capacitor.Plugins.StreamCall;
    await StreamCall.acceptCall();
    return true;
  } catch (err) {
    console.error("Failed to accept StreamCall:", err);
    return false;
  }
}

/**
 * Rejects an incoming native stream call.
 */
export async function rejectStreamCall(): Promise<boolean> {
  if (!isStreamCallAvailable()) return false;
  try {
    const StreamCall = (window as any).Capacitor.Plugins.StreamCall;
    await StreamCall.rejectCall();
    return true;
  } catch (err) {
    console.error("Failed to reject StreamCall:", err);
    return false;
  }
}
