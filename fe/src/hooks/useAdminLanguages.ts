"use client";

import { useEffect, useState } from "react";

import { adminApiClient as apiClient } from "@/lib/api/admin-api-client";

export interface AdminLanguage {
  id: number;
  key: string;
  name: string;
  isActive: boolean;
  displayOrder: number;
}

const fallbackLanguages: AdminLanguage[] = [
  { id: 0, key: "vi", name: "Tiếng Việt", isActive: true, displayOrder: 0 },
  { id: 1, key: "en", name: "English", isActive: true, displayOrder: 1 },
];

const normalizeLanguages = (raw: unknown): AdminLanguage[] => {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: unknown[] })?.data)
      ? (raw as { data: unknown[] }).data
      : [];

  const parsed = list
    .map((item) => {
      const record = item as Partial<AdminLanguage>;
      if (!record || typeof record.key !== "string" || typeof record.name !== "string") {
        return null;
      }

      return {
        id: typeof record.id === "number" ? record.id : 0,
        key: record.key,
        name: record.name,
        isActive: Boolean(record.isActive),
        displayOrder: typeof record.displayOrder === "number" ? record.displayOrder : 0,
      } satisfies AdminLanguage;
    })
    .filter((item): item is AdminLanguage => item !== null);

  return parsed.length > 0
    ? parsed.sort((a, b) => a.displayOrder - b.displayOrder || a.key.localeCompare(b.key))
    : fallbackLanguages;
};

export const useAdminLanguages = () => {
  const [languages, setLanguages] = useState<AdminLanguage[]>(fallbackLanguages);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchLanguages = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get("/languages", {
          params: {
            all: true,
            active: true,
          },
        });

        if (isMounted) {
          setLanguages(normalizeLanguages(res.data));
        }
      } catch (error) {
        console.error("Failed to fetch admin languages:", error);
        if (isMounted) {
          setLanguages(fallbackLanguages);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchLanguages();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    languages,
    isLoading,
  };
};
