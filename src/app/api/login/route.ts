import { NextResponse } from "next/server";
import { db, type MessageRow } from "@/lib/db";
import { codeHash, normalizeCode, accessible } from "@/lib/messages";
import { sameSecret } from "@/lib/crypto";
import {
  clearFailures,
  mayAttempt,
  recordFailure,
  sameOrigin,
  setSession,
} from "@/lib/auth";
import { jsonError, noStore } from "@/lib/http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin", 403);
  const body = (await request.json().catch(() => null)) as {
    mode?: string;
    password?: string;
  } | null;
  const mode = body?.mode === "master" ? "master" : "reader";
  const password = String(body?.password ?? "");
  if (password.length > 200 || !password) return jsonError("Enter a passcode");
  if (!(await mayAttempt(request, mode)))
    return jsonError("Too many attempts. Try again in 15 minutes.", 429);

  if (mode === "master") {
    if (
      !process.env.MASTER_PASSWORD ||
      !sameSecret(password, process.env.MASTER_PASSWORD)
    ) {
      await recordFailure(request, mode);
      return jsonError("Incorrect password", 401);
    }
    await clearFailures(request, mode);
    await setSession({ role: "master" });
    return NextResponse.json({ role: "master" }, { headers: noStore });
  }

  const normalized = normalizeCode(password);
  const rows =
    normalized.length >= 8 && normalized.length <= 64
      ? await db()`SELECT * FROM messages WHERE code_hash = ${codeHash(password)} LIMIT 1`
      : [];
  const row = rows[0] as MessageRow | undefined;
  if (!row || !accessible(row)) {
    await recordFailure(request, mode);
    return jsonError("This passcode is unavailable", 401);
  }
  await clearFailures(request, mode);
  await setSession({ role: "reader", id: row.id, version: row.access_version });
  return NextResponse.json(
    { role: "reader", id: row.id },
    { headers: noStore },
  );
}
