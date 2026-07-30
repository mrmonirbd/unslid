import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/api/can-change-keys",
  "/api/has-required-key",
  "/api/telemetry-status",
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
const RESERVED_IFRAME_SEGMENTS = new Set([
  "admin",
  "api",
  "app_data",
  "auth",
  "dashboard",
  "documents-preview",
  "forgot-password",
  "get-started",
  "login",
  "my-templates",
  "outline",
  "pdf-maker",
  "presentation",
  "reset-password",
  "schema",
  "settings",
  "signup",
  "template-preview",
  "templates",
  "theme",
  "upload",
]);

function hasIframeBootstrapParams(request: NextRequest) {
  const parts = request.nextUrl.pathname.split("/").filter(Boolean);
  if (parts.length !== 1 || RESERVED_IFRAME_SEGMENTS.has(parts[0])) return false;
  const params = request.nextUrl.searchParams;
  const hasApiKey = params.has("apiKey") || params.has("api_key") || params.has("apikey");
  const hasCustomerKey =
    params.has("customerKey") ||
    params.has("customer_key") ||
    params.has("customer") ||
    params.has("customerApiKey") ||
    params.has("customer_api_key") ||
    params.has("customerapikey");
  return hasApiKey && hasCustomerKey;
}

function isTemplateImagePlaceholder(pathname: string) {
  try {
    return /^\/\{\{image_\d+\}\}$/.test(decodeURIComponent(pathname));
  } catch {
    return false;
  }
}

function hasIframeModeParams(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return params.get("iframe") === "1" && Boolean(params.get("siteDomain"));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (isTemplateImagePlaceholder(pathname)) {
    return NextResponse.next();
  }

  const headerAuth = request.headers.get("authorization") ?? "";
  const headerToken = headerAuth.startsWith("Bearer ") ? headerAuth.slice(7) : "";
  const token = request.cookies.get(COOKIE_NAME)?.value ?? headerToken;
  const isPublicRoute =
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!token && hasIframeBootstrapParams(request)) {
    return NextResponse.next();
  }

  if (!token && hasIframeModeParams(request)) {
    return NextResponse.next();
  }

  if (!token && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    token &&
    PUBLIC_ROUTES.includes(pathname) &&
    pathname !== "/auth/callback" &&
    !pathname.startsWith("/api/")
  ) {
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
