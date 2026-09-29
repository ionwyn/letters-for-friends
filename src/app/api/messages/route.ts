import { NextResponse } from "next/server";
import { isMaster } from "@/lib/auth";
import { db, type MessageRow } from "@/lib/db";
import { decode, createMessage } from "@/lib/messages";
import { jsonError, masterMutation, noStore } from "@/lib/http";

export async function GET() {
  if (!(await isMaster())) return jsonError("Master access required", 401);
  const rows = await db()`SELECT * FROM messages ORDER BY created_at DESC`;
  return NextResponse.json(
    {
      messages: (rows as MessageRow[]).map((row) => ({
        id: row.id,
        title: decode(row).title,
        status: row.status,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        revokedAt: row.revoked_at,
        expired:
          row.status === "active" &&
          !!row.expires_at &&
          new Date(row.expires_at).getTime() <= Date.now(),
      })),
    },
    { headers: noStore },
  );
}

export async function POST(request: Request) {
  const denied = await masterMutation(request);
  if (denied) return denied;
  const id = await createMessage();
  return NextResponse.json({ id }, { status: 201, headers: noStore });
}
