import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const FASTAPI_URL = process.env.FASTAPI_INTERNAL_URL ?? "http://localhost:8000";

type Ctx = { params: { path: string[] } };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const parts = ctx.params.path ?? [];
  const targetPath = parts.map(encodeURIComponent).join("/");
  const headers = new Headers();

  if (parts[0] === "images") {
    const authClient = await createClient();
    const {
      data: { session },
    } = await authClient.auth.getSession();

    if (!session?.access_token) {
      return new NextResponse("Image not found", { status: 404 });
    }
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const upstream = await fetch(`${FASTAPI_URL}/app_data/${targetPath}`, {
    headers,
    cache: "no-store",
  });

  if (!upstream.ok) {
    return new NextResponse("Not found", {
      status: parts[0] === "images" && upstream.status === 401 ? 404 : upstream.status,
    });
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders.set("content-type", contentType);
  responseHeaders.set("cache-control", parts[0] === "images" ? "private, no-store" : "public, max-age=60");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
