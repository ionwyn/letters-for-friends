"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteShell } from "@/components/SiteShell";
import { RichEditor, RichViewer } from "@/components/RichText";
import type { RichNode } from "@/lib/content";

type Message = {
  id: string;
  title: string;
  code: string;
  content: RichNode;
  status: "draft" | "active" | "revoked";
  expiresAt: string | null;
  expired: boolean;
  revokedAt: string | null;
};

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function EditMessage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [message, setMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [permanent, setPermanent] = useState(false);
  const [date, setDate] = useState("");

  useEffect(() => {
    fetch(`/api/messages/${id}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          router.replace("/master");
          return;
        }
        const data = (await response.json()) as Message;
        if (!data.code) {
          router.replace("/master");
          return;
        }
        setMessage(data);
        setPermanent(!data.expiresAt);
        setDate(localDateTime(data.expiresAt));
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load this letter");
        setLoading(false);
      });
  }, [id, router]);

  async function save(publish: boolean) {
    if (!message) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const expiresAt = permanent
        ? null
        : date
          ? new Date(date).toISOString()
          : "";
      const response = await fetch(`/api/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: message.title,
          code: message.code,
          content: message.content,
          expiresAt,
          publish,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not save letter");
      setMessage({
        ...message,
        status: publish ? "active" : message.status,
        expiresAt,
        expired: !permanent && new Date(expiresAt!).getTime() <= Date.now(),
      });
      setNotice(
        publish
          ? "Letter is available to anyone with its passcode."
          : "Changes saved.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save letter",
      );
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (
      !message ||
      !window.confirm(
        "Remove recipient access permanently? You will still be able to read this letter, but the passcode can never be reactivated.",
      )
    )
      return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/messages/${id}/revoke`, {
      method: "POST",
    });
    if (response.ok) {
      setMessage({ ...message, status: "revoked" });
      setNotice("Recipient access removed permanently.");
    } else {
      setError("Could not remove access. Please try again.");
    }
    setBusy(false);
  }

  if (loading)
    return (
      <SiteShell>
        <div className="master-wrap">
          <p className="loading-copy">Opening your letter…</p>
        </div>
      </SiteShell>
    );
  if (!message)
    return (
      <SiteShell>
        <div className="master-wrap">
          <p className="form-error">{error || "Letter unavailable"}</p>
          <Link href="/master">← Back to letters</Link>
        </div>
      </SiteShell>
    );

  const readonly = message.status === "revoked";
  return (
    <SiteShell className="master-shell">
      <div className="edit-wrap">
        <div className="edit-topline">
          <Link href="/master" className="back-link">
            ← ALL LETTERS
          </Link>
          <span
            className={`status-chip ${readonly || message.expired ? "muted" : message.status === "active" ? "active" : ""}`}
          >
            {readonly
              ? "Removed"
              : message.expired
                ? "Expired"
                : message.status === "draft"
                  ? "Draft"
                  : "Available"}
          </span>
        </div>
        <div className="edit-heading">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />{" "}
              {readonly ? "ARCHIVED LETTER" : "A LETTER IN THE MAKING"}
            </div>
            <h1>{readonly ? "Words you gave." : "Make it personal."}</h1>
            <p>
              {readonly
                ? "Recipient access is permanently removed. This copy stays with you."
                : "Write freely. The only people who can read it are those with the passcode."}
            </p>
          </div>
          <div className="edit-actions">
            {!readonly && (
              <>
                <button
                  className="secondary-button"
                  onClick={() => setPreview(!preview)}
                >
                  {preview ? "Edit letter" : "Preview letter"}
                </button>
                <button
                  className="primary-button"
                  onClick={() => void save(message.status === "draft")}
                  disabled={busy}
                >
                  {busy
                    ? "Saving…"
                    : message.status === "draft"
                      ? "Publish letter ↗"
                      : "Save changes ↗"}
                </button>
              </>
            )}
          </div>
        </div>
        {notice && (
          <p className="form-notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="edit-grid">
          <section className="edit-main">
            <div className="section-label">01 / THE LETTER</div>
            {readonly || preview ? (
              <div className="editor-preview">
                <h2>{message.title}</h2>
                <RichViewer content={message.content} />
              </div>
            ) : (
              <>
                <label htmlFor="title" className="field-label">
                  TITLE
                </label>
                <input
                  id="title"
                  className="title-input"
                  value={message.title}
                  maxLength={160}
                  onChange={(event) =>
                    setMessage({ ...message, title: event.target.value })
                  }
                  placeholder="Give this letter a title"
                />
                <label className="field-label body-label">BODY</label>
                <RichEditor
                  messageId={id}
                  content={message.content}
                  onChange={(content) =>
                    setMessage((previous) =>
                      previous ? { ...previous, content } : previous,
                    )
                  }
                />
              </>
            )}
          </section>
          <aside className="edit-side">
            <div className="section-label">02 / ACCESS</div>
            <div className="side-panel">
              <label className="field-label" htmlFor="recipient-code">
                RECIPIENT PASSCODE
              </label>
              <p>
                Share this in person. Anyone with the code can open the letter.
              </p>
              <div className="code-row">
                <input
                  id="recipient-code"
                  value={message.code}
                  onChange={(event) =>
                    setMessage({ ...message, code: event.target.value })
                  }
                  disabled={readonly}
                  spellCheck={false}
                />
                <button
                  type="button"
                  title="Copy passcode"
                  onClick={() =>
                    void navigator.clipboard.writeText(message.code)
                  }
                >
                  Copy
                </button>
              </div>
              <div className="fine-print">
                Changing the passcode signs out existing readers.
              </div>
            </div>
            <div className="side-panel">
              <label className="field-label" htmlFor="expiry">
                EXPIRATION
              </label>
              <p>
                One month from creation by default. You can change it any time
                while access is active.
              </p>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={permanent}
                  disabled={readonly}
                  onChange={(event) => setPermanent(event.target.checked)}
                />{" "}
                Keep permanent
              </label>
              {!permanent && (
                <input
                  id="expiry"
                  className="date-input"
                  type="datetime-local"
                  value={date}
                  disabled={readonly}
                  onChange={(event) => setDate(event.target.value)}
                />
              )}
            </div>
            {!readonly && (
              <div className="side-panel remove-panel">
                <div className="field-label">REMOVE ACCESS</div>
                <p>
                  This permanently invalidates the passcode. Your copy remains
                  visible here.
                </p>
                <button
                  className="text-button danger-link"
                  disabled={busy}
                  onClick={() => void revoke()}
                >
                  Remove recipient access ↗
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </SiteShell>
  );
}
