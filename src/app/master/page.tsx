"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteShell } from "@/components/SiteShell";

type Summary = {
  id: string;
  title: string;
  status: "draft" | "active" | "revoked";
  expired: boolean;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
};

export default function MasterPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Summary[]>([]);
  const [creating, setCreating] = useState(false);

  async function load() {
    const response = await fetch("/api/messages", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      setMessages(data.messages);
      setAuthorized(true);
    } else setAuthorized(false);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "master", password }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Incorrect password");
      return;
    }
    setPassword("");
    await load();
  }

  async function create() {
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/messages", { method: "POST" });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not create letter");
      router.push(`/master/${data.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create letter",
      );
      setCreating(false);
    }
  }

  async function signOut() {
    await fetch("/api/logout", { method: "POST" });
    setAuthorized(false);
    setMessages([]);
  }

  return (
    <SiteShell className="master-shell">
      <div className="master-wrap">
        {loading ? (
          <p className="loading-copy">Opening your desk…</p>
        ) : !authorized ? (
          <div className="master-login">
            <div className="eyebrow">
              <span className="eyebrow-line" /> PRIVATE WORKSPACE
            </div>
            <h1>
              Your letters,
              <br />
              <em>your space.</em>
            </h1>
            <p>Enter your master password to write and manage letters.</p>
            <form onSubmit={signIn}>
              <label htmlFor="master-password">MASTER PASSWORD</label>
              <input
                id="master-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary-button">
                Enter workspace <span>↗</span>
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="dashboard-heading">
              <div>
                <div className="eyebrow">
                  <span className="eyebrow-line" /> MASTER WORKSPACE
                </div>
                <h1>Letters</h1>
              </div>
              <button
                className="primary-button"
                onClick={create}
                disabled={creating}
              >
                {creating ? "Creating…" : "＋ New letter"}
              </button>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="dashboard-summary">
              <span>
                <strong>{messages.length}</strong> letters
              </span>
              <span>
                <strong>
                  {
                    messages.filter(
                      (message) =>
                        message.status === "active" && !message.expired,
                    ).length
                  }
                </strong>{" "}
                available
              </span>
              <span>
                <strong>
                  {
                    messages.filter((message) => message.status === "revoked")
                      .length
                  }
                </strong>{" "}
                removed
              </span>
            </div>
            <div className="list-heading">
              <span>ALL LETTERS</span>
              <span>STATUS / DATE</span>
            </div>
            {messages.length ? (
              <div className="message-list">
                {messages.map((message, index) => (
                  <Link
                    className="message-row"
                    href={`/master/${message.id}`}
                    key={message.id}
                  >
                    <span className="row-index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="row-title">{message.title}</span>
                    <span
                      className={`status-chip ${message.status === "revoked" ? "muted" : message.expired ? "muted" : message.status === "active" ? "active" : ""}`}
                    >
                      {message.status === "revoked"
                        ? "Removed"
                        : message.expired
                          ? "Expired"
                          : message.status === "draft"
                            ? "Draft"
                            : "Available"}
                    </span>
                    <span className="row-date">
                      {new Date(message.createdAt).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric", year: "numeric" },
                      )}
                    </span>
                    <span className="row-arrow">↗</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-list">
                <span>✳</span>
                <h2>Nothing on the page yet.</h2>
                <p>Your first letter starts here.</p>
              </div>
            )}
            <button className="text-button sign-out" onClick={signOut}>
              Sign out ↗
            </button>
          </>
        )}
      </div>
    </SiteShell>
  );
}
