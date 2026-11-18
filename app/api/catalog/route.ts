import { catalog } from "@/lib/store";
import { json } from "@/lib/owner-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() { return json(catalog()); }
