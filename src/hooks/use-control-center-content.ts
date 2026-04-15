"use client";

import { useEffect, useState } from "react";
import { defaultStoreProducts, defaultStoreSettings } from "@/lib/store-data";
import {
  getStoredProducts,
  getStoredSettings,
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
      const [storedProducts, storedSettings] = await Promise.all([
        getStoredProducts(),
        getStoredSettings(),
      ]);

      if (!active) {
        return;
      }

      setProducts(storedProducts);
      setSettings(storedSettings);
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
