import { useState, useCallback } from "react";
import { toast } from "sonner";
import { ApiResponseHandler } from "@/app/(presentation-generator)/services/api/api-error-handler";
import { ProcessedSlide, SlideData, FontData } from "../types";

const SLIDE_WIDTH = 1280;
const SLIDE_HEIGHT = 720;
const DEFAULT_SLIDE_WIDTH_EMU = 12192000;
const DEFAULT_SLIDE_HEIGHT_EMU = 6858000;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const localName = (node: Element) =>
  node.localName || node.nodeName.split(":").pop() || "";

const descendants = (root: Element, name: string) =>
  Array.from(root.getElementsByTagName("*")).filter(
    (node) => localName(node) === name
  );

const firstDescendant = (root: Element, name: string) =>
  descendants(root, name)[0] as Element | undefined;

const getSlideAspectRatio = (slide: SlideData) => {
  const width = Number(slide.slide_width_emu || slide.slide_width_px);
  const height = Number(slide.slide_height_emu || slide.slide_height_px);

  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return `${width} / ${height}`;
  }

  return "16 / 9";
};

const emuToPx = (
  value: string | null,
  axis: "x" | "y",
  slideWidthEmu = DEFAULT_SLIDE_WIDTH_EMU,
  slideHeightEmu = DEFAULT_SLIDE_HEIGHT_EMU
) => {
  const numeric = Number(value || 0);
  const base = axis === "x" ? slideWidthEmu : slideHeightEmu;
  return (numeric / base) * (axis === "x" ? SLIDE_WIDTH : SLIDE_HEIGHT);
};

const extractEditableTextBoxes = (
  xmlContent?: string,
  slideWidthEmu?: number,
  slideHeightEmu?: number
) => {
  if (!xmlContent || typeof window === "undefined") {
    return "";
  }

  try {
    const doc = new DOMParser().parseFromString(xmlContent, "application/xml");
    const parserError = doc.getElementsByTagName("parsererror")[0];
    if (parserError) {
      return "";
    }

    const shapes = Array.from(doc.getElementsByTagName("*")).filter(
      (node) => localName(node) === "sp"
    );

    return shapes
      .map((shape, index) => {
        const textBody = firstDescendant(shape, "txBody");
        if (!textBody) {
          return "";
        }

        const paragraphs = descendants(textBody, "p")
          .map((paragraph) =>
            descendants(paragraph, "t")
              .map((textNode) => textNode.textContent || "")
              .join("")
              .trim()
          )
          .filter(Boolean);

        if (!paragraphs.length) {
          return "";
        }

        const xfrm = firstDescendant(shape, "xfrm");
        const off = xfrm ? firstDescendant(xfrm, "off") : undefined;
        const ext = xfrm ? firstDescendant(xfrm, "ext") : undefined;
        const left = emuToPx(off?.getAttribute("x") || "0", "x", slideWidthEmu, slideHeightEmu);
        const top = emuToPx(off?.getAttribute("y") || "0", "y", slideWidthEmu, slideHeightEmu);
        const width = Math.max(20, emuToPx(ext?.getAttribute("cx") || "0", "x", slideWidthEmu, slideHeightEmu));
        const height = Math.max(18, emuToPx(ext?.getAttribute("cy") || "0", "y", slideWidthEmu, slideHeightEmu));

        const runProps = firstDescendant(textBody, "rPr") || firstDescendant(textBody, "defRPr");
        const fontSize = runProps?.getAttribute("sz")
          ? Math.max(8, (Number(runProps.getAttribute("sz")) / 100) * 1.333)
          : Math.max(12, Math.min(42, (height / Math.max(1, paragraphs.length)) * 0.72));
        const isBold = runProps?.getAttribute("b") === "1";
        const isItalic = runProps?.getAttribute("i") === "1";
        const fontNode = firstDescendant(runProps || textBody, "latin");
        const fontFamily = fontNode?.getAttribute("typeface") || "Arial";
        const colorNode = firstDescendant(runProps || textBody, "srgbClr");
        const color = colorNode?.getAttribute("val") || "111827";
        const paragraphProps = firstDescendant(textBody, "pPr");
        const align =
          paragraphProps?.getAttribute("algn") === "ctr"
            ? "center"
            : paragraphProps?.getAttribute("algn") === "r"
              ? "right"
              : "left";
        const safeText = paragraphs.map(escapeHtml).join("<br />");
        const lineHeight = Math.max(
          1.05,
          Math.min(1.35, height / Math.max(fontSize, 1) / Math.max(paragraphs.length, 1))
        );

        const fontSizePx = Number(fontSize.toFixed(2));

        return `
  <div
    class="imported-editable-text"
    contenteditable="true"
    data-slide-text="${index + 1}"
    style="position:absolute;left:${((left / SLIDE_WIDTH) * 100).toFixed(3)}%;top:${((top / SLIDE_HEIGHT) * 100).toFixed(3)}%;width:${((width / SLIDE_WIDTH) * 100).toFixed(3)}%;min-height:${((height / SLIDE_HEIGHT) * 100).toFixed(3)}%;box-sizing:border-box;color:#${color};font-family:'${fontFamily.replace(/'/g, "\\'")}', Arial, sans-serif;font-size:clamp(8px, ${((fontSize / SLIDE_HEIGHT) * 100).toFixed(3)}cqh, ${fontSizePx}px);font-weight:${isBold ? 700 : 400};font-style:${isItalic ? "italic" : "normal"};line-height:${lineHeight.toFixed(2)};text-align:${align};white-space:pre-wrap;overflow:visible;outline:1px dashed transparent;transform:none;-webkit-text-size-adjust:100%;text-size-adjust:100%;"
  >${safeText}</div>`;
      })
      .join("");
  } catch (error) {
    console.warn("Could not extract editable text boxes from PPTX XML", error);
    return "";
  }
};

