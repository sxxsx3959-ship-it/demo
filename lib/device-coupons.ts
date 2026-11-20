"use client";
import { normalizeCouponCode, type Coupon } from "./restaurant";
import { isSupabaseConfigured, supabase } from "./supabase";

const DEVICE_ID_KEY = "hadramout-device-id-v1";
const USED_COUPONS_KEY = "hadramout-used-coupons-v1";

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id || id.length < 8) {
      id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "dev_session_fallback";
  }
}

export function getUsedCouponsOnDevice(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(USED_COUPONS_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter((x): x is string => typeof x === "string").map(normalizeCouponCode);
  } catch {
    return [];
  }
}

export function hasUsedCouponOnDevice(code: string): boolean {
  const clean = normalizeCouponCode(code);
  if (!clean) return false;
  return getUsedCouponsOnDevice().includes(clean);
}

export function markCouponUsedOnDevice(code: string) {
  const clean = normalizeCouponCode(code);
  if (!clean) return;
  try {
    const current = getUsedCouponsOnDevice();
    if (!current.includes(clean)) {
      localStorage.setItem(USED_COUPONS_KEY, JSON.stringify([...current, clean]));
    }
  } catch {
    // Storage may be disabled
  }
}

export type CouponEligibilityResult =
  | { ok: true; coupon: Coupon }
  | { ok: false; error: string };

/**
 * يتحقق مباشرة من سوبابيس أن الكوبون ما زال متاحاً، وأن هذا الجهاز أو رقم الهاتف لم يستخدمه مسبقاً.
 */
export async function verifyCouponEligibility(
  code: string,
  localCoupons: Coupon[],
  phone?: string
): Promise<CouponEligibilityResult> {
  const cleanCode = normalizeCouponCode(code);
  if (!cleanCode) {
    return { ok: false, error: "أدخل كود الخصم أولًا." };
  }

  // 1. فحص استخدام الجهاز المحلي
  if (hasUsedCouponOnDevice(cleanCode)) {
    return { ok: false, error: "لقد استخدمت هذا الكوبون مسبقًا على هذا الجهاز. يمكنك تجربة كود آخر فقط." };
  }

  let matched: Coupon | undefined = localCoupons.find(c => normalizeCouponCode(c.code) === cleanCode);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: liveRow, error: fetchErr } = await supabase
        .from("coupons")
        .select("*")
        .ilike("code", cleanCode)
        .maybeSingle();

      if (!fetchErr) {
        if (!liveRow) {
          return { ok: false, error: "كود الخصم هذا غير موجود. تأكد من كتابة الكود بشكل صحيح." };
        }
        matched = {
          id: String(liveRow.id),
          code: normalizeCouponCode(String(liveRow.code)),
          discountType: liveRow.discount_type === "fixed" ? "fixed" : "percent",
          discountValue: Number(liveRow.discount_value),
          minOrder: Number(liveRow.min_order ?? 0),
          maxUses: Number(liveRow.max_uses ?? 0),
          usedCount: Number(liveRow.used_count ?? 0),
          active: Boolean(liveRow.active),
        };
      }
    } catch {
      // Fall back to local state if network fails
    }
  }

  if (!matched) {
    return { ok: false, error: "كود الخصم هذا غير موجود. تأكد من كتابة الكود بشكل صحيح." };
  }

  if (!matched.active) {
    return { ok: false, error: "هذا الكوبون متوقف أو منتهي الصلاحية." };
  }

  if (matched.maxUses > 0 && matched.usedCount >= matched.maxUses) {
    return { ok: false, error: "عذرًا، تم استنفاد العدد المسموح لهذا الكوبون وانتهت صلاحيته." };
  }

  // 2. فحص سجل الاستخدام في سوبابيس لنفس الجهاز أو رقم الهاتف
  if (isSupabaseConfigured && supabase) {
    try {
      const deviceId = getDeviceId();
      const cleanPhone = (phone || "").trim();
      let query = supabase
        .from("coupon_redemptions")
        .select("id")
        .eq("coupon_id", matched.id);

      if (cleanPhone) {
        query = query.or(`device_id.eq.${deviceId},customer_phone.eq.${cleanPhone}`);
      } else {
        query = query.eq("device_id", deviceId);
      }

      const { data: priorRedemption, error: redErr } = await query.limit(1);
      if (!redErr && Array.isArray(priorRedemption) && priorRedemption.length > 0) {
        if (deviceId) markCouponUsedOnDevice(cleanCode);
        return { ok: false, error: "لقد استخدمت هذا الكوبون مسبقًا ولا يمكن استخدامه أكثر من مرة." };
      }
    } catch {
      // Table may not exist yet; local check still protects
    }
  }

  return { ok: true, coupon: matched };
}

/**
 * استهلاك الكوبون نهائياً عند إرسال الطلب، وحظر إعادة استخدامه على الجهاز وزيادة العداد في سوبابيس.
 */
export async function redeemCouponOnOrder(
  code: string,
  phone: string
): Promise<{ ok: boolean; error?: string }> {
  const cleanCode = normalizeCouponCode(code);
  if (!cleanCode) return { ok: true };

  if (hasUsedCouponOnDevice(cleanCode)) {
    return { ok: false, error: "لقد استخدمت هذا الكوبون مسبقًا على هذا الجهاز." };
  }

  const deviceId = getDeviceId();
  const cleanPhone = phone.trim();

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc("redeem_coupon", {
        p_code: cleanCode,
        p_device_id: deviceId,
        p_phone: cleanPhone,
      });

      if (!error && data && typeof data === "object") {
        if (data.ok) {
          markCouponUsedOnDevice(cleanCode);
          return { ok: true };
        }
        return { ok: false, error: String(data.error || "تعذر تفعيل الكوبون.") };
      }

      // إذا لم تكن دالة RPC منشأة بعد في SQL، نستخدم تحديث احتياطي على الجداول
      if (error) {
        const { data: couponRow } = await supabase
          .from("coupons")
          .select("*")
          .ilike("code", cleanCode)
          .maybeSingle();

        if (!couponRow) {
          return { ok: false, error: "كود الخصم غير موجود." };
        }
        if (!couponRow.active) {
          return { ok: false, error: "هذا الكوبون متوقف أو منتهي الصلاحية." };
        }
        const maxUses = Number(couponRow.max_uses ?? 0);
        const usedCount = Number(couponRow.used_count ?? 0);
        if (maxUses > 0 && usedCount >= maxUses) {
          await supabase.from("coupons").update({ active: false }).eq("id", couponRow.id);
          return { ok: false, error: "عذرًا، تم استنفاد العدد المسموح لهذا الكوبون." };
        }

        const nextUsed = usedCount + 1;
        const nextActive = maxUses > 0 && nextUsed >= maxUses ? false : Boolean(couponRow.active);
        await supabase
          .from("coupons")
          .update({ used_count: nextUsed, active: nextActive })
          .eq("id", couponRow.id);

        try {
          await supabase.from("coupon_redemptions").insert({
            coupon_id: couponRow.id,
            coupon_code: couponRow.code,
            device_id: deviceId,
            customer_phone: cleanPhone,
          });
        } catch {
          // Ignore if coupon_redemptions table is not yet created
        }

        markCouponUsedOnDevice(cleanCode);
        return { ok: true };
      }
    } catch {
      // Fallback to local mark
    }
  }

  markCouponUsedOnDevice(cleanCode);
  return { ok: true };
}
