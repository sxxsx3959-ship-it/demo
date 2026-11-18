import { catalog } from "@/lib/store";
import { NextRequest, NextResponse } from "next/server";
import { createOrderQuote, OrderError } from "@/lib/order";
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "نوع الطلب غير مدعوم." }, { status: 415, headers });
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const source = new URL(origin);
      // Next.js can normalize its internal URL to the listening address. The Host header preserves the browser-facing host.
      const expectedHost = request.headers.get("host") || request.nextUrl.host;
      if (source.host !== expectedHost || !["http:", "https:"].includes(source.protocol)) return NextResponse.json({ error: "مصدر الطلب غير مسموح." }, { status: 403, headers });
    } catch { return NextResponse.json({ error: "مصدر الطلب غير مسموح." }, { status: 403, headers }); }
  }
  try {
    if (Number(request.headers.get("content-length") || 0) > 10000) return NextResponse.json({ error: "بيانات الطلب أطول من الحد المسموح." }, { status: 413, headers });
    const body = await request.text();
    if (body.length > 10000) return NextResponse.json({ error: "بيانات الطلب أطول من الحد المسموح." }, { status: 413, headers });
    const live = catalog();
    if (!live.accepting) return NextResponse.json({ error: "المطعم أوقف استقبال الطلبات مؤقتًا." }, { status: 409, headers });
    return NextResponse.json(createOrderQuote(JSON.parse(body), live.dishes, live.areas), { headers });
  } catch (error) {
    if (error instanceof OrderError || error instanceof SyntaxError) return NextResponse.json({ error: error instanceof OrderError ? error.message : "بيانات الطلب غير صالحة." }, { status: 400, headers });
    return NextResponse.json({ error: "تعذّر تجهيز الطلب الآن. حاول مجددًا أو اتصل بالمطعم." }, { status: 500, headers });
  }
}
