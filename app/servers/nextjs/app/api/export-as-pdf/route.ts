import { sanitizeFilename } from "@/app/(presentation-generator)/utils/others";
import { createExportPage } from "@/utils/puppeteer-browser";
import { NextResponse, NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { id, title } = await req.json();
  if (!id) {
    return NextResponse.json(
      { error: "Missing Presentation ID" },
      { status: 400 }
    );
  }

  const port = process.env.PORT ?? "3000";
  const page = await createExportPage(req.headers.get("cookie"));

  try {
    await page.goto(`http://localhost:${port}/pdf-maker?id=${id}`, {
      waitUntil: "networkidle0",
      timeout: 300000,
    });

    if (page.url().includes("/login")) {
      throw new Error("Authentication required to export this presentation");
    }

    await page.waitForFunction('() => document.readyState === "complete"');

    try {
      await page.waitForFunction(
        `
        () => {
          const allElements = document.querySelectorAll('*');
          let loadedElements = 0;
          let totalElements = allElements.length;
          
          for (let el of allElements) {
              const style = window.getComputedStyle(el);
              const isVisible = style.display !== 'none' && 
                              style.visibility !== 'hidden' && 
                              style.opacity !== '0';
              
              if (isVisible && el.offsetWidth > 0 && el.offsetHeight > 0) {
                  loadedElements++;
              }
          }
          
          return (loadedElements / totalElements) >= 0.99;
        }
        `,
        { timeout: 300000 }
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.log("Warning: Some content may not have loaded completely:", error);
    }

    const pdfBuffer = await page.pdf({
      width: "1280px",
      height: "720px",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    await page.close();

    const sanitizedTitle = sanitizeFilename(title ?? "presentation");

    // Return the PDF buffer directly as a download — no filesystem access needed.
    const pdfArrayBuffer = new ArrayBuffer(pdfBuffer.byteLength);
    new Uint8Array(pdfArrayBuffer).set(pdfBuffer);
    return new NextResponse(pdfArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${sanitizedTitle}.pdf"`,
        "Content-Length": pdfBuffer.byteLength.toString(),
      },
    });
  } catch (err) {
    await page.close().catch(() => undefined);
    throw err;
  }
}
