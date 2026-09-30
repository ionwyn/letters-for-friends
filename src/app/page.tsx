"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SiteShell } from "@/components/SiteShell";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("access") === "unavailable") {
      setError("This NFC link is unavailable. Enter your passcode instead.");
      window.history.replaceState({}, "", "/");
    }
    fetch("/api/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data.role === "reader") router.replace("/letter");
      })
      .catch(() => {});
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "reader", password: code }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "This passcode is unavailable");
      router.push("/letter");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SiteShell className="entry-shell">
      <div className="entry-layout">
        <div className="entry-card">
          <div className="card-body">
            <div className="envelope-mark">✉</div>
            <h2>Ion's Letter Project.</h2>
            <form onSubmit={submit}>
              <input
                id="code"
                type="password"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="off"
                placeholder="Enter your passcode"
                required
              />
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary-button" disabled={loading}>
                {loading ? "Opening…" : "Open letter"} <span>↗</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
