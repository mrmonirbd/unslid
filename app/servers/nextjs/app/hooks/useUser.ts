"use client";

import { useEffect, useState } from "react";
import { api, UserProfile } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

export function useUser() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<UserProfile>("/api/v1/account/me")
      .then(setUser)
      .catch((e) => {
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);

  return { user, loading, error };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.href = "/login";
}
