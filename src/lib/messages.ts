import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { db, type MessageRow } from "./db";
import { decryptJson, encryptJson, keyedHash } from "./crypto";
import {
  cleanDocument,
  usedAssets,
  type Payload,
  type RichNode,
} from "./content";
import { session } from "./auth";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newCode() {
  const part = () =>
    Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join(
      "",
    );
  return `${part()}-${part()}-${part()}`;
}

export function normalizeCode(code: string) {
  return code.toUpperCase().replace(/[\s-]/g, "");
}

export function codeHash(code: string) {
  return keyedHash(`code:${normalizeCode(code)}`);
}

export function newNfcToken() {
  return randomBytes(32).toString("base64url");
}

export function validNfcToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function nfcTokenHash(token: string) {
  return keyedHash(`nfc:${token}`);
}

export function defaultExpiry() {
  const now = new Date();
  const day = now.getUTCDate();
  const firstNextMonth = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
      1,
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
    ),
  );
  const daysInNextMonth = new Date(
    Date.UTC(
      firstNextMonth.getUTCFullYear(),
      firstNextMonth.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
  firstNextMonth.setUTCDate(Math.min(day, daysInNextMonth));
  return firstNextMonth.toISOString();
}

export function decode(row: MessageRow) {
  return decryptJson<Payload>(row.encrypted_payload, row.id);
}

export function accessible(row: MessageRow) {
  return (
    row.status === "active" &&
    (!row.expires_at || new Date(row.expires_at).getTime() > Date.now())
  );
}

export async function getMessage(id: string): Promise<MessageRow | null> {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return null;
  const rows = await db()`SELECT * FROM messages WHERE id = ${id}::uuid`;
  return (rows[0] as MessageRow | undefined) ?? null;
}

export async function getMessageByNfcToken(token: string): Promise<MessageRow | null> {
  if (!validNfcToken(token)) return null;
  const rows =
    await db()`SELECT * FROM messages WHERE nfc_token_hash = ${nfcTokenHash(token)} LIMIT 1`;
  const row = rows[0] as MessageRow | undefined;
  return row && accessible(row) ? row : null;
}

export async function authorizedMessage(id: string) {
  const current = await session();
  const row = await getMessage(id);
  if (!row || !current) return null;
  if (current.role === "master") return { row, master: true };
  if (
    current.role === "reader" &&
    current.id === id &&
    current.version === row.access_version &&
    accessible(row)
  ) {
    return { row, master: false };
  }
  return null;
}

export async function assertAssetsBelongToMessage(doc: RichNode, id: string) {
  const assetIds = [...new Set(usedAssets(doc))];
  if (!assetIds.length) return;
  const rows = await db()`SELECT id FROM assets WHERE message_id = ${id}::uuid`;
  const allowed = new Set(rows.map((row) => String(row.id)));
  if (assetIds.some((assetId) => !allowed.has(assetId)))
    throw new Error("An attachment has not finished uploading");
}

export async function createMessage() {
  const id = randomUUID();
  const code = newCode();
  const payload: Payload = {
    title: "Untitled letter",
    code,
    content: { type: "doc", content: [{ type: "paragraph" }] },
  };
  const expiresAt = defaultExpiry();
  await db()`INSERT INTO messages (id, code_hash, encrypted_payload, expires_at)
    VALUES (${id}::uuid, ${codeHash(code)}, ${encryptJson(payload, id)}, ${expiresAt}::timestamptz)`;
  return id;
}

export async function saveMessage(
  row: MessageRow,
  data: Record<string, unknown>,
) {
  if (row.status === "revoked")
    throw new Error("Removed messages are read only");
  const title = String(data.title ?? "")
    .trim()
    .slice(0, 160);
  const code = String(data.code ?? "").trim();
  if (!title) throw new Error("Add a title");
  if (normalizeCode(code).length < 8 || normalizeCode(code).length > 64)
    throw new Error("Passcode must be 8 to 64 characters");
  const content = cleanDocument(data.content);
  await assertAssetsBelongToMessage(content, row.id);
  const expiresAt =
    data.expiresAt === null ? null : String(data.expiresAt ?? "");
  if (
    expiresAt !== null &&
    (!Number.isFinite(Date.parse(expiresAt)) ||
      Date.parse(expiresAt) <= Date.now())
  ) {
    throw new Error("Choose a future expiration or keep this permanent");
  }
  const old = decode(row);
  const changedCode = normalizeCode(old.code) !== normalizeCode(code);
  const nextStatus = data.publish === true ? "active" : row.status;
  const payload: Payload = {
    title,
    code,
    content,
    ...(old.nfcToken ? { nfcToken: old.nfcToken } : {}),
  };
  const changed =
    await db()`UPDATE messages SET code_hash = ${codeHash(code)}, encrypted_payload = ${encryptJson(payload, row.id)},
    expires_at = ${expiresAt}::timestamptz, status = ${nextStatus},
    access_version = access_version + ${changedCode ? 1 : 0}, updated_at = now()
    WHERE id = ${row.id}::uuid AND status != 'revoked' RETURNING id`;
  if (!changed.length) throw new Error("This letter has already been removed");
}

export async function rotateNfcToken(row: MessageRow) {
  if (row.status === "revoked") throw new Error("Removed messages are read only");
  const token = newNfcToken();
  const payload = { ...decode(row), nfcToken: token };
  const changed = await db()`UPDATE messages SET
    nfc_token_hash = ${nfcTokenHash(token)},
    encrypted_payload = ${encryptJson(payload, row.id)},
    access_version = access_version + 1,
    updated_at = now()
    WHERE id = ${row.id}::uuid AND status != 'revoked' RETURNING id`;
  if (!changed.length) throw new Error("This letter has already been removed");
  return token;
}

export async function revokeNfcToken(row: MessageRow) {
  if (row.status === "revoked") throw new Error("Removed messages are read only");
  const { nfcToken: _removed, ...payload } = decode(row);
  const changed = await db()`UPDATE messages SET
    nfc_token_hash = NULL,
    encrypted_payload = ${encryptJson(payload, row.id)},
    access_version = access_version + 1,
    updated_at = now()
    WHERE id = ${row.id}::uuid AND status != 'revoked' RETURNING id`;
  if (!changed.length) throw new Error("This letter has already been removed");
}
