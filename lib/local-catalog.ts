import { dishes, normalizeCouponCode, type Coupon, type Dish } from "./restaurant";
import areas from "./delivery-areas.json";
import published from "./catalog-defaults.json";

export type Catalog = {
  dishes: Dish[];
  areas: typeof areas;
  accepting: boolean;
  coupons: Coupon[];
  couponsEnabled: boolean;
  featuredCouponCode: string | null;
};

export const CATALOG_KEY = "hadramout-local-catalog-v1";
export const CATALOG_EVENT = "hadramout-catalog-change";

function sanitizeDish(raw: unknown): Dish | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const id = Number(d.id);
  const price = Number(d.price);
  if (!Number.isSafeInteger(id) || id < 1 || typeof d.title !== "string" || !d.title.trim()) return null;
  if (!Number.isFinite(price) || price < 1 || price > 1000000) return null;
  return {
    id,
    category: typeof d.category === "string" && d.category ? d.category : "chicken",
    title: d.title.trim(),
    sub: typeof d.sub === "string" ? d.sub : "",
    price: Math.round(price),
    image: typeof d.image === "string" && d.image ? d.image : "whole",
    description: typeof d.description === "string" ? d.description : "",
    available: typeof d.available === "boolean" ? d.available : true,
  };
}

function sanitizeArea(raw: unknown): { id: string; name: string; fee: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const fee = Number(a.fee);
  if (typeof a.id !== "string" || !a.id || typeof a.name !== "string" || !a.name.trim()) return null;
  if (!Number.isFinite(fee) || fee < 0 || fee > 100000) return null;
  return { id: a.id, name: a.name.trim(), fee: Math.round(fee) };
}

function sanitizeCoupon(raw: unknown): Coupon | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const code = typeof c.code === "string" ? normalizeCouponCode(c.code) : "";
  const discountType = c.discountType === "percent" || c.discountType === "fixed" ? c.discountType : null;
  const discountValue = Number(c.discountValue);
  const minOrder = Number(c.minOrder ?? 0);
  const maxUses = Number(c.maxUses ?? 0);
  const usedCount = Number(c.usedCount ?? 0);
  if (typeof c.id !== "string" || !c.id || !code || !discountType) return null;
  if (!Number.isFinite(discountValue) || discountValue <= 0) return null;
  if (discountType === "percent" && discountValue > 100) return null;
  if (!Number.isFinite(minOrder) || minOrder < 0) return null;
  if (!Number.isFinite(maxUses) || maxUses < 0) return null;
  if (!Number.isFinite(usedCount) || usedCount < 0) return null;
  return {
    id: c.id,
    code,
    discountType,
    discountValue: Math.round(discountValue),
    minOrder: Math.round(minOrder),
    maxUses: Math.round(maxUses),
    usedCount: Math.round(usedCount),
    active: typeof c.active === "boolean" ? c.active : true,
  };
}

export function normalizeCatalog(value: unknown): Catalog {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const menu = Array.isArray(raw.dishes) ? raw.dishes : [];
  const fees = Array.isArray(raw.areas) ? raw.areas : [];
  const rawCoupons = Array.isArray(raw.coupons) ? raw.coupons : [];

  const parsedDishes = menu.flatMap(item => {
    // Support partial overrides from catalog-defaults.json ({id, price, available})
    if (item && typeof item === "object" && !("title" in item)) {
      const base = dishes.find(d => d.id === (item as Record<string, unknown>).id);
      if (base) {
        const p = Number((item as Record<string, unknown>).price);
        const av = (item as Record<string, unknown>).available;
        return [{
          ...base,
          price: Number.isSafeInteger(p) && p >= 1 && p <= 1000000 ? p : base.price,
          available: typeof av === "boolean" ? av : base.available,
        }];
      }
    }
    const valid = sanitizeDish(item);
    return valid ? [valid] : [];
  });

  const parsedAreas = fees.flatMap(item => {
    if (item && typeof item === "object" && !("name" in item)) {
      const base = areas.find(a => a.id === (item as Record<string, unknown>).id);
      if (base) {
        const f = Number((item as Record<string, unknown>).fee);
        return [{ ...base, fee: Number.isSafeInteger(f) && f >= 0 && f <= 100000 ? f : base.fee }];
      }
    }
    const valid = sanitizeArea(item);
    return valid ? [valid] : [];
  });

  return {
    dishes: parsedDishes.length > 0 ? parsedDishes : dishes,
    areas: parsedAreas.length > 0 ? parsedAreas : areas,
    accepting: typeof raw.accepting === "boolean" ? raw.accepting : true,
    coupons: rawCoupons.flatMap(item => {
      const valid = sanitizeCoupon(item);
      return valid ? [valid] : [];
    }),
    couponsEnabled: typeof raw.couponsEnabled === "boolean" ? raw.couponsEnabled : true,
    featuredCouponCode:
      typeof raw.featuredCouponCode === "string" && raw.featuredCouponCode.trim()
        ? normalizeCouponCode(raw.featuredCouponCode)
        : null,
  };
}

export const defaultCatalog = normalizeCatalog(published);

export function readCatalog(): Catalog {
  try {
    const saved = localStorage.getItem(CATALOG_KEY);
    return saved ? normalizeCatalog(JSON.parse(saved)) : defaultCatalog;
  } catch {
    return defaultCatalog;
  }
}

export function saveCatalog(value: Catalog) {
  const valid = normalizeCatalog(value);
  localStorage.setItem(CATALOG_KEY, JSON.stringify(valid));
  window.dispatchEvent(new Event(CATALOG_EVENT));
  return valid;
}

export function resetCatalog() {
  localStorage.removeItem(CATALOG_KEY);
  window.dispatchEvent(new Event(CATALOG_EVENT));
}

export function exportCatalog(value: Catalog) {
  return JSON.stringify(
    {
      dishes: value.dishes.map(({ id, price, available }) => ({ id, price, available })),
      areas: value.areas.map(({ id, fee }) => ({ id, fee })),
      accepting: value.accepting,
      coupons: value.coupons,
      couponsEnabled: value.couponsEnabled,
    },
    null,
    2
  );
}
