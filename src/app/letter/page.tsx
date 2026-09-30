"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteShell } from "@/components/SiteShell";
import { RichViewer } from "@/components/RichText";
import type { RichNode } from "@/lib/content";

type Letter = {
  id: string;
  title: string;
  content: RichNode;
  expiresAt: string | null;
};

export default function LetterPage() {
  const router = useRouter();
  const [letter, setLetter] = useState<Letter | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "gone">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await fetch("/api/session", { cache: "no-store" }).then(
        (response) => response.json(),
      );
      if (session.role !== "reader" || !session.id) {
        router.replace("/");
        return;
      }
      const response = await fetch(`/api/messages/${session.id}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        setState("gone");
        return;
      }
      setLetter(await response.json());
      setState("ready");
    })().catch(() => setState("gone"));
  }, [router]);

  async function remove() {
    if (
      !letter ||
      !window.confirm(
        "Remove this letter from your access permanently? This cannot be undone.",
      )
    )
      return;
    setBusy(true);
    const response = await fetch(`/api/messages/${letter.id}/revoke`, {
      method: "POST",
    });
    if (response.ok) {
      setLetter(null);
      setState("gone");
    } else {
      window.alert("Could not remove the letter. Please try again.");
      setBusy(false);
    }
  }

  async function keepPermanently() {
    if (
      !letter ||
      !window.confirm(
        "Keep this letter permanently? This removes the expiration for everyone who can access it.",
      )
    )
      return;
    setBusy(true);
    const response = await fetch(`/api/messages/${letter.id}/keep`, {
      method: "POST",
    });
    if (response.ok) {
      setLetter({ ...letter, expiresAt: null });
    } else {
      window.alert("Could not keep the letter. Please try again.");
    }
    setBusy(false);
  }

  async function leave() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <SiteShell className="reading-shell">
      <div className="letter-wrap">
        {state === "loading" ? (
          <p className="loading-copy">Finding your letter…</p>
        ) : state === "gone" ? (
          <div className="gone-state">
            <span className="eyebrow">LETTER UNAVAILABLE</span>
            <h1>This page has gone quiet.</h1>
            <p>The letter may have been removed or expired.</p>
            <button className="text-button" onClick={leave}>
              Return to the beginning ↗
            </button>
          </div>
        ) : (
          letter && (
            <>
              <div className="letter-meta">
                <span>Ion's Letter Project</span>
                <span>✳</span>
              </div>
              <article className="letter-paper">
                <h1>{letter.title}</h1>
                <RichViewer content={letter.content} />
              </article>
              <div className="letter-actions">
                <div className="letter-expiry">
                  <span>
                    {letter.expiresAt
                      ? `Available until ${new Date(letter.expiresAt).toLocaleDateString(undefined, { dateStyle: "long" })}`
                      : "Here to keep"}
                  </span>
                  {letter.expiresAt && (
                    <button
                      className="text-button keep-link"
                      onClick={keepPermanently}
                      disabled={busy}
                    >
                      Keep permanently for me
                    </button>
                  )}
                </div>
                <div>
                  <button className="text-button" onClick={leave}>
                    Close letter
                  </button>
                  <button
                    className="text-button danger-link"
                    onClick={remove}
                    disabled={busy}
                  >
                    Remove my access
                  </button>
                </div>
              </div>
            </>
          )
        )}
      </div>
    </SiteShell>
  );
}
