"use client";

import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api/api-client";
import { unwrapData } from "@/lib/api/unwrap";

export function useAdInsertionFrequency(defaultValue = 1000) {
  const [insertionFrequency, setInsertionFrequency] = useState<number>(defaultValue);

  useEffect(() => {
    let cancelled = false;

    const fetchInsertionFrequency = async () => {
      try {
        const response = await apiClient.get<{ value?: string | number }>("/settings/ad_insertion_frequency");
        const parsed = Number(unwrapData<{ value?: string | number }>(response?.data)?.value);

        if (!cancelled) {
          if (Number.isFinite(parsed) && parsed > 0) {
            setInsertionFrequency(Math.floor(parsed));
          } else {
            setInsertionFrequency(defaultValue);
          }
        }
      } catch {
        if (!cancelled) {
          setInsertionFrequency(defaultValue);
        }
      }
    };

    void fetchInsertionFrequency();

    return () => {
      cancelled = true;
    };
  }, [defaultValue]);

  return insertionFrequency;
}
