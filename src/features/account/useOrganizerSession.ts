"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { cloudConfigured, getCloudClient } from "./client";

export function useOrganizerSession() {
  const configured = cloudConfigured();
  const [state, setState] = useState<{
    user: User | null;
    loading: boolean;
    error: string;
  }>({ user: null, loading: configured, error: "" });
  useEffect(() => {
    const client = getCloudClient();
    if (!client) return;
    let alive = true;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (alive)
        setState({ user: session?.user ?? null, loading: false, error: "" });
    });
    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (alive)
          setState({
            user: data.session?.user ?? null,
            loading: false,
            error: error
              ? "Your session could not be restored. Please sign in again."
              : "",
          });
      })
      .catch(() => {
        if (alive)
          setState({
            user: null,
            loading: false,
            error: "Your session could not be restored.",
          });
      });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);
  return { ...state, configured };
}
