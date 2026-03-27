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
      .catch(async (e) => {
        // FastAPI DB may be in degraded mode — fall back to Supabase session
        // so the user at least sees their email and admin status from the JWT.
        setError(e.message);
        try {
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const su = session.user;
            const meta = su.user_metadata ?? {};
            const appMeta = su.app_metadata ?? {};
            setUser({
              id: 0,
              email: su.email ?? "",
              full_name: meta.full_name ?? meta.name ?? su.email ?? "",
              plan: appMeta.plan ?? "free",
              storage_region: appMeta.storage_region ?? "eu",
              storage_used_bytes: 0,
              is_admin: appMeta.is_admin === true,
              created_at: su.created_at,
            });
          }
        } catch {
          // ignore fallback errors
        }
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
