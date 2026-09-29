import { NextResponse } from "next/server";
import { clearSession, sameOrigin } from "@/lib/auth";
import { jsonError, noStore } from "@/lib/http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin", 403);
  await clearSession();
  return NextResponse.json({ ok: true }, { headers: noStore });
}
