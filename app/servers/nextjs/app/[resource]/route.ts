import { NextRequest, NextResponse } from "next/server";

const TRANSPARENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9" viewBox="0 0 16 9"><rect width="16" height="9" fill="transparent"/></svg>`;
const FASTAPI_URL = process.env.FASTAPI_INTERNAL_URL ?? "http://localhost:8000";
const COOKIE_NAME = "unslid_access_token";

function firstParam(searchParams: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value) return value;
  }
  return "";
}

function errorPage(status: number, message: string) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${status}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#0f172a;font-family:Inter,system-ui,sans-serif}.box{text-align:center;padding:32px}h1{font-size:48px;margin:0 0 8px}p{color:#64748b;margin:0}</style></head><body><div class="box"><h1>${status}</h1><p>${message}</p></div></body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}

function publicOrigin(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "");
  const hostHeader =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    request.nextUrl.host;
  const host = hostHeader.replace(/^0\.0\.0\.0(?=:\d+)?/, "localhost");
  return `${protocol}://${host}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { resource: string } }
) {
  const resource = decodeURIComponent(params.resource || "");

  if (/^\{\{image_\d+\}\}$/.test(resource)) {
    return new Response(TRANSPARENT_SVG, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-store",
      },
    });
  }

  const searchParams = request.nextUrl.searchParams;
  const apiKey = firstParam(searchParams, ["apiKey", "api_key", "apikey"]);
  const customerApiKey = firstParam(searchParams, [
    "customerApiKey",
    "customer_api_key",
    "customerapikey",
  ]);
  const customerKey =
    firstParam(searchParams, ["customerKey", "customer_key", "customer"]) ||
    customerApiKey;

  if (!apiKey || !customerKey) {
    return new Response("Not found", { status: 404 });
  }

  const validation = await fetch(`${FASTAPI_URL}/api/v1/iframe/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      site_domain: resource,
      domain: resource,
      api_key: apiKey,
      customer_key: customerKey,
      customer_api_key: customerApiKey || null,
    }),
    cache: "no-store",
  });

  if (!validation.ok) {
    const data = await validation.json().catch(() => ({}));
    return errorPage(
      validation.status === 404 ? 404 : 502,
      data.detail || "Iframe validation failed."
    );
  }

  const data = await validation.json();
  const redirectUrl = new URL("/dashboard", publicOrigin(request));
  redirectUrl.searchParams.set("iframe", "1");
  redirectUrl.searchParams.set("siteDomain", resource);
  redirectUrl.searchParams.set("iframeToken", data.access_token);

  const response = NextResponse.redirect(redirectUrl);
  const isProd = process.env.NODE_ENV === "production";
  response.cookies.set(COOKIE_NAME, data.access_token, {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
  });
  return response;
}
