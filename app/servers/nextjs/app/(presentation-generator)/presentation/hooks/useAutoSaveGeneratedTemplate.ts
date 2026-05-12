"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/auth/client";

const AUTO_SAVE_PREFIX = "unslid:auto-saved-generated-template:";

const cleanSlideHtml = (html: string) => {
  if (typeof document === "undefined") return html;

  const container = document.createElement("div");
  container.innerHTML = html;

  container.querySelectorAll("[contenteditable]").forEach((node) => {
    node.removeAttribute("contenteditable");
    node.removeAttribute("contentEditable");
  });

  container.querySelectorAll<HTMLElement>(".ProseMirror").forEach((node) => {
    node.removeAttribute("contenteditable");
    node.classList.remove("ProseMirror", "ProseMirror-focused");
  });

  container.querySelectorAll<HTMLElement>("[data-editable-processed]").forEach((node) => {
    node.removeAttribute("data-editable-processed");
    node.removeAttribute("data-editable-id");
    node.style.cursor = "";
    node.style.transition = "";
    node.style.opacity = "";
    node.style.transform = "";
  });

  return container.innerHTML;
};

type TextToken = {
  key: string;
  value: string;
};

type ImageToken = {
  key: string;
  url: string;
  prompt: string;
};

const tokenizeSlideHtml = (html: string): { html: string; textTokens: TextToken[]; imageTokens: ImageToken[] } => {
  if (typeof document === "undefined") return { html, textTokens: [], imageTokens: [] };

  const container = document.createElement("div");
  container.innerHTML = cleanSlideHtml(html);
  const textTokens: TextToken[] = [];
  const imageTokens: ImageToken[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const skippedParents = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "CANVAS"]);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    const text = node.textContent || "";
    const trimmed = text.trim();

    if (!parent || skippedParents.has(parent.tagName) || trimmed.length < 3) continue;
    if (/^[\d\s.,:%$€£৳#()\-+/]+$/.test(trimmed) && trimmed.length < 8) continue;

    textNodes.push(node);
  }

  textNodes.slice(0, 80).forEach((node, index) => {
    const key = `text_${index + 1}`;
    const value = (node.textContent || "").replace(/\s+/g, " ").trim();
    if (!value) return;

    textTokens.push({ key, value });
    node.textContent = `{{${key}}}`;
  });

  Array.from(container.querySelectorAll<HTMLImageElement>("img[src]")).slice(0, 24).forEach((image, index) => {
    const key = `image_${index + 1}`;
    const url = image.getAttribute("src") || "";
    if (!url || url.startsWith("data:")) return;

    const nearbyText = image
      .closest("div")
      ?.textContent
      ?.replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    const prompt = image.getAttribute("alt")?.trim() || nearbyText || "Relevant presentation image for this slide";

    imageTokens.push({ key, url, prompt });
    image.setAttribute("src", `{{${key}}}`);
  });

  return {
    html: container.innerHTML,
    textTokens,
    imageTokens,
  };
};

const buildStaticLayoutCode = (slideIndex: number, html: string) => `
const layoutId = "${slideIndex + 1}";
const layoutName = "Slide ${slideIndex + 1}";
const layoutDescription = "Auto-saved generated slide ${slideIndex + 1}";
${(() => {
  const { html: tokenizedHtml, textTokens, imageTokens } = tokenizeSlideHtml(html);
  const textSchemaFields = textTokens.map((token) => (
    `${JSON.stringify(token.key)}: z.string().max(260).describe(${JSON.stringify(`Visible template text currently reading: "${token.value.slice(0, 140)}". Rewrite this text for the user's prompt while preserving the slide's role and length.`)}).default(${JSON.stringify(token.value)})`
  ));
  const imageSchemaFields = imageTokens.map((token) => (
    `${JSON.stringify(token.key)}: z.object({
    __image_url__: z.string().default(${JSON.stringify(token.url)}),
    __image_prompt__: z.string().min(10).max(100).describe(${JSON.stringify("Prompt for replacing this exact image. Use a realistic, presentation-related photographic scene that matches the user's topic and this slide's message.")}).default(${JSON.stringify(token.prompt.slice(0, 100))})
  })`
  ));
  return `
