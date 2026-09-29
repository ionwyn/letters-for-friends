import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { db, type AssetRow } from "@/lib/db";
import { authorizedMessage, decode } from "@/lib/messages";
import { usedAssets } from "@/lib/content";
import { jsonError } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
    return jsonError("File unavailable", 404);
  const rows = await db()`SELECT * FROM assets WHERE id = ${id}::uuid`;
  const asset = rows[0] as AssetRow | undefined;
  if (!asset) return jsonError("File unavailable", 404);
  const authorized = await authorizedMessage(asset.message_id);
  if (
    !authorized ||
    (!authorized.master &&
      !usedAssets(decode(authorized.row).content).includes(id))
  )
    return jsonError("File unavailable", 404);
  const result = await get(asset.blob_url, { access: "private" });
  if (!result?.stream || result.statusCode !== 200)
    return jsonError("File unavailable", 404);
  const inline =
    asset.content_type.startsWith("image/") ||
    asset.content_type.startsWith("video/") ||
    asset.content_type.startsWith("audio/") ||
    asset.content_type === "application/pdf";
  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": asset.content_type,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(asset.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
