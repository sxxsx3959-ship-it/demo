import { dishes, MAX_QUANTITY, money, restaurant } from "./restaurant";
import areas from "./delivery-areas.json";
export class OrderError extends Error { constructor(message: string) { super(message); this.name = "OrderError"; } }
export function normalizePhone(value: string) {
  return value.replace(/[٠-٩]/g, x => String("٠١٢٣٤٥٦٧٨٩".indexOf(x))).replace(/[۰-۹]/g, x => String("۰۱۲۳۴۵۶۷۸۹".indexOf(x))).replace(/[\s()\-]/g, "");
}
function textField(value: unknown, min: number, max: number, label: string) {
  if (typeof value !== "string") throw new OrderError(`يرجى إدخال ${label}.`);
  const text = value.trim();
  if (text.length < min || text.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) throw new OrderError(`يرجى مراجعة ${label}.`);
  return text;
}
export function createOrderQuote(input: unknown, menu = dishes, deliveryAreas = areas) {
  if (!input || typeof input !== "object") throw new OrderError("بيانات الطلب غير صالحة.");
  const body = input as Record<string, unknown>;
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > menu.length) throw new OrderError("أضف وجبة إلى سلتك أولًا.");
  const ids = new Set<number>();
  const items = body.items.map(item => {
    if (!item || typeof item !== "object") throw new OrderError("يرجى مراجعة أصناف السلة.");
    const { id, quantity } = item;
    const dish = menu.find(d => d.id === id && d.available);
    if (!dish || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY || ids.has(id)) throw new OrderError("أحد الأصناف أو الكميات غير متاح. حدّث سلتك وحاول مجددًا.");
    ids.add(id);
    return { id, title: dish.title, quantity: quantity as number, price: dish.price, total: dish.price * quantity };
  });
  const name = textField(body.name, 2, 80, "الاسم");
  const phone = normalizePhone(textField(body.phone, 7, 24, "رقم الهاتف"));
  if (!/^(?:07\d{9}|\+?9647\d{9})$/.test(phone)) throw new OrderError("أدخل رقم موبايل عراقي صحيح، مثل 07XXXXXXXXX.");
  if (body.fulfillment !== "delivery" && body.fulfillment !== "pickup") throw new OrderError("اختر طريقة استلام الطلب.");
  const delivery = body.fulfillment === "delivery";
  const area = delivery ? deliveryAreas.find(a => a.id === body.areaId) : null;
  if (delivery && !area) throw new OrderError("اختر منطقة التوصيل من القائمة.");
  const address = delivery ? textField(body.address, 6, 250, "عنوان التوصيل بالتفصيل") : restaurant.address;
  const notes = textField(body.notes ?? "", 0, 500, "ملاحظات الطلب");
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const deliveryFee = area?.fee ?? 0;
  const total = subtotal + deliveryFee;
  const message = [
    `طلب جديد — ${restaurant.name} / ${restaurant.city}`,
    "────────────────", ...items.map(item => `${item.quantity} × ${item.title} — ${money(item.total)} د.ع`),
    "────────────────", `مجموع الأصناف: ${money(subtotal)} د.ع`,
    `طريقة الاستلام: ${delivery ? "توصيل إلى العنوان" : "استلام من المطعم"}`,
    `أجور التوصيل: ${money(deliveryFee)} د.ع`, `المجموع الكلي: ${money(total)} د.ع`,
    "────────────────", `الاسم: ${name}`, `الهاتف: ${phone}`,
    ...(area ? [`المنطقة: ${area.name}`] : []), `العنوان: ${address}`,
    ...(notes ? [`ملاحظات: ${notes}`] : []), "يرجى تأكيد توفر الطلب ووقت التجهيز.",
  ].join("\n");
  return { items, subtotal, deliveryFee, total, name, phone, address, notes, fulfillment: body.fulfillment, area: area?.name ?? null, whatsappUrl: `https://wa.me/${restaurant.whatsapp}?text=${encodeURIComponent(message)}` };
}
export type OrderQuote = ReturnType<typeof createOrderQuote>;