const Schema = z.object({
  ${[...textSchemaFields, ...imageSchemaFields].join(",\n  ")}
});
const generatedSlideHtml = ${JSON.stringify(tokenizedHtml)};
const textTokenKeys = ${JSON.stringify(textTokens.map((token) => token.key))};
const textTokenDefaults = ${JSON.stringify(Object.fromEntries(textTokens.map((token) => [token.key, token.value])))};
const imageTokenKeys = ${JSON.stringify(imageTokens.map((token) => token.key))};
const imageTokenDefaults = ${JSON.stringify(Object.fromEntries(imageTokens.map((token) => [token.key, token.url])))};
`;
})()}

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const applyThemeToHtml = (html, theme) => {
  const colors = theme?.data?.colors;
  if (!colors) return html;

  const replacements = [
    ["rgb(131, 24, 67)", colors.primary],
    ["#831843", colors.primary],
    ["rgb(244, 114, 182)", colors.graph_0 || colors.primary],
    ["#f472b6", colors.graph_0 || colors.primary],
    ["rgb(31, 16, 32)", colors.background],
    ["#1f1020", colors.background],
    ["rgb(253, 242, 248)", colors.background_text],
    ["#fdf2f8", colors.background_text],
    ["rgba(131, 24, 67, 0.8)", colors.primary],
    ["rgba(244, 114, 182, 0.12)", colors.card],
  ].filter((entry) => entry[1]);

  return replacements.reduce((nextHtml, [from, to]) => nextHtml.split(from).join(to), html);
};

const dynamicSlideLayout = ({ data = {} }) => {
  const textHtml = textTokenKeys.reduce((nextHtml, key) => (
    nextHtml.split("{{" + key + "}}").join(escapeHtml(data[key] ?? textTokenDefaults[key] ?? ""))
  ), generatedSlideHtml);
  const imageHtml = imageTokenKeys.reduce((nextHtml, key) => (
    nextHtml.split("{{" + key + "}}").join(escapeHtml(data[key]?.__image_url__ ?? imageTokenDefaults[key] ?? ""))
  ), textHtml);
  const fallbackImageUrl = imageTokenKeys.map((key) => data[key]?.__image_url__ ?? imageTokenDefaults[key]).find(Boolean) ?? "";
  const cleanedHtml = imageHtml
    .replace(/\\{\\{image_\\d+\\}\\}/g, escapeHtml(fallbackImageUrl))
    .replace(/\\/static\\/images\\/placeholder\\.jpg/g, escapeHtml(fallbackImageUrl));
  const html = applyThemeToHtml(cleanedHtml, data.__theme__);

  return (
    <div
      className="relative h-full w-full overflow-hidden [&>*]:mx-auto"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
`;

const postJson = async (path: string, body: unknown) => {
  const authClient = createClient();
  const {
    data: { session },
  } = await authClient.auth.getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || "Request failed");
  }

  return response.json();
};

export const useAutoSaveGeneratedTemplate = ({
  presentationId,
  presentationData,
  isStreaming,
  loading,
}: {
  presentationId: string;
  presentationData: any;
  isStreaming: boolean;
  loading: boolean;
}) => {
  const savingRef = useRef(false);

  useEffect(() => {
    if (!presentationId || !presentationData?.slides?.length || isStreaming || loading) return;
    if (presentationData?.pptx_template_id) return;
    if (savingRef.current) return;
    if (typeof window !== "undefined" && window.localStorage.getItem(`${AUTO_SAVE_PREFIX}${presentationId}`)) return;

    let cancelled = false;

    const timeout = window.setTimeout(async () => {
      if (savingRef.current) return;

      try {
        const slideElements = Array.from(
          document.querySelectorAll<HTMLElement>("[id^='slide-'] [data-slide-content='true']")
        );

        if (!slideElements.length || cancelled) return;

        const layouts = slideElements.map((element, index) => {
          const clone = element.cloneNode(true) as HTMLElement;
          return {
            presentation: presentationId,
            layout_id: `${index + 1}`,
            layout_name: `Slide ${index + 1}`,
            layout_code: buildStaticLayoutCode(index, clone.innerHTML),
            fonts: [] as string[],
          };
        });

        savingRef.current = true;
        const title = presentationData?.title || "Generated Template";

        await postJson("/api/v1/ppt/template-management/templates", {
          id: presentationId,
          name: title,
          description: "Auto-saved from generated presentation",
        });

        await postJson("/api/v1/ppt/template-management/save-templates", { layouts });
        if (!cancelled) {
          window.localStorage.setItem(`${AUTO_SAVE_PREFIX}${presentationId}`, "1");
        }
      } catch (error) {
        console.error("Failed to auto-save generated template:", error);
      } finally {
        savingRef.current = false;
      }
    }, 1800);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [presentationId, presentationData, isStreaming, loading]);
};
