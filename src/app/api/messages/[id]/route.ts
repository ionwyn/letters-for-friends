import { NextResponse } from "next/server";
import {
  authorizedMessage,
  decode,
  getMessage,
  saveMessage,
} from "@/lib/messages";
import { jsonError, masterMutation, noStore } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const authorized = await authorizedMessage(id);
  if (!authorized) return jsonError("Message unavailable", 404);
  const { row, master } = authorized;
  const payload = decode(row);
  return NextResponse.json(
    {
      id: row.id,
      title: payload.title,
      content: payload.content,
      ...(master ? { code: payload.code } : {}),
      status: row.status,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      revokedAt: row.revoked_at,
      expired: !master
        ? false
        : row.status === "active" &&
          !!row.expires_at &&
          new Date(row.expires_at).getTime() <= Date.now(),
    },
    { headers: noStore },
  );
}

export async function PATCH(request: Request, context: Context) {
  const denied = await masterMutation(request);
  if (denied) return denied;
  const { id } = await context.params;
  const row = await getMessage(id);
  if (!row) return jsonError("Message unavailable", 404);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Invalid message");
  try {
    await saveMessage(row, body as Record<string, unknown>);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    if (String(error).includes("duplicate key"))
      return jsonError("That passcode is already in use", 409);
    return jsonError(error instanceof Error ? error.message : "Unable to save");
  }
}
