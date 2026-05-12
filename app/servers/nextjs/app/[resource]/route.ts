const TRANSPARENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9" viewBox="0 0 16 9"><rect width="16" height="9" fill="transparent"/></svg>`;

export async function GET(
  _request: Request,
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

  return new Response("Not found", { status: 404 });
}
