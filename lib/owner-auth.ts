import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db, hash, limit, StoreError } from "./store";
export const sessionName = "hadramout_owner";
export function authenticated(request: NextRequest) {
  const token = request.cookies.get(sessionName)?.value;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return false;
  return !!db().prepare("SELECT token FROM sessions WHERE token=? AND expires>?").get(hash(token), Date.now());
}
export function login(password: unknown, request: NextRequest, response: NextResponse) {
  const key = hash(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local");
  if (!limit(`login:${key}`, 10, 15 * 60 * 1000)) throw new StoreError("محاولات كثيرة. حاول بعد 15 دقيقة.", 429);
  const stored = process.env.OWNER_PASSWORD_HASH;
  if (!stored) throw new StoreError("يجب إعداد كلمة مرور الإدارة على الخادم.", 503);
  const [salt, digest] = stored.split(":");
  if (typeof password !== "string" || password.length > 128 || !salt || !digest) throw new StoreError("كلمة المرور غير صحيحة.", 401);
  const actual = scryptSync(password, salt, 64), expected = Buffer.from(digest, "hex");
  if (expected.length !== actual.length || !timingSafeEqual(actual, expected)) throw new StoreError("كلمة المرور غير صحيحة.", 401);
  db().prepare("DELETE FROM limits WHERE key=?").run(`login:${key}`);
  db().prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
  const token = randomBytes(32).toString("hex");
  db().prepare("INSERT INTO sessions VALUES (?,?)").run(hash(token), Date.now() + 12 * 3600000);
  response.cookies.set(sessionName, token, { httpOnly: true, sameSite: "strict", secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https", maxAge: 12 * 3600, path: "/" });
}
export function logout(request: NextRequest, response: NextResponse) {
  const token = request.cookies.get(sessionName)?.value;
  if (token) db().prepare("DELETE FROM sessions WHERE token=?").run(hash(token));
  response.cookies.set(sessionName, "", { httpOnly: true, sameSite: "strict", maxAge: 0, path: "/" });
}
export async function readBody(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) { try { const url = new URL(origin); if (url.host !== (request.headers.get("host") || request.nextUrl.host) || !["http:", "https:"].includes(url.protocol)) throw new Error(); } catch { throw new StoreError("مصدر الطلب غير مسموح.", 403); } }
  if (!request.headers.get("content-type")?.includes("application/json")) throw new StoreError("نوع البيانات غير مدعوم.", 415);
  if (Number(request.headers.get("content-length")) > 16000) throw new StoreError("الطلب أكبر من المسموح.", 413);
  const body = await request.text();
  if (body.length > 16000) throw new StoreError("الطلب أكبر من المسموح.", 413);
  try { const data = JSON.parse(body); if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(); return data as Record<string, unknown>; } catch { throw new StoreError("بيانات الطلب غير صالحة."); }
}
export const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
export function failure(error: unknown) { return json({ error: error instanceof Error && (error instanceof StoreError || error.name === "OrderError") ? error.message : "تعذّر إكمال العملية. حاول مجددًا." }, error instanceof StoreError ? error.status : 400); }
