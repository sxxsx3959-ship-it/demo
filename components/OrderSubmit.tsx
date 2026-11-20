"use client";
import { useState } from "react";
import { Icon } from "./Brand";
import type { OrderQuote } from "@/lib/order";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { refreshCatalog, useCatalog } from "@/lib/use-catalog";
import { redeemCouponOnOrder } from "@/lib/device-coupons";

type Props = {
  quote: OrderQuote;
  onEdit: () => void;
  onCouponRedeemed?: () => void;
  onCouponRejected?: (message: string) => void;
};

export default function OrderSubmit({ quote, onEdit, onCouponRedeemed, onCouponRejected }: Props) {
  const { accepting } = useCatalog();
  const [opened, setOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [redeemed, setRedeemed] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");

  async function saveOrderToSupabase() {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const payload = {
        customer_name: quote.name,
        customer_phone: quote.phone,
        fulfillment: quote.fulfillment,
        area: quote.area,
        address: quote.address,
        notes: quote.notes,
        items: quote.items,
        subtotal: quote.subtotal,
        delivery_fee: quote.deliveryFee,
        coupon_code: quote.couponCode,
        discount_amount: quote.discountAmount,
        total: quote.total,
        status: "pending",
      };
      const { error } = await supabase.from("orders").insert(payload);
      if (error) {
        await supabase.from("orders").insert({
          customer_name: quote.name,
          customer_phone: quote.phone,
          fulfillment: quote.fulfillment,
          area: quote.area,
          address: quote.address,
          notes: quote.couponCode
            ? `${quote.notes ? quote.notes + " | " : ""}كوبون: ${quote.couponCode} (-${quote.discountAmount} د.ع)`
            : quote.notes,
          items: quote.items,
          subtotal: quote.subtotal,
          delivery_fee: quote.deliveryFee,
          total: quote.total,
          status: "pending",
        });
      }
    } catch (err) {
      console.warn("Could not save order copy to Supabase:", err);
    }
  }

  async function handleOrderClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!accepting) {
      e.preventDefault();
      alert("نعتذر منكم، تم إيقاف استقبال الطلبات من قبل المطعم.");
      return;
    }

    // إذا لم يكن هناك كوبون خصم (أو تم استهلاك الكوبون لهذا الطلب بالفعل)، يفتح رابط واتساب مباشرة
    if (!quote.couponCode || redeemed) {
      setOpened(true);
      setSaving(true);
      try {
        await saveOrderToSupabase();
      } finally {
        setSaving(false);
      }
      return;
    }

    // في حال وجود كوبون: نتحقق ونخصم الاستخدام ذريًا قبل فتح واتساب لمنع أي تلاعب أو تجاوز للحد
    e.preventDefault();
    if (saving) return;

    setCouponError("");
    setSaving(true);

    // نفتح نافذة مبدئية متزامنة لتفادي حظر النوافذ المنبثقة على الموبايل/سفاري
    const win = window.open("about:blank", "_blank");

    try {
      const result = await redeemCouponOnOrder(quote.couponCode, quote.phone);
      if (!result.ok) {
        if (win) win.close();
        const msg = result.error || "تعذر تفعيل الكوبون لهذا الطلب.";
        setCouponError(msg);
        onCouponRejected?.(msg);
        return;
      }

      setRedeemed(true);
      setOpened(true);
      onCouponRedeemed?.();
      await saveOrderToSupabase();
      refreshCatalog();

      if (win) {
        win.opener = null;
        win.location.href = quote.whatsappUrl;
      } else {
        setFallbackUrl(quote.whatsappUrl);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="order-confirm">
      <div className="confirm-explanation">
        <Icon name="whatsapp" size={23} />
        <p>نفتح واتساب برسالة تحتوي وجباتك وعنوانك والمجموع. اضغط «إرسال» داخل واتساب حتى يوصل طلبك للمطعم.</p>
      </div>
      {couponError && (
        <p className="checkout-error" role="alert" style={{ marginTop: "12px" }}>
          {couponError}
        </p>
      )}
      <div className="review-actions">
        <button className="button button-outline" onClick={onEdit} disabled={saving}>تعديل الطلب</button>
        <a
          className="button button-dark whatsapp-order-link"
          href={quote.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleOrderClick}
        >
          {saving ? "جارٍ تأكيد الطلب..." : "أرسل الطلب عبر واتساب"} <Icon name="whatsapp" size={20} />
        </a>
      </div>
      {fallbackUrl && (
        <p className="whatsapp-handoff-note" role="status">
          تم تأكيد الطلب والكوبون!{" "}
          <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", fontWeight: "bold" }}>
            اضغط هنا لفتح واتساب الآن
          </a>
        </p>
      )}
      {opened && !fallbackUrl && (
        <p className="whatsapp-handoff-note" role="status">
          كمّل الإرسال داخل واتساب وانتظر تأكيد المطعم. سلتك باقية إذا احتجت ترجع وتعدّل الطلب.
        </p>
      )}
    </div>
  );
}
