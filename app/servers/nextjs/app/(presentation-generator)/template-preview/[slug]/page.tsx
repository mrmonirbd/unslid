"use client";
import React, { useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRightFromLine, ArrowUpRight, Download, FileSpreadsheet, Home, Loader2, MessageSquare, Mic2, Minus, MoveDiagonal, Palette, Pencil, Plus, Save, Sparkles, Trash2, Type, Video } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import html2canvas from "html2canvas";
import { jsonrepair } from "jsonrepair";

import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";
import TemplateService from "../../services/api/template";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";
import DashboardSidebar from "../../(dashboard)/Components/DashboardSidebar";
import { toast } from "sonner";
import {
  CustomTemplateDetail,
  CustomTemplateLayout,
  getCustomTemplateDetails,
  useCustomTemplateDetails,
} from "@/app/hooks/useCustomTemplates";
import { getTemplateGroupByRouteId, getTemplatesByTemplateName } from "@/app/presentation-templates";
import { api } from "@/lib/api";
import { useUser } from "@/app/hooks/useUser";
import { createClient } from "@/lib/auth/client";
import DesignerTemplateSlideRender from "../../components/DesignerTemplateSlideRender";
import ImageEditor from "../../components/ImageEditor";
import { DEFAULT_THEMES } from "../../(dashboard)/theme/components/ThemePanel/constants";
import { loadFonts } from "../../hooks/useFontLoad";
import ThemeApi from "../../services/api/theme";

interface PptxDesignerTemplate {
  id: number;
  name: string;
  description: string;
  tier: "free" | "premium";
  slide_count: number;
  thumbnail_urls: string[];
  file_url?: string;
  color_scheme: Record<string, string> | null;
  font_scheme: Record<string, string> | null;
  html_template_id?: string | null;
  html_template_slug?: string | null;
  html_conversion_status?: "pending" | "processing" | "completed" | "failed";
  html_conversion_error?: string | null;
  locked?: boolean;
}

interface SelectableTextBox {
  text: string;
  left_pct: number;
  top_pct: number;
  width_pct: number;
  height_pct: number;
  font_size_pt?: number | null;
}

interface SelectableDesignerSlide {
  slide_number: number;
  thumbnail_url: string | null;
  text_boxes: SelectableTextBox[];
}

interface SelectableDesignerPreview {
  id: number;
  name: string;
  slide_count: number;
  slides: SelectableDesignerSlide[];
}

interface DesignerTextBox {
  text: string;
  font_size_pt?: number | null;
}

interface DesignerPreviewSlideForGeneration {
  slide_number: number;
  text_boxes: DesignerTextBox[];
}

const getTemplateScopedLayoutId = (templateId: string, layoutId: string) => {
  const rawLayoutId = layoutId.split(":").pop() || layoutId;
  return `${templateId}:${rawLayoutId}`;
};

const buildDesignerSlideSchema = (slide: DesignerPreviewSlideForGeneration) => {
  const textBoxCount = Math.max(slide.text_boxes.length, 1);
  const slotDescriptions = slide.text_boxes.map((box, index) => {
    const role =
      index === 0
        ? "main title/headline"
        : box.text.length <= 30
        ? "short label or badge"
        : "body/description text";
    return `Slot ${index + 1}: ${role}. Replace template text "${box.text.slice(0, 90)}" with generated content.`;
  });

  return {
    type: "object",
    additionalProperties: false,
    required: ["__designer_text_boxes__"],
    properties: {
      __designer_text_boxes__: {
        type: "array",
        minItems: textBoxCount,
        maxItems: textBoxCount,
        description: [
          "Generated text for the selected designer PPTX template text boxes, in visual top-to-bottom/left-to-right order.",
          ...slotDescriptions,
        ].join(" "),
        items: {
          type: "string",
          minLength: 1,
          maxLength: 180,
        },
      },
    },
  };
};

const shouldTypeString = (key: string, value: string) => {
  if (!value) return false;
  const normalizedKey = key.toLowerCase();
  if (["id", "presentation", "layout", "layout_group", "type", "created_at", "updated_at"].includes(normalizedKey)) return false;
  if (normalizedKey.includes("url")) return false;
  if (normalizedKey.includes("color")) return false;
  if (normalizedKey.includes("font")) return false;
  if (normalizedKey.includes("prompt")) return false;
  return true;
};

const countTypableCharacters = (value: unknown, key = ""): number => {
  if (typeof value === "string") {
    return shouldTypeString(key, value) ? value.length : 0;
  }
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countTypableCharacters(item, key), 0);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce(
      (total, [childKey, childValue]) => total + countTypableCharacters(childValue, childKey),
      0
    );
  }
  return 0;
};

const revealTypableText = (value: unknown, characterBudget: { remaining: number }, key = ""): unknown => {
  if (typeof value === "string") {
    if (!shouldTypeString(key, value)) return value;
    const visibleLength = Math.max(0, Math.min(value.length, characterBudget.remaining));
    characterBudget.remaining -= visibleLength;
    return value.slice(0, visibleLength);
  }
  if (Array.isArray(value)) {
    return value.map((item) => revealTypableText(item, characterBudget, key));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        revealTypableText(childValue, characterBudget, childKey),
      ])
    );
  }
  return value;
};

const buildSequentialTypedPresentationData = (
  presentationData: any,
  activeSlideIndex: number,
  visibleCharacters: number
) => {
  if (!presentationData?.slides?.length) return presentationData;
  const nextPresentation = structuredClone(presentationData);
  nextPresentation.slides = presentationData.slides.slice(0, activeSlideIndex + 1).map((slide: any, index: number) => {
    if (index < activeSlideIndex) return structuredClone(slide);
    return revealTypableText(structuredClone(slide), { remaining: visibleCharacters });
  });
  return nextPresentation;
};

