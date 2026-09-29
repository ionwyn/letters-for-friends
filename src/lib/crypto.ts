import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

function authSecret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32)
    throw new Error("AUTH_SECRET must be at least 32 characters");
  return value;
}

function encryptionKey() {
  const value = process.env.ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error("ENCRYPTION_KEY must be 64 hexadecimal characters");
  }
  return Buffer.from(value, "hex");
}

export function keyedHash(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("hex");
}

export function sameSecret(a: string, b: string) {
  const left = Buffer.from(keyedHash(a), "hex");
  const right = Buffer.from(keyedHash(b), "hex");
  return timingSafeEqual(left, right);
}

export function validSignature(body: string, signature: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(
    Buffer.from(keyedHash(body), "hex"),
    Buffer.from(signature, "hex"),
  );
}

export function encryptJson(value: unknown, id: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(id));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptJson<T>(value: string, id: string): T {
  const [version, iv, tag, ciphertext] = value.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext)
    throw new Error("Invalid encrypted payload");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(id));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8"),
  ) as T;
}
