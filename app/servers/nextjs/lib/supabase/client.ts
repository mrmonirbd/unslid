const TOKEN_KEY = "unslid_access_token";
const COOKIE_NAME = "unslid_access_token";

type AuthResponse<T = unknown> = Promise<{ data: T; error: { message: string } | null }>;
type LocalUser = {
  id: string;
  email?: string;
  full_name?: string;
  storage_region?: string;
  plan?: string;
  is_admin?: boolean;
  created_at?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function authRequest(path: string, body: unknown) {
  const res = await fetch(`/api/v1/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { data: null, error: { message: data.detail ?? "Authentication failed" } };
  }
  if (data.access_token) setToken(data.access_token);
  return { data, error: null };
}

function normalizeUser(user: LocalUser | null): LocalUser | null {
  if (!user) return null;
  return {
    ...user,
    id: String(user.id),
    user_metadata: {
      full_name: user.full_name,
      storage_region: user.storage_region,
      ...(user.user_metadata ?? {}),
    },
    app_metadata: {
      plan: user.plan,
      is_admin: user.is_admin,
      ...(user.app_metadata ?? {}),
    },
  };
}

export function createClient() {
  return {
    channel(_name: string, _options?: unknown) {
      const channel = {
        on(_type: string, _filter: unknown, _callback?: (event: any) => void) {
          return channel;
        },
        subscribe(callback?: (status: string) => void) {
          callback?.("SUBSCRIBED");
          return channel;
        },
        presenceState<T = unknown>(): Record<string, T[]> {
          return {};
        },
        async track(_payload?: unknown) {
          return "ok";
        },
        async send(_payload?: unknown) {
          return "ok";
        },
      };
      return channel;
    },
    removeChannel(_channel?: unknown) {
      return "ok";
    },
    auth: {
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        return authRequest("login", { email, password });
      },
      async signUp({
        email,
        password,
        options,
      }: {
        email: string;
        password: string;
        options?: { data?: Record<string, unknown>; emailRedirectTo?: string };
      }) {
        const metadata = options?.data ?? {};
        return authRequest("signup", {
          email,
          password,
          full_name: metadata.full_name ?? "",
          storage_region: metadata.storage_region ?? "eu",
          utm_source: metadata.utm_source,
          utm_medium: metadata.utm_medium,
          utm_campaign: metadata.utm_campaign,
        });
      },
      async signOut(): AuthResponse<null> {
        clearToken();
        return { data: null, error: null };
      },
      async getSession() {
        const access_token = getToken();
        return { data: { session: access_token ? { access_token, user: null } : null }, error: null };
      },
      async getUser() {
        const access_token = getToken();
        if (!access_token) return { data: { user: null }, error: null };
        const res = await fetch("/api/v1/auth/me", {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { data: { user: null }, error: { message: data.detail ?? "Not authenticated" } };
        return { data: { user: normalizeUser(data.user) }, error: null };
      },
      async updateUser(_attributes?: unknown) {
        return { data: null, error: { message: "Password update is not available for local auth yet." } };
      },
      async resetPasswordForEmail(_email?: string, _options?: unknown) {
        return { data: null, error: { message: "Password reset email is not available for local auth yet." } };
      },
    },
  };
}
