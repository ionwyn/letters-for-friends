import { NextResponse } from "next/server";
import { session, sameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMessage, accessible } from "@/lib/messages";
import { jsonError, noStore } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin", 403);
  const { id } = await context.params;
  const current = await session();
  const row = await getMessage(id);
  if (!row || !current) return jsonError("Message unavailable", 404);
  if (
    current.role === "reader" &&
    (current.id !== id ||
      current.version !== row.access_version ||
      !accessible(row))
  ) {
    return jsonError("Message unavailable", 404);
  }
  const changed =
    current.role === "reader"
      ? await db()`UPDATE messages SET status = 'revoked', revoked_at = now(), updated_at = now(),
        access_version = access_version + 1 WHERE id = ${id}::uuid AND status = 'active'
        AND access_version = ${current.version ?? -1} AND (expires_at IS NULL OR expires_at > now()) RETURNING id`
      : await db()`UPDATE messages SET status = 'revoked', revoked_at = now(), updated_at = now(),
        access_version = access_version + 1 WHERE id = ${id}::uuid AND status != 'revoked' RETURNING id`;
  if (!changed.length)
    return jsonError("Message has already been removed", 409);
  return NextResponse.json({ ok: true }, { headers: noStore });
}
