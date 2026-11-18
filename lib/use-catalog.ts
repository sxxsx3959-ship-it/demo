"use client";
import { useEffect, useState } from "react";
import { CATALOG_EVENT, CATALOG_KEY, defaultCatalog, readCatalog, type Catalog } from "./local-catalog";
export type { Catalog } from "./local-catalog";
export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog>(defaultCatalog);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const refresh = () => { setCatalog(readCatalog()); setReady(true); };
    const storage = (event: StorageEvent) => { if (event.key === CATALOG_KEY || event.key === null) refresh(); };
    refresh(); window.addEventListener(CATALOG_EVENT, refresh); window.addEventListener("storage", storage); window.addEventListener("focus", refresh);
    return () => { window.removeEventListener(CATALOG_EVENT, refresh); window.removeEventListener("storage", storage); window.removeEventListener("focus", refresh); };
  }, []);
  return { ...catalog, ready };
}
