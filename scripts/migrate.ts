import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

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
  console.log("Database schema is ready.");
}

main().catch((error) => {
  console.error("Database migration failed:", error);
  process.exitCode = 1;
});
