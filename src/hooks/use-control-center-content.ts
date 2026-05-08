"use client";

import { useEffect, useState } from "react";
import { defaultStoreProducts, defaultStoreSettings } from "@/lib/store-data";
import {
  getPublishedContent,
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
      const storedContent = await getPublishedContent();

      if (!active) {
        return;
      }

      setProducts(storedContent.products);
      setSettings(storedContent.settings);
      setLoading(false);
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
