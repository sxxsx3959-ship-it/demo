"use client";
import { useEffect, useState } from "react";
import { CATALOG_EVENT, CATALOG_KEY, defaultCatalog, readCatalog, type Catalog } from "./local-catalog";
import { supabase, isSupabaseConfigured } from "./supabase";
import { categories as defaultCategories, normalizeCouponCode, type Coupon } from "./restaurant";

export type Category = { id: string; name: string; sub: string; image: string; sort_order?: number };
export type { Catalog } from "./local-catalog";

let channelSeq = 0;
let activeSubscribers = 0;
let currentCatalog: Catalog = defaultCatalog;
let currentCategories: Category[] = defaultCategories;
let isReady = false;
let activeChannel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
const stateListeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of stateListeners) {
    listener();
  }
}

function refreshFromLocal() {
  currentCatalog = readCatalog();
  isReady = true;
  notifyListeners();
}

function handleStorageEvent(event: StorageEvent) {
  if (event.key === CATALOG_KEY || event.key === null) {
    refreshFromLocal();
  }
}

async function fetchSupabaseCatalog() {
  if (!isSupabaseConfigured || !supabase) return;

  try {
    const [dishesRes, areasRes, settingsRes, categoriesRes, couponsRes] = await Promise.all([
      supabase.from("dishes").select("*").order("sort_order", { ascending: true }),
      supabase.from("delivery_areas").select("*").order("sort_order", { ascending: true }),
      supabase.from("restaurant_settings").select("*"),
      supabase.from("categories").select("*").order("sort_order", { ascending: true }),
      supabase.from("coupons").select("*").order("created_at", { ascending: false }),
    ]);

    if (categoriesRes.data && categoriesRes.data.length > 0) {
      currentCategories = categoriesRes.data.map((c: any) => ({
        id: String(c.id),
        name: String(c.name),
        sub: String(c.sub || ""),
        image: String(c.image || "whole"),
      }));
    }

    let updatedDishes = currentCatalog.dishes;
    if (dishesRes.data && dishesRes.data.length > 0) {
      updatedDishes = dishesRes.data.map((d: any) => ({
        id: Number(d.id),
        category: String(d.category),
        title: String(d.title),
        sub: String(d.sub || ""),
        price: Number(d.price),
        image: String(d.image),
        description: String(d.description || ""),
        available: Boolean(d.available),
      }));
    }

    let updatedAreas = currentCatalog.areas;
    if (areasRes.data && areasRes.data.length > 0) {
      updatedAreas = areasRes.data.map((a: any) => ({
        id: String(a.id),
        name: String(a.name),
        fee: Number(a.fee),
      }));
    }

    let accepting = currentCatalog.accepting;
    let couponsEnabled = currentCatalog.couponsEnabled;
    let featuredCouponCode = currentCatalog.featuredCouponCode;
    if (settingsRes.data) {
      const acceptingSetting = settingsRes.data.find((s: any) => s.key === "accepting_orders");
      if (acceptingSetting) {
        accepting =
          typeof acceptingSetting.value === "boolean"
            ? acceptingSetting.value
            : acceptingSetting.value === "true" || acceptingSetting.value === true;
      }

      const couponsSetting = settingsRes.data.find((s: any) => s.key === "coupons_enabled");
      if (couponsSetting) {
        couponsEnabled =
          typeof couponsSetting.value === "boolean"
            ? couponsSetting.value
            : couponsSetting.value === "true" || couponsSetting.value === true;
      }

      const featuredSetting = settingsRes.data.find((s: any) => s.key === "featured_coupon_code");
      if (featuredSetting) {
        const rawCode = typeof featuredSetting.value === "string" ? normalizeCouponCode(featuredSetting.value) : "";
        featuredCouponCode = rawCode || null;
      }
    }

    let updatedCoupons: Coupon[] = currentCatalog.coupons;
    if (!couponsRes.error && Array.isArray(couponsRes.data)) {
      updatedCoupons = couponsRes.data.map((c: any) => ({
        id: String(c.id),
        code: normalizeCouponCode(String(c.code)),
        discountType: c.discount_type === "fixed" ? "fixed" : "percent",
        discountValue: Number(c.discount_value),
        minOrder: Number(c.min_order ?? 0),
        maxUses: Number(c.max_uses ?? 0),
        usedCount: Number(c.used_count ?? 0),
        active: Boolean(c.active),
      }));
    }

    currentCatalog = {
      dishes: updatedDishes,
      areas: updatedAreas,
      accepting,
      coupons: updatedCoupons,
      couponsEnabled,
      featuredCouponCode,
    };
    isReady = true;
    notifyListeners();
  } catch (err) {
    console.warn("Could not fetch catalog from Supabase, falling back to local:", err);
    isReady = true;
    notifyListeners();
  }
}

function handleFocusEvent() {
  if (isSupabaseConfigured && supabase) {
    fetchSupabaseCatalog();
  } else {
    refreshFromLocal();
  }
}

function startSharedSubscriptions() {
  refreshFromLocal();
  window.addEventListener(CATALOG_EVENT, refreshFromLocal);
  window.addEventListener("storage", handleStorageEvent);
  window.addEventListener("focus", handleFocusEvent);

  if (isSupabaseConfigured && supabase) {
    fetchSupabaseCatalog();

    if (!activeChannel) {
      const channelName = `catalog-realtime-${++channelSeq}`;
      activeChannel = supabase
        .channel(channelName)
        .on("postgres_changes", { event: "*", schema: "public", table: "dishes" }, () => {
          fetchSupabaseCatalog();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "delivery_areas" }, () => {
          fetchSupabaseCatalog();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_settings" }, () => {
          fetchSupabaseCatalog();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => {
          fetchSupabaseCatalog();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "coupons" }, () => {
          fetchSupabaseCatalog();
        })
        .subscribe();
    }
  }
}

function stopSharedSubscriptions() {
  window.removeEventListener(CATALOG_EVENT, refreshFromLocal);
  window.removeEventListener("storage", handleStorageEvent);
  window.removeEventListener("focus", handleFocusEvent);

  if (activeChannel && supabase) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
  }
}

export { fetchSupabaseCatalog as refreshCatalog };

export function useCatalog() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const update = () => setTick(t => t + 1);
    stateListeners.add(update);

    if (activeSubscribers === 0) {
      startSharedSubscriptions();
    } else if (isSupabaseConfigured && supabase) {
      // Sync local state immediately if needed
      update();
    }
    activeSubscribers += 1;

    return () => {
      stateListeners.delete(update);
      activeSubscribers = Math.max(0, activeSubscribers - 1);
      if (activeSubscribers === 0) {
        stopSharedSubscriptions();
      }
    };
  }, []);

  return { ...currentCatalog, categories: currentCategories, ready: isReady };
}
