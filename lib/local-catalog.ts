import { dishes, type Dish } from "./restaurant";
import areas from "./delivery-areas.json";
import published from "./catalog-defaults.json";
export type Catalog = { dishes: Dish[]; areas: typeof areas; accepting: boolean };
export const CATALOG_KEY = "hadramout-local-catalog-v1";
export const CATALOG_EVENT = "hadramout-catalog-change";
export function normalizeCatalog(value: unknown): Catalog {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const menu = Array.isArray(raw.dishes) ? raw.dishes : [];
  const fees = Array.isArray(raw.areas) ? raw.areas : [];
  return {
    dishes: dishes.map(d => { const item = menu.find(v => v && typeof v === "object" && v.id === d.id); return { ...d, price: item && Number.isSafeInteger(item.price) && item.price >= 1 && item.price <= 1000000 ? item.price : d.price, available: typeof item?.available === "boolean" ? item.available : d.available }; }),
    areas: areas.map(a => { const item = fees.find(v => v && typeof v === "object" && v.id === a.id); return { ...a, fee: item && Number.isSafeInteger(item.fee) && item.fee >= 0 && item.fee <= 100000 ? item.fee : a.fee }; }),
    accepting: typeof raw.accepting === "boolean" ? raw.accepting : true,
  };
}
export const defaultCatalog = normalizeCatalog(published);
export function readCatalog(): Catalog {
  try { const saved = localStorage.getItem(CATALOG_KEY); return saved ? normalizeCatalog(JSON.parse(saved)) : defaultCatalog; }
  catch { return defaultCatalog; }
}
export function saveCatalog(value: Catalog) {
  const valid = normalizeCatalog(value);
  localStorage.setItem(CATALOG_KEY, JSON.stringify(valid));
  window.dispatchEvent(new Event(CATALOG_EVENT));
  return valid;
}
export function resetCatalog() { localStorage.removeItem(CATALOG_KEY); window.dispatchEvent(new Event(CATALOG_EVENT)); }
export function exportCatalog(value: Catalog) {
  return JSON.stringify({ dishes: value.dishes.map(({id,price,available}) => ({id,price,available})), areas: value.areas.map(({id,fee}) => ({id,fee})), accepting: value.accepting }, null, 2);
}
