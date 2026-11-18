import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { dishes as defaults, type Dish } from "./restaurant";
import defaultAreas from "./delivery-areas.json";
import { createOrderQuote, type OrderQuote } from "./order";
import { nextStatuses, type DeliveryArea, type OrderStatus, type OrderEvent } from "./order-types";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const globalDb = globalThis as typeof globalThis & { hadramoutDb?: DatabaseSync };
export function db() {
  if (!globalDb.hadramoutDb) {
    const path = resolve(/* turbopackIgnore: true */ process.env.HADRAMOUT_DB_PATH || ".data/hadramout.sqlite");
    mkdirSync(dirname(path), { recursive: true });
    const connection = new DatabaseSync(path);
    connection.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS catalog (id INTEGER PRIMARY KEY, price INTEGER NOT NULL, available INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS areas (id TEXT PRIMARY KEY, fee INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, token TEXT UNIQUE NOT NULL, request_key TEXT UNIQUE NOT NULL, fingerprint TEXT NOT NULL, quote TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, eta INTEGER, events TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS order_created ON orders(created_at);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until_at INTEGER NOT NULL);`);
    for (const dish of defaults) connection.prepare("INSERT OR IGNORE INTO catalog VALUES (?, ?, ?)").run(dish.id, dish.price, dish.available ? 1 : 0);
    for (const area of defaultAreas) connection.prepare("INSERT OR IGNORE INTO areas VALUES (?, ?)").run(area.id, area.fee);
    connection.prepare("INSERT OR IGNORE INTO settings VALUES ('accepting', 'true')").run();
    globalDb.hadramoutDb = connection;
  }
  return globalDb.hadramoutDb;
}
export function catalog() {
  const prices = db().prepare("SELECT * FROM catalog").all() as unknown as { id: number; price: number; available: number }[];
  const fees = db().prepare("SELECT * FROM areas").all() as unknown as { id: string; fee: number }[];
  const accepting = (db().prepare("SELECT value FROM settings WHERE key='accepting'").get() as { value: string }).value === "true";
  return { dishes: defaults.map(d => { const row = prices.find(p => p.id === d.id)!; return { ...d, price: row.price, available: !!row.available }; }), areas: defaultAreas.map(a => ({ ...a, fee: fees.find(f => f.id === a.id)!.fee })), accepting };
}
export function limit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  db().prepare("DELETE FROM limits WHERE until_at < ?").run(now);
  db().prepare("INSERT INTO limits VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count=count+1").run(key, now + windowMs);
  return (db().prepare("SELECT count FROM limits WHERE key=?").get(key) as { count: number }).count <= max;
}
export class StoreError extends Error { constructor(message: string, public status = 400) { super(message); } }
type Row = { id: string; code: string; request_key: string; fingerprint: string; quote: string; status: OrderStatus; created_at: number; updated_at: number; eta: number | null; events: string };
const parse = (row: Row) => ({ id: row.id, code: row.code, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, etaMinutes: row.eta, quote: JSON.parse(row.quote) as OrderQuote, events: JSON.parse(row.events) as OrderEvent[] });
export function placeOrder(input: unknown, requestKey: string, expectedTotal: number) {
  if (!/^[0-9a-f-]{36}$/i.test(requestKey)) throw new StoreError("معرّف الطلب غير صالح. أعد فتح السلة.");
  const fingerprint = hash(JSON.stringify(input));
  const existing = db().prepare("SELECT * FROM orders WHERE request_key=?").get(requestKey) as Row | undefined;
  if (existing) {
    if (existing.fingerprint !== fingerprint) throw new StoreError("هذا الطلب مسجّل بتفاصيل مختلفة. راجع السلة.", 409);
    return { code: existing.code, total: (JSON.parse(existing.quote) as OrderQuote).total, createdAt: existing.created_at };
  }
  const live = catalog();
  if (!live.accepting) throw new StoreError("المطعم أوقف استقبال الطلبات مؤقتًا. حاول لاحقًا.", 409);
  const quote = createOrderQuote(input, live.dishes, live.areas);
  if (quote.total !== expectedTotal) throw new StoreError("تغيّر سعر أحد الأصناف أو التوصيل. ارجع وراجع المجموع الجديد قبل التأكيد.", 409);
  if (!limit(`phone:${hash(quote.phone)}`, 8, 10 * 60 * 1000)) throw new StoreError("لديك طلبات كثيرة خلال فترة قصيرة. يرجى التواصل مع المطعم.", 429);
  const now = Date.now(), id = randomUUID(), code = `HY-${randomBytes(4).toString("hex").toUpperCase()}`;
  // Keep the legacy required column populated with the internal ID for existing databases.
  // No customer access token is generated, returned or resolved.
  db().prepare("INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, NULL, ?)").run(id, code, id, requestKey, fingerprint, JSON.stringify(quote), now, now, JSON.stringify([{ status: "pending", at: now }]));
  return { code, total: quote.total, createdAt: now };
}
export function ownerSnapshot() {
  const orders = (db().prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 300").all() as unknown as Row[]).map(parse);
  const stats = db().prepare(`SELECT COUNT(*) as allTime, SUM(CASE WHEN status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) as active, SUM(CASE WHEN date(created_at/1000,'unixepoch','+3 hours')=date('now','+3 hours') THEN 1 ELSE 0 END) as today, SUM(CASE WHEN status='completed' AND date(updated_at/1000,'unixepoch','+3 hours')=date('now','+3 hours') THEN json_extract(quote,'$.total') ELSE 0 END) as completedValue FROM orders`).get();
  const popular = db().prepare(`SELECT json_extract(j.value,'$.title') as title, SUM(json_extract(j.value,'$.quantity')) as quantity FROM orders, json_each(quote,'$.items') j WHERE status='completed' GROUP BY title ORDER BY quantity DESC LIMIT 5`).all();
  return { orders, stats, popular, ...catalog(), serverTime: Date.now() };
}
export function updateOrder(id: string, status: OrderStatus, eta: unknown) {
  db().exec("BEGIN IMMEDIATE");
  try {
    const row = db().prepare("SELECT * FROM orders WHERE id=?").get(id) as Row | undefined;
    if (!row) throw new StoreError("الطلب غير موجود.", 404);
    if (!nextStatuses[row.status].includes(status)) throw new StoreError("تغيّرت حالة الطلب أو أن الانتقال غير مسموح. حدّث اللوحة.", 409);
    const quote = JSON.parse(row.quote) as OrderQuote;
    if (quote.fulfillment === "pickup" && status === "out_for_delivery") throw new StoreError("طلب الاستلام لا يخرج للتوصيل.");
    if (eta != null && (!Number.isInteger(eta) || Number(eta) < 5 || Number(eta) > 180)) throw new StoreError("مدة التجهيز يجب أن تكون بين 5 و180 دقيقة.");
    const now = Date.now(), events = JSON.parse(row.events);
    events.push({ status, at: now });
    db().prepare("UPDATE orders SET status=?, updated_at=?, eta=?, events=? WHERE id=?").run(status, now, eta == null ? row.eta : Number(eta), JSON.stringify(events), id);
    db().exec("COMMIT");
  } catch (error) { db().exec("ROLLBACK"); throw error; }
}
export function editCatalog(id: unknown, price: unknown, available: unknown) {
  if (!defaults.some(d => d.id === id) || !Number.isSafeInteger(price) || Number(price) < 1 || Number(price) > 1000000 || typeof available !== "boolean") throw new StoreError("راجع السعر وتوفر الصنف.");
  db().prepare("UPDATE catalog SET price=?, available=? WHERE id=?").run(Number(price), available ? 1 : 0, Number(id));
}
export function editArea(id: unknown, fee: unknown) {
  if (!defaultAreas.some(a => a.id === id) || !Number.isSafeInteger(fee) || Number(fee) < 0 || Number(fee) > 100000) throw new StoreError("راجع منطقة التوصيل وأجورها.");
  db().prepare("UPDATE areas SET fee=? WHERE id=?").run(Number(fee), String(id));
}
export type OwnerSnapshot = ReturnType<typeof ownerSnapshot>;
