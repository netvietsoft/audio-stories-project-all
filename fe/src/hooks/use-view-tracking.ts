"use client";

import { useEffect } from "react";

import { apiClient } from "@/lib/api/api-client";
import { getOrCreateDeviceId } from "@/lib/tracking/device-id";

type ViewTrackingInput = {
  storyId?: string | null;
  chapterId?: string | null;
};

export const useViewTracking = ({ storyId, chapterId }: ViewTrackingInput) => {
  useEffect(() => {
    if (!storyId || !chapterId) return;

    const timer = window.setTimeout(() => {
      const deviceId = getOrCreateDeviceId();
      if (!deviceId) return;

      void apiClient.post("/tracking/view", {
        storyId,
        chapterId,
        deviceId,
      }).catch(() => {
        // Tracking must be non-blocking for UX.
      });
    }, 5000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [storyId, chapterId]);
};
