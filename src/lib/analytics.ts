import * as api from "@/lib/tauri";

export async function trackEvent(
  eventName: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  try {
    await api.trackEvent(eventName, properties);
  } catch (error) {
    console.warn("analytics tracking failed", error);
  }
}
