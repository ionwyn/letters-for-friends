import { NextResponse } from "next/server";
import { isMaster, sameOrigin } from "./auth";

export const noStore = { "Cache-Control": "private, no-store" };

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: noStore });
}

export async function masterMutation(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin", 403);
  if (!(await isMaster())) return jsonError("Master access required", 401);
  return null;
}
