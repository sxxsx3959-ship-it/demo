"use client";
import { useEffect, useState } from "react";
import { dishes } from "./restaurant";
import areas from "./delivery-areas.json";
export type Catalog = { dishes: typeof dishes; areas: typeof areas; accepting: boolean };
export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog>({ dishes, areas, accepting: true });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    async function update() { try { const response = await fetch("/api/catalog", { cache: "no-store" }); if (!response.ok) return; const value = await response.json(); if (active) { setCatalog(value); setReady(true); } } catch { /* Previously loaded menu stays visible offline. */ } }
    void update(); const interval = window.setInterval(update, 20000); window.addEventListener("focus", update);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("focus", update); };
  }, []);
  return { ...catalog, ready };
}
