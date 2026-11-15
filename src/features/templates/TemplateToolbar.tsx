"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { LayoutDocument } from "../editor/layout";
import { useOrganizerSession } from "../account/useOrganizerSession";
import { preserveDraft, takeDraft, clearDraft } from "./draft";
import { loadTemplate, saveTemplate } from "./storage";
import styles from "./templates.module.css";

export default function TemplateToolbar({
  layout,
  onLoad,
}: {
  layout: LayoutDocument;
  onLoad: (document: LayoutDocument, name: string) => void;
}) {
  const { user, loading, configured } = useOrganizerSession();
  const ownerId = user?.id;
  const latestLayout = useRef(layout);
  useEffect(() => {
    latestLayout.current = layout;
  }, [layout]);
  const params = useSearchParams();
  const requested = params.get("template");
  const newDraft = params.get("new") === "1";
  const [selected, setSelected] = useState<{
    id: string;
    owner: string;
    name: string;
  } | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    if (!ownerId || !requested) return;
    const startingDraft = JSON.stringify(latestLayout.current);
    let alive = true;
    loadTemplate(requested)
      .then((template) => {
        if (!alive) return;
        if (JSON.stringify(latestLayout.current) !== startingDraft) {
          setError(
            "Your draft changed while the template was opening. Reopen it from My templates when you’re ready to replace the draft.",
          );
          return;
        }
        onLoad(template.document, template.name);
        setSelected({ id: template.id, owner: ownerId, name: template.name });
        setName(template.name);
        setMessage(`Opened ${template.name}.`);
        setError("");
      })
      .catch((failure) => {
        if (alive)
          setError(
            failure instanceof Error
              ? failure.message
              : "Could not open this template.",
          );
      });
    return () => {
      alive = false;
    };
  }, [ownerId, requested, onLoad]);
  useEffect(() => {
    if (loading || requested) return;
    let alive = true;
    Promise.resolve().then(() => {
      if (!alive) return;
      try {
        if (newDraft) {
          clearDraft();
          return;
        }
        const draft = takeDraft(user?.id ?? null);
        if (draft) {
          onLoad(draft, "Unsaved draft");
          setMessage(
            "Your unsaved draft has been restored. Save a template to keep it in your account.",
          );
        }
      } catch {
        setError(
          "Your draft could not be restored. Any cloud templates are still available in My templates.",
        );
      }
    });
    return () => {
      alive = false;
    };
  }, [loading, requested, newDraft, user?.id, onLoad]);
  function beforeNavigation(event: React.MouseEvent<HTMLAnchorElement>) {
    try {
      preserveDraft(layout, user?.id ?? null);
    } catch {
      event.preventDefault();
      setError(
        "Your draft could not be kept while changing pages. Export the layout before leaving.",
      );
    }
  }
  async function save(asNew = false) {
    if (!user || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const snapshot = structuredClone(layout);
    try {
      const template = await saveTemplate(
        name || snapshot.name,
        snapshot,
        asNew || selected?.owner !== user.id ? undefined : selected?.id,
      );
      setSelected({ id: template.id, owner: user.id, name: template.name });
      setName(template.name);
      setMessage(`Saved ${template.name} to your private cloud templates.`);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Your template wasn’t saved.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <section className={styles.toolbar} aria-label="Cloud layout templates">
      <div>
        <strong>Your layout, ready for next time.</strong>
        <p>
          {user
            ? "Save a private template and reopen it on any device."
            : "Sign in to keep your event layouts together."}
        </p>
      </div>
      {loading ? (
        <p role="status">Checking your session…</p>
      ) : user ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label>
            Template name
            <input
              name="templateName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={layout.name}
              maxLength={80}
              disabled={busy}
            />
          </label>
          <button className={styles.primary} disabled={busy} type="submit">
            {busy
              ? "Saving…"
              : selected?.owner === user.id
                ? "Save changes"
                : "Save template"}
          </button>
          {selected?.owner === user.id && (
            <button
              disabled={busy}
              type="button"
              onClick={() => void save(true)}
            >
              Save as new
            </button>
          )}
          <Link href="/templates" onClick={beforeNavigation}>
            My templates ↗
          </Link>
        </form>
      ) : (
        <Link
          href="/login"
          onClick={beforeNavigation}
          className={styles.primary}
        >
          {configured ? "Sign in to save →" : "Organizer login →"}
        </Link>
      )}
      {requested && !user && !loading && (
        <p>Sign in to open this private template.</p>
      )}
      <p role="alert" className={styles.error}>
        {error}
      </p>
      <p role="status" className={styles.success}>
        {message}
      </p>
    </section>
  );
}
