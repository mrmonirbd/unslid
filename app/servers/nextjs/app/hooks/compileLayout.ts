"use client";

import React from "react";
import * as z from "zod";
import * as Recharts from "recharts";
import * as Babel from "@babel/standalone";
import * as d3 from "d3";
// import * as d3Cloud from "d3-cloud";

export interface CompiledLayout {
    component: React.ComponentType<{ data: any }>;
    layoutId: string;
    layoutName: string;
    layoutDescription: string;
    schema: any;
    sampleData: Record<string, any>;
    schemaJSON: any;
}

type AutoSavedTextToken = {
    key: string;
    value: string;
};

type AutoSavedImageToken = {
    key: string;
    url: string;
    prompt: string;
};

const tokenizeAutoSavedHtml = (html: string): { html: string; textTokens: AutoSavedTextToken[]; imageTokens: AutoSavedImageToken[] } => {
    if (typeof document === "undefined") return { html, textTokens: [], imageTokens: [] };

    const container = document.createElement("div");
    container.innerHTML = html;

    container.querySelectorAll<HTMLElement>(".imported-slide-canvas").forEach((canvas) => {
        const editableTextNodes = canvas.querySelectorAll<HTMLElement>(".imported-editable-text");
        const hasEditableText = canvas.getAttribute("data-editable-text") === "true" && editableTextNodes.length > 0;
        const originalBg = canvas.querySelector<HTMLElement>(".imported-original-bg");
        const editBg = canvas.querySelector<HTMLElement>(".imported-edit-bg");
        const editableLayer = canvas.querySelector<HTMLElement>(".imported-editable-layer");

        if (hasEditableText) {
            if (originalBg) originalBg.style.opacity = "0";
            if (editBg) editBg.style.opacity = "1";
            if (editableLayer) {
                editableLayer.style.opacity = "1";
                editableLayer.style.pointerEvents = "none";
            }
        }

        editableTextNodes.forEach((node) => {
            node.removeAttribute("contenteditable");
            node.removeAttribute("contentEditable");
            node.style.pointerEvents = "none";
            node.style.outline = "none";
        });
    });

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const skippedParents = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "CANVAS"]);
    const textNodes: Text[] = [];

    while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        const parent = node.parentElement;
        const trimmed = (node.textContent || "").trim();

        if (!parent || skippedParents.has(parent.tagName) || trimmed.length < 3) continue;
        if (/^[\d\s.,:%$€£৳#()\-+/]+$/.test(trimmed) && trimmed.length < 8) continue;
        textNodes.push(node);
    }

    const textTokens: AutoSavedTextToken[] = [];
    const imageTokens: AutoSavedImageToken[] = [];
    textNodes.slice(0, 80).forEach((node, index) => {
        const key = `text_${index + 1}`;
        const value = (node.textContent || "").replace(/\s+/g, " ").trim();
        if (!value) return;
        textTokens.push({ key, value });
        node.parentElement?.setAttribute("data-ai-text-key", key);
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

    return { html: container.innerHTML, textTokens, imageTokens };
};

const buildAutoSavedDynamicBlock = (tokenizedHtml: string, textTokens: AutoSavedTextToken[], imageTokens: AutoSavedImageToken[]) => {
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
};

const upgradeAutoSavedStaticLayout = (layoutCode: string) => {
    if (!layoutCode.includes("const Schema = z.object({});")) return layoutCode;
    const htmlStartMarker = layoutCode.includes("const generatedSlideHtml = ")
        ? "const generatedSlideHtml = "
        : layoutCode.includes("const importedHtml = ")
            ? "const importedHtml = "
            : "";
    if (!htmlStartMarker) return layoutCode;

    const htmlStart = layoutCode.indexOf(htmlStartMarker);
    const htmlValueStart = htmlStart + htmlStartMarker.length;
    const htmlValueEnd = layoutCode.indexOf(";\n", htmlValueStart);
    if (htmlStart < 0 || htmlValueEnd < 0) return layoutCode;

    let generatedHtml = "";
    try {
        generatedHtml = JSON.parse(layoutCode.slice(htmlValueStart, htmlValueEnd));
    } catch {
        return layoutCode;
    }

    const arrowMarkers = [
        { start: "const dynamicSlideLayout = () => (", end: "\n);" },
        { start: "const dynamicSlideLayout = ({ data = {} }) => {", end: "\n};" },
    ];
    const dynamicMarker = arrowMarkers
        .map((marker) => ({ ...marker, index: layoutCode.indexOf(marker.start, htmlValueEnd) }))
        .find((marker) => marker.index >= 0);
    const dynamicStart = dynamicMarker?.index ?? -1;
    const dynamicEnd = dynamicMarker ? layoutCode.indexOf(dynamicMarker.end, dynamicStart) : -1;
    const schemaStart = layoutCode.indexOf("const Schema = z.object({});");
    if (schemaStart < 0 || dynamicStart < 0 || dynamicEnd < 0) return layoutCode;

    const { html: tokenizedHtml, textTokens, imageTokens } = tokenizeAutoSavedHtml(generatedHtml);
    if (!textTokens.length && !imageTokens.length) return layoutCode;

    return [
        layoutCode.slice(0, schemaStart),
        buildAutoSavedDynamicBlock(tokenizedHtml, textTokens, imageTokens),
        layoutCode.slice(dynamicEnd + (dynamicMarker?.end.length ?? 0)),
    ].join("");
};

const patchAutoSavedTokenReplacementCode = (layoutCode: string) => (
    layoutCode
        .replace(
            /nextHtml\.replace\(new RegExp\("[^"]+"\s*\+\s*key\s*\+\s*"[^"]+",\s*"g"\),\s*escapeHtml\(data\[key\] \?\? textTokenDefaults\[key\] \?\? ""\)\)/g,
            'nextHtml.split("{{" + key + "}}").join(escapeHtml(data[key] ?? textTokenDefaults[key] ?? ""))'
        )
        .replace(
            /nextHtml\.replace\(new RegExp\("[^"]+"\s*\+\s*key\s*\+\s*"[^"]+",\s*"g"\),\s*escapeHtml\(data\[key\]\?\.__image_url__ \?\? imageTokenDefaults\[key\] \?\? ""\)\)/g,
            'nextHtml.split("{{" + key + "}}").join(escapeHtml(data[key]?.__image_url__ ?? imageTokenDefaults[key] ?? ""))'
        )
);

const parseGeneratedDefaults = (layoutCode: string, marker: string) => {
    const start = layoutCode.indexOf(marker);
    if (start < 0) return {};

    const valueStart = start + marker.length;
    const valueEnd = layoutCode.indexOf(";\n", valueStart);
    if (valueEnd < 0) return {};

    try {
        const parsed = JSON.parse(layoutCode.slice(valueStart, valueEnd));
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
};

const extractGeneratedSampleData = (layoutCode: string) => ({
    ...parseGeneratedDefaults(layoutCode, "const textTokenDefaults = "),
    ...Object.fromEntries(
        Object.entries(parseGeneratedDefaults(layoutCode, "const imageTokenDefaults = ")).map(([key, value]) => [
            key,
            {
                __image_url__: typeof value === "string" ? value : "",
                __image_prompt__: "Relevant presentation image for this slide",
            },
        ])
    ),
});

/**
 * Compiles a layout code string into a usable React component
 */
export function compileCustomLayout(layoutCode: string): CompiledLayout | null {
    try {
        const upgradedLayoutCode = patchAutoSavedTokenReplacementCode(upgradeAutoSavedStaticLayout(layoutCode));
        const generatedSampleData = extractGeneratedSampleData(upgradedLayoutCode);
        // Clean up imports that we'll provide ourselves
        const cleanCode = upgradedLayoutCode
            // Remove React imports
            .replace(/import\s+React\s*,?\s*\{?[^}]*\}?\s*from\s+['"]react['"];?/g, "")
            .replace(/import\s+\*\s+as\s+React\s+from\s+['"]react['"];?/g, "")
            .replace(/import\s+{\s*[^}]*\s*}\s*from\s+['"]react['"];?/g, "")
            // Remove zod imports
            .replace(/import\s+\*\s+as\s+z\s+from\s+['"]zod['"];?/g, "")
            .replace(/import\s+{\s*z\s*}\s*from\s+['"]zod['"];?/g, "")
            .replace(/import\s+.*\s+from\s+['"]zod['"];?/g, "")
            // Remove recharts imports
            .replace(/import\s+.*\s+from\s+['"]recharts['"];?/g, "")
            // Remove other common imports we'll provide
            .replace(/import\s+.*\s+from\s+['"]@\/[^'"]+['"];?/g, "")
            // Remove export default at the end (we'll handle it differently)
            .replace(/export\s+default\s+\w+;?\s*$/g, "");



        const compiled = Babel.transform(cleanCode, {
            presets: [
                ["react", { runtime: "classic" }],
                ["typescript", { isTSX: true, allExtensions: true }],
            ],
            sourceType: "script",
        }).code;

        // Create a factory function that executes the compiled code
        const factory = new Function(
            "React",
            "_z",
            "Recharts",
            "_d3",
            // "_d3Cloud",
            `
             const z = _z;
            // const d3Cloud= _d3Cloud;
            const d3 = _d3;
            // Expose React hooks
            const { useState, useEffect, useRef, useMemo, useCallback, Fragment } = React;
            
            // Expose Recharts components
            const {
                ResponsiveContainer, LineChart, Line, BarChart, Bar,
                XAxis, YAxis, CartesianGrid, Tooltip, Legend,
                PieChart, Pie, Cell, AreaChart, Area,
                RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
                ComposedChart, ScatterChart, Scatter,
                RadialBarChart, RadialBar,
                ReferenceLine, ReferenceDot, ReferenceArea,
                Brush, LabelList, Label,Text
            } = Recharts || {};

            // Execute the compiled code
            ${compiled}

            // Return the exports
            return {
              __esModule: true,   
                component: typeof dynamicSlideLayout !== 'undefined' 
                    ? dynamicSlideLayout 
                    : (typeof DefaultLayout !== 'undefined' ? DefaultLayout : undefined),
                layoutId: typeof layoutId !== 'undefined' ? layoutId : 'custom-layout',
                layoutName: typeof layoutName !== 'undefined' ? layoutName : 'Custom Layout',
                layoutDescription: typeof layoutDescription !== 'undefined' ? layoutDescription : '',
                Schema: typeof Schema !== 'undefined' ? Schema : null,
            };
            `
        );

        // Execute the factory
        const result = factory(React, z, Recharts, d3);

        if (!result.component) {
            console.error("No component found in compiled code");
            return null;
        }

        // Parse schema to get sample data
        let sampleData: Record<string, any> = {};
        if (result.Schema) {
            try {
                sampleData = result.Schema.parse({});
            } catch (e) {
                console.warn("Could not parse schema defaults:", e);
            }
        }
        sampleData = { ...generatedSampleData, ...sampleData };
        let schemaJSON = {};
        if (result.Schema) {
            try {
                schemaJSON = z.toJSONSchema(result.Schema);
            } catch (error) {
                console.warn("Could not convert schema to JSON schema:", error);
            }
        }

        return {
            component: result.component,
            layoutId: result.layoutId,
            layoutName: result.layoutName,
            layoutDescription: result.layoutDescription,
            schema: result.Schema,
            sampleData,
            schemaJSON,
        };
    } catch (error) {
        console.error("Error compiling layout:", error);
        return null;
    }
}
