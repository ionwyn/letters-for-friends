import { neon } from "@neondatabase/serverless";

export function db() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

export type MessageRow = {
  id: string;
  code_hash: string;
  encrypted_payload: string;
  status: "draft" | "active" | "revoked";
  expires_at: string | null;
  access_version: number;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
};

export type AssetRow = {
  id: string;
  message_id: string;
  blob_url: string;
  filename: string;
  content_type: string;
  size_bytes: number;
};