const buildPptxPreviewHtml = (slide: SlideData) => {
  const editableTextBoxes = extractEditableTextBoxes(
    slide.xml_content,
    slide.slide_width_emu,
    slide.slide_height_emu
  );
  const hasEditableText = editableTextBoxes.trim().length > 0;
  const editBackground = slide.textless_screenshot_url || slide.screenshot_url;

  return `
<div class="imported-slide-canvas relative mx-auto w-full max-w-[1280px] overflow-hidden bg-white" data-editable-text="${hasEditableText ? "true" : "false"}" style="position:relative;width:100%;max-width:1280px;aspect-ratio:${getSlideAspectRatio(slide)};background:#fff;container-type:size;">
  <img src="${slide.screenshot_url}" alt="Imported slide ${slide.slide_number}" class="imported-original-bg" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill;opacity:1;pointer-events:none;" draggable="false" />
  <img src="${editBackground}" alt="" class="imported-edit-bg" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill;opacity:0;pointer-events:none;" draggable="false" />
  <div class="imported-editable-layer" style="position:absolute;inset:0;width:100%;height:100%;z-index:40;opacity:0;pointer-events:${hasEditableText ? "auto" : "none"};">
${editableTextBoxes}
  </div>
</div>
`;
};

export const useSlideProcessing = (
  selectedFile: File | null,
  slides: ProcessedSlide[],
  setSlides: React.Dispatch<React.SetStateAction<ProcessedSlide[]>>,
  
  setFontsData: React.Dispatch<React.SetStateAction<FontData | null>>
) => {
  const [isProcessingPptx, setIsProcessingPptx] = useState(false);

  // Process individual slide to HTML
  const processSlideToHtml = useCallback(
    (slide: SlideData, index: number) => {
      console.log(`Loading PPTX preview for slide ${slide.slide_number}`);

      // Update slide to processing state
      setSlides((prev) =>
        prev.map((s, i) =>
          i === index ? { ...s, processing: true, error: undefined } : s
        )
      );

      try {
        const html = buildPptxPreviewHtml(slide);
        setSlides((prev) => {
          const newSlides = prev.map((s, i) =>
            i === index
              ? {
                  ...s,
                  processing: false,
                  processed: true,
                  html,
                }
              : s
          );

          const nextIndex = index + 1;
          if (
            nextIndex < newSlides.length &&
            !newSlides[nextIndex].processed &&
            !newSlides[nextIndex].processing
          ) {
            console.log(
              `Scheduling next slide ${nextIndex + 1} for processing`
            );
            setTimeout(() => {
              const nextSlide = newSlides[nextIndex];
              processSlideToHtml(nextSlide, nextIndex);
            }, 50);
          }

          return newSlides;
        });
      } catch (error) {
        console.error(`Error processing slide ${slide.slide_number}:`, error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load slide HTML";

        // Update slide with error
        setSlides((prev) => {
          const newSlides = prev.map((s, i) =>
            i === index
              ? {
                  ...s,
                  processing: false,
                  processed: false,
                  error: errorMessage,
                }
              : s
          );

          // Continue with next slide even if this one failed
          const nextIndex = index + 1;
          if (
            nextIndex < newSlides.length &&
            !newSlides[nextIndex].processed &&
            !newSlides[nextIndex].processing
          ) {
            console.log(`Scheduling next slide ${nextIndex + 1} after error`);
            setTimeout(() => {
              const nextSlide = newSlides[nextIndex];
              processSlideToHtml(nextSlide, nextIndex);
            }, 1000);
          }

          return newSlides;
        });
      }
    },
    [setSlides]
  );

  // Process PDF or PPTX file to extract slides
  const processFile = useCallback(async () => {
    if (!selectedFile) {
      toast.error("Please select a PDF or PPTX file first");
      return;
    }

    try {
      setIsProcessingPptx(true);

      const formData = new FormData();
      const fileName = selectedFile.name.toLowerCase();
      const isPdf = fileName.endsWith(".pdf");
      const isPptx = fileName.endsWith(".pptx");

      let slidesResponseData: any = null;
      if (isPdf) {
        formData.append("pdf_file", selectedFile);
        const pdfResponse = await fetch("/api/v1/ppt/pdf-slides/process", {
          method: "POST",
          body: formData,
        });
        slidesResponseData = await ApiResponseHandler.handleResponse(
          pdfResponse,
          "Failed to process PDF file"
        );
      } else if (isPptx) {
        formData.append("pptx_file", selectedFile);
        const pptxResponse = await fetch("/api/v1/ppt/pptx-slides/process", {
          method: "POST",
          body: formData,
        });
        slidesResponseData = await ApiResponseHandler.handleResponse(
          pptxResponse,
          "Failed to process PPTX file"
        );
      } else {
        throw new Error("Unsupported file type. Please upload a PDF or PPTX file.");
      }

      if (!slidesResponseData.success || !slidesResponseData.slides?.length) {
        throw new Error("No slides found in the uploaded file");
      }

      // Extract fonts data only for PPTX where available
      if (slidesResponseData.fonts) {
        setFontsData(slidesResponseData.fonts);
      }

      // Show the exact PPTX render as the preview, then reveal editable text
      // overlays in edit mode using the extracted PPTX XML.
      const initialSlides: ProcessedSlide[] = slidesResponseData.slides.map(
        (slide: any) => ({
          slide_number: slide.slide_number,
          screenshot_url: slide.screenshot_url,
          textless_screenshot_url: slide.textless_screenshot_url ?? null,
          xml_content: slide.xml_content ?? "",
          html_content: slide.html_content ?? null,
          normalized_fonts: slide.normalized_fonts ?? [],
          slide_width_emu: slide.slide_width_emu,
          slide_height_emu: slide.slide_height_emu,
          slide_width_px: slide.slide_width_px,
          slide_height_px: slide.slide_height_px,
          processing: false,
          processed: true,
          html: buildPptxPreviewHtml({
            slide_number: slide.slide_number,
            screenshot_url: slide.screenshot_url,
            textless_screenshot_url: slide.textless_screenshot_url ?? null,
            xml_content: slide.xml_content ?? "",
            normalized_fonts: slide.normalized_fonts ?? [],
            slide_width_emu: slide.slide_width_emu,
            slide_height_emu: slide.slide_height_emu,
            slide_width_px: slide.slide_width_px,
            slide_height_px: slide.slide_height_px,
          }),
        })
      );

      setSlides(initialSlides);

      const hasUnsupported = Array.isArray(slidesResponseData.fonts?.not_supported_fonts) && slidesResponseData.fonts.not_supported_fonts.length > 0;

      toast.success(
        `Upload finished`,
        {
          description: hasUnsupported
            ? `Please Upload the not supported fonts, and click Extract Template`
            : `PPTX preview imported. Click Edit Slide to edit text.`
        }
      );

      
    } catch (error) {
      console.error("Error processing file:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      toast.error("Processing failed", {
        description: errorMessage,
      });
    } finally {
      setIsProcessingPptx(false);
    }
  }, [selectedFile, processSlideToHtml, setSlides, setFontsData]);

  // Retry failed slide
  const retrySlide = useCallback(
    (index: number) => {
      const slide = slides[index];
      if (slide) {
        processSlideToHtml(slide, index);
      }
    },
    [slides, processSlideToHtml]
  );

  return {
    isProcessingPptx,
    processFile,
    processSlideToHtml,
    retrySlide,
  };
}; 
