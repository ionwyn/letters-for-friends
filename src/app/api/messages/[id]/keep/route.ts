import { NextResponse } from "next/server";
import { session, sameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { accessible, getMessage } from "@/lib/messages";
import { jsonError, noStore } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin", 403);
  const { id } = await context.params;
  const current = await session();
  const row = await getMessage(id);
  if (
    !row ||
    !current ||
    current.role !== "reader" ||
    current.id !== id ||
    current.version !== row.access_version ||
    !accessible(row)
  ) {
    return jsonError("Message unavailable", 404);
  }

  if (!row.expires_at) {
    return NextResponse.json({ ok: true }, { headers: noStore });
  }

  const changed = await db()`UPDATE messages SET expires_at = NULL, updated_at = now()
    WHERE id = ${id}::uuid AND status = 'active'
    AND access_version = ${current.version ?? -1}
    AND expires_at IS NOT NULL AND expires_at > now() RETURNING id`;
  if (!changed.length) return jsonError("Message unavailable", 409);

  return NextResponse.json({ ok: true }, { headers: noStore });
}
