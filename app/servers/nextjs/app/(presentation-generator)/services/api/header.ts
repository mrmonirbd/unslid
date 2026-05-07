import { createClient } from "@/lib/auth/client";

async function getAuthToken(): Promise<string | null> {
  try {
    const authClient = createClient();
    const { data: { session } } = await authClient.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

export const getHeader = async (): Promise<Record<string, string>> => {
  const token = await getAuthToken();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const getHeaderForFormData = async (): Promise<Record<string, string>> => {
  const token = await getAuthToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};
