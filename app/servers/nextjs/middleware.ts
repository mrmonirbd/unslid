import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/google062401a5f7c9cb81.html",
  "/sitemap.xml",
];

const PUBLIC_PREFIXES = [
  "/s/",
  "/api/auth/",
  "/accept-invite/",
  "/pdf-maker",
];

const BYPASS_PREFIXES = ["/api/v1/", "/app_data/"];
const COOKIE_NAME = "unslid_access_token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const isPublicRoute =
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!token && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token && PUBLIC_ROUTES.includes(pathname) && pathname !== "/auth/callback") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/dashboard";
    homeUrl.searchParams.delete("redirectTo");
    return NextResponse.redirect(homeUrl);
  }

  if (token && pathname === "/") {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|apple-icon.png|icon1.svg|icon2.png|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
