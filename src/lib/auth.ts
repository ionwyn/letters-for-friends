import { cookies } from "next/headers";
import { db } from "./db";
import { keyedHash, validSignature } from "./crypto";

type Session = {
  role: "master" | "reader";
  id?: string;
  version?: number;
  exp: number;
};
const COOKIE = "friends_session";

export async function session(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [body, signature] = raw.split(".");
  if (!body || !signature || !validSignature(body, signature)) return null;
  try {
    const data = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Session;
    return data.exp > Date.now() &&
      (data.role === "master" || data.role === "reader")
      ? data
      : null;
  } catch {
    return null;
  }
}

export async function setSession(value: Omit<Session, "exp">) {
  const maxAge = value.role === "master" ? 60 * 60 * 12 : 60 * 60 * 24 * 7;
  const body = Buffer.from(
    JSON.stringify({ ...value, exp: Date.now() + maxAge * 1000 }),
  ).toString("base64url");
  (await cookies()).set(COOKIE, `${body}.${keyedHash(body)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function isMaster() {
  return (await session())?.role === "master";
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const source = new URL(origin);
    const target = new URL(request.url);
    return source.host === target.host && source.protocol === target.protocol;
  } catch {
    return false;
  }
}

function attemptKey(request: Request, purpose: string) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return keyedHash(`${purpose}:${ip}`);
}

export async function mayAttempt(request: Request, purpose: string) {
  const key = attemptKey(request, purpose);
  const rows =
    await db()`SELECT blocked_until FROM login_attempts WHERE key = ${key}`;
  return (
    !rows[0]?.blocked_until ||
    new Date(String(rows[0].blocked_until)).getTime() < Date.now()
  );
}

export async function recordFailure(request: Request, purpose: string) {
  const key = attemptKey(request, purpose);
  await db()`INSERT INTO login_attempts (key, failures, window_started_at, blocked_until)
    VALUES (${key}, 1, now(), NULL)
    ON CONFLICT (key) DO UPDATE SET
      failures = CASE WHEN login_attempts.window_started_at < now() - interval '15 minutes' THEN 1 ELSE login_attempts.failures + 1 END,
      window_started_at = CASE WHEN login_attempts.window_started_at < now() - interval '15 minutes' THEN now() ELSE login_attempts.window_started_at END,
      blocked_until = CASE WHEN login_attempts.window_started_at >= now() - interval '15 minutes' AND login_attempts.failures >= 4 THEN now() + interval '15 minutes' ELSE NULL END`;
}

export async function clearFailures(request: Request, purpose: string) {
  await db()`DELETE FROM login_attempts WHERE key = ${attemptKey(request, purpose)}`;
}
