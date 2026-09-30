import { NextResponse } from "next/server";
import {
  getMessage,
  revokeNfcToken,
  rotateNfcToken,
} from "@/lib/messages";
import { jsonError, masterMutation, noStore } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const denied = await masterMutation(request);
  if (denied) return denied;
  const { id } = await context.params;
  const row = await getMessage(id);
  if (!row) return jsonError("Message unavailable", 404);
  try {
    const token = await rotateNfcToken(row);
    return NextResponse.json({ token }, { headers: noStore });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to create NFC access");
  }
}

export async function DELETE(request: Request, context: Context) {
  const denied = await masterMutation(request);
  if (denied) return denied;
  const { id } = await context.params;
  const row = await getMessage(id);
  if (!row) return jsonError("Message unavailable", 404);
  try {
    await revokeNfcToken(row);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to revoke NFC access");
  }
}
