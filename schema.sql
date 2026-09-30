CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY,
  code_hash text NOT NULL UNIQUE,
  nfc_token_hash text,
  encrypted_payload text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'revoked')),
  expires_at timestamptz,
  access_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS nfc_token_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS messages_nfc_token_hash_idx
  ON messages(nfc_token_hash) WHERE nfc_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES messages(id),
  blob_url text NOT NULL UNIQUE,
  filename text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assets_message_id_idx ON assets(message_id);

CREATE TABLE IF NOT EXISTS login_attempts (
  key text PRIMARY KEY,
  failures integer NOT NULL,
  window_started_at timestamptz NOT NULL,
  blocked_until timestamptz
);
