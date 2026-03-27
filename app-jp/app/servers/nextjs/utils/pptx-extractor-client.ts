/**
 * Client-side PPTX model extractor.
 *
 * Runs entirely in the user's browser — no Puppeteer, no network round-trip.
 * Reduces PPTX export from 15-60 s → 2-5 s.
 *
 * Usage:
 *   const model = await extractPresentationPptxModel(presentation_id);
 *   // Then POST model to /api/v1/ppt/presentation/export/pptx
 */

import { convertElementAttributesToPptxSlides } from "@/utils/pptx_models_utils";
import type { ElementAttributes, SlideAttributesResult } from "@/types/element_attibutes";
import type { PptxPresentationModel } from "@/types/pptx_models";

// ─── Color parsing (same logic as inside element.evaluate() in route.ts) ──────

function colorToHex(color: string): { hex: string | undefined; opacity: number | undefined } {
  if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") {
    return { hex: undefined, opacity: undefined };
  }

  if (color.startsWith("rgba(") || color.startsWith("hsla(")) {
    const match = color.match(/rgba?\(([^)]+)\)|hsla?\(([^)]+)\)/);
    if (match) {
      const values = match[1] || match[2];
      const parts = values.split(",").map((p) => p.trim());
      if (parts.length >= 4) {
        const opacity = parseFloat(parts[3]);
        const rgbColor = color.replace(/rgba?\(|hsla?\(|\)/g, "").split(",").slice(0, 3).join(",");
        const rgbString = color.startsWith("rgba") ? `rgb(${rgbColor})` : `hsl(${rgbColor})`;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = rgbString;
          const hexColor = ctx.fillStyle;
          const hex = hexColor.startsWith("#") ? hexColor.substring(1) : hexColor;
          return { hex, opacity: isNaN(opacity) ? undefined : opacity };
        }
      }
    }
  }

  if (color.startsWith("rgb(") || color.startsWith("hsl(")) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = color;
      const hexColor = ctx.fillStyle;
      const hex = hexColor.startsWith("#") ? hexColor.substring(1) : hexColor;
      return { hex, opacity: undefined };
    }
  }

  if (color.startsWith("#")) return { hex: color.substring(1), opacity: undefined };

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return { hex: color, opacity: undefined };
  ctx.fillStyle = color;
  const hexColor = ctx.fillStyle;
  return { hex: hexColor.startsWith("#") ? hexColor.substring(1) : hexColor, opacity: undefined };
}

// ─── Per-element attribute parsers ────────────────────────────────────────────

function hasOnlyTextNodes(el: Element): boolean {
  for (let i = 0; i < el.childNodes.length; i++) {
    if (el.childNodes[i].nodeType === Node.ELEMENT_NODE) return false;
  }
  return true;
}

function parsePosition(el: Element) {
  const rect = el.getBoundingClientRect();
  return {
    left: isFinite(rect.left) ? rect.left : 0,
    top: isFinite(rect.top) ? rect.top : 0,
    width: isFinite(rect.width) ? rect.width : 0,
    height: isFinite(rect.height) ? rect.height : 0,
  };
}

function parseBackground(cs: CSSStyleDeclaration) {
  const r = colorToHex(cs.backgroundColor);
  if (!r.hex && r.opacity === undefined) return undefined;
  return { color: r.hex, opacity: r.opacity };
}

function parseBackgroundImage(cs: CSSStyleDeclaration) {
  const bg = cs.backgroundImage;
  if (!bg || bg === "none") return undefined;
  const m = bg.match(/url\(['"]?([^'"]+)['"]?\)/);
  return m ? m[1] : undefined;
}

function parseBorder(cs: CSSStyleDeclaration) {
  const r = colorToHex(cs.borderColor);
  const w = parseFloat(cs.borderWidth);
  if (w === 0) return undefined;
  if (!r.hex && w === undefined && r.opacity === undefined) return undefined;
  return { color: r.hex, width: isNaN(w) ? undefined : w, opacity: r.opacity };
}

