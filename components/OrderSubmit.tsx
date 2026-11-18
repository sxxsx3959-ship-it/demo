"use client";
import { useState } from "react";
import { Icon } from "./Brand";
import type { OrderQuote } from "@/lib/order";
export default function OrderSubmit({ quote, onEdit }: { quote: OrderQuote; onEdit: () => void }) {
  const [opened, setOpened] = useState(false);
  return <div className="order-confirm">
    <div className="confirm-explanation"><Icon name="whatsapp" size={23}/><p>نفتح واتساب برسالة تحتوي وجباتك وعنوانك والمجموع. اضغط «إرسال» داخل واتساب حتى يوصل طلبك للمطعم.</p></div>
    <div className="review-actions"><button className="button button-outline" onClick={onEdit}>تعديل الطلب</button><a className="button button-dark whatsapp-order-link" href={quote.whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)}>أرسل الطلب عبر واتساب <Icon name="whatsapp" size={20}/></a></div>
    {opened && <p className="whatsapp-handoff-note" role="status">كمّل الإرسال داخل واتساب وانتظر تأكيد المطعم. سلتك باقية إذا احتجت ترجع وتعدّل الطلب.</p>}
  </div>;
}
