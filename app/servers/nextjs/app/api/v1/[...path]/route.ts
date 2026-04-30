/**
 * Catch-all proxy for /api/v1/* → FastAPI backend.
 *
 * Using an explicit route handler instead of next.config.mjs rewrites because
 * Next.js rewrites can silently drop the POST body in certain edge cases
 * (especially in dev mode or with large payloads), leading to 422 errors from
 * FastAPI ("Field required").
 *
 * This handler:
 *   - Reads the raw request body as an ArrayBuffer (no size limit, no parsing)
 *   - Forwards all relevant headers (preserving Content-Type, Authorization, etc.)
 *   - Streams the upstream response back to the browser (supports SSE / chunked)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FASTAPI_URL =
  process.env.FASTAPI_INTERNAL_URL ?? "http://localhost:8000";

// Headers that must not be forwarded (hop-by-hop)
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

type Ctx = { params: { path: string[] } };

async function proxy(request: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const segments = ctx.params.path ?? [];
  const search = request.nextUrl.search ?? "";
  const targetUrl = `${FASTAPI_URL}/api/v1/${segments.join("/")}${search}`;

  // Copy request headers, skipping hop-by-hop and rewriting Host
  const forwardHeaders = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (!HOP_BY_HOP.has(key.toLowerCase()) && key.toLowerCase() !== "host") {
      forwardHeaders.set(key, value);
    }
  }

  // Browser <img> requests cannot attach our API client's Bearer token.
  // Add the logged-in Supabase token from cookies so authenticated media
  // endpoints like PPTX template thumbnails can still render normally.
  if (!forwardHeaders.has("authorization")) {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      forwardHeaders.set("authorization", `Bearer ${session.access_token}`);
    }
  }

  // Read body for methods that carry a payload
  let body: BodyInit | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
  }

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers: forwardHeaders,
    body,
    cache: "no-store",
    // @ts-expect-error — Node 18+ fetch supports duplex for streaming uploads
    duplex: "half",
  });

  // Copy response headers, skipping hop-by-hop
  const responseHeaders = new Headers();
  for (const [key, value] of upstream.headers.entries()) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  }

  // Stream the upstream response body back (critical for SSE)
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