function parseShadow(cs: CSSStyleDeclaration) {
  const boxShadow = cs.boxShadow;
  if (!boxShadow || boxShadow === "none") return undefined;

  const shadows: string[] = [];
  let cur = ""; let parens = 0;
  for (const ch of boxShadow) {
    if (ch === "(") parens++;
    else if (ch === ")") parens--;
    else if (ch === "," && parens === 0) { shadows.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) shadows.push(cur.trim());

  let best = ""; let bestScore = -1;
  for (const s of shadows) {
    const parts = s.split(" "); const nums: number[] = []; const cols: string[] = [];
    let inColor = false; let colBuf = "";
    for (const p of parts) {
      const t = p.trim(); if (!t) continue;
      if (t.toLowerCase() === "inset") continue;
      if (/^(rgba?|hsla?)\s*\(/i.test(t)) { inColor = true; colBuf = t; continue; }
      if (inColor) {
        colBuf += " " + t;
        if ((colBuf.match(/\(/g) || []).length <= (colBuf.match(/\)/g) || []).length) {
          cols.push(colBuf); colBuf = ""; inColor = false;
        }
        continue;
      }
      const n = parseFloat(t);
      if (!isNaN(n)) nums.push(n); else cols.push(t);
    }
    let score = 0;
    if (nums.some((v) => v !== 0)) score += nums.filter((v) => v !== 0).length;
    if (cols.length) {
      const cr = colorToHex(cols.join(" "));
      if (cr.hex && cr.hex !== "000000" && cr.opacity !== 0) score += 2;
    }
    if (score > bestScore) { best = s; bestScore = score; }
  }
  if (!best && shadows.length) best = shadows[0];
  if (!best) return undefined;

  const parts = best.split(" "); const nums: number[] = []; const cols: string[] = [];
  let inColor = false; let colBuf = ""; let isInset = false;
  for (const p of parts) {
    const t = p.trim(); if (!t) continue;
    if (t.toLowerCase() === "inset") { isInset = true; continue; }
    if (/^(rgba?|hsla?)\s*\(/i.test(t)) { inColor = true; colBuf = t; continue; }
    if (inColor) {
      colBuf += " " + t;
      if ((colBuf.match(/\(/g) || []).length <= (colBuf.match(/\)/g) || []).length) {
        cols.push(colBuf); colBuf = ""; inColor = false;
      }
      continue;
    }
    const n = parseFloat(t);
    if (!isNaN(n)) nums.push(n); else cols.push(t);
  }
  if (nums.length < 2 || !cols.length) return undefined;
  const cr = colorToHex(cols.join(" "));
  if (!cr.hex) return undefined;
  const [ox, oy] = nums;
  return {
    offset: [ox, oy] as [number, number],
    color: cr.hex,
    opacity: cr.opacity,
    radius: nums[2] ?? 0,
    spread: nums[3] ?? 0,
    inset: isInset,
    angle: Math.atan2(oy, ox) * (180 / Math.PI),
  };
}

function parseFont(cs: CSSStyleDeclaration) {
  const size = parseFloat(cs.fontSize);
  const weight = parseInt(cs.fontWeight);
  const cr = colorToHex(cs.color);
  const family = cs.fontFamily;
  let name: string | undefined;
  if (family !== "initial") name = family.split(",")[0].trim().replace(/['"]/g, "");
  if (!name && size === undefined && weight === undefined && !cr.hex && cs.fontStyle !== "italic") return undefined;
  return {
    name,
    size: isNaN(size) ? undefined : size,
    weight: isNaN(weight) ? undefined : weight,
    color: cr.hex,
    italic: cs.fontStyle === "italic",
  };
}

function parseLineHeight(cs: CSSStyleDeclaration, el: Element) {
  const htmlEl = el as HTMLElement;
  const fontSize = parseFloat(cs.fontSize);
  const lh = parseFloat(cs.lineHeight);
  const singleLh = !isNaN(lh) ? lh : fontSize * 1.2;
  const text = el.textContent || "";
  const multiline =
    text.includes("\n") || text.includes("\r") ||
    htmlEl.offsetHeight > singleLh * 2 ||
    htmlEl.scrollHeight > htmlEl.clientHeight;
  if (multiline && cs.lineHeight && cs.lineHeight !== "normal") {
    const v = parseFloat(cs.lineHeight);
    if (!isNaN(v)) return v;
  }
  return undefined;
}

function parseMargin(cs: CSSStyleDeclaration) {
  const t = parseFloat(cs.marginTop), b = parseFloat(cs.marginBottom);
  const l = parseFloat(cs.marginLeft), r = parseFloat(cs.marginRight);
  if (t === 0 && b === 0 && l === 0 && r === 0) return undefined;
  return {
    top: isNaN(t) ? undefined : t, bottom: isNaN(b) ? undefined : b,
    left: isNaN(l) ? undefined : l, right: isNaN(r) ? undefined : r,
  };
}

function parsePadding(cs: CSSStyleDeclaration) {
  const t = parseFloat(cs.paddingTop), b = parseFloat(cs.paddingBottom);
  const l = parseFloat(cs.paddingLeft), r = parseFloat(cs.paddingRight);
  if (t === 0 && b === 0 && l === 0 && r === 0) return undefined;
  return {
    top: isNaN(t) ? undefined : t, bottom: isNaN(b) ? undefined : b,
    left: isNaN(l) ? undefined : l, right: isNaN(r) ? undefined : r,
  };
}

function parseBorderRadius(cs: CSSStyleDeclaration, el: Element) {
  const br = cs.borderRadius;
  if (!br || br === "0px") return undefined;
  const parts = br.split(" ").map((p) => parseFloat(p));
  let vals: number[];
  if (parts.length === 1) vals = [parts[0], parts[0], parts[0], parts[0]];
  else if (parts.length === 2) vals = [parts[0], parts[1], parts[0], parts[1]];
  else if (parts.length === 3) vals = [parts[0], parts[1], parts[2], parts[1]];
  else vals = parts;
  const rect = el.getBoundingClientRect();
  const mx = rect.width / 2, my = rect.height / 2;
  return vals.map((v, i) => Math.max(0, Math.min(v, i === 0 || i === 2 ? mx : my)));
}

function parseFilters(cs: CSSStyleDeclaration) {
  const f = cs.filter;
  if (!f || f === "none") return undefined;
  const out: Record<string, number> = {};
  const fns = f.match(/[a-zA-Z-]+\([^)]*\)/g) || [];
  for (const fn of fns) {
    const m = fn.match(/([a-zA-Z-]+)\(([^)]*)\)/);
    if (!m) continue;
    const v = parseFloat(m[2]);
    if (isNaN(v)) continue;
    const map: Record<string, string> = {
      invert: "invert", brightness: "brightness", contrast: "contrast",
      saturate: "saturate", "hue-rotate": "hueRotate", blur: "blur",
      grayscale: "grayscale", sepia: "sepia", opacity: "opacity",
    };
    if (map[m[1]]) out[map[m[1]]] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function getElementAttributes(el: Element): ElementAttributes {
  const cs = window.getComputedStyle(el);
  const tagName = el.tagName.toLowerCase();
  const position = parsePosition(el);
  const borderRadiusValue = parseBorderRadius(cs, el);
  const imageSrc = (el as HTMLImageElement).src || parseBackgroundImage(cs);
  const shape =
    tagName === "img"
      ? borderRadiusValue?.length === 4 && borderRadiusValue.every((r) => r === 50)
        ? "circle"
        : "rectangle"
      : undefined;
  const zIndex = parseInt(cs.zIndex);
  const opacity = parseFloat(cs.opacity);

  return {
    tagName,
    id: el.id || undefined,
    className:
      el.className && typeof el.className === "string"
        ? el.className
        : el.className
        ? String(el.className)
        : undefined,
    innerText: hasOnlyTextNodes(el) ? el.textContent || undefined : undefined,
    opacity: isNaN(opacity) ? undefined : opacity,
    background: parseBackground(cs),
    border: parseBorder(cs),
    shadow: parseShadow(cs) as ElementAttributes["shadow"],
    font: parseFont(cs),
    position,
    margin: parseMargin(cs),
    padding: parsePadding(cs),
    zIndex: isNaN(zIndex) ? 0 : zIndex,
    textAlign: cs.textAlign !== "left" ? (cs.textAlign as ElementAttributes["textAlign"]) : undefined,
    lineHeight: parseLineHeight(cs, el),
    borderRadius: borderRadiusValue,
    imageSrc,
    objectFit: cs.objectFit as ElementAttributes["objectFit"],
    clip: false,
    overlay: undefined,
    shape: shape as ElementAttributes["shape"],
    connectorType: undefined,
    textWrap: cs.whiteSpace !== "nowrap",
    should_screenshot: false,
    element: undefined,
    filters: parseFilters(cs) as ElementAttributes["filters"],
  };
}

// ─── SVG / canvas → PNG data URL ──────────────────────────────────────────────

async function svgToPngDataUrl(svgEl: Element, w: number, h: number): Promise<string> {
  try {
    const cs = window.getComputedStyle(svgEl);
    const clone = svgEl.cloneNode(true) as SVGElement;
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    // Propagate inherited color so icon paths render correctly
    clone.style.color = cs.color;
    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w); canvas.height = Math.round(h);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

// ─── Recursive attribute tree traversal ───────────────────────────────────────

interface TraversalState {
  rootRect: { left: number; top: number; width: number; height: number } | null;
  inheritedFont?: ElementAttributes["font"];
  inheritedBackground?: ElementAttributes["background"];
  inheritedBorderRadius?: number[];
  inheritedZIndex?: number;
  inheritedOpacity?: number;
}

async function collectChildAttributes(
  element: Element,
  state: TraversalState,
  depth: number
): Promise<{ attributes: ElementAttributes; depth: number }[]> {
  const children = Array.from(element.querySelectorAll(":scope > *"));
  const results: { attributes: ElementAttributes; depth: number }[] = [];

  for (const child of children) {
    const attrs = getElementAttributes(child);

    if (["style", "script", "link", "meta", "path"].includes(attrs.tagName)) continue;

    // Inherit properties
    if (state.inheritedFont && !attrs.font && attrs.innerText?.trim()) attrs.font = state.inheritedFont;
    if (state.inheritedBackground && !attrs.background && attrs.shadow) attrs.background = state.inheritedBackground;
    if (state.inheritedBorderRadius && !attrs.borderRadius) attrs.borderRadius = state.inheritedBorderRadius;
    if (state.inheritedZIndex !== undefined && attrs.zIndex === 0) attrs.zIndex = state.inheritedZIndex;
    if (state.inheritedOpacity !== undefined && (!attrs.opacity || attrs.opacity === 1)) attrs.opacity = state.inheritedOpacity;

    // Make position relative to slide root
    if (attrs.position && state.rootRect) {
      attrs.position = {
        left: attrs.position.left - state.rootRect.left,
        top: attrs.position.top - state.rootRect.top,
        width: attrs.position.width,
        height: attrs.position.height,
      };
    }

    // Skip invisible/zero-size elements
    if (!attrs.position || !attrs.position.width || !attrs.position.height) continue;

    // Paragraph shortcut: if only inline formatting tags inside, keep innerHTML as text
    if (attrs.tagName === "p") {
      const innerTags = Array.from(child.querySelectorAll("*")).map((e) => e.tagName.toLowerCase());
      const inlineTags = new Set(["strong", "u", "em", "code", "s"]);
      if (innerTags.length > 0 && innerTags.every((t) => inlineTags.has(t))) {
        attrs.innerText = child.innerHTML;
        results.push({ attributes: attrs, depth });
        continue;
      }
    }

    // SVG → PNG data URL
    if (attrs.tagName === "svg") {
      const w = attrs.position.width ?? 100, h = attrs.position.height ?? 100;
      const dataUrl = await svgToPngDataUrl(child, w, h);
      if (dataUrl) {
        attrs.imageSrc = dataUrl;
        attrs.should_screenshot = false;
      }
      results.push({ attributes: attrs, depth });
      // Don't recurse into SVG children
      continue;
    }

    // Canvas → PNG data URL
    if (attrs.tagName === "canvas") {
      try {
        attrs.imageSrc = (child as HTMLCanvasElement).toDataURL("image/png");
      } catch { /* tainted canvas — skip */ }
      results.push({ attributes: attrs, depth });
      continue;
    }

    // Table — include as element, skip children (avoids noise)
    if (attrs.tagName === "table") {
      results.push({ attributes: attrs, depth });
      continue;
    }

    results.push({ attributes: attrs, depth });

    // Recurse
    const childState: TraversalState = {
      rootRect: state.rootRect,
      inheritedFont: attrs.font || state.inheritedFont,
      inheritedBackground: attrs.background || state.inheritedBackground,
      inheritedBorderRadius: attrs.borderRadius || state.inheritedBorderRadius,
      inheritedZIndex: attrs.zIndex || state.inheritedZIndex,
      inheritedOpacity: attrs.opacity || state.inheritedOpacity,
    };
    const childResults = await collectChildAttributes(child, childState, depth + 1);
    results.push(...childResults);
  }

  return results;
}

async function extractSlideAttributes(slideContentEl: Element): Promise<SlideAttributesResult> {
  const rootAttrs = getElementAttributes(slideContentEl);
  const rootRect = {
    left: rootAttrs.position?.left ?? 0,
    top: rootAttrs.position?.top ?? 0,
    width: rootAttrs.position?.width ?? 1280,
    height: rootAttrs.position?.height ?? 720,
  };

  const state: TraversalState = {
    rootRect,
    inheritedFont: rootAttrs.font,
    inheritedBackground: rootAttrs.background,
    inheritedZIndex: rootAttrs.zIndex,
    inheritedOpacity: rootAttrs.opacity,
  };

  const allResults = await collectChildAttributes(slideContentEl, state, 0);

  // Determine background colour from full-size element
  let backgroundColor = rootAttrs.background?.color;
  const fullSizeEls = allResults.filter(({ attributes: a }) =>
    a.position?.left === 0 && a.position?.top === 0 &&
    a.position?.width === rootRect.width && a.position?.height === rootRect.height
  );
  for (const { attributes: a } of fullSizeEls) {
    if (a.background?.color) { backgroundColor = a.background.color; break; }
  }

  // Filter at depth-0: keep only elements with visible content
  const filtered = allResults.filter(({ attributes: a }) => {
    const occupiesRoot =
      a.position?.left === 0 && a.position?.top === 0 &&
      a.position?.width === rootRect.width && a.position?.height === rootRect.height;

    const hasContent =
      a.background?.color || a.border?.color || a.shadow?.color ||
      a.innerText?.trim() || a.imageSrc ||
      a.tagName === "svg" || a.tagName === "canvas" || a.tagName === "table";

    return (hasContent && !occupiesRoot) || !!a.imageSrc;
  });

  // Sort: higher z-index on top, then by depth
  const sorted = filtered
    .sort((a, b) => {
      const za = a.attributes.zIndex ?? 0, zb = b.attributes.zIndex ?? 0;
      return za !== zb ? zb - za : a.depth - b.depth;
    })
    .map(({ attributes: a }) => {
      // If element has shadow but no background, assign slide bg so PPTX looks right
      if (a.shadow?.color && !a.background?.color && backgroundColor) {
        a.background = { color: backgroundColor, opacity: undefined };
      }
      return a;
    });

  return { elements: sorted, backgroundColor };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract a PPTX model directly from the currently-rendered presentation DOM.
 *
 * Looks for `.main-slide[data-speaker-note]` elements inside
 * `#presentation-slides-wrapper`, then drills into `[data-slide-content]`
 * (the V1ContentRender root) to get clean slide elements without UI chrome.
 *
 * @param title  Presentation title used as the PPTX document name.
 */
export async function extractPresentationPptxModel(title?: string): Promise<PptxPresentationModel> {
  const wrapper = document.getElementById("presentation-slides-wrapper");
  if (!wrapper) throw new Error("Presentation slides wrapper not found in DOM");

  // Each SlideContent renders: .main-slide[data-speaker-note][data-slide-index]
  //   > .main-slide > div[data-layout] > div[data-slide-content] (V1ContentRender root)
  const slideEls = Array.from(wrapper.querySelectorAll(".main-slide[data-speaker-note]"));
  if (slideEls.length === 0) throw new Error("No slides found in the presentation wrapper");

  const slidesAttributes: SlideAttributesResult[] = [];

  for (const slideEl of slideEls) {
    const speakerNote = slideEl.getAttribute("data-speaker-note") ?? "";

    // Target only the clean V1ContentRender div (skips edit buttons, add-slide chrome)
    const contentRoot = slideEl.querySelector("[data-slide-content]") as HTMLElement | null;
    if (!contentRoot) continue;

    const attrs = await extractSlideAttributes(contentRoot);
    attrs.speakerNote = speakerNote;
    slidesAttributes.push(attrs);
  }

  if (slidesAttributes.length === 0) throw new Error("Could not extract attributes from any slide");

  const slides = convertElementAttributesToPptxSlides(slidesAttributes);
  return { slides, name: title };
}
