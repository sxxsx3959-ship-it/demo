"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./Brand";
import { calculateDiscount, dishImage, isCouponUsable, MAX_QUANTITY, money, normalizeCouponCode, restaurant, type CartItem } from "@/lib/restaurant";
import OrderSubmit from "./OrderSubmit";
import { useCatalog } from "@/lib/use-catalog";
import { createOrderQuote, normalizePhone, type OrderQuote } from "@/lib/order";
import { hasUsedCouponOnDevice, verifyCouponEligibility } from "@/lib/device-coupons";

type Props = { items: CartItem[]; onChange: (id: number, delta: number) => void; onRemove: (id: number) => void; onClose: () => void };

export default function Cart({ items, onChange, onRemove, onClose }: Props) {
  const { dishes, areas, accepting, coupons, couponsEnabled, featuredCouponCode } = useCatalog();

  function close() { onClose(); }
  const dialog = useRef<HTMLDialogElement>(null);
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [areaId, setAreaId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // حالة كوبون الخصم
  const [couponInput, setCouponInput] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [couponFeedback, setCouponFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const [quote, setQuote] = useState<OrderQuote | null>(null);

  const lines = items.flatMap(item => {
    const dish = dishes.find(d => d.id === item.id);
    return dish ? [{ ...item, dish }] : [];
  });
  const count = lines.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = lines.reduce((sum, item) => sum + item.dish.price * item.quantity, 0);
  const area = areas.find(a => a.id === areaId);
  const deliveryFee = fulfillment === "pickup" ? 0 : area?.fee;

  const hasUnavailable = lines.some(l => !l.dish.available);

  // الكوبون المطبق حالياً (يختفي تلقائياً إذا تم إيقافه أو استنفاد حده من الإدارة)
  const appliedCoupon =
    couponsEnabled && appliedCouponCode
      ? coupons.find(c => normalizeCouponCode(c.code) === appliedCouponCode && isCouponUsable(c)) ?? null
      : null;

  const minOrderUnmet = Boolean(appliedCoupon && appliedCoupon.minOrder > 0 && subtotal < appliedCoupon.minOrder);
  const discountAmount = appliedCoupon && !minOrderUnmet ? calculateDiscount(subtotal, appliedCoupon) : 0;
  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);

  // مقترحات «كمّل سفرتك؟» الذكية: أصناف متوفرة غير موجودة في السلة (المشروبات والإضافات أولاً)
  const upsellDishes = dishes
    .filter(d => d.available && !items.some(i => i.id === d.id))
    .sort((a, b) => {
      const aDrink = a.category === "drinks" ? 0 : 1;
      const bDrink = b.category === "drinks" ? 0 : 1;
      if (aDrink !== bDrink) return aDrink - bDrink;
      return a.price - b.price;
    })
    .slice(0, 3);

  // كوبون العرض البارز لتشجيع الزبون داخل السلة
  const promoCoupon =
    couponsEnabled && featuredCouponCode
      ? coupons.find(
          c =>
            normalizeCouponCode(c.code) === normalizeCouponCode(featuredCouponCode) &&
            isCouponUsable(c) &&
            !hasUsedCouponOnDevice(c.code)
        ) ?? null
      : null;

  // هدف الحد الأدنى للتحفيز (إما للكوبون المطبق أو لكوبون العرض البارز)
  const targetCouponForProgress = appliedCoupon && minOrderUnmet
    ? appliedCoupon
    : !appliedCoupon && promoCoupon && promoCoupon.minOrder > 0 && subtotal < promoCoupon.minOrder
      ? promoCoupon
      : null;
  const remainingForCoupon = targetCouponForProgress ? Math.max(0, targetCouponForProgress.minOrder - subtotal) : 0;
  const progressPercent = targetCouponForProgress && targetCouponForProgress.minOrder > 0
    ? Math.min(100, Math.round((subtotal / targetCouponForProgress.minOrder) * 100))
    : 0;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;
    dialog.current?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
      opener?.focus();
    };
  }, []);

  async function applyCoupon(overrideCode?: string) {
    if (checkingCoupon) return;
    const raw = typeof overrideCode === "string" ? overrideCode : couponInput;
    const code = normalizeCouponCode(raw);
    if (typeof overrideCode === "string") setCouponInput(code);
    if (!code) {
      setCouponFeedback({ ok: false, text: "أدخل كود الخصم أولاً." });
      return;
    }

    setCheckingCoupon(true);
    setCouponFeedback(null);
    try {
      const res = await verifyCouponEligibility(code, coupons);
      if (!res.ok) {
        setAppliedCouponCode(null);
        setCouponFeedback({ ok: false, text: res.error });
        return;
      }

      const found = res.coupon;
      if (found.minOrder > 0 && subtotal < found.minOrder) {
        setAppliedCouponCode(null);
        setCouponFeedback({ ok: false, text: `يتطلب هذا الكوبون طلباً بقيمة ${money(found.minOrder)} د.ع على الأقل.` });
        return;
      }

      setAppliedCouponCode(found.code);
      const label = found.discountType === "percent" ? `${found.discountValue}%` : `${money(found.discountValue)} د.ع`;
      setCouponFeedback({ ok: true, text: `تم تفعيل كود ${found.code} (خصم ${label})` });
    } finally {
      setCheckingCoupon(false);
    }
  }

  function removeCoupon() {
    setAppliedCouponCode(null);
    setCouponInput("");
    setCouponFeedback(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (!accepting) {
      setError("نعتذر منكم، استقبال الطلبات متوقف حالياً من قبل إدارة المطعم. نتشرف بخدمتكم لاحقاً.");
      return;
    }

    const unavailableDish = lines.find(l => !l.dish.available);
    if (unavailableDish) {
      setError(`الطبق "${unavailableDish.dish.title}" غير متوفر حالياً. يرجى حذفه من السلة لإكمال الطلب.`);
      return;
    }

    setLoading(true);
    setError("");
    try {
      let activeCouponsForQuote = coupons;
      let validatedCode: string | undefined = undefined;

      if (appliedCoupon && !minOrderUnmet) {
        const cleanPhone = normalizePhone(phone);
        const eligibility = await verifyCouponEligibility(appliedCoupon.code, coupons, cleanPhone);
        if (!eligibility.ok) {
          setAppliedCouponCode(null);
          setCouponFeedback({ ok: false, text: eligibility.error });
          setError(eligibility.error);
          return;
        }
        validatedCode = eligibility.coupon.code;
        activeCouponsForQuote = [
          eligibility.coupon,
          ...coupons.filter(c => normalizeCouponCode(c.code) !== eligibility.coupon.code),
        ];
      }

      const snapshot = {
        items: items.map(item => ({ ...item })),
        fulfillment,
        areaId,
        name,
        phone,
        address,
        notes,
        couponCode: validatedCode,
      };
      setQuote(createOrderQuote(snapshot, dishes, areas, activeCouponsForQuote));
      dialog.current?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تجهيز الطلب. تحقق من بياناتك وحاول مجددًا.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="cart-dialog"
      aria-labelledby="cart-title"
      onCancel={e => { e.preventDefault(); close(); }}
      onClick={e => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="cart-header">
        <div className="cart-title-row">
          <span className="cart-title-icon"><Icon name="bag" size={27}/></span>
          <div>
            <p className="eyebrow">حضرموت اليمني · الناصرية</p>
            <h2 id="cart-title">{quote ? "كل التفاصيل… على ذوقك." : "سلتك… وبالعافية مقدّمًا."}</h2>
          </div>
        </div>
        <button className="cart-close" onClick={close} aria-label="إغلاق السلة" autoFocus>
          <Icon name="close" size={22}/>
        </button>
      </div>

      {!accepting && (
        <div style={{
          background: "#fbf0e8",
          border: "1px solid #eccbb7",
          color: "#9b4e28",
          padding: "12px 18px",
          margin: "14px 20px 0",
          borderRadius: "10px",
          fontSize: "13px",
          lineHeight: "1.7",
          display: "flex",
          alignItems: "center",
          gap: "12px"
        }}>
          <Icon name="clock" size={24} />
          <div>
            <strong style={{ display: "block", fontSize: "14px", marginBottom: "2px" }}>استقبال الطلبات متوقف حالياً</strong>
            المطعم أوقف استقبال الطلبات مؤقتًا. يمكنك مراجعة المنيو وحساب الأصناف لكن لا يمكن إرسال الطلب حالياً.
          </div>
        </div>
      )}

      {hasUnavailable && (
        <div style={{
          background: "#fff2e8",
          border: "1px solid #f2c7a6",
          color: "#b05526",
          padding: "11px 18px",
          margin: "12px 20px 0",
          borderRadius: "10px",
          fontSize: "12px",
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          <Icon name="close" size={18} />
          <span>يوجد صنف غير متوفر حالياً في سلتك. اضغط على أيقونة الحذف المجاورة للصنف لتتمكن من إكمال طلبك.</span>
        </div>
      )}

      {lines.length === 0 ? (
        <div className="cart-empty">
          <div className="empty-bag"><Icon name="bag" size={58}/><span>✦</span></div>
          <p className="eyebrow">كل طلب حلو يبدأ باختيار</p>
          <h3>شنو مشتهي اليوم؟</h3>
          <p>سلتك فارغة حاليًا. اختر المندي أو وجبتك المفضلة،<br/>ونجهّز لك تفاصيل الطلب هنا.</p>
          <a className="button button-dark" href="#dishes" onClick={close}>
            استكشف المنيو <Icon name="arrow" size={18}/>
          </a>
        </div>
      ) : quote ? (
        <div className="order-review">
          <div className="review-ready">
            <span><Icon name="check" size={26}/></span>
            <div>
              <h3>طلبك جاهز للإرسال</h3>
              <p>راجع الوجبات والعنوان والمجموع قبل تأكيد طلبك.</p>
            </div>
          </div>
          <div className="review-columns">
            <div className="review-card">
              <h3><Icon name="bag" size={19}/> تفاصيل الطلب</h3>
              {quote.items.map(item => (
                <div className="review-line" key={item.id}>
                  <span><b>{item.quantity} ×</b> {item.title}</span>
                  <strong>{money(item.total)} <small>د.ع</small></strong>
                </div>
              ))}
              <div className="review-line summary-divider">
                <span>مجموع الأصناف</span>
                <strong>{money(quote.subtotal)} د.ع</strong>
              </div>
              {quote.discountAmount > 0 && quote.couponCode && (
                <div className="review-line coupon-discount-line">
                  <span>كود الخصم ({quote.couponCode})</span>
                  <strong>-{money(quote.discountAmount)} د.ع</strong>
                </div>
              )}
              <div className="review-line">
                <span>أجور التوصيل</span>
                <strong>{quote.fulfillment === "pickup" ? "استلام من المطعم" : `${money(quote.deliveryFee)} د.ع`}</strong>
              </div>
              <div className="review-total">
                <span>المجموع الكلي</span>
                <strong>{money(quote.total)} <small>د.ع</small></strong>
              </div>
            </div>
            <div className="review-card">
              <h3><Icon name={quote.fulfillment === "delivery" ? "truck" : "store"} size={21}/> {quote.fulfillment === "delivery" ? "يوصلك إلى" : "الاستلام من المطعم"}</h3>
              <p className="customer-name">{quote.name}</p>
              <p dir="ltr" className="customer-phone">{quote.phone}</p>
              {quote.area && <p className="customer-area">الناصرية · {quote.area}</p>}
              <p className="customer-address">{quote.address}</p>
              {quote.notes && (
                <div className="customer-notes">
                  <small>ملاحظاتك للمطعم</small>
                  <p>{quote.notes}</p>
                </div>
              )}
            </div>
          </div>
          <OrderSubmit
            quote={quote}
            onEdit={() => setQuote(null)}
            onCouponRedeemed={() => {
              setAppliedCouponCode(null);
              setCouponInput("");
              setCouponFeedback(null);
            }}
            onCouponRejected={msg => {
              setAppliedCouponCode(null);
              setCouponFeedback({ ok: false, text: msg });
              setError(msg);
              setQuote(null);
            }}
          />
        </div>
      ) : (
        <form className="cart-layout" onSubmit={submit}>
          <section className="cart-items-panel" aria-labelledby="cart-items-title">
            <div className="cart-section-title">
              <h3 id="cart-items-title"><span>01</span> اختياراتك اللذيذة</h3>
              <span className="cart-count-label">{count} في السلة</span>
            </div>
            <div className="cart-lines">
              {lines.map(({ id, quantity, dish }) => (
                <article className={`cart-line ${!dish.available ? "line-disabled" : ""}`} key={id}>
                  <img src={dishImage(dish.image)} alt={dish.title}/>
                  <div className="cart-line-body">
                    <h4>{dish.title}</h4>
                    {!dish.available && (
                      <span className="unavailable-line" style={{ color: "#bd4a27", fontWeight: "bold" }}>
                        غير متوفر حاليًا — احذفه لإكمال الطلب.
                      </span>
                    )}
                    <span className="unit-price">{money(dish.price)} د.ع للواحدة</span>
                    <div className="line-controls">
                      <div className="quantity-stepper">
                        <button
                          type="button"
                          onClick={() => onChange(id, 1)}
                          disabled={!dish.available || !accepting || quantity >= MAX_QUANTITY || loading}
                          aria-label={`زيادة ${dish.title}`}
                        >
                          <Icon name="plus" size={15}/>
                        </button>
                        <output aria-label={`كمية ${dish.title}`}>{quantity}</output>
                        <button
                          type="button"
                          onClick={() => onChange(id, -1)}
                          disabled={loading}
                          aria-label={`تقليل ${dish.title}`}
                        >
                          <Icon name="minus" size={15}/>
                        </button>
                      </div>
                      <button
                        type="button"
                        className="remove-item"
                        onClick={() => onRemove(id)}
                        disabled={loading}
                        aria-label={`حذف ${dish.title}`}
                      >
                        <Icon name="trash" size={15}/>
                      </button>
                    </div>
                  </div>
                  <strong className="line-total">{money(dish.price * quantity)}<small>د.ع</small></strong>
                </article>
              ))}
            </div>

            {accepting && upsellDishes.length > 0 && (
              <div className="cart-upsell" aria-label="أصناف مقترحة لإكمال طلبك">
                <div className="cart-upsell-head">
                  <span>✦ كمّل سفرتك؟</span>
                  <small>أضف بلمسة واحدة</small>
                </div>
                <div className="cart-upsell-list">
                  {upsellDishes.map(d => (
                    <div className="cart-upsell-item" key={d.id}>
                      <img src={dishImage(d.image)} alt={d.title} loading="lazy" />
                      <div className="cart-upsell-info">
                        <strong>{d.title}</strong>
                        <span>{money(d.price)} <small>د.ع</small></span>
                      </div>
                      <button
                        type="button"
                        className="cart-upsell-add"
                        onClick={() => onChange(d.id, 1)}
                        disabled={loading}
                        aria-label={`أضف ${d.title} إلى السلة`}
                      >
                        <Icon name="plus" size={13} /> أضف
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {couponsEnabled && (
              <div className="coupon-box">
                <div className="coupon-box-head">
                  <Icon name="tag" size={16} />
                  <span>عندك كود خصم؟</span>
                </div>
                {targetCouponForProgress && remainingForCoupon > 0 && (
                  <div className="coupon-progress-wrap">
                    <p>
                      أضف بـ <b>{money(remainingForCoupon)} د.ع</b> بعد حتى تستفيد من كود{" "}
                      <strong dir="ltr">{targetCouponForProgress.code}</strong>{" "}
                      (خصم {targetCouponForProgress.discountType === "percent"
                        ? `${targetCouponForProgress.discountValue}%`
                        : `${money(targetCouponForProgress.discountValue)} د.ع`})!
                    </p>
                    <div className="coupon-progress-track">
                      <span style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                )}
                {!appliedCoupon && promoCoupon && (promoCoupon.minOrder === 0 || subtotal >= promoCoupon.minOrder) && (
                  <div className="coupon-quick-promo">
                    <span>
                      ✦ عرض متاح الآن: <strong dir="ltr">{promoCoupon.code}</strong>{" "}
                      (خصم {promoCoupon.discountType === "percent" ? `${promoCoupon.discountValue}%` : `${money(promoCoupon.discountValue)} د.ع`})
                    </span>
                    <button
                      type="button"
                      className="coupon-quick-apply"
                      onClick={() => applyCoupon(promoCoupon.code)}
                      disabled={checkingCoupon}
                    >
                      تطبيق فوري
                    </button>
                  </div>
                )}
                {appliedCoupon ? (
                  <div className="coupon-applied-row">
                    <div>
                      <strong dir="ltr">{appliedCoupon.code}</strong>
                      <small>
                        {minOrderUnmet
                          ? `الحد الأدنى لتفعيل الخصم ${money(appliedCoupon.minOrder)} د.ع`
                          : `خصم ${appliedCoupon.discountType === "percent" ? `${appliedCoupon.discountValue}%` : `${money(appliedCoupon.discountValue)} د.ع`} (-${money(discountAmount)} د.ع)`}
                      </small>
                    </div>
                    <button type="button" className="coupon-remove-btn" onClick={removeCoupon}>
                      إزالة
                    </button>
                  </div>
                ) : (
                  <div className="coupon-input-row">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={e => {
                        setCouponInput(e.target.value);
                        if (couponFeedback) setCouponFeedback(null);
                      }}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyCoupon();
                        }
                      }}
                      placeholder="أدخل كود الكوبون..."
                      aria-label="كود الخصم"
                      dir="ltr"
                      maxLength={32}
                    />
                    <button type="button" className="coupon-apply-btn" onClick={() => applyCoupon()} disabled={checkingCoupon}>
                      {checkingCoupon ? "جارٍ الفحص..." : "تطبيق"}
                    </button>
                  </div>
                )}
                {couponFeedback && !appliedCoupon && (
                  <p className={`coupon-msg ${couponFeedback.ok ? "ok" : "err"}`} role="status">
                    {couponFeedback.text}
                  </p>
                )}
              </div>
            )}

            <div className="cart-receipt">
              <p>
                <span>مجموع الأصناف</span>
                <strong data-testid="subtotal">{money(subtotal)} <small>د.ع</small></strong>
              </p>
              {discountAmount > 0 && appliedCoupon && (
                <p className="coupon-discount-line">
                  <span>خصم الكوبون <small dir="ltr">({appliedCoupon.code})</small></span>
                  <strong data-testid="discount">-{money(discountAmount)} <small>د.ع</small></strong>
                </p>
              )}
              <p>
                <span>أجور التوصيل {area && fulfillment === "delivery" && <small>· {area.name}</small>}</span>
                <strong data-testid="delivery-fee">{deliveryFee === undefined ? "اختر المنطقة" : deliveryFee === 0 ? "بدون توصيل" : `${money(deliveryFee)} د.ع`}</strong>
              </p>
              <div className="cart-grand-total">
                <span>{deliveryFee === undefined ? "المجموع قبل التوصيل" : "المجموع الكلي"}</span>
                <strong data-testid="grand-total">{money(subtotalAfterDiscount + (deliveryFee ?? 0))} <small>د.ع</small></strong>
              </div>
              <span className="receipt-note"><Icon name="check" size={13}/> أجور التوصيل والخصم ظاهرة قبل إرسال طلبك</span>
            </div>
            <a href="#dishes" onClick={close} className="continue-shopping">
              <Icon name="plus" size={16}/> أضف شي لذيذ بعد
            </a>
          </section>

          <section className="cart-details-panel" aria-labelledby="delivery-title">
            <div className="cart-section-title">
              <h3 id="delivery-title"><span>02</span> وين تحب تستلم؟</h3>
            </div>
            <fieldset className="fulfillment-toggle">
              <legend className="sr-only">طريقة استلام الطلب</legend>
              <label className={fulfillment === "delivery" ? "active" : ""}>
                <input
                  type="radio"
                  name="fulfillment"
                  value="delivery"
                  checked={fulfillment === "delivery"}
                  onChange={() => { setFulfillment("delivery"); setError(""); }}
                />
                <Icon name="truck" size={22}/>
                <span>توصيل للبيت</span>
              </label>
              <label className={fulfillment === "pickup" ? "active" : ""}>
                <input
                  type="radio"
                  name="fulfillment"
                  value="pickup"
                  checked={fulfillment === "pickup"}
                  onChange={() => { setFulfillment("pickup"); setError(""); }}
                />
                <Icon name="store" size={22}/>
                <span>استلام من المطعم</span>
              </label>
            </fieldset>

            <div className="customer-fields">
              <div className="field-pair">
                <label>
                  اسمك الكريم
                  <input
                    name="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="name"
                    placeholder="الاسم الكامل"
                  />
                </label>
                <label>
                  رقم الموبايل
                  <input
                    name="phone"
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                    maxLength={24}
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="07XX XXX XXXX"
                    dir="ltr"
                  />
                </label>
              </div>

              {fulfillment === "delivery" ? (
                <>
                  <label className="area-label">
                    منطقة التوصيل
                    <span className="city-label">الناصرية</span>
                    <div className="select-wrap">
                      <Icon name="pin" size={18}/>
                      <select
                        name="area"
                        value={areaId}
                        onChange={e => { setAreaId(e.target.value); setError(""); }}
                        required
                        aria-label="منطقة التوصيل"
                      >
                        <option value="" disabled>اختار منطقتك</option>
                        {areas.map(a => (
                          <option key={a.id} value={a.id}>{a.name} — {money(a.fee)} د.ع</option>
                        ))}
                      </select>
                      <span className="select-chevron">⌄</span>
                    </div>
                  </label>
                  {area && (
                    <div className="delivery-preview" aria-live="polite">
                      <Icon name="truck" size={20}/>
                      <span>التوصيل إلى <b>{area.name}</b></span>
                      <strong>{money(area.fee)} <small>د.ع</small></strong>
                    </div>
                  )}
                  <label>
                    العنوان بالتفصيل
                    <textarea
                      name="address"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      required
                      minLength={6}
                      maxLength={250}
                      autoComplete="street-address"
                      rows={2}
                      placeholder="اسم الشارع، أقرب نقطة دالة، رقم الدار…"
                    />
                  </label>
                </>
              ) : (
                <div className="pickup-address">
                  <Icon name="pin" size={24}/>
                  <div>
                    <b>ننتظرك في حضرموت اليمني</b>
                    <p>{restaurant.address}</p>
                    <a href={restaurant.map} target="_blank" rel="noopener noreferrer">
                      عرض الموقع على الخريطة <Icon name="arrow" size={13}/>
                    </a>
                  </div>
                </div>
              )}

              <label>
                ملاحظات للمطبخ <small>اختياري</small>
                <textarea
                  name="notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="نوع المشروب، طلب خاص، حساسية طعام…"
                />
              </label>
            </div>

            {error && <p className="checkout-error" role="alert">{error}</p>}

            <button
              className="button button-dark checkout-button"
              type="submit"
              disabled={loading || !accepting || hasUnavailable}
            >
              {loading ? (
                <><span className="loading-dot"/> جارٍ تجهيز التفاصيل…</>
              ) : !accepting ? (
                "استقبال الطلبات متوقف حالياً"
              ) : hasUnavailable ? (
                "يوجد صنف غير متوفر بالسلة"
              ) : (
                <>مراجعة الطلب <Icon name="arrow" size={18}/></>
              )}
            </button>
            <p className="checkout-hint">
              <Icon name="phone" size={13}/> راجع التفاصيل، وأرسل طلبك عبر واتساب
            </p>
          </section>
        </form>
      )}
      <div className="cart-bottom-brand">
        <span>مذاق يمني… بكرم أهل الناصرية.</span>
        <a href={`tel:${restaurant.phone}`}><Icon name="phone" size={13}/><span dir="ltr">{restaurant.phone}</span></a>
      </div>
    </dialog>
  );
}
