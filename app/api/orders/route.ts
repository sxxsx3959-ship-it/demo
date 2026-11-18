import { NextRequest } from "next/server";
import { failure, json, readBody } from "@/lib/owner-auth";
import { placeOrder } from "@/lib/store";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);
    return json(placeOrder(body.order, String(body.requestKey || ""), Number(body.expectedTotal)), 201);
  } catch (error) { return failure(error); }
}
