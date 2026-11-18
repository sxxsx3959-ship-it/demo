"use client";
import { useRef, useState } from "react";
import { Icon } from "./Brand";
import { CART_KEY, restaurant } from "@/lib/restaurant";
import type { OrderQuote } from "@/lib/order";
import type { OrderReceipt } from "@/lib/order-types";
export default function OrderSubmit({ quote, order, onEdit, onPlaced }: { quote: OrderQuote; order: Record<string, unknown>; onEdit: () => void; onPlaced: () => void }) {
  const key = useRef("");
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function place() {
    if (busy || receipt) return;
    setBusy(true); setError("");
    if (!key.current) key.current = crypto.randomUUID();
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order, requestKey: key.current, expectedTotal: quote.total }), signal: AbortSignal.timeout(20000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setReceipt(data);
      try {
        localStorage.removeItem(CART_KEY);
      } catch { /* The receipt is still shown when local storage is unavailable. */ }
      onPlaced();
    } catch (e) { setError(e instanceof Error && e.name !== "TimeoutError" ? e.message : "تأخر الاتصال. جرّب مرة أخرى؛ لن نكرر نفس الطلب."); }
    finally { setBusy(false); }
  }
  if (receipt) {
    const url = new URL(quote.whatsappUrl);
    url.searchParams.set("text", `${url.searchParams.get("text")}\nرقم الطلب المسجل بالموقع: ${receipt.code}`);
    return <div className="placed-order" role="status"><span className="placed-check"><Icon name="check" size={28}/></span><p className="eyebrow">وصل إلى لوحة المطعم</p><h3>طلبك صار عندنا.</h3><p>رقم طلبك <b dir="ltr">{receipt.code}</b> — بانتظار تأكيد المطعم.</p><div className="placed-actions"><a className="button button-dark" href={`tel:${restaurant.phone}`}>اتصل بالمطعم <Icon name="phone" size={17}/></a><a className="button button-outline" href={url.toString()} target="_blank" rel="noopener noreferrer">أرسل نسخة على واتساب <Icon name="phone" size={16}/></a></div><small>احتفظ برقم الطلب، واذكره عند التواصل مع المطعم للاستفسار.</small></div>;
  }
  return <div className="order-confirm"><div className="confirm-explanation"><Icon name="bag" size={20}/><p>بالتأكيد، تُحفظ تفاصيل الطلب وبيانات التواصل والعنوان وتظهر لفريق المطعم. بعدها تحصل على رقم طلب تذكره عند التواصل مع المطعم.</p></div>{error && <p className="checkout-error" role="alert">{error}</p>}<div className="review-actions"><button className="button button-outline" disabled={busy} onClick={onEdit}>تعديل الطلب</button><button className="button button-dark" disabled={busy} onClick={place}>{busy ? "جارٍ إرسال الطلب…" : "تأكيد وإرسال الطلب للمطعم"}<Icon name="arrow" size={18}/></button></div></div>;
}
