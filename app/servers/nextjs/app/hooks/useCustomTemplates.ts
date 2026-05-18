"use client";

import { useState, useEffect, useCallback } from "react";

import { compileCustomLayout, CompiledLayout } from "./compileLayout";
import TemplateService from "../(presentation-generator)/services/api/template";



export interface TemplateSummary {
    id: string;
    name: string;
    total_layouts: number;
}

export interface RawLayoutResponse {
    template: string;
    layout_id: string;
    layout_name: string;
    layout_code: string;
    fonts?: string[];
}

export interface CustomTemplateDetailResponse {

    layouts: RawLayoutResponse[];
    template: any;
    fonts?: string[];
}

// Compiled layout with all metadata
export interface CustomTemplateLayout extends CompiledLayout {
    templateId: string;
    rawLayoutId: string;
    rawLayoutName: string;
    layoutCode: string;
    fonts?: string[];
}

export interface CustomTemplateDetail {
    layouts: CustomTemplateLayout[];
    name: string;
    description: string;
    id: string;
    template: any;
    fonts?: string[];
}

// Custom templates for the main page
export interface CustomTemplates {
    id: string;

    name: string;

    layoutCount: number;

    isCustom: true;
}

function normalizeCustomTemplateId(id: string): string {
    if (!id) return id;
    return id.startsWith("custom-") ? id.slice("custom-".length) : id;
}

function getGeneratedSlideHtml(layoutCode: string): string | null {
    const marker = ["const generatedSlideHtml = ", "const importedHtml = "].find((candidate) =>
        layoutCode.includes(candidate)
    );
    if (!marker) return null;

    const start = layoutCode.indexOf(marker);
    if (start < 0) return null;

    const valueStart = start + marker.length;
    const valueEnd = layoutCode.indexOf(";\n", valueStart);
    if (valueEnd < 0) return null;

    try {
        return JSON.parse(layoutCode.slice(valueStart, valueEnd));
    } catch {
        return null;
    }
}

function isBlankAutoSavedLayout(layoutCode: string): boolean {
    const generatedHtml = getGeneratedSlideHtml(layoutCode);
    if (generatedHtml === null) return false;

    if (typeof document !== "undefined") {
        const container = document.createElement("div");
        container.innerHTML = generatedHtml;
        const text = (container.textContent || "").replace(/\s+/g, " ").trim();
        if (text.length > 8) return false;
        return !container.querySelector("img[src], svg, canvas, table");
    }

    const textOnly = generatedHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    return textOnly.length <= 8 && !/(<img\b|<svg\b|<canvas\b|<table\b)/i.test(generatedHtml);
}

function compileUsableCustomLayout(layoutCode: string): CompiledLayout | null {
    if (isBlankAutoSavedLayout(layoutCode)) return null;
    return compileCustomLayout(layoutCode);
}

/**
 * Fetch + compile ONLY the first layout for a custom template.
 * Accepts either a raw presentationId or a "custom-..." id.
 * Uses global cache + in-flight request deduplication.
 */
export async function getCustomTemplateFirstSlidePreview(
    presentationIdOrCustomId: string
): Promise<CompiledLayout | null> {
    const presentationId = normalizeCustomTemplateId(presentationIdOrCustomId);
    if (!presentationId) return null;

    try {
        const data: CustomTemplateDetailResponse = await TemplateService.getCustomTemplateDetails(presentationId);
        const firstLayout = data?.layouts?.[0];
        if (!firstLayout?.layout_code) {
            return null;
        }
        return compileUsableCustomLayout(firstLayout.layout_code);
    } catch (err) {
        console.error("Error fetching first-slide preview:", err);
        return null;
    }
}


/**
 * Standalone async function to fetch and compile custom template details
 * Can be called from hooks or regular async functions (like handleSubmit)
 */
export async function getCustomTemplateDetails(
    templateId: string,
    name: string = "Custom Template",
    description: string = "User-created template"
): Promise<CustomTemplateDetail | null> {
    if (!templateId) {
        return null;
    }

    try {
        const data: CustomTemplateDetailResponse = await TemplateService.getCustomTemplateDetails(templateId);

        // Compile each layout
        const compiledLayouts: CustomTemplateLayout[] = [];

        for (const layout of data.layouts) {
            try {
                const compiled = compileUsableCustomLayout(layout.layout_code);

                if (compiled) {
                    compiledLayouts.push({
                        ...compiled,
                        templateId: layout.template,
                        rawLayoutId: layout.layout_id,
                        rawLayoutName: layout.layout_name,
                        layoutCode: layout.layout_code,
                        fonts: layout.fonts,
                    });
                } else {
                    console.warn(`Failed to compile layout: ${layout.layout_name}`);
                }
            } catch (compileError) {
                console.error(`Error compiling ${layout.layout_name}:`, compileError);
            }
        }

        return {
            layouts: compiledLayouts,
            name,
            description,
            id: templateId,
            template: data.template ? data.template : null,
            fonts: data.fonts
        };
    } catch (err) {
        console.error("Error fetching template details:", err);
        throw err;
    }
}


