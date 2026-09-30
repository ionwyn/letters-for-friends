import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { decryptJson } from "../src/lib/crypto";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  const statements = readFileSync(resolve("schema.sql"), "utf8")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql.query(statement);
  }

  const messages = (await sql.query(
    "SELECT id, encrypted_payload FROM messages",
  )) as { id: string; encrypted_payload: string }[];
  for (const message of messages) {
    decryptJson(message.encrypted_payload, message.id);
  }
  console.log(
    `Database schema is ready; ${messages.length} encrypted letter${messages.length === 1 ? "" : "s"} verified.`,
  );
}

main().catch((error) => {
  console.error("Database migration failed:", error);
  process.exitCode = 1;
});
