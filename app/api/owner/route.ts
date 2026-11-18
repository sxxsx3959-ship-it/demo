import { NextRequest } from "next/server";
import { authenticated, failure, json, login, logout, readBody } from "@/lib/owner-auth";
import { catalog, db, editArea, editCatalog, ownerSnapshot, StoreError, updateOrder } from "@/lib/store";
import { statusLabels, type OrderStatus } from "@/lib/order-types";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (!authenticated(request)) return json({ error: "يرجى تسجيل الدخول." }, 401);
  return json(ownerSnapshot());
}
export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);
    if (body.action === "login") { const response = json({ ok: true }); login(body.password, request, response); return response; }
    if (!authenticated(request)) return json({ error: "انتهت الجلسة. سجّل الدخول مجددًا." }, 401);
    if (body.action === "logout") { const response = json({ ok: true }); logout(request, response); return response; }
    if (body.action === "order") {
      if (typeof body.id !== "string" || typeof body.status !== "string" || !(body.status in statusLabels)) throw new StoreError("بيانات تحديث الطلب غير صالحة.");
      updateOrder(body.id, body.status as OrderStatus, body.eta);
    } else if (body.action === "dish") editCatalog(body.id, body.price, body.available);
    else if (body.action === "area") editArea(body.id, body.fee);
    else if (body.action === "accepting") {
      if (typeof body.accepting !== "boolean") throw new StoreError("الإعداد غير صالح.");
      db().prepare("UPDATE settings SET value=? WHERE key='accepting'").run(String(body.accepting));
    } else throw new StoreError("العملية غير مدعومة.");
    return json({ ok: true, catalog: catalog() });
  } catch (error) { return failure(error); }
}