/**
 * Hook to fetch custom template summaries
 */
export function useCustomTemplateSummaries() {
    const [templates, setTemplates] = useState<CustomTemplates[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTemplates = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const data = await TemplateService.getCustomTemplateSummaries();
            // const mappedTemplates: CustomTemplates[] = data.filter(item => item.total_layouts && item.total_layouts > 0).map((item) => {

            //     return {
            //         id: item.id,
            //         name: item.name || "Custom Template",
            //         layoutCount: item.total_layouts,
            //         isCustom: true as const,
            //     }
            // });

            const mappedTemplates: CustomTemplates[] = data.presentations.map((item: any) => {
                return {
                    id: item.template.id,
                    name: item.template.name || "Custom Template",
                    layoutCount: item.layout_count ?? item.total_layouts ?? 0,
                    isCustom: true as const,
                }
            });


            setTemplates(mappedTemplates);
        } catch (err) {
            console.error("Error fetching custom templates:", err);
            setError(err instanceof Error ? err.message : "Unknown error");
            setTemplates([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    return { templates, loading, error, refetch: fetchTemplates };
}

/**
 * Hook to fetch and compile custom template layouts
 * Always fetches from the API because custom templates are user-scoped.
 */
export function useCustomTemplateDetails(templateDetail: { id: string, name: string, description: string }) {
    const [template, setTemplate] = useState<CustomTemplateDetail | null>(null);
    const [fonts, setFonts] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(() => Boolean(templateDetail.id));
    const [error, setError] = useState<string | null>(null);

    const fetchTemplateDetails = useCallback(async () => {
        if (!templateDetail.id) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await getCustomTemplateDetails(
                templateDetail.id,
                templateDetail.name,
                templateDetail.description
            );
            if (result) {
                setTemplate(result);
                setFonts(result?.fonts ?? []);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
            setTemplate(null);
            setFonts([]);
        } finally {
            setLoading(false);
        }
    }, [templateDetail.id, templateDetail.name, templateDetail.description]);

    useEffect(() => {
        if (templateDetail.id) {
            fetchTemplateDetails();
        }
    }, [templateDetail.id, fetchTemplateDetails]);

    return { template, loading, error, refetch: fetchTemplateDetails, fonts };
}

/**
 * Hook to fetch and compile preview layouts for a single template (first 4 layouts)
 */
export function useCustomTemplatePreview(presentationId: string, enabled = true) {
    const [previewLayouts, setPreviewLayouts] = useState<CompiledLayout[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalLayouts, setTotalLayouts] = useState(0);



    useEffect(() => {
        if (!presentationId || !enabled) {
            setLoading(false);
            return;
        }

        const fetchPreviews = async () => {
            try {
                setLoading(true);
                const data = await TemplateService.getCustomTemplateDetails(presentationId);
                setTotalLayouts(data.layouts.length);
                // Compile first 4 layouts for preview
                const compiled: CompiledLayout[] = [];
                const layoutsToPreview = data.layouts.slice(0, 4);

                for (const layout of layoutsToPreview) {
                    try {
                        const result = compileUsableCustomLayout(layout.layout_code);
                        if (result) {
                            compiled.push(result);
                        }
                    } catch (e) {
                        console.warn(`Failed to compile preview: ${layout.layout_name}`);
                    }
                }

                setPreviewLayouts(compiled);
            } catch (err) {
                console.error("Error fetching preview layouts:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchPreviews();
    }, [enabled, presentationId]);

    return { previewLayouts, loading: loading, totalLayouts: totalLayouts };
}

/**
 * Hook to fetch and compile preview for ONLY the first layout of a custom template.
 * Accepts either a raw presentationId or a "custom-..." id.
 */
export function useCustomTemplateFirstSlidePreview(presentationIdOrCustomId: string) {
    const [previewLayout, setPreviewLayout] = useState<CompiledLayout | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!presentationIdOrCustomId) return;

        let cancelled = false;
        const run = async () => {
            try {
                setLoading(true);
                setError(null);
                const compiled = await getCustomTemplateFirstSlidePreview(presentationIdOrCustomId);
                if (cancelled) return;
                setPreviewLayout(compiled);
            } catch (e) {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : "Unknown error");
                setPreviewLayout(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [presentationIdOrCustomId]);

    return { previewLayout, loading, error };
}
