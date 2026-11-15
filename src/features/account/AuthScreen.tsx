"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getCloudClient } from "./client";
import { useOrganizerSession } from "./useOrganizerSession";
import styles from "./account.module.css";

type Mode = "signin" | "signup" | "reset" | "update";
export default function AuthScreen({
  initialMode = "signin",
}: {
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { user, configured, loading } = useOrganizerSession();
  const router = useRouter();
  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setMessage("");
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const client = getCloudClient();
    if (!client) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "reset") {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage(
          "If an account exists for this email, a password reset link will arrive shortly.",
        );
      } else if (mode === "update") {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        setMessage("Your password has been updated.");
        router.push("/templates");
      } else if (mode === "signup") {
        const { data: result, error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/templates`,
            data: { organizer_name: String(data.get("name") ?? "").trim() },
          },
        });
        if (error) throw error;
        if (result.session) router.push("/templates");
        else
          setMessage(
            "Check your inbox to confirm your email, then sign in to see your templates.",
          );
      } else {
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/templates");
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "We couldn’t complete that request. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={styles.authPage}>
      <aside className={styles.story}>
        <Link href="/" className={styles.brand}>
          r↗ <span>RushLab.</span>
        </Link>
        <div className={styles.storyBody}>
          <p className={styles.eyebrow}>YOUR NEXT GREAT EVENT STARTS HERE</p>
          <h1>
            Good plans deserve
            <br />a place to
            <br />
            <em>come back to.</em>
          </h1>
          <p>
            Keep your venue layouts together. Pick up where you left off, and
            make your next event a little better.
          </p>
          <div className={styles.layoutIllustration} aria-hidden="true">
            <span>YOUR COLLECTION</span>
            <div className={styles.paper}>
              <div className={styles.paperStage}>MAIN STAGE</div>
              <div className={styles.paperPath} />
              <div className={styles.paperStalls}>
                <i />
                <i />
                <i />
                <i />
              </div>
              <strong>A space for your next big idea.</strong>
            </div>
            <div className={styles.paperBehind} />
          </div>
        </div>
        <p className={styles.storyFooter}>
          A little planning. A better gathering.
        </p>
      </aside>
      <section className={styles.formSide} aria-labelledby="account-heading">
        <Link href="/" className={styles.back}>
          ← Back to RushLab
        </Link>
        <div className={styles.formCard}>
          <p className={styles.eyebrow}>THE ORGANIZER’S CORNER</p>
          <h2 id="account-heading">
            {mode === "signup"
              ? "Make yourself at home."
              : mode === "reset"
                ? "A fresh start."
                : mode === "update"
                  ? "Choose a new password."
                  : "Welcome back."}
          </h2>
          <p className={styles.subtitle}>
            {mode === "signup"
              ? "Create your account and give your event ideas a home."
              : mode === "reset"
                ? "We’ll email you a link to reset your password."
                : mode === "update"
                  ? "Use the secure link from your email to update your password."
                  : "Sign in to your saved layouts and next big ideas."}
          </p>
          {!configured && (
            <p className={styles.notice} role="status">
              Cloud accounts aren’t connected yet. You can explore the workspace
              while setup is completed.
            </p>
          )}
          {loading ? (
            <p role="status">Restoring your session…</p>
          ) : user && mode !== "update" ? (
            <div className={styles.signedIn}>
              <p>You’re signed in as {user.email}.</p>
              <Link href="/templates" className={styles.primary}>
                Go to my templates →
              </Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              {mode === "signup" && (
                <label>
                  Your name
                  <input
                    name="name"
                    autoComplete="name"
                    maxLength={80}
                    placeholder="How should we call you?"
                    required
                    disabled={busy}
                  />
                </label>
              )}
              {mode !== "update" && (
                <label>
                  Email address
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="you@yourevent.com"
                    required
                    disabled={busy}
                  />
                </label>
              )}
              {mode !== "reset" && (
                <label>
                  Password
                  <span className={styles.passwordField}>
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        mode === "signin" ? "current-password" : "new-password"
                      }
                      minLength={mode === "signin" ? 1 : 8}
                      maxLength={128}
                      placeholder={
                        mode === "signin"
                          ? "Your password"
                          : "At least 8 characters"
                      }
                      required
                      disabled={busy}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </span>
                </label>
              )}
              {mode === "signin" && (
                <button
                  className={styles.forgot}
                  type="button"
                  onClick={() => switchMode("reset")}
                  disabled={busy}
                >
                  Forgot password?
                </button>
              )}
              <p role="alert" className={styles.error}>
                {error}
              </p>
              <p role="status" className={styles.success}>
                {message}
              </p>
              <button
                className={styles.primary}
                type="submit"
                disabled={!configured || busy || (mode === "update" && !user)}
              >
                {busy
                  ? "Please wait…"
                  : mode === "signup"
                    ? "Create my account →"
                    : mode === "reset"
                      ? "Send reset link →"
                      : mode === "update"
                        ? "Update password →"
                        : "Sign in →"}
              </button>
              {mode === "update" && !user && configured && (
                <p className={styles.notice}>
                  Open the password reset link from your email to continue.
                </p>
              )}
            </form>
          )}
          {mode !== "update" && (
            <p className={styles.switch}>
              {mode === "signin"
                ? "New to RushLab? "
                : "Already have an account? "}
              <button
                type="button"
                onClick={() =>
                  switchMode(mode === "signin" ? "signup" : "signin")
                }
                disabled={busy}
              >
                {mode === "signin" ? "Create an account" : "Sign in"}
              </button>
            </p>
          )}
          <div className={styles.divider}>
            <span>or keep exploring</span>
          </div>
          <Link href="/workspace" className={styles.guest}>
            Try the workspace without an account ↗
          </Link>
          <p className={styles.privacy}>
            Your saved templates are private to your account.
          </p>
        </div>
      </section>
    </main>
  );
}
