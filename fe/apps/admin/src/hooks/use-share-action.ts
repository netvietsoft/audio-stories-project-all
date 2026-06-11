"use client";

import { useCallback } from "react";

export type SharePayload = {
  title?: string;
  text?: string;
  url?: string;
  fallbackPrompt?: string;
};

export type ShareResult = "shared" | "copied" | "prompted" | "unavailable";

export function useShareAction() {
  return useCallback(async (payload: SharePayload): Promise<ShareResult> => {
    if (typeof window === "undefined") return "unavailable";

    const url = payload.url || window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: payload.title,
          text: payload.text,
          url,
        });
        return "shared";
      } catch {
        // Ignore canceled native share and continue to clipboard fallback.
      }
    }

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        return "copied";
      } catch {
        // Fall through to prompt fallback.
      }
    }

    window.prompt(payload.fallbackPrompt || "Copy this link", url);
    return "prompted";
  }, []);
}
