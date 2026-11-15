import Link from "next/link";
import type { Metadata } from "next";
import DemoSignInForm from "../../features/account/DemoSignInForm";
import styles from "../../features/account/account.module.css";
export const metadata: Metadata = { title: "Sign in · RushLab" };
export default function LoginPage() {
  return (
    <main className={styles.authPage}>
      <aside className={styles.story}>
        <Link href="/" className={styles.brand}>
          r↗ <span>RushLab.</span>
        </Link>
        <div className={styles.storyBody}>
          <p className={styles.eyebrow}>YOUR NEXT GREAT EVENT STARTS HERE</p>
          <h1>
            Big ideas.
            <br />
            Better events.
            <br />
            <em>Let’s get started.</em>
          </h1>
          <p>
            Design your venue, watch your event come to life, and explore the
            possibilities.
          </p>
        </div>
        <p className={styles.storyFooter}>
          A little planning. A better gathering.
        </p>
      </aside>
      <section className={styles.formSide}>
        <Link href="/" className={styles.back}>
          ← Back to RushLab
        </Link>
        <div className={styles.formCard}>
          <p className={styles.eyebrow}>THE ORGANIZER’S CORNER</p>
          <h2>Welcome to RushLab.</h2>
          <p className={styles.subtitle}>Step into your event workspace.</p>
          <DemoSignInForm />
          <p className={styles.privacy}>
            Demo access. No account or password required.
          </p>
        </div>
      </section>
    </main>
  );
}
