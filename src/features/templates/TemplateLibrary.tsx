"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getCloudClient } from "../account/client";
import { useOrganizerSession } from "../account/useOrganizerSession";
import { listTemplates, type TemplateSummary } from "./storage";
import styles from "./templates.module.css";

export default function TemplateLibrary() {
  const {
    user,
    loading,
    configured,
    error: sessionError,
  } = useOrganizerSession();
  const ownerId = user?.id;
  const [collection, setCollection] = useState<{
    owner: string;
    items: TemplateSummary[];
    error: string;
    loading: boolean;
  }>({ owner: "", items: [], error: "", loading: false });
  const [retry, setRetry] = useState(0);
  const [signoutError, setSignoutError] = useState("");
  useEffect(() => {
    if (!ownerId) return;
    let alive = true;
    listTemplates()
      .then((items) => {
        if (alive)
          setCollection({ owner: ownerId, items, error: "", loading: false });
      })
      .catch((error) => {
        if (alive)
          setCollection({
            owner: ownerId,
            items: [],
            error:
              error instanceof Error
                ? error.message
                : "Could not load templates.",
            loading: false,
          });
      });
    return () => {
      alive = false;
    };
  }, [ownerId, retry]);
  const belongsToUser = collection.owner === user?.id;
  async function signOut() {
    const { error } = await getCloudClient()!.auth.signOut();
    if (error) setSignoutError("Sign out failed. Please try again.");
  }
  return (
    <main className={styles.library}>
      <header className={styles.nav}>
        <Link href="/" className={styles.brand}>
          RushLab.
        </Link>
        <Link href="/workspace">Open workspace ↗</Link>
        {user && <button onClick={signOut}>Sign out</button>}
      </header>
      <section className={styles.libraryHeader}>
        <p className={styles.eyebrow}>YOUR ORGANIZER WORKSPACE</p>
        <h1>
          A home for your
          <br />
          <em>next great event.</em>
        </h1>
        <p>
          Keep your layouts close. Open a saved plan, make it your own, and get
          back to creating.
        </p>
        {user && <span className={styles.accountEmail}>{user.email}</span>}
      </section>
      {sessionError && <p role="alert">{sessionError}</p>}
      {signoutError && <p role="alert">{signoutError}</p>}
      {loading ? (
        <p role="status">Restoring your session…</p>
      ) : !configured || !user ? (
        <section className={styles.empty}>
          <span aria-hidden="true">⌘</span>
          <h2>
            {configured
              ? "Your templates are waiting."
              : "Your collection starts here."}
          </h2>
          <p>
            {configured
              ? "Sign in to save and reopen your event layouts across devices."
              : "Cloud accounts aren’t connected yet. You can still create and explore in the workspace."}
          </p>
          <Link
            className={styles.primary}
            href={configured ? "/login" : "/workspace"}
          >
            {configured ? "Sign in →" : "Explore the workspace →"}
          </Link>
        </section>
      ) : (
        <>
          <div className={styles.collectionHeading}>
            <h2>My layout templates</h2>
            <Link href="/workspace?new=1" className={styles.primary}>
              + Create a new layout
            </Link>
          </div>
          {!belongsToUser ? (
            <p role="status">Loading your templates…</p>
          ) : collection.error ? (
            <div className={styles.empty}>
              <p role="alert">{collection.error}</p>
              <button onClick={() => setRetry(retry + 1)}>Try again</button>
            </div>
          ) : collection.items.length === 0 ? (
            <section className={styles.empty}>
              <span aria-hidden="true">↗</span>
              <h2>Every great event starts with a blank canvas.</h2>
              <p>
                Create a layout, then choose Save template in the workspace. It
                will be here the next time you sign in.
              </p>
              <Link href="/workspace?new=1" className={styles.primary}>
                Create my first layout →
              </Link>
            </section>
          ) : (
            <div className={styles.cards}>
              {collection.items.map((template) => (
                <article key={template.id} className={styles.templateCard}>
                  <div className={styles.cardArt} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                    <span>YOUR EVENT PLAN</span>
                  </div>
                  <div className={styles.cardBody}>
                    <h3>{template.name}</h3>
                    <p>
                      Saved{" "}
                      {new Date(template.updated_at).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" },
                      )}
                    </p>
                    <Link
                      href={`/workspace?template=${encodeURIComponent(template.id)}`}
                    >
                      Open layout <span aria-hidden="true">↗</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
      <footer className={styles.footer}>
        Private to your account. Ready for your next event.
      </footer>
    </main>
  );
}
