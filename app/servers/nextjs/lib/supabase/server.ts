import { cookies } from "next/headers";

const COOKIE_NAME = "unslid_access_token";

export async function createClient() {
  const cookieStore = await cookies();

  return {
    auth: {
      async getSession() {
        const access_token = cookieStore.get(COOKIE_NAME)?.value ?? null;
        return { data: { session: access_token ? { access_token } : null }, error: null };
      },
      async getUser() {
        const access_token = cookieStore.get(COOKIE_NAME)?.value ?? null;
        if (!access_token) return { data: { user: null }, error: null };
        return { data: { user: { access_token } }, error: null };
      },
    },
  };
}
