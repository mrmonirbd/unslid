import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const FASTAPI_URL = process.env.FASTAPI_INTERNAL_URL ?? "http://localhost:8000";

type Ctx = { params: { path: string[] } };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const authClient = await createClient();
  const {
    data: { session },
  } = await authClient.auth.getSession();

  if (!session?.access_token) {
    return new NextResponse("Image not found", { status: 404 });
  }

  const imagePath = (ctx.params.path ?? []).map(encodeURIComponent).join("/");
  const upstream = await fetch(`${FASTAPI_URL}/app_data/images/${imagePath}`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return new NextResponse("Image not found", { status: upstream.status === 401 ? 404 : upstream.status });
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders.set("content-type", contentType);
  responseHeaders.set("cache-control", "private, no-store");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
