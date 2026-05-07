/**
 * Authenticated API client.
 * Reads the local auth session token and adds it as Bearer auth to every request.
 */
import { createClient } from "@/lib/auth/client";

// Default to same-origin so production builds keep working even when
// NEXT_PUBLIC_API_URL is not injected. /api/v1/* is proxied by Next/nginx.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getToken(): Promise<string | null> {
  const authClient = createClient();
  const {
    data: { session },
  } = await authClient.auth.getSession();
  return session?.access_token ?? null;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `${res.status} ${res.statusText}` }));
    throw new Error(err.detail ?? "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function requestFormData<T>(path: string, formData: FormData, method = "POST"): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // Do NOT set Content-Type — browser sets it automatically with boundary for multipart
  const res = await fetch(`${API_BASE}${path}`, { method, body: formData, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  postFormData: <T>(path: string, formData: FormData) => requestFormData<T>(path, formData),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// ─── Typed helpers ────────────────────────────────────────────────────────────

export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  plan: "free" | "pro" | "team";
  storage_region: string;
  storage_used_bytes: number;
  is_admin: boolean;
  created_at: string;
}

export interface BillingStatus {
  plan: string;
  storage_region: string;
  storage_used_bytes: number;
  usage: {
    active_jobs: number;
    concurrency_limit: number;
    presentations_this_month: number;
    monthly_limit: number | null;
  };
  prices: Record<string, string>;
  has_billing: boolean;
}

export interface OrgSummary {
  id: number;
  name: string;
  slug: string;
  plan: string;
  role: string;
  joined_at: string;
}

export interface OrgDetail extends OrgSummary {
  storage_used_bytes: number;
  created_at: string;
}

export interface OrgMember {
  user_id: number;
  email: string;
  full_name: string;
  role: string;
  joined_at: string;
}

export interface ApiKey {
  id: number;
  label: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  key?: string; // Only present on creation
}

export interface ShareLink {
  id: number;
  presentation_id: string;
  token: string;
  mode: string;
  view_count: number;
  share_url: string;
  created_at: string;
}
