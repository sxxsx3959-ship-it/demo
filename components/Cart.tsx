"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./Brand";
import { dishes, dishImage, MAX_QUANTITY, money, restaurant, type CartItem } from "@/lib/restaurant";
import areas from "@/lib/delivery-areas.json";
import OrderSubmit from "./OrderSubmit";
import { useCatalog } from "@/lib/use-catalog";
import type { OrderQuote } from "@/lib/order";

type Props = { items: CartItem[]; onChange: (id: number, delta: number) => void; onRemove: (id: number) => void; onClose: () => void; onComplete: () => void };
export default function Cart({ items, onChange, onRemove, onClose, onComplete }: Props) {
  const { dishes, areas } = useCatalog();
  const [placed, setPlaced] = useState(false);
  function close() { if (placed) onComplete(); else onClose(); }
  const dialog = useRef<HTMLDialogElement>(null);
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [areaId, setAreaId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reviewInput, setReviewInput] = useState<Record<string, unknown> | null>(null);
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [whatsappOpened, setWhatsappOpened] = useState(false);
  const lines = items.flatMap(item => { const dish = dishes.find(d => d.id === item.id); return dish ? [{ ...item, dish }] : []; });
  const count = lines.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = lines.reduce((sum, item) => sum + item.dish.price * item.quantity, 0);
  const area = areas.find(a => a.id === areaId);
  const deliveryFee = fulfillment === "pickup" ? 0 : area?.fee;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;
    dialog.current?.showModal();
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = old; opener?.focus(); };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true); setError("");
    const snapshot = { items: items.map(item => ({ ...item })), fulfillment, areaId, name, phone, address, notes };
    try {
      const response = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذّر تجهيز الطلب. حاول مجددًا.");
      setReviewInput(snapshot); setQuote(result); setWhatsappOpened(false);
      dialog.current?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { setError(err instanceof Error ? err.message : "تعذّر الاتصال. تحقق من الإنترنت وحاول مجددًا."); }
    finally { setLoading(false); }
  }
  return <dialog ref={dialog} className="cart-dialog" aria-labelledby="cart-title" onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="cart-header"><div className="cart-title-row"><span className="cart-title-icon"><Icon name="bag" size={27}/></span><div><p className="eyebrow">حضرموت اليمني · الناصرية</p><h2 id="cart-title">{quote ? "كل التفاصيل… على ذوقك." : "سلتك… وبالعافية مقدّمًا."}</h2></div></div><button className="cart-close" onClick={close} aria-label="إغلاق السلة" autoFocus><Icon name="close" size={22}/></button></div>
    {lines.length === 0 ? <div className="cart-empty"><div className="empty-bag"><Icon name="bag" size={58}/><span>✦</span></div><p className="eyebrow">كل طلب حلو يبدأ باختيار</p><h3>شنو مشتهي اليوم؟</h3><p>سلتك فارغة حاليًا. اختر المندي أو وجبتك المفضلة،<br/>ونجهّز لك تفاصيل الطلب هنا.</p><a className="button button-dark" href="#dishes" onClick={close}>استكشف المنيو <Icon name="arrow" size={18}/></a></div> : quote ? <div className="order-review"><div className="review-ready"><span><Icon name="check" size={26}/></span><div><h3>طلبك جاهز للإرسال</h3><p>راجع الوجبات والعنوان والمجموع قبل تأكيد طلبك.</p></div></div><div className="review-columns"><div className="review-card"><h3><Icon name="bag" size={19}/> تفاصيل الطلب</h3>{quote.items.map(item => <div className="review-line" key={item.id}><span><b>{item.quantity} ×</b> {item.title}</span><strong>{money(item.total)} <small>د.ع</small></strong></div>)}<div className="review-line summary-divider"><span>مجموع الأصناف</span><strong>{money(quote.subtotal)} د.ع</strong></div><div className="review-line"><span>أجور التوصيل</span><strong>{quote.fulfillment === "pickup" ? "استلام من المطعم" : `${money(quote.deliveryFee)} د.ع`}</strong></div><div className="review-total"><span>المجموع الكلي</span><strong>{money(quote.total)} <small>د.ع</small></strong></div></div><div className="review-card"><h3><Icon name={quote.fulfillment === "delivery" ? "truck" : "store"} size={21}/> {quote.fulfillment === "delivery" ? "يوصلك إلى" : "الاستلام من المطعم"}</h3><p className="customer-name">{quote.name}</p><p dir="ltr" className="customer-phone">{quote.phone}</p>{quote.area && <p className="customer-area">الناصرية · {quote.area}</p>}<p className="customer-address">{quote.address}</p>{quote.notes && <div className="customer-notes"><small>ملاحظاتك للمطعم</small><p>{quote.notes}</p></div>}</div></div><OrderSubmit quote={quote} order={reviewInput!} onEdit={() => setQuote(null)} onPlaced={() => setPlaced(true)}/></div> : <form className="cart-layout" onSubmit={submit}>
      <section className="cart-items-panel" aria-labelledby="cart-items-title"><div className="cart-section-title"><h3 id="cart-items-title"><span>01</span> اختياراتك اللذيذة</h3><span className="cart-count-label">{count} في السلة</span></div><div className="cart-lines">{lines.map(({ id, quantity, dish }) => <article className="cart-line" key={id}><img src={dishImage(dish.image)} alt={dish.title}/><div className="cart-line-body"><h4>{dish.title}</h4>{!dish.available && <span className="unavailable-line">غير متوفر حاليًا، احذفه لإكمال الطلب.</span>}<span className="unit-price">{money(dish.price)} د.ع للواحدة</span><div className="line-controls"><div className="quantity-stepper"><button type="button" onClick={() => onChange(id, 1)} disabled={!dish.available || quantity >= MAX_QUANTITY || loading} aria-label={`زيادة ${dish.title}`}><Icon name="plus" size={15}/></button><output aria-label={`كمية ${dish.title}`}>{quantity}</output><button type="button" onClick={() => onChange(id, -1)} disabled={loading} aria-label={`تقليل ${dish.title}`}><Icon name="minus" size={15}/></button></div><button type="button" className="remove-item" onClick={() => onRemove(id)} disabled={loading} aria-label={`حذف ${dish.title}`}><Icon name="trash" size={15}/></button></div></div><strong className="line-total">{money(dish.price * quantity)}<small>د.ع</small></strong></article>)}</div><div className="cart-receipt"><p><span>مجموع الأصناف</span><strong data-testid="subtotal">{money(subtotal)} <small>د.ع</small></strong></p><p><span>أجور التوصيل {area && fulfillment === "delivery" && <small>· {area.name}</small>}</span><strong data-testid="delivery-fee">{deliveryFee === undefined ? "اختر المنطقة" : deliveryFee === 0 ? "بدون توصيل" : `${money(deliveryFee)} د.ع`}</strong></p><div className="cart-grand-total"><span>{deliveryFee === undefined ? "المجموع قبل التوصيل" : "المجموع الكلي"}</span><strong data-testid="grand-total">{money(subtotal + (deliveryFee ?? 0))} <small>د.ع</small></strong></div><span className="receipt-note"><Icon name="check" size={13}/> أجور التوصيل ظاهرة قبل إرسال طلبك</span></div><a href="#dishes" onClick={close} className="continue-shopping"><Icon name="plus" size={16}/> أضف شي لذيذ بعد</a></section>
      <section className="cart-details-panel" aria-labelledby="delivery-title"><div className="cart-section-title"><h3 id="delivery-title"><span>02</span> وين تحب تستلم؟</h3></div><fieldset className="fulfillment-toggle"><legend className="sr-only">طريقة استلام الطلب</legend><label className={fulfillment === "delivery" ? "active" : ""}><input type="radio" name="fulfillment" value="delivery" checked={fulfillment === "delivery"} onChange={() => { setFulfillment("delivery"); setError(""); }}/><Icon name="truck" size={22}/><span>توصيل للبيت</span></label><label className={fulfillment === "pickup" ? "active" : ""}><input type="radio" name="fulfillment" value="pickup" checked={fulfillment === "pickup"} onChange={() => { setFulfillment("pickup"); setError(""); }}/><Icon name="store" size={22}/><span>استلام من المطعم</span></label></fieldset><div className="customer-fields"><div className="field-pair"><label>اسمك الكريم<input name="name" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={80} autoComplete="name" placeholder="الاسم الكامل"/></label><label>رقم الموبايل<input name="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} required maxLength={24} autoComplete="tel" inputMode="tel" placeholder="07XX XXX XXXX" dir="ltr"/></label></div>{fulfillment === "delivery" ? <><label className="area-label">منطقة التوصيل<span className="city-label">الناصرية</span><div className="select-wrap"><Icon name="pin" size={18}/><select name="area" value={areaId} onChange={e => { setAreaId(e.target.value); setError(""); }} required aria-label="منطقة التوصيل"><option value="" disabled>اختار منطقتك</option>{areas.map(a => <option key={a.id} value={a.id}>{a.name} — {money(a.fee)} د.ع</option>)}</select><span className="select-chevron">⌄</span></div></label>{area && <div className="delivery-preview" aria-live="polite"><Icon name="truck" size={20}/><span>التوصيل إلى <b>{area.name}</b></span><strong>{money(area.fee)} <small>د.ع</small></strong></div>}<label>العنوان بالتفصيل<textarea name="address" value={address} onChange={e => setAddress(e.target.value)} required minLength={6} maxLength={250} autoComplete="street-address" rows={2} placeholder="اسم الشارع، أقرب نقطة دالة، رقم الدار…"/></label></> : <div className="pickup-address"><Icon name="pin" size={24}/><div><b>ننتظرك في حضرموت اليمني</b><p>{restaurant.address}</p><a href={restaurant.map} target="_blank" rel="noopener noreferrer">عرض الموقع على الخريطة <Icon name="arrow" size={13}/></a></div></div>}<label>ملاحظات للمطبخ <small>اختياري</small><textarea name="notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} rows={2} placeholder="نوع المشروب، طلب خاص، حساسية طعام…"/></label></div>{error && <p className="checkout-error" role="alert">{error}</p>}<button className="button button-dark checkout-button" type="submit" disabled={loading}>{loading ? <><span className="loading-dot"/> جارٍ تجهيز التفاصيل…</> : <>مراجعة الطلب <Icon name="arrow" size={18}/></>}</button><p className="checkout-hint"><Icon name="phone" size={13}/> راجع التفاصيل، وأكّد طلبك مباشرة للمطعم</p></section>
    </form>}
    <div className="cart-bottom-brand"><span>مذاق يمني… بكرم أهل الناصرية.</span><a href={`tel:${restaurant.phone}`}><Icon name="phone" size={13}/><span dir="ltr">{restaurant.phone}</span></a></div>
  </dialog>;
}
