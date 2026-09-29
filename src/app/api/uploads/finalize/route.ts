import { head } from "@vercel/blob";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMessage } from "@/lib/messages";
import { jsonError, masterMutation, noStore } from "@/lib/http";

const allowed = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "application/pdf",
  "text/plain",
]);

export async function POST(request: Request) {
  const denied = await masterMutation(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as {
    url?: string;
    messageId?: string;
  } | null;
  if (!body?.url || !body.messageId || body.url.length > 2000)
    return jsonError("Invalid upload");
  const message = await getMessage(body.messageId);
  if (!message || message.status === "revoked")
    return jsonError("Message unavailable", 404);
  try {
    const blob = await head(body.url);
    const match = /^messages\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/([^/]+)$/i.exec(
      blob.pathname,
    );
    if (
      !match ||
      match[1] !== body.messageId ||
      !allowed.has(blob.contentType) ||
      blob.size > 100 * 1024 * 1024
    ) {
      return jsonError("Invalid uploaded file");
    }
    const filename = decodeURIComponent(match[3]).slice(0, 180);
    const id = match[2];
    await db()`INSERT INTO assets (id, message_id, blob_url, filename, content_type, size_bytes)
      VALUES (${id}::uuid, ${message.id}::uuid, ${blob.url}, ${filename}, ${blob.contentType}, ${blob.size})
      ON CONFLICT (id) DO NOTHING`;
    return NextResponse.json(
      { id, src: `/api/assets/${id}`, filename, contentType: blob.contentType },
      { headers: noStore },
    );
  } catch {
    return jsonError("Could not confirm the uploaded file");
  }
}
