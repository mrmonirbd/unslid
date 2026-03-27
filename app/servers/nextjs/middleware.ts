import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
];

// Routes that start with these prefixes are public
const PUBLIC_PREFIXES = [
  "/s/",
  "/api/auth/",
  "/accept-invite/",
  "/pdf-maker",   // accessed by Puppeteer headlessly — no user session available
];

// Routes that should be completely bypassed by this middleware
// (FastAPI handles its own auth via Bearer token — no need to proxy through Supabase session checks)
const BYPASS_PREFIXES = ["/api/v1/", "/app_data/"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pass FastAPI proxy routes straight through — Supabase session processing
  // can consume the POST body before Next.js forwards it to FastAPI.
  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute =
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  // Not authenticated and trying to access a protected route
  if (!user && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user trying to access auth pages → redirect to dashboard
  if (user && PUBLIC_ROUTES.includes(pathname) && pathname !== "/auth/callback") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/dashboard";
    homeUrl.searchParams.delete("redirectTo");
    return NextResponse.redirect(homeUrl);
  }

  // Authenticated user hitting the root "/" → redirect to dashboard
  // (The root page is the open-source API key setup wizard; in SaaS mode users skip it)
  if (user && pathname === "/") {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|apple-icon.png|icon1.svg|icon2.png|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
