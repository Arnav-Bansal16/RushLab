"use client";
import { useRouter } from "next/navigation";
import styles from "./account.module.css";

/** Demo navigation only: inputs have no names and are never read, sent or stored. */
export default function DemoSignInForm() {
  const router = useRouter();
  return (
    <form
      action="/workspace"
      noValidate
      autoComplete="off"
      onSubmit={(event) => {
        event.preventDefault();
        router.push("/workspace");
      }}
    >
      <label>
        Username
        <input
          type="text"
          autoComplete="off"
          placeholder="Your username (optional)"
        />
      </label>
      <label>
        Password
        <input
          type="password"
          autoComplete="off"
          placeholder="Your password (optional)"
        />
      </label>
      <button type="submit" className={styles.primary}>
        Sign in →
      </button>
    </form>
  );
}
