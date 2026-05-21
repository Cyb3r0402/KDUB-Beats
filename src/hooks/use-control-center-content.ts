"use client";

import { useEffect, useState } from "react";
import { defaultStoreProducts, defaultStoreSettings } from "@/lib/store-data";
import {
  getStoredContent,
  subscribeToControlCenterUpdates,
} from "@/lib/control-center-storage";
import type { StoreProduct, StoreSettings } from "@/types/store";

export function useControlCenterContent() {
  const [products, setProducts] = useState<StoreProduct[]>(defaultStoreProducts);
  const [settings, setSettings] = useState<StoreSettings>(defaultStoreSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadContent() {
      try {
        // Fetch published content from API first (always fresh in production)
        const response = await fetch("/api/control-center/content", {
          cache: "no-store",
        });

        if (response.ok && active) {
          const apiContent = await response.json();
          setProducts(apiContent.products || defaultStoreProducts);
          setSettings(apiContent.settings || defaultStoreSettings);
          setLoading(false);
          return;
        }
      } catch {
        // API fetch failed, fall back to stored content
      }

      // Fall back to locally stored content if API is unavailable
      if (active) {
        const storedContent = await getStoredContent();
        setProducts(storedContent.products);
        setSettings(storedContent.settings);
        setLoading(false);
      }
    }

    loadContent().catch(() => {
      if (active) {
        setLoading(false);
      }
    });

    const unsubscribe = subscribeToControlCenterUpdates(() => {
      loadContent().catch(() => undefined);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return {
    products,
    settings,
    loading,
  };
}