function SlideHoverToolbar({ onAi }: { onAi: () => void }) {
  const tools = [
    { label: "Edit", icon: Pencil },
    { label: "Narration", icon: Mic2 },
    { label: "AI", icon: Sparkles, active: true, onClick: onAi },
    { label: "Video", icon: Video },
    { label: "Comments", icon: MessageSquare },
    { label: "Delete", icon: Trash2 },
  ];

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-[70] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.label}
              type="button"
              title={tool.label}
              onClick={(event) => {
                event.stopPropagation();
                tool.onClick?.();
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
                tool.active
                  ? "border-violet-100 bg-violet-100 text-violet-700"
                  : "border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {tool.label === "AI" ? (
                <span className="text-xs font-bold">AI</span>
              ) : (
                <Icon className="h-4 w-4" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const TEMPLATE_THEME_VARIABLES = [
  "--primary-color",
  "--background-color",
  "--card-color",
  "--stroke",
  "--primary-text",
  "--background-text",
  "--graph-0",
  "--graph-1",
  "--graph-2",
  "--graph-3",
  "--graph-4",
  "--graph-5",
  "--graph-6",
  "--graph-7",
  "--graph-8",
  "--graph-9",
  "--heading-font-family",
  "--body-font-family",
];

const applyTemplateThemeToElement = (element: HTMLElement | null, theme: any | null) => {
  if (!element) return;

  TEMPLATE_THEME_VARIABLES.forEach((variable) => element.style.removeProperty(variable));
  element.removeAttribute("data-template-theme-active");
  element.style.removeProperty("font-family");

  if (!theme?.data?.colors) return;

  const colors = theme.data.colors;
  const cssVariables: Record<string, string | undefined> = {
    "--primary-color": colors.primary,
    "--background-color": colors.background,
    "--card-color": colors.card,
    "--stroke": colors.stroke,
    "--primary-text": colors.primary_text,
    "--background-text": colors.background_text,
    "--graph-0": colors.graph_0,
    "--graph-1": colors.graph_1,
    "--graph-2": colors.graph_2,
    "--graph-3": colors.graph_3,
    "--graph-4": colors.graph_4,
    "--graph-5": colors.graph_5,
    "--graph-6": colors.graph_6,
    "--graph-7": colors.graph_7,
    "--graph-8": colors.graph_8,
    "--graph-9": colors.graph_9,
  };

  Object.entries(cssVariables).forEach(([key, value]) => {
    if (value) element.style.setProperty(key, value);
  });

  const textFont = theme.data.fonts?.textFont;
  if (textFont?.name) {
    if (textFont.url) loadFonts({ [textFont.name]: textFont.url });
    element.style.setProperty("font-family", `"${textFont.name}", Inter, Arial, sans-serif`);
    element.style.setProperty("--heading-font-family", `"${textFont.name}", Inter, Arial, sans-serif`);
    element.style.setProperty("--body-font-family", `"${textFont.name}", Inter, Arial, sans-serif`);
  }

  element.setAttribute("data-template-theme-active", "true");
};

function TemplateThemeSelector({
  themes,
  selectedTheme,
  loading,
  onApply,
  onReset,
}: {
  themes: any[];
  selectedTheme: any | null;
  loading: boolean;
  onApply: (theme: any) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="gap-2 rounded-full">
          <Palette className="h-4 w-4" />
          {selectedTheme?.name || "Theme"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] max-h-[440px] overflow-y-auto rounded-2xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Preset themes</h3>
            <p className="text-xs text-slate-500">Apply a saved theme to this preview.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            Reset
          </Button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading themes...
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {themes.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => {
                  onApply(theme);
                  setOpen(false);
                }}
                className={`rounded-xl border bg-white p-2 text-left shadow-sm transition hover:border-blue-300 ${
                  selectedTheme?.id === theme.id ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"
                }`}
              >
                <div
                  className="rounded-lg p-2"
                  style={{ backgroundColor: theme.data?.colors?.background || "#fff" }}
                >
                  <div
                    className="rounded-md p-3"
                    style={{ backgroundColor: theme.data?.colors?.card || "#f3f4f6" }}
                  >
                    <div
                      className="mb-2 h-2 w-16 rounded-full"
                      style={{ backgroundColor: theme.data?.colors?.background_text || "#111827" }}
                    />
                    <div
                      className="mb-1 h-2 w-12 rounded-full"
                      style={{ backgroundColor: theme.data?.colors?.background_text || "#111827" }}
                    />
                    <div
                      className="h-3 w-9 rounded-full"
                      style={{ backgroundColor: theme.data?.colors?.primary || "#2563eb" }}
                    />
                  </div>
                </div>
                <p className="mt-2 truncate text-xs font-semibold text-slate-700">{theme.name}</p>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function TemplatePreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 h-screen overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function slugifyFileName(value: string) {
  return value.replace(/[^a-z0-9_\-. ]/gi, "_").replace(/\s+/g, "_").slice(0, 90) || "template-preview";
}

function downloadBlob(blob: Blob, fileName: string) {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}

function removeNodeIfAttached(parent: Node, child: Node) {
  if (child.parentNode === parent) {
    parent.removeChild(child);
  }
}

async function blobToUint8Array(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

function writeUint16(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

async function createZipBlob(files: Array<{ name: string; blob: Blob }>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const { time, date } = dosDateTime();

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = await blobToUint8Array(file.blob);
    const crc = crc32(data);

    const local: number[] = [];
    writeUint32(local, 0x04034b50);
    writeUint16(local, 20);
    writeUint16(local, 0);
    writeUint16(local, 0);
    writeUint16(local, time);
    writeUint16(local, date);
    writeUint32(local, crc);
    writeUint32(local, data.length);
    writeUint32(local, data.length);
    writeUint16(local, nameBytes.length);
    writeUint16(local, 0);
    localParts.push(new Uint8Array(local), nameBytes, data);

    const central: number[] = [];
    writeUint32(central, 0x02014b50);
    writeUint16(central, 20);
    writeUint16(central, 20);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, time);
    writeUint16(central, date);
    writeUint32(central, crc);
    writeUint32(central, data.length);
    writeUint32(central, data.length);
    writeUint16(central, nameBytes.length);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, 0);
    writeUint32(central, offset);
    centralParts.push(new Uint8Array(central), nameBytes);

    offset += local.length + nameBytes.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end: number[] = [];
  writeUint32(end, 0x06054b50);
  writeUint16(end, 0);
  writeUint16(end, 0);
  writeUint16(end, files.length);
  writeUint16(end, files.length);
  writeUint32(end, centralSize);
  writeUint32(end, offset);
  writeUint16(end, 0);

  const zipParts: BlobPart[] = [...localParts, ...centralParts, new Uint8Array(end)].map((part) => {
    const copy = new Uint8Array(part.byteLength);
    copy.set(part);
    return copy.buffer;
  });
  return new Blob(zipParts, { type: "application/zip" });
}

function getPreviewSlideElements() {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-template-preview-slide='true']"));
}

async function waitForPreviewAssets(targets: HTMLElement[]) {
  await document.fonts?.ready.catch(() => undefined);

  const images = targets.flatMap((target) => Array.from(target.querySelectorAll<HTMLImageElement>("img")));
  await Promise.all(images.map(async (image) => {
    if (image.complete && image.naturalWidth > 0) return;
    if (typeof image.decode === "function") {
      await image.decode().catch(() => undefined);
      return;
    }
    await new Promise<void>((resolve) => {
      image.onload = () => resolve();
      image.onerror = () => resolve();
    });
  }));
}

async function renderPreviewSlideImage(target: HTMLElement) {
  const stage = document.createElement("div");
  const clone = target.cloneNode(true) as HTMLElement;

  stage.style.position = "fixed";
  stage.style.left = "-10000px";
  stage.style.top = "0";
  stage.style.width = "1280px";
  stage.style.height = "720px";
  stage.style.overflow = "hidden";
  stage.style.background = "#ffffff";
  stage.style.zIndex = "-1";
  stage.style.pointerEvents = "none";

  clone.removeAttribute("id");
  clone.style.width = "1280px";
  clone.style.height = "720px";
  clone.style.background = "#ffffff";
  clone.style.boxShadow = "none";
  clone.style.overflow = "hidden";

  const slideRoot = clone.firstElementChild as HTMLElement | null;
  if (slideRoot) {
    slideRoot.style.width = "1280px";
    slideRoot.style.height = "720px";
    slideRoot.style.maxWidth = "1280px";
    slideRoot.style.maxHeight = "720px";
    slideRoot.style.boxShadow = "none";
  }

  stage.appendChild(clone);
  document.body.appendChild(stage);

  try {
    await waitForPreviewAssets([stage]);
    const canvas = await html2canvas(stage, {
      backgroundColor: "#ffffff",
      width: 1280,
      height: 720,
      windowWidth: 1280,
      windowHeight: 720,
      scrollX: 0,
      scrollY: 0,
      scale: 2,
      useCORS: true,
    });
    return canvas.toDataURL("image/png");
  } finally {
    removeNodeIfAttached(document.body, stage);
  }
}

async function buildPreviewImageModel(targets: HTMLElement[], title: string) {
  await waitForPreviewAssets(targets);

  const slides = await Promise.all(targets.map(async (target) => {
    const dataUrl = await renderPreviewSlideImage(target);
    return {
      background: {
        color: "FFFFFF",
        opacity: 1,
      },
      shapes: [
        {
          shape_type: "picture",
          position: {
            left: 0,
            top: 0,
            width: 1280,
            height: 720,
          },
          clip: false,
          opacity: 1,
          invert: false,
          shape: "rectangle",
          object_fit: {
            fit: "fill",
          },
          picture: {
            is_network: false,
            path: dataUrl,
          },
        },
      ],
    };
  }));

  return {
    name: title,
    slides,
  };
}

function FullPreviewDownloadDropdown({
  title,
}: {
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState<"pptx" | "pdf" | "images" | null>(null);

  const handleDownload = async (format: "pptx" | "pdf") => {
    const targets = getPreviewSlideElements();
    if (!targets.length) {
      toast.error("Previews are not ready yet");
      return;
    }

    try {
      setOpen(false);
      setDownloading(format);
      const model = await buildPreviewImageModel(targets, title);
      const blob = format === "pptx"
        ? await PresentationGenerationApi.exportAsPPTX(model)
        : await PresentationGenerationApi.exportAsPDFFromModel(model);
      downloadBlob(blob, `${slugifyFileName(title)}.${format}`);
      toast.success(`${format.toUpperCase()} download ready`);
    } catch (error) {
      console.error(`Failed to download ${format}`, error);
      toast.error("Having trouble exporting!", {
        description: `We are having trouble exporting this template as ${format.toUpperCase()}. Please try again.`,
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleImageZipDownload = async () => {
    const targets = getPreviewSlideElements();
    if (!targets.length) {
      toast.error("Previews are not ready yet");
      return;
    }

    try {
      setOpen(false);
      setDownloading("images");
      await waitForPreviewAssets(targets);
      const files = await Promise.all(targets.map(async (target, index) => {
        const canvas = await html2canvas(target, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
        });
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((nextBlob) => {
            if (nextBlob) resolve(nextBlob);
            else reject(new Error("Could not create image"));
          }, "image/png");
        });
        return {
          name: `slide-${String(index + 1).padStart(2, "0")}.png`,
          blob,
        };
      }));
      const zipBlob = await createZipBlob(files);
      downloadBlob(zipBlob, `${slugifyFileName(title)}-images.zip`);
      toast.success("Images ZIP download ready");
    } catch (error) {
      console.error("Failed to download images ZIP", error);
      toast.error("Failed to download images ZIP");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="flex items-center gap-[7px] rounded-[53px] px-[18px] py-[11px] text-sm font-semibold text-[#101323] disabled:opacity-60"
        style={{
          background: "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)",
        }}
        disabled={!!downloading}
        onClick={() => setOpen((value) => !value)}
      >
        {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Export"}
        <ArrowRightFromLine className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[200px] rounded-[18px] border border-slate-200 bg-white p-5 text-sm shadow-xl">
          <p className="text-sm font-medium text-[#19001F]">Export as</p>
          <div className="my-[18px] h-[1px] bg-[#E8E8E8]" />
          <div className="space-y-3">
            <button
              type="button"
              className="flex w-full items-center justify-start gap-2 px-0 text-xs text-black hover:bg-transparent"
              onClick={() => handleDownload("pdf")}
            >
              PDF <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="flex w-full items-center justify-start gap-2 px-0 text-xs text-black hover:bg-transparent"
              onClick={() => handleDownload("pptx")}
            >
              PPTX <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="flex w-full items-center justify-start gap-2 px-0 text-xs text-black hover:bg-transparent"
              onClick={handleImageZipDownload}
            >
              Images ZIP <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function buildStaticLayoutCode(layout: CustomTemplateLayout, html: string) {
  return `
import * as z from "zod";

const layoutId = ${JSON.stringify(layout.rawLayoutId || layout.layoutId || "custom-layout")};
const layoutName = ${JSON.stringify(layout.rawLayoutName || layout.layoutName || "Custom Layout")};
const layoutDescription = ${JSON.stringify(layout.layoutDescription || "")};
const Schema = z.object({});
const EDITED_TEMPLATE_HTML = ${JSON.stringify(html)};

const dynamicSlideLayout = () => (
  <div
    style={{ width: "1280px", height: "720px", position: "relative", overflow: "hidden", background: "#ffffff" }}
    dangerouslySetInnerHTML={{ __html: EDITED_TEMPLATE_HTML }}
  />
);

export default dynamicSlideLayout;
`;
}

function cleanEditedLayoutHtml(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll<HTMLElement>("[data-admin-editable]").forEach((element) => {
    element.removeAttribute("contenteditable");
    element.removeAttribute("data-admin-editable");
    element.removeAttribute("data-selected-admin-editable");
    element.style.outline = "";
    element.style.outlineOffset = "";
    element.style.cursor = "";
    element.style.resize = "";
  });
  return clone.innerHTML;
}

function makeTextElementsEditable(root: HTMLElement, onSelect: (element: HTMLElement) => void) {
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,p,span,div,li,td,th,strong,em")
  );

  candidates.forEach((element) => {
    const text = element.textContent?.trim();
    if (!text) return;

    const childWithText = Array.from(element.children).some(
      (child) => child.textContent?.trim()
    );
    if (childWithText && element.children.length > 0) return;

    element.contentEditable = "true";
    element.dataset.adminEditable = "true";
    element.spellcheck = false;
    element.style.cursor = "text";
    if (getComputedStyle(element).display === "inline") {
      element.style.display = "inline-block";
    }
    element.style.minWidth ||= "24px";
    element.style.minHeight ||= "18px";

    element.onmousedown = (event) => {
      event.stopPropagation();
      onSelect(element);
    };
    element.onfocus = () => onSelect(element);
  });
}

function AdminEditableLayout({
  layout,
  templateId,
  onSaved,
  children,
}: {
  layout: CustomTemplateLayout;
  templateId: string;
  onSaved?: () => void;
  children: React.ReactNode;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const selectedRef = React.useRef<HTMLElement | null>(null);
  const [selectedLabel, setSelectedLabel] = useState("No text selected");
  const [fontSize, setFontSize] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const selectElement = React.useCallback((element: HTMLElement | null) => {
    selectedRef.current?.removeAttribute("data-selected-admin-editable");
    selectedRef.current && (selectedRef.current.style.outline = "");
    selectedRef.current && (selectedRef.current.style.outlineOffset = "");

    selectedRef.current = element;
    if (!element) {
      setSelectedLabel("No text selected");
      setFontSize(null);
      return;
    }

    element.dataset.selectedAdminEditable = "true";
    element.style.outline = "2px solid #4f46e5";
    element.style.outlineOffset = "2px";
    const computedSize = Number.parseFloat(getComputedStyle(element).fontSize || "16");
    setFontSize(Number.isFinite(computedSize) ? Math.round(computedSize) : 16);
    setSelectedLabel(element.textContent?.trim().slice(0, 42) || "Selected text");
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    makeTextElementsEditable(root, selectElement);
    return () => {
      root.querySelectorAll<HTMLElement>("[data-admin-editable]").forEach((element) => {
        element.onmousedown = null;
        element.onfocus = null;
      });
    };
  }, [children, selectElement]);

  const changeFontSize = (delta: number) => {
    const selected = selectedRef.current;
    if (!selected) return;
    const current = Number.parseFloat(getComputedStyle(selected).fontSize || "16");
    const next = Math.max(6, Math.min(160, Math.round(current + delta)));
    selected.style.fontSize = `${next}px`;
    setFontSize(next);
  };

  const enableResize = () => {
    const selected = selectedRef.current;
    if (!selected) return;
    const rect = selected.getBoundingClientRect();
    selected.style.width ||= `${Math.ceil(rect.width)}px`;
    selected.style.height ||= `${Math.ceil(rect.height)}px`;
    selected.style.overflow = "auto";
    selected.style.resize = "both";
    selected.style.outline = "2px solid #4f46e5";
  };

  const saveLayout = async () => {
    if (!rootRef.current) return;
    try {
      setSaving(true);
      const html = cleanEditedLayoutHtml(rootRef.current);
      await api.put("/api/v1/ppt/template/update", {
        id: templateId,
        layouts: [
          {
            layout_id: layout.rawLayoutId,
            layout_name: layout.rawLayoutName || layout.layoutName || "Custom Layout",
            layout_code: buildStaticLayoutCode(layout, html),
          },
        ],
      });
      toast.success("Template layout saved");
      onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save layout");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-sm text-indigo-900">
          <Type className="h-4 w-4 shrink-0" />
          <span className="truncate">{selectedLabel}</span>
          {fontSize ? <span className="rounded bg-white px-2 py-0.5 font-mono text-xs">{fontSize}px</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => changeFontSize(-2)} title="Decrease font size">
            <Minus className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => changeFontSize(2)} title="Increase font size">
            <Plus className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={enableResize} title="Make selected text resizable">
            <MoveDiagonal className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" onClick={saveLayout} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>
      <div ref={rootRef} onMouseDown={(event) => event.currentTarget === event.target && selectElement(null)}>
        {children}
      </div>
    </div>
  );
}

type StaticEditableSelection = {
  type: "text" | "image";
  element: HTMLElement;
  label: string;
  editorId: string;
};

type StaticEditorPanelState = {
  selection: StaticEditableSelection | null;
  fontSize: number;
  fontFamily: string;
  imageUrl: string;
  animation: string;
  saveState: "idle" | "saved";
  actions: {
    updateFontSize: (size: number) => void;
    setFontFamily: (family: string) => void;
    toggleBold: () => void;
    toggleItalic: () => void;
    setColor: (color: string) => void;
    replaceImage: (url: string) => void;
    replaceImageFile: (file: File) => void;
    updateImageProperties: (propertiesData: any) => void;
    setAnimation: (animation: string) => void;
    enableResize: () => void;
    moveSelected: (dx: number, dy: number) => void;
    clearSelection: () => void;
    saveEdits: () => void;
    resetEdits: () => void;
  } | null;
};

type StaticEditorSavedTemplateMeta = {
  userKey: string;
  templateId: string;
  name: string;
  description: string;
  layoutCount: number;
};

const STATIC_EDITOR_ANIMATIONS: Record<string, string> = {
  none: "",
  fade: "staticEditorFade 800ms ease both",
  rise: "staticEditorRise 800ms ease both",
  zoom: "staticEditorZoom 700ms ease both",
  pulse: "staticEditorPulse 1200ms ease-in-out infinite",
};

const STATIC_TEMPLATE_EDIT_INDEX_PREFIX = "static-template-edits:index:";

const parseImageFocusPoint = (element: HTMLImageElement) => {
  const computed = getComputedStyle(element);
  const objectPosition = element.style.objectPosition || computed.objectPosition || "50% 50%";
  const [rawX = "50%", rawY = "50%"] = objectPosition.split(/\s+/);
  const parsePositionValue = (value: string, fallback: number) => {
    if (value === "left" || value === "top") return 0;
    if (value === "center") return 50;
    if (value === "right" || value === "bottom") return 100;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : fallback;
  };
  return {
    x: parsePositionValue(rawX, 50),
    y: parsePositionValue(rawY, 50),
  };
};

const getImageEditorProperties = (element?: HTMLElement | null) => {
  if (!(element instanceof HTMLImageElement)) return null;
  const computed = getComputedStyle(element);
  const fit = element.style.objectFit || computed.objectFit || "cover";
  return [{
    initialObjectFit: ["cover", "contain", "fill"].includes(fit) ? fit : "cover",
    initialFocusPoint: parseImageFocusPoint(element),
  }];
};

function saveStaticTemplateEditIndex(meta: StaticEditorSavedTemplateMeta) {
  const indexKey = `${STATIC_TEMPLATE_EDIT_INDEX_PREFIX}${meta.userKey}`;
  const saved = window.localStorage.getItem(indexKey);
  const entries = saved ? JSON.parse(saved) as Array<StaticEditorSavedTemplateMeta & { id: string; updatedAt: string }> : [];
  const id = `edited-${meta.templateId}`;
  const nextEntry = { ...meta, id, updatedAt: new Date().toISOString() };
  const nextEntries = [nextEntry, ...entries.filter((entry) => entry.id !== id)];
  window.localStorage.setItem(indexKey, JSON.stringify(nextEntries));
}

const EMPTY_STATIC_EDITOR_PANEL_STATE: StaticEditorPanelState = {
  selection: null,
  fontSize: 24,
  fontFamily: "Inter, Arial, sans-serif",
  imageUrl: "",
  animation: "none",
  saveState: "idle",
  actions: null,
};

function StaticTemplateEditPanel({ state }: { state: StaticEditorPanelState }) {
  const [showImageEditor, setShowImageEditor] = useState(false);
  const actions = state.actions;
  const selection = state.selection;
  const isText = selection?.type === "text";
  const isImage = selection?.type === "image";

  useEffect(() => {
    setShowImageEditor(false);
  }, [state.imageUrl, selection?.element]);

  if (!selection || !actions) {
    return null;
  }

  return (
    <div
      data-static-editor-panel="true"
      className="sticky top-[132px] z-40 mx-auto mb-6 flex w-full max-w-[1440px] flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur"
    >
      <span className="max-w-[240px] truncate rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
        {selection.type}: {selection.label}
      </span>
      <select
        className="h-9 rounded-md border px-2 text-sm"
        value={state.fontFamily}
        disabled={!isText}
        onChange={(event) => actions.setFontFamily(event.target.value)}
      >
        <option value="Inter, Arial, sans-serif">Inter</option>
        <option value="Impact, Arial Black, sans-serif">Impact</option>
        <option value="Georgia, serif">Georgia</option>
        <option value="'Times New Roman', serif">Times</option>
        <option value="'Courier New', monospace">Courier</option>
        <option value="Arial, sans-serif">Arial</option>
      </select>
      <Button type="button" variant="outline" size="sm" disabled={!isText} onClick={() => actions.updateFontSize(state.fontSize - 4)}>
        <Minus className="h-4 w-4" />
      </Button>
      <input
        className="h-9 w-16 rounded-md border px-2 text-sm"
        type="number"
        min={8}
        max={180}
        value={state.fontSize}
        disabled={!isText}
        onChange={(event) => actions.updateFontSize(Number(event.target.value))}
      />
      <Button type="button" variant="outline" size="sm" disabled={!isText} onClick={() => actions.updateFontSize(state.fontSize + 4)}>
        <Plus className="h-4 w-4" />
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={!isText} onClick={actions.toggleBold}>B</Button>
      <Button type="button" variant="outline" size="sm" disabled={!isText} onClick={actions.toggleItalic}>I</Button>
      <input
        type="color"
        className="h-9 w-10 rounded-md border bg-white p-1"
        disabled={!isText}
        onChange={(event) => actions.setColor(event.target.value)}
        title="Text color"
      />
      <Button type="button" variant="outline" size="sm" disabled={!isImage} onClick={() => setShowImageEditor(true)}>
        Replace image
      </Button>
      <select
        className="h-9 rounded-md border px-2 text-sm"
        value={state.animation}
        onChange={(event) => actions.setAnimation(event.target.value)}
      >
        <option value="none">No animation</option>
        <option value="fade">Fade</option>
        <option value="rise">Rise</option>
        <option value="zoom">Zoom</option>
        <option value="pulse">Pulse</option>
      </select>
      <Button type="button" variant="outline" size="sm" onClick={actions.enableResize}>Resize</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => actions.moveSelected(-8, 0)}>←</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => actions.moveSelected(8, 0)}>→</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => actions.moveSelected(0, -8)}>↑</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => actions.moveSelected(0, 8)}>↓</Button>
      <Button type="button" variant="ghost" size="sm" onClick={actions.clearSelection}>Done</Button>
      <Button type="button" size="sm" onClick={actions.saveEdits} className="gap-2">
        <Save className="h-4 w-4" />
        {state.saveState === "saved" ? "Saved" : "Save for me"}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={actions.resetEdits}>
        Reset
      </Button>
      {isImage && showImageEditor && (
        <ImageEditor
          initialImage={state.imageUrl}
          slideIndex={0}
          promptContent={`A realistic, high-quality presentation-related image for ${selection.label}. Professional photography, natural lighting, relevant to the slide content.`}
          properties={getImageEditorProperties(selection.element)}
          onClose={() => setShowImageEditor(false)}
          onImageChange={(newImageUrl) => {
            actions.replaceImage(newImageUrl);
            setShowImageEditor(false);
          }}
          onFocusPointClick={(propertiesData) => actions.updateImageProperties(propertiesData)}
        />
      )}
    </div>
  );
}

function cleanStaticEditorHtml(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll<HTMLElement>("[data-static-editor-text],[data-static-editor-image]").forEach((element) => {
    element.removeAttribute("contenteditable");
    element.removeAttribute("data-static-editor-text");
    element.removeAttribute("data-static-editor-image");
    element.removeAttribute("spellcheck");
    element.style.outline = "";
    element.style.outlineOffset = "";
    element.style.cursor = "";
  });
  return clone.innerHTML;
}

function StaticTemplateEditor({
  children,
  storageKey,
  editorId,
  onPanelStateChange,
  savedTemplateMeta,
}: {
  children: React.ReactNode;
  storageKey: string;
  editorId: string;
  onPanelStateChange: (state: StaticEditorPanelState) => void;
  savedTemplateMeta: StaticEditorSavedTemplateMeta;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<StaticEditableSelection | null>(null);
  const loadedStorageKeyRef = useRef<string | null>(null);
  const [selection, setSelection] = useState<StaticEditableSelection | null>(null);
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState("Inter, Arial, sans-serif");
  const [imageUrl, setImageUrl] = useState("");
  const [activeImageElement, setActiveImageElement] = useState<HTMLImageElement | null>(null);
  const [animation, setAnimation] = useState("none");
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");

  const clearSelection = React.useCallback(() => {
    if (!selectedRef.current) return;
    const previous = selectedRef.current?.element;
    if (previous) {
      previous.style.outline = "";
      previous.style.outlineOffset = "";
    }
    selectedRef.current = null;
    setSelection(null);
    onPanelStateChange(EMPTY_STATIC_EDITOR_PANEL_STATE);
  }, [onPanelStateChange]);

  const selectElement = React.useCallback((type: "text" | "image", element: HTMLElement) => {
    const current = selectedRef.current;
    if (current?.element === element && current.type === type) {
      return;
    }

    selectedRef.current?.element && (selectedRef.current.element.style.outline = "");
    selectedRef.current?.element && (selectedRef.current.element.style.outlineOffset = "");

    element.style.outline = "3px solid #7c3aed";
    element.style.outlineOffset = "3px";
    const label = type === "image"
      ? "Selected image"
      : element.textContent?.trim().slice(0, 48) || "Selected text";
    const next = { type, element, label, editorId };
    selectedRef.current = next;
    setSelection(next);

    const computed = getComputedStyle(element);
    const nextSize = Number.parseFloat(computed.fontSize || "24");
    setFontSize(Number.isFinite(nextSize) ? Math.round(nextSize) : 24);
    setFontFamily(computed.fontFamily || "Inter, Arial, sans-serif");
    setAnimation(Object.entries(STATIC_EDITOR_ANIMATIONS).find(([, value]) => value && computed.animation.includes(value.split(" ")[0]))?.[0] || "none");
    if (type === "image" && element instanceof HTMLImageElement) {
      setImageUrl(element.src);
    }
  }, [editorId]);

  const buildImagePrompt = (image: HTMLImageElement) => {
    const alt = image.alt?.trim();
    const nearbyText = image
      .closest("[data-template-preview-slide='true']")
      ?.textContent
      ?.replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);

    return [
      alt || nearbyText || savedTemplateMeta.name,
      "Realistic, high-quality presentation-related photo, natural lighting, professional composition.",
    ]
      .filter(Boolean)
      .join(". ");
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (loadedStorageKeyRef.current !== storageKey) {
      const savedHtml = window.localStorage.getItem(storageKey);
      if (savedHtml) {
        root.innerHTML = savedHtml;
      }
      loadedStorageKeyRef.current = storageKey;
    }

    const textElements = Array.from(root.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,p,span,li,strong,em,button,div"))
      .filter((element) => {
        const text = element.textContent?.trim();
        if (!text) return false;
        const hasTextChild = Array.from(element.children).some((child) => child.textContent?.trim());
        return !(hasTextChild && element.children.length > 0);
      });

    const textHandlers: Array<{
      element: HTMLElement;
      handleMouseDown: (event: MouseEvent) => void;
      handleFocus: () => void;
    }> = [];

    textElements.forEach((element) => {
      element.contentEditable = "true";
      element.spellcheck = false;
      element.dataset.staticEditorText = "true";
      element.style.cursor = "text";
      if (getComputedStyle(element).display === "inline") {
        element.style.display = "inline-block";
      }
      const handleMouseDown = (event: MouseEvent) => {
        event.stopPropagation();
        selectElement("text", element);
      };
      const handleFocus = () => selectElement("text", element);
      element.addEventListener("mousedown", handleMouseDown);
      element.addEventListener("focus", handleFocus);
      textHandlers.push({ element, handleMouseDown, handleFocus });
    });

    const imageElements = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
    const imageHandlers: Array<{
      image: HTMLImageElement;
      handleMouseDown: (event: MouseEvent) => void;
    }> = [];

    imageElements.forEach((image) => {
      image.dataset.staticEditorImage = "true";
      image.style.cursor = "pointer";
      image.draggable = false;
      const handleMouseDown = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        selectElement("image", image);
        setActiveImageElement(image);
      };
      image.addEventListener("mousedown", handleMouseDown);
      imageHandlers.push({ image, handleMouseDown });
    });

    return () => {
      textHandlers.forEach(({ element, handleMouseDown, handleFocus }) => {
        element.removeEventListener("mousedown", handleMouseDown);
        element.removeEventListener("focus", handleFocus);
      });
      imageHandlers.forEach(({ image, handleMouseDown }) => {
        image.removeEventListener("mousedown", handleMouseDown);
      });
    };
  }, [children, selectElement, storageKey]);

  const persistEdits = () => {
    const root = rootRef.current;
    if (!root) return;
    window.localStorage.setItem(storageKey, cleanStaticEditorHtml(root));
    saveStaticTemplateEditIndex(savedTemplateMeta);
  };

  const saveEdits = () => {
    persistEdits();
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 1400);
  };

  const scheduleAutoSave = () => {
    window.setTimeout(() => {
      persistEdits();
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1400);
    }, 0);
  };

  const resetEdits = () => {
    window.localStorage.removeItem(storageKey);
    window.location.reload();
  };

  const applyToSelected = (updater: (element: HTMLElement) => void) => {
    if (!selectedRef.current?.element) return;
    updater(selectedRef.current.element);
  };

  const updateFontSize = (nextSize: number) => {
    const size = Math.max(8, Math.min(180, Math.round(nextSize)));
    setFontSize(size);
    applyToSelected((element) => {
      element.style.fontSize = `${size}px`;
      element.style.lineHeight = "1.05";
    });
  };

  const replaceImage = (url: string) => {
    const element = selectedRef.current?.element;
    if (!element || !(element instanceof HTMLImageElement) || !url.trim()) return;
    element.src = url.trim();
    setImageUrl(url.trim());
    scheduleAutoSave();
  };

  const replaceImageFile = (file: File) => {
    replaceImage(URL.createObjectURL(file));
  };

  const enableResize = () => {
    applyToSelected((element) => {
      const rect = element.getBoundingClientRect();
      element.style.width ||= `${Math.ceil(rect.width)}px`;
      element.style.height ||= `${Math.ceil(rect.height)}px`;
      element.style.resize = "both";
      element.style.overflow = "auto";
    });
  };

  const moveSelected = (dx: number, dy: number) => {
    applyToSelected((element) => {
      const computed = getComputedStyle(element);
      if (computed.position === "static") {
        element.style.position = "relative";
      }
      const left = Number.parseFloat(element.style.left || "0");
      const top = Number.parseFloat(element.style.top || "0");
      element.style.left = `${left + dx}px`;
      element.style.top = `${top + dy}px`;
    });
  };

  const updateImageProperties = (propertiesData: any) => {
    const fit = propertiesData?.initialObjectFit;
    const focusPoint = propertiesData?.initialFocusPoint;

    applyToSelected((element) => {
      if (!(element instanceof HTMLImageElement)) return;
      if (["cover", "contain", "fill"].includes(fit)) {
        element.style.objectFit = fit;
      }
      if (focusPoint && Number.isFinite(focusPoint.x) && Number.isFinite(focusPoint.y)) {
        element.style.objectPosition = `${focusPoint.x}% ${focusPoint.y}%`;
      }
    });

    scheduleAutoSave();
  };

  useEffect(() => {
    if (!selection) return;
    onPanelStateChange({
      selection,
      fontSize,
      fontFamily,
      imageUrl,
      animation,
      saveState,
      actions: {
        updateFontSize,
        setFontFamily: (family) => {
          setFontFamily(family);
          applyToSelected((element) => { element.style.fontFamily = family; });
        },
        toggleBold: () => applyToSelected((element) => { element.style.fontWeight = element.style.fontWeight === "900" ? "" : "900"; }),
        toggleItalic: () => applyToSelected((element) => { element.style.fontStyle = element.style.fontStyle === "italic" ? "" : "italic"; }),
        setColor: (color) => applyToSelected((element) => { element.style.color = color; }),
        replaceImage,
        replaceImageFile,
        updateImageProperties,
        setAnimation: (nextAnimation) => {
          setAnimation(nextAnimation);
          applyToSelected((element) => { element.style.animation = STATIC_EDITOR_ANIMATIONS[nextAnimation]; });
        },
        enableResize,
        moveSelected,
        clearSelection,
        saveEdits,
        resetEdits,
      },
    });
  }, [selection, fontSize, fontFamily, imageUrl, animation, saveState, onPanelStateChange]);

  useEffect(() => {
    if (!selection) return;

    const handleOutsideMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (target instanceof HTMLElement && target.closest("[data-static-editor-panel='true']")) return;
      clearSelection();
    };

    document.addEventListener("mousedown", handleOutsideMouseDown, true);
    return () => document.removeEventListener("mousedown", handleOutsideMouseDown, true);
  }, [clearSelection, selection]);

  return (
    <div className="space-y-3">
      <style>{`
        @keyframes staticEditorFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes staticEditorRise { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes staticEditorZoom { from { opacity: 0; transform: scale(.86); } to { opacity: 1; transform: scale(1); } }
        @keyframes staticEditorPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.035); } }
      `}</style>
      <div ref={rootRef} onMouseDown={(event) => event.currentTarget === event.target && clearSelection()}>
        {children}
      </div>
      {activeImageElement && (
        <ImageEditor
          initialImage={activeImageElement.src}
          slideIndex={0}
          promptContent={buildImagePrompt(activeImageElement)}
          properties={getImageEditorProperties(activeImageElement)}
          onClose={() => setActiveImageElement(null)}
          onImageChange={(newImageUrl) => {
            activeImageElement.src = newImageUrl;
            setImageUrl(newImageUrl);
            setActiveImageElement(null);
            scheduleAutoSave();
          }}
          onFocusPointClick={(propertiesData) => {
            const fit = propertiesData?.initialObjectFit;
            const focusPoint = propertiesData?.initialFocusPoint;
            if (["cover", "contain", "fill"].includes(fit)) {
              activeImageElement.style.objectFit = fit;
            }
            if (focusPoint && Number.isFinite(focusPoint.x) && Number.isFinite(focusPoint.y)) {
              activeImageElement.style.objectPosition = `${focusPoint.x}% ${focusPoint.y}%`;
            }
            scheduleAutoSave();
          }}
        />
      )}
    </div>
  );
}

const DESIGNER_18_EXCEL_SHEETS = [
  {
    name: "Financial Summary",
    columns: ["Metric", "Q1", "Q2", "Q3", "Q4", "Total"],
    rows: [
      ["Revenue", "$128,400", "$143,900", "$156,200", "$171,500", "$600,000"],
      ["Cost of Sales", "$42,100", "$47,800", "$51,300", "$55,600", "$196,800"],
      ["Gross Profit", "$86,300", "$96,100", "$104,900", "$115,900", "$403,200"],
      ["Operating Expense", "$31,200", "$34,500", "$36,100", "$39,400", "$141,200"],
      ["Net Profit", "$55,100", "$61,600", "$68,800", "$76,500", "$262,000"],
    ],
  },
  {
    name: "Pipeline",
    columns: ["Account", "Stage", "Owner", "Value", "Close Date", "Status"],
    rows: [
      ["Northstar Retail", "Proposal", "A. Rahman", "$42,000", "2026-05-18", "On track"],
      ["Helio Finance", "Negotiation", "S. Karim", "$58,500", "2026-05-24", "Review"],
      ["Atlas Health", "Discovery", "N. Ahmed", "$31,750", "2026-06-03", "New"],
      ["Metro Foods", "Contract", "T. Islam", "$74,200", "2026-06-11", "Priority"],
      ["Vertex Labs", "Proposal", "M. Hasan", "$49,600", "2026-06-19", "On track"],
    ],
  },
  {
    name: "Monthly Budget",
    columns: ["Category", "Budget", "Actual", "Variance", "Owner", "Notes"],
    rows: [
      ["Marketing", "$32,000", "$29,850", "$2,150", "Growth", "Under budget"],
      ["Product", "$48,500", "$51,200", "-$2,700", "Product", "Hiring overlap"],
      ["Operations", "$26,400", "$24,900", "$1,500", "Ops", "Stable"],
      ["Sales", "$39,700", "$41,100", "-$1,400", "Sales", "Travel increase"],
      ["Support", "$18,900", "$17,750", "$1,150", "CX", "Under budget"],
    ],
  },
  {
    name: "KPI Tracker",
    columns: ["KPI", "Target", "Current", "Delta", "Trend", "Comment"],
    rows: [
      ["MRR", "$210,000", "$226,400", "+7.8%", "Up", "Ahead of plan"],
      ["Churn", "3.2%", "2.7%", "-0.5%", "Down", "Improving"],
      ["Activation", "64%", "68%", "+4%", "Up", "Better onboarding"],
      ["NPS", "48", "52", "+4", "Up", "Healthy"],
      ["CAC Payback", "11 mo", "10 mo", "-1 mo", "Down", "Efficient"],
    ],
  },
];

function ReadOnlyExcelPreview({ title }: { title: string }) {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-12">
      {DESIGNER_18_EXCEL_SHEETS.map((sheet, sheetIndex) => (
        <Card
          key={sheet.name}
          id={`excel-sheet-${sheetIndex + 1}`}
          className="overflow-hidden border-slate-200 shadow-md"
        >
          <div className="flex items-center justify-between border-b bg-white px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  {sheet.name}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {title} • Sheet {sheetIndex + 1} of {DESIGNER_18_EXCEL_SHEETS.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded bg-slate-100 px-3 py-1 text-sm font-mono text-slate-600">
                excel:sheet-{sheetIndex + 1}
              </span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
                Non editable
              </span>
            </div>
          </div>

          <div className="bg-gray-100 p-6">
          <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
              <FileSpreadsheet className="h-4 w-4" />
              Read-only Excel Sheet
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="w-12 border border-slate-200 bg-slate-100 px-3 py-2 text-center text-xs font-semibold text-slate-500">
                      #
                    </th>
                    {sheet.columns.map((column) => (
                      <th
                        key={column}
                        className="border border-slate-200 bg-slate-100 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.map((row, rowIndex) => (
                    <tr key={`${sheet.name}-${rowIndex}`} className="odd:bg-white even:bg-slate-50/70">
                      <td className="border border-slate-200 bg-slate-100 px-3 py-2 text-center text-xs font-medium text-slate-500">
                        {rowIndex + 1}
                      </td>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={`${sheet.name}-${rowIndex}-${cellIndex}`}
                          className="border border-slate-200 px-3 py-2 text-slate-700"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </Card>
      ))}
    </div>
  );
}

const GroupLayoutPreview = () => {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();

  const templateParams = params.slug as string;

  // Check if this is a custom template
  const isCustom = templateParams.startsWith("custom-");
  const isDesigner = templateParams.startsWith("designer-");
  const resolvedStaticGroup = !isCustom && !isDesigner ? getTemplateGroupByRouteId(templateParams) : undefined;
  const resolvedStaticTemplateId = resolvedStaticGroup?.id ?? templateParams;
  const customTemplateId = isCustom ? templateParams.split("custom-")[1] : null;
  const designerTemplateId = isDesigner ? Number(templateParams.split("designer-")[1]) : null;
  const shouldShowExcelPreview = designerTemplateId === 18;
  const [designerTemplate, setDesignerTemplate] = useState<PptxDesignerTemplate | null>(null);
  const [designerSelectablePreview, setDesignerSelectablePreview] = useState<SelectableDesignerPreview | null>(null);
  const [designerHtmlTemplate, setDesignerHtmlTemplate] = useState<CustomTemplateDetail | null>(null);
  const [designerLoading, setDesignerLoading] = useState(false);
  const [designerError, setDesignerError] = useState<string | null>(null);
  const [staticEditorPanelState, setStaticEditorPanelState] = useState<StaticEditorPanelState>(EMPTY_STATIC_EDITOR_PANEL_STATE);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiPromptModalOpen, setAiPromptModalOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGenerationMessage, setAiGenerationMessage] = useState("");
  const [availableThemes, setAvailableThemes] = useState<any[]>(DEFAULT_THEMES);
  const [themesLoading, setThemesLoading] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<any | null>(null);
  const [rawGeneratedPresentationData, setRawGeneratedPresentationData] = useState<any | null>(null);
  const [generatedPresentationData, setGeneratedPresentationData] = useState<any | null>(null);
  const [generatedPresentationVersion, setGeneratedPresentationVersion] = useState("sample");
  const [, setActiveUpdatingSlideIndex] = useState<number | null>(null);
  const typedVisibleCharactersRef = useRef(0);
  const generationRunRef = useRef(0);
  const { user } = useUser();
  const isAdmin = !!user?.is_admin;
  const userStorageId = user?.id || user?.email ? String(user.id || user.email) : "";
  const generatedPreviewStorageKey = userStorageId
    ? `template-preview-ai-generated:${userStorageId}:${templateParams}`
    : "";
  const selectedThemeStorageKey = userStorageId
    ? `template-preview-theme:${userStorageId}:${templateParams}`
    : "";


  // Fetch static templates if not custom
  const staticTemplates = !isCustom && !isDesigner ? getTemplatesByTemplateName(templateParams) : [];

  const staticGroup = !isCustom && !isDesigner ? resolvedStaticGroup ?? null : null;

  // Fetch custom template details if custom
  const {
    template: customTemplate,
    loading: customLoading,
    error: customError,
  } = useCustomTemplateDetails({ id: templateParams?.split("custom-")[1] || "", name: "", description: "" });

  const scrollToPreviewSlide = (index: number) => {
    const possibleIds = [
      `${resolvedStaticTemplateId}-static-preview-${index}`,
      `${templateParams}-designer-html-preview-${index}`,
      `${templateParams}-designer-slide-preview-${index}`,
      `${templateParams}-custom-preview-${index}`,
    ];
    window.setTimeout(() => {
      const element = possibleIds
        .map((id) => document.getElementById(id))
        .find(Boolean);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  const saveGeneratedPreviewData = (data: any) => {
    if (!generatedPreviewStorageKey || typeof window === "undefined" || !data?.slides?.length) return "";
    const updatedAt = new Date().toISOString();
    window.localStorage.setItem(
      generatedPreviewStorageKey,
      JSON.stringify({
        data,
        updatedAt,
      })
    );
    return updatedAt;
  };

  const revealPresentationSequentially = async (presentationData: any) => {
    if (!presentationData?.slides?.length) return;

    const runId = ++generationRunRef.current;
    setRawGeneratedPresentationData(presentationData);
    setGeneratedPresentationData({ ...presentationData, slides: [] });
    typedVisibleCharactersRef.current = 0;

    for (let slideIndex = 0; slideIndex < presentationData.slides.length; slideIndex += 1) {
      if (runId !== generationRunRef.current) return;

      const slide = presentationData.slides[slideIndex];
      const totalCharacters = countTypableCharacters(slide);
      const step = Math.max(1, Math.ceil(Math.max(totalCharacters, 1) / 260));
      let visibleCharacters = totalCharacters === 0 ? 1 : 0;

      setActiveUpdatingSlideIndex(slideIndex);
      setAiGenerationMessage(`Updating slide ${slideIndex + 1} of ${presentationData.slides.length}...`);
      scrollToPreviewSlide(slideIndex);

      while (visibleCharacters < Math.max(totalCharacters, 1)) {
        if (runId !== generationRunRef.current) return;

        visibleCharacters = Math.min(Math.max(totalCharacters, 1), visibleCharacters + step);
        typedVisibleCharactersRef.current += step;
        setGeneratedPresentationData(
          buildSequentialTypedPresentationData(presentationData, slideIndex, visibleCharacters)
        );
        const humanDelay = 48 + Math.floor(Math.random() * 34);
        await new Promise((resolve) => window.setTimeout(resolve, humanDelay));
      }

      setGeneratedPresentationData({
        ...presentationData,
        slides: presentationData.slides.slice(0, slideIndex + 1),
      });
      await new Promise((resolve) => window.setTimeout(resolve, 520));
    }

    if (runId !== generationRunRef.current) return;
    typedVisibleCharactersRef.current = countTypableCharacters(presentationData);
    setGeneratedPresentationData(presentationData);
    setActiveUpdatingSlideIndex(null);
  };

  const streamGeneratedOutlines = async (presentationId: string) => {
    const authClient = createClient();
    const { data: { session } } = await authClient.auth.getSession();
    const token = session?.access_token ?? "";
    const url = `/api/v1/ppt/outlines/stream/${presentationId}${token ? `?token=${encodeURIComponent(token)}` : ""}`;

    return await new Promise<{ content: string }[]>((resolve, reject) => {
      const eventSource = new EventSource(url);

      eventSource.addEventListener("response", (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "status") {
          setAiGenerationMessage(data.status || "Generating outline...");
          return;
        }

        if (data.type === "complete") {
          eventSource.close();
          const slides = data.presentation?.outlines?.slides || [];
          resolve(slides);
          return;
        }

        if (data.type === "error") {
          eventSource.close();
          reject(new Error(data.detail || "Failed to generate outline"));
        }
      });

      eventSource.onerror = () => {
        eventSource.close();
        reject(new Error("Failed to connect to outline generator"));
      };
    });
  };

  const streamPreparedPresentation = async (presentationId: string) => {
    const authClient = createClient();
    const { data: { session } } = await authClient.auth.getSession();
    const token = session?.access_token ?? "";
    const url = `/api/v1/ppt/presentation/stream/${presentationId}${token ? `?token=${encodeURIComponent(token)}` : ""}`;

    return await new Promise<any>((resolve, reject) => {
      const eventSource = new EventSource(url);
      let accumulatedChunks = "";

      let isSettled = false;

      eventSource.addEventListener("response", (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "chunk") {
          accumulatedChunks += data.chunk;
          try {
            const partialData = JSON.parse(jsonrepair(accumulatedChunks));
            if (partialData?.slides?.length) {
              setAiGenerationMessage(`Generating slide ${partialData.slides.length}...`);
            }
          } catch {
            // Wait for enough stream chunks to form valid JSON.
          }
          return;
        }

        if (data.type === "complete" || data.type === "closing") {
          if (isSettled) return;
          isSettled = true;
          eventSource.close();
          const finalIndex = Math.max((data.presentation?.slides?.length || 1) - 1, 0);
          const updatedAt = saveGeneratedPreviewData(data.presentation);
          revealPresentationSequentially(data.presentation)
            .then(() => {
              setGeneratedPresentationVersion(updatedAt ? `saved-${updatedAt}` : `generated-${Date.now()}`);
              scrollToPreviewSlide(finalIndex);
              resolve(data.presentation);
            })
            .catch(reject);
          return;
        }

        if (data.type === "error") {
          eventSource.close();
          reject(new Error(data.detail || "Failed to generate presentation"));
        }
      });

      eventSource.onerror = () => {
        eventSource.close();
        reject(new Error("Failed to connect to presentation generator"));
      };
    });
  };



  useEffect(() => {
    const existingScript = document.querySelector('script[src*="tailwindcss.com"]');
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://cdn.tailwindcss.com";
      script.async = true;
      document.head.appendChild(script);
    }
  }, [templateParams]);

  useEffect(() => {
    if (!isCustom && !isDesigner && staticGroup?.slug && templateParams === staticGroup.id) {
      router.replace(`/template-preview/${staticGroup.slug}`);
    }
  }, [isCustom, isDesigner, router, staticGroup?.id, staticGroup?.slug, templateParams]);

  useEffect(() => {
    let cancelled = false;

    const loadThemes = async () => {
      setThemesLoading(true);
      try {
        const customThemes = await ThemeApi.getThemes();
        if (cancelled) return;
        const mergedThemes = [...DEFAULT_THEMES, ...(Array.isArray(customThemes) ? customThemes : [])]
          .filter((theme, index, themes) => theme?.data?.colors && themes.findIndex((item) => item.id === theme.id) === index);
        setAvailableThemes(mergedThemes);
      } catch (error) {
        console.error("Failed to load custom themes", error);
        if (!cancelled) setAvailableThemes(DEFAULT_THEMES);
      } finally {
        if (!cancelled) setThemesLoading(false);
      }
    };

    loadThemes();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedThemeStorageKey || typeof window === "undefined" || !availableThemes.length) return;
    const savedThemeId = window.localStorage.getItem(selectedThemeStorageKey);
    if (!savedThemeId) return;
    const savedTheme = availableThemes.find((theme) => theme.id === savedThemeId);
    if (savedTheme) setSelectedTheme(savedTheme);
  }, [availableThemes, selectedThemeStorageKey]);

  useEffect(() => {
    applyTemplateThemeToElement(document.getElementById("presentation-page"), selectedTheme);
  }, [generatedPresentationData, selectedTheme]);

  useEffect(() => {
    if (!generatedPreviewStorageKey || typeof window === "undefined") return;

    const savedPayload = window.localStorage.getItem(generatedPreviewStorageKey);
    if (!savedPayload) return;

    try {
      const parsed = JSON.parse(savedPayload);
      const savedData = parsed?.data;
      if (!savedData?.slides?.length) return;

      typedVisibleCharactersRef.current = countTypableCharacters(savedData);
      setRawGeneratedPresentationData(savedData);
      setGeneratedPresentationData(savedData);
      setGeneratedPresentationVersion(`saved-${parsed?.updatedAt || "local"}`);
    } catch {
      window.localStorage.removeItem(generatedPreviewStorageKey);
    }
  }, [generatedPreviewStorageKey]);

  useEffect(() => {
    if (!rawGeneratedPresentationData) {
      typedVisibleCharactersRef.current = 0;
      setGeneratedPresentationData(null);
    }
  }, [rawGeneratedPresentationData]);

  useEffect(() => {
    if (!isDesigner || !designerTemplateId) return;

    setDesignerLoading(true);
    setDesignerError(null);
    setDesignerHtmlTemplate(null);
    api.get<PptxDesignerTemplate[]>("/api/v1/account/pptx-templates")
      .then(async (templates) => {
        const found = templates.find((template) => template.id === designerTemplateId);
        if (!found) {
          setDesignerError("Designer template not found");
          setDesignerTemplate(null);
          return;
        }
        if (found.locked) {
          router.push("/settings/billing");
          return;
        }
        setDesignerTemplate(found);
        if (found.html_template_id && found.html_conversion_status === "completed") {
          try {
            const convertedTemplate = await getCustomTemplateDetails(
              found.html_template_id,
              found.name,
              found.description || "Designer template converted from PPTX"
            );
            setDesignerHtmlTemplate(convertedTemplate);
          } catch (error) {
            console.warn("Failed to load converted designer HTML template", error);
          }
        }
        return api
          .get<SelectableDesignerPreview>(`/api/v1/account/pptx-templates/${designerTemplateId}/selectable-preview`)
          .then(setDesignerSelectablePreview)
          .catch(() => setDesignerSelectablePreview(null));
      })
      .catch((error: any) => setDesignerError(error?.message ?? "Failed to load designer template"))
      .finally(() => setDesignerLoading(false));
  }, [designerTemplateId, isDesigner, router]);

  const handleDeleteCustomTemplate = async () => {
    if (!customTemplateId) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this template? This action cannot be undone."
    );
    if (!confirmed) return;

    try {
      const result = await TemplateService.deleteCustomTemplate(customTemplateId);
      if (result?.success) {
        toast.success("Template deleted successfully");
        router.push("/template-preview");
      } else {
        toast.error("Failed to delete template");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete template");
    }
  };


  // Loading state for custom templates
  if (isCustom && (customLoading)) {
    return (
      <TemplatePreviewShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Compiling templates...</span>
        </div>
      </TemplatePreviewShell>
    );
  }

  if (isDesigner && designerLoading) {
    return (
      <TemplatePreviewShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          <span className="ml-3 text-gray-600">Loading designer template...</span>
        </div>
      </TemplatePreviewShell>
    );
  }

  // Error state
  if (isCustom && customError) {
    return (
      <TemplatePreviewShell>
        <div className="flex flex-col items-center justify-center py-24">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error loading template</h2>
          <p className="text-gray-600 mb-4">{customError}</p>
          <Button onClick={() => router.push("/template-preview")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Templates
          </Button>
        </div>
      </TemplatePreviewShell>
    );
  }

  if (isDesigner && designerError) {
    return (
      <TemplatePreviewShell>
        <div className="flex flex-col items-center justify-center py-24">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error loading template</h2>
          <p className="text-gray-600 mb-4">{designerError}</p>
          <Button onClick={() => router.push("/template-preview")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Templates
          </Button>
        </div>
      </TemplatePreviewShell>
    );
  }

  // Empty state
  if (
    (!isCustom && !isDesigner && (!staticGroup || staticTemplates.length === 0)) ||
    (isCustom && (!customTemplate)) ||
    (isDesigner && !designerTemplate)
  ) {
    return (
      <TemplatePreviewShell>
        <div className="flex flex-col items-center justify-center py-24">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Template not found
          </h2>
          <Button onClick={() => router.push("/template-preview")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Templates
          </Button>
        </div>
      </TemplatePreviewShell>
    );
  }

  // Determine what to render
  const templateName = isCustom ? customTemplate?.template.name || "Custom Template" : staticGroup?.name || "";
  const templateDescription = isDesigner
    ? designerTemplate?.description || ""
    : isCustom
    ? customTemplate?.template.description || ""
    : staticGroup?.description || "";
  const layoutCount = isDesigner
    ? designerHtmlTemplate?.layouts.length || designerTemplate?.slide_count || designerTemplate?.thumbnail_urls.length || 0
    : isCustom
    ? customTemplate?.layouts.length || 0
    : staticTemplates.length;
  const resolvedTemplateName = isDesigner ? designerTemplate?.name || "Designer Template" : templateName;

  const buildGenerationLayout = () => {
    if (isDesigner) {
      if (designerHtmlTemplate?.layouts.length) {
        return {
          layout: {
            name: designerHtmlTemplate.id,
            ordered: true,
            slides: designerHtmlTemplate.layouts.map((layout) => ({
              id: designerHtmlTemplate.id.startsWith("custom-")
                ? `${designerHtmlTemplate.id}:${layout.layoutId}`
                : `custom-${designerHtmlTemplate.id}:${layout.layoutId}`,
              name: layout.layoutName,
              description: layout.layoutDescription,
              templateID: designerHtmlTemplate.id,
              templateName: designerHtmlTemplate.name,
              json_schema: layout.schemaJSON,
            })),
          },
          pptxTemplateId: null,
        };
      }

      const designerSlides = designerSelectablePreview?.slides.filter((slide) => slide.text_boxes.length > 0) || [];
      const templateId = `designer-${designerTemplateId}`;
      return {
        layout: {
          name: templateId,
          ordered: true,
          slides: designerSlides.map((slide) => ({
            id: `${templateId}:slide-${slide.slide_number}`,
            name: `Designer Slide ${slide.slide_number}`,
            description: `Generate text specifically for slide ${slide.slide_number} of the selected designer PPTX template.`,
            templateID: templateId,
            templateName: designerTemplate?.name || "Designer Template",
            json_schema: buildDesignerSlideSchema(slide),
          })),
        },
        pptxTemplateId: designerTemplateId,
      };
    }

    if (isCustom && customTemplate) {
      return {
        layout: {
          name: customTemplate.id,
          ordered: true,
          slides: customTemplate.layouts.map((layout) => ({
            id: customTemplate.id.startsWith("custom-")
              ? `${customTemplate.id}:${layout.layoutId}`
              : `custom-${customTemplate.id}:${layout.layoutId}`,
            name: layout.layoutName,
            description: layout.layoutDescription,
            templateID: customTemplate.id,
            templateName: customTemplate.name,
            json_schema: layout.schemaJSON,
          })),
        },
        pptxTemplateId: null,
      };
    }

    return {
      layout: {
        name: resolvedStaticTemplateId,
        ordered: true,
        slides: staticTemplates.map((layout) => ({
          id: getTemplateScopedLayoutId(resolvedStaticTemplateId, layout.layoutId),
          name: layout.layoutName,
          description: layout.layoutDescription,
          templateID: resolvedStaticTemplateId,
          templateName: resolvedTemplateName,
          json_schema: layout.schemaJSON,
        })),
      },
      pptxTemplateId: null,
    };
  };

  const handleApplyTheme = (theme: any) => {
    setSelectedTheme(theme);
    if (selectedThemeStorageKey && typeof window !== "undefined") {
      window.localStorage.setItem(selectedThemeStorageKey, theme.id);
    }
    toast.success(`${theme.name} theme applied`);
  };

  const handleResetTheme = () => {
    setSelectedTheme(null);
    if (selectedThemeStorageKey && typeof window !== "undefined") {
      window.localStorage.removeItem(selectedThemeStorageKey);
    }
    applyTemplateThemeToElement(document.getElementById("presentation-page"), null);
    toast.success("Theme reset");
  };

  const handleGenerateWithAi = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    const { layout, pptxTemplateId } = buildGenerationLayout();
    if (!layout.slides.length) {
      toast.error("No usable layouts found for this template");
      return;
    }

    try {
      setAiPromptModalOpen(false);
      setAiGenerating(true);
      generationRunRef.current += 1;
      setGeneratedPresentationVersion(`generating-${Date.now()}`);
      typedVisibleCharactersRef.current = 0;
      setRawGeneratedPresentationData(null);
      setGeneratedPresentationData(null);
      setActiveUpdatingSlideIndex(null);
      setAiGenerationMessage("Creating presentation...");

      const createResponse = await PresentationGenerationApi.createPresentation({
        content: aiPrompt,
        n_slides: layout.slides.length,
        file_paths: [],
        language: "English",
        tone: "default",
        verbosity: "standard",
        instructions: [
          "Generate content for every template page/layout.",
          "All image prompts must be realistic, presentation-related, high-quality photographic scenes with natural lighting.",
          "Avoid abstract, cartoon, logo, icon-only, blurry, or generic stock-looking image prompts unless the user explicitly asks for them.",
          "Image prompts should be directly relevant to the user's topic and the slide's message.",
        ].join(" "),
        include_table_of_contents: false,
        include_title_slide: true,
        web_search: false,
      });

      setAiGenerationMessage("Generating outline...");
      const outlines = await streamGeneratedOutlines(createResponse.id);

      setAiGenerationMessage("Preparing template content...");
      await PresentationGenerationApi.presentationPrepare({
        presentation_id: createResponse.id,
        outlines,
        layout,
        pptx_template_id: pptxTemplateId,
      });

      setAiGenerationMessage("Generating slide content and images...");
      await streamPreparedPresentation(createResponse.id);
      toast.success("Template updated with AI content");
    } catch (error: any) {
      console.error("Template AI generation failed", error);
      toast.error("Generation Error", {
        description: error?.message || "Failed to generate content for this template.",
      });
    } finally {
      setAiGenerating(false);
      setAiGenerationMessage("");
    }
  };

  const getGeneratedSlide = (index: number) => {
    const slides = generatedPresentationData?.slides;
    if (!Array.isArray(slides) || slides.length === 0) return null;
    return slides[index] ?? null;
  };

  return (
    <TemplatePreviewShell>
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-30">
        <div className=" mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4 max-w-[1440px] mx-auto">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  trackEvent(MixpanelEvent.TemplatePreview_Back_Button_Clicked, { pathname });
                  router.back();
                }}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  trackEvent(MixpanelEvent.TemplatePreview_All_Groups_Button_Clicked, { pathname });
                  router.push("/template-preview");
                }}
                className="flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                All Templates
              </Button>
            </div>

            {isCustom && (
              <div className="flex items-center gap-4">

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    trackEvent(MixpanelEvent.TemplatePreview_Delete_Templates_Button_Clicked, { pathname });
                    trackEvent(MixpanelEvent.TemplatePreview_Delete_Templates_API_Call);
                    handleDeleteCustomTemplate();
                  }}
                  className="flex items-center gap-2 border-red-200 text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Template
                </Button>
              </div>
            )}
            {isDesigner && designerTemplate?.file_url && (
              <a
                href={designerTemplate.file_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-purple-200 bg-white px-3 text-sm font-medium text-purple-700 shadow-sm transition-colors hover:bg-purple-50"
              >
                <Download className="w-4 h-4" />
                Open PPTX
              </a>
            )}
            <Button
              type="button"
              onClick={() => setAiPromptModalOpen(true)}
              disabled={aiGenerating}
              className="gap-2 bg-indigo-600 text-white hover:bg-indigo-500"
            >
              {aiGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate with AI
            </Button>
            <TemplateThemeSelector
              themes={availableThemes}
              selectedTheme={selectedTheme}
              loading={themesLoading}
              onApply={handleApplyTheme}
              onReset={handleResetTheme}
            />
            <FullPreviewDownloadDropdown title={resolvedTemplateName} />
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{resolvedTemplateName}</h1>
              {isCustom && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-sm">
                  Custom
                </span>
              )}
              {isDesigner && (
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-sm">
                  Designer
                </span>
              )}
            </div>
            <p className="text-gray-600">
              {layoutCount} layout{layoutCount !== 1 ? "s" : ""} •{" "}
              {templateDescription}
            </p>
            {aiGenerating && aiGenerationMessage && (
              <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {aiGenerationMessage}
              </p>
            )}
          </div>

        </div>

      </header>

      <Dialog open={aiPromptModalOpen} onOpenChange={(open) => !aiGenerating && setAiPromptModalOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate content for this template</DialogTitle>
            <DialogDescription>
              AI will update all {layoutCount} page{layoutCount !== 1 ? "s" : ""} in this template and use realistic, presentation-related images.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder={`Write what this ${resolvedTemplateName} presentation should be about...`}
              className="min-h-[150px] w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              disabled={aiGenerating}
              autoFocus
            />
            {aiGenerationMessage && (
              <p className="text-xs font-medium text-indigo-700">
                {aiGenerationMessage}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAiPromptModalOpen(false)}
                disabled={aiGenerating}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleGenerateWithAi}
                disabled={aiGenerating || !aiPrompt.trim()}
                className="gap-2 bg-indigo-600 text-white hover:bg-indigo-500"
              >
                {aiGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {aiGenerating ? "Generating" : `Generate ${layoutCount} pages`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Layout Grid - Wrapped in SchemaHighlightProvider for custom templates */}
      <main className="mx-auto px-2 py-8" id="presentation-page">
        <StaticTemplateEditPanel state={staticEditorPanelState} />

        {/* Static Templates */}
        {!isCustom && (
          !isDesigner && (
          <div className="mx-auto w-full max-w-[1440px] space-y-12">
            {staticTemplates.map((template: any, index: number) => {
              const LayoutComponent = template.component;
              const previewTargetId = `${resolvedStaticTemplateId}-static-preview-${index}`;
              const generatedSlide = getGeneratedSlide(index);

              return (
                <Card
                  key={`${resolvedStaticTemplateId}-${template.layoutId}-${index}`}
                  id={template.layoutId}
                  className="overflow-hidden shadow-md"
                >
                  <div className="bg-white px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">
                          {template.layoutName}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                          {template.layoutDescription}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm font-mono">
                          {template.layoutId}
                        </span>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                          #{index + 1}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-100 p-6 flex justify-center overflow-x-auto">
                    <StaticTemplateEditor
                      key={`${resolvedStaticTemplateId}-${template.layoutId}-${generatedPresentationVersion}`}
                      storageKey={[
                        "static-template-edits",
                        user?.id || user?.email || "guest",
                        resolvedStaticTemplateId,
                        generatedPresentationVersion,
                        template.layoutId,
                      ].join(":")}
                      editorId={`${resolvedStaticTemplateId}-${template.layoutId}-${index}`}
                      onPanelStateChange={setStaticEditorPanelState}
                      savedTemplateMeta={{
                        userKey: String(user?.id || user?.email || "guest"),
                        templateId: resolvedStaticTemplateId,
                        name: resolvedTemplateName,
                        description: templateDescription,
                        layoutCount,
                      }}
                    >
                      <div
                        id={previewTargetId}
                        data-template-preview-slide="true"
                        className="relative flex-shrink-0"
                        style={{ width: "1280px", height: "720px" }}
                      >
                        <SlideHoverToolbar onAi={() => setAiPromptModalOpen(true)} />
                        <LayoutComponent data={generatedSlide?.content ?? template.sampleData} />
                      </div>
                    </StaticTemplateEditor>
                  </div>
                </Card>
              );
            })}
          </div>
          )
        )}

        {isDesigner && designerTemplate && shouldShowExcelPreview && (
          <ReadOnlyExcelPreview title={designerTemplate.name || "Excel File"} />
        )}

        {isDesigner && designerTemplate && !shouldShowExcelPreview && designerHtmlTemplate?.layouts.length ? (
          <div className="flex flex-col items-center justify-center w-full gap-10 aspect-video mx-auto">
            {designerHtmlTemplate.layouts.map((layout: CustomTemplateLayout, index: number) => {
              const LayoutComponent = layout.component;
              const previewTargetId = `${templateParams}-designer-html-preview-${index}`;
              const generatedSlide = getGeneratedSlide(index);
              return (
                <Card
                  key={`${templateParams}-html-${layout.rawLayoutId}-${index}`}
                  id={`designer-html-${layout.rawLayoutId}`}
                  className="overflow-hidden shadow-md"
                >
                  <div className="bg-white px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">
                          {layout.rawLayoutName}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                          Converted HTML layout from {designerTemplate.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {isAdmin && (
                          <>
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
                            HTML
                          </span>
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm font-mono">
                            {designerTemplate.html_template_slug}:{layout.rawLayoutId}
                          </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-100 p-6 flex justify-center overflow-x-auto">
                    {isAdmin && customTemplateId ? (
                      <AdminEditableLayout
                        layout={layout}
                        templateId={customTemplateId}
                        onSaved={() => toast.success("Reload the page to see the saved compiled version")}
                      >
                        <div
                          id={previewTargetId}
                          data-template-preview-slide="true"
                          className="relative flex-shrink-0"
                          style={{ width: "1280px", height: "720px" }}
                        >
                          <SlideHoverToolbar onAi={() => setAiPromptModalOpen(true)} />
                          <LayoutComponent data={generatedSlide?.content ?? layout.sampleData} />
                        </div>
                      </AdminEditableLayout>
                    ) : (
                      <StaticTemplateEditor
                        key={`${templateParams}-${layout.layoutId}-${generatedPresentationVersion}`}
                        storageKey={[
                          "designer-html-template-preview-edits",
                          user?.id || user?.email || "guest",
                          templateParams,
                          generatedPresentationVersion,
                          layout.layoutId,
                        ].join(":")}
                        editorId={`${templateParams}-${layout.layoutId}-${index}`}
                        onPanelStateChange={setStaticEditorPanelState}
                        savedTemplateMeta={{
                          userKey: String(user?.id || user?.email || "guest"),
                          templateId: templateParams,
                          name: resolvedTemplateName,
                          description: templateDescription,
                          layoutCount,
                        }}
                      >
                        <div
                          id={previewTargetId}
                          data-template-preview-slide="true"
                          className="relative flex-shrink-0"
                          style={{ width: "1280px", height: "720px" }}
                        >
                          <SlideHoverToolbar onAi={() => setAiPromptModalOpen(true)} />
                          <LayoutComponent data={generatedSlide?.content ?? layout.sampleData} />
                        </div>
                      </StaticTemplateEditor>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : null}

        {isDesigner && designerTemplate && !shouldShowExcelPreview && !designerHtmlTemplate?.layouts.length && (
          <div className="mx-auto w-full max-w-[1440px] space-y-12">
            {designerTemplate.html_conversion_status && designerTemplate.html_conversion_status !== "completed" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                HTML conversion is {designerTemplate.html_conversion_status}. Showing PPTX thumbnail preview for now.
              </div>
            )}
            {(designerSelectablePreview?.slides.length || designerTemplate.thumbnail_urls.length) > 0 ? (
              (designerSelectablePreview?.slides ?? designerTemplate.thumbnail_urls.map((url, index) => ({
                slide_number: index + 1,
                thumbnail_url: url,
                text_boxes: [],
              }))).map((slide, index) => {
                const previewTargetId = `${templateParams}-designer-slide-preview-${index}`;
                const generatedSlide = getGeneratedSlide(index);
                return (
                <Card
                  key={`${templateParams}-designer-slide-${index}`}
                  id={`designer-slide-${slide.slide_number}`}
                  className="overflow-hidden shadow-md"
                >
                  <div className="bg-white px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">
                          Slide {slide.slide_number}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                          {designerTemplate.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {isAdmin && (
                          <>
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm font-mono">
                            {templateParams}:slide-{index + 1}
                          </span>
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                            #{index + 1}
                          </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-100 p-6 flex justify-center overflow-x-auto">
                    <div
                      id={previewTargetId}
                      data-template-preview-slide="true"
                      className="relative flex-shrink-0 bg-white"
                      style={{ width: "1280px", height: "720px" }}
                    >
                      <SlideHoverToolbar onAi={() => setAiPromptModalOpen(true)} />
                      {generatedSlide?.content && designerTemplateId ? (
                        <DesignerTemplateSlideRender
                          templateId={designerTemplateId}
                          slideIndex={index}
                          slideContent={generatedSlide.content}
                        />
                      ) : (
                        <>
                      {slide.thumbnail_url && (
                        <img
                          src={slide.thumbnail_url}
                          alt={`${designerTemplate.name} slide ${slide.slide_number}`}
                          className="absolute inset-0 h-full w-full object-contain"
                          draggable={false}
                        />
                      )}
                      <div className="absolute inset-0 z-10">
                        {slide.text_boxes.map((box, boxIndex) => (
                          <div
                            key={`${slide.slide_number}-${boxIndex}`}
                            className="absolute whitespace-pre-wrap break-words text-transparent selection:bg-indigo-500/30 selection:text-transparent"
                            style={{
                              left: `${box.left_pct}%`,
                              top: `${box.top_pct}%`,
                              width: `${Math.min(100 - box.left_pct, box.width_pct * 1.18)}%`,
                              maxWidth: `calc(100% - ${box.left_pct}%)`,
                              minHeight: `${box.height_pct}%`,
                              fontSize: `${box.font_size_pt ?? 16}pt`,
                              lineHeight: 1.15,
                              color: "transparent",
                              userSelect: "text",
                              WebkitUserSelect: "text",
                              WebkitTextFillColor: "transparent",
                            }}
                          >
                            {box.text}
                          </div>
                        ))}
                      </div>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
                );
              })
            ) : (
              <Card className="flex flex-1 flex-col items-center justify-center py-20 text-gray-500">
                <Loader2 className="mb-3 h-8 w-8 animate-spin text-purple-600" />
                <p className="text-sm font-medium">Preview thumbnails are still generating.</p>
                <p className="mt-1 text-xs">Refresh this page after a few seconds.</p>
              </Card>
            )}
          </div>
        )}

        {/* Custom Templates - with page-level schema editor */}
        {isCustom && (

          <div className="flex flex-col items-center justify-center w-full gap-10  aspect-video mx-auto">
            {/* Slides List */}

            {customTemplate && customTemplate.layouts.map((layout: CustomTemplateLayout, index: number) => {
              const LayoutComponent = layout.component;
              const previewTargetId = `${templateParams}-custom-preview-${index}`;
              const generatedSlide = getGeneratedSlide(index);
              return (
                <Card
                  key={`${templateParams}-${layout.layoutId}-${index}`}
                  id={layout.layoutId}
                  className="overflow-hidden shadow-md"
                >
                  <div className="bg-white px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">
                          {layout.rawLayoutName}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                          {layout.layoutDescription}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-end justify-end ">
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm font-mono">
                        {templateParams}:{layout.layoutId}
                      </span>

                    </div>
                  </div>

                  <div className="bg-gray-100 p-6 flex justify-center overflow-x-auto">
                    <StaticTemplateEditor
                      key={`${templateParams}-${layout.layoutId}-${generatedPresentationVersion}`}
                      storageKey={[
                        "custom-template-preview-edits",
                        user?.id || user?.email || "guest",
                        templateParams,
                        generatedPresentationVersion,
                        layout.layoutId,
                      ].join(":")}
                      editorId={`${templateParams}-${layout.layoutId}-${index}`}
                      onPanelStateChange={setStaticEditorPanelState}
                      savedTemplateMeta={{
                        userKey: String(user?.id || user?.email || "guest"),
                        templateId: templateParams,
                        name: resolvedTemplateName,
                        description: templateDescription,
                        layoutCount,
                      }}
                    >
                      <div
                        id={previewTargetId}
                        data-template-preview-slide="true"
                        className="relative flex-shrink-0"
                        style={{ width: "1280px", height: "720px" }}
                      >
                        <SlideHoverToolbar onAi={() => setAiPromptModalOpen(true)} />
                        <LayoutComponent data={generatedSlide?.content ?? layout.sampleData} />
                      </div>
                    </StaticTemplateEditor>
                  </div>
                </Card>
              );
            })}


          </div>
        )}
      </main>
    </TemplatePreviewShell>
  );
};

export default GroupLayoutPreview;
