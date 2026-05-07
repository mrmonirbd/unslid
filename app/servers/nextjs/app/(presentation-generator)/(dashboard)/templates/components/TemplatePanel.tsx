"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ArrowRight, ArrowUpRight, FileDown, Lock, Loader2, Search } from "lucide-react";
import { templates } from "@/app/presentation-templates";
import { TemplateWithData, TemplateLayoutsWithSettings } from "@/app/presentation-templates/utils";
import {
    useCustomTemplateSummaries,
    useCustomTemplatePreview,
    CustomTemplates,
} from "@/app/hooks/useCustomTemplates";
import { CompiledLayout } from "@/app/hooks/compileLayout";
import CreateCustomTemplate from "./CreateCustomTemplate";
import { api, UserProfile } from "@/lib/api";

interface TemplateTierEntry {
    template_id: string;
    name: string;
    tier: "free" | "premium";
}

const CARD_CLASS =
    "relative h-[210px] min-w-[340px] cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md";
const CARD_BACKGROUND_CLASS = "absolute left-0 top-0 h-full w-full object-cover";
const PREVIEW_TILE_CLASS = "relative aspect-video overflow-hidden rounded border border-gray-200 bg-gray-100";
const PREVIEW_SCALE_STYLE = { width: "833.33%", height: "833.33%" };
const PREVIEW_PLACEHOLDERS = [0, 1, 2, 3];
const TEMPLATE_SKELETONS = [0, 1, 2, 3, 4, 5, 6, 7];
const STOP_WORDS = new Set([
    "template",
    "templates",
    "presentation",
    "slide",
    "slides",
    "layout",
    "layouts",
    "with",
    "from",
    "your",
    "custom",
    "designer",
    "built",
    "builtin",
    "built-in",
]);

const getTagsFromText = (text: string) =>
    text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 3 && !STOP_WORDS.has(word))
        .slice(0, 4);

const EmptyTemplates = React.memo(function EmptyTemplates({ label }: { label: string }) {
    return (
        <div className="col-span-full rounded-lg border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-700">No {label} templates found</p>
            <p className="mt-1 text-xs text-slate-500">Try a different search term.</p>
        </div>
    );
});

const TemplateCardSkeleton = React.memo(function TemplateCardSkeleton() {
    return (
        <Card className={`${CARD_CLASS} animate-pulse cursor-default`}>
            <img src="/card_bg.svg" alt="" className={CARD_BACKGROUND_CLASS} />
            <div className="p-4">
                <div className="grid grid-cols-2 gap-2">
                    {PREVIEW_PLACEHOLDERS.map((index) => (
                        <div
                            key={`template-card-skeleton-${index}`}
                            className="aspect-video rounded border border-slate-200 bg-white/85 shadow-sm"
                        >
                            <div className="m-3 h-2 w-1/2 rounded bg-slate-100" />
                            <div className="mx-3 mt-2 h-1.5 w-3/4 rounded bg-slate-100" />
                            <div className="mx-3 mt-1.5 h-1.5 w-2/3 rounded bg-slate-100" />
                        </div>
                    ))}
                </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 z-40 border-t border-[#EDEEEF] bg-white px-4 py-3">
                <div className="h-4 w-32 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-56 max-w-full rounded bg-slate-100" />
            </div>
        </Card>
    );
});

const TemplateGridSkeleton = ({ includeCreateCard = false }: { includeCreateCard?: boolean }) => (
    <div className="grid grid-cols-1 gap-6 pb-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {includeCreateCard && (
            <div className="w-full">
                <CreateCustomTemplate />
            </div>
        )}
        {TEMPLATE_SKELETONS.map((index) => (
            <TemplateCardSkeleton key={index} />
        ))}
    </div>
);

function useInViewport(ref: React.RefObject<Element>, rootMargin = "240px") {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isVisible) return;

        const element = ref.current;
        if (!element) return;
        if (!("IntersectionObserver" in window)) {
            setIsVisible(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin },
        );

        observer.observe(element);
        return () => observer.disconnect();
    }, [isVisible, ref, rootMargin]);

    return isVisible;
}

function useTemplateTiers() {
    const [tiers, setTiers] = useState<TemplateTierEntry[]>([]);
    const [plan, setPlan] = useState<string>("free");
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        Promise.allSettled([
            api.get<UserProfile>("/api/v1/account/me"),
            api.get<TemplateTierEntry[]>("/api/v1/account/template-tiers"),
        ]).then(([meRes, tiersRes]) => {
            if (meRes.status === "fulfilled") setPlan(meRes.value.plan ?? "free");
            if (tiersRes.status === "fulfilled") setTiers(tiersRes.value);
            setLoaded(true);
        });
    }, []);

    const tierMap = useMemo(() => {
        const m: Record<string, "free" | "premium"> = {};
        for (const t of tiers) m[t.template_id] = t.tier;
        return m;
    }, [tiers]);

    const isLocked = useCallback(
        (templateId: string): boolean => {
            // Only lock if tiers are loaded, template is premium, and user is free
            if (!loaded) return false;
            if (plan === "pro" || plan === "team") return false;
            return tierMap[templateId] === "premium";
        },
        [loaded, plan, tierMap],
    );

    return { isLocked, plan, loaded };
}

// Component for rendering custom template card with lazy-loaded previews
export const CustomTemplateCard = React.memo(function CustomTemplateCard({ template }: { template: CustomTemplates }) {
    const router = useRouter();
    const cardRef = useRef<HTMLDivElement>(null);
    const shouldLoadPreview = useInViewport(cardRef);
    const { previewLayouts, loading } = useCustomTemplatePreview(`${template.id}`, shouldLoadPreview);
    const handleOpen = useCallback(() => {
        if (template.id.startsWith('custom-')) {
            router.push(`/template-preview/${template.id}`)
        } else {
            router.push(`/template-preview/custom-${template.id}`)
        }
    }
        , [router, template.id]);

    return (
        <Card
            ref={cardRef}
            className={CARD_CLASS}
            onClick={handleOpen}
        >

            <img src="/card_bg.svg" alt="" className={CARD_BACKGROUND_CLASS} />
            <div className="p-4">

                {/* Layout previews */}
                <div className="grid grid-cols-2 gap-2">
                    {!shouldLoadPreview || loading ? (
                        // Loading placeholders
                        PREVIEW_PLACEHOLDERS.map((index) => (
                            <div
                                key={`${template.id}-loading-${index}`}
                                className="relative bg-gradient-to-br from-purple-50 to-blue-50 border border-gray-200 overflow-hidden aspect-video rounded flex items-center justify-center"
                            >
                                {shouldLoadPreview && <Loader2 className="w-4 h-4 text-purple-300 animate-spin" />}
                            </div>
                        ))
                    ) : previewLayouts.length > 0 && (
                        // Actual layout previews
                        previewLayouts.slice(0, 4).map((layout: CompiledLayout, index: number) => {
                            const LayoutComponent = layout.component;
                            return (
                                <div
                                    key={`${template.id}-preview-${index}`}
                                    className={PREVIEW_TILE_CLASS}
                                >
                                    <div className="absolute inset-0 bg-transparent z-10 pointer-events-none" />
                                    <div
                                        className="transform scale-[0.12] origin-top-left"
                                        style={PREVIEW_SCALE_STYLE}
                                    >
                                        <LayoutComponent data={layout.sampleData} />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>


            </div>
            <div className="absolute inset-x-0 bottom-0 z-40 flex items-center justify-between border-t border-[#EDEEEF] bg-white px-4 py-3">
                <h3 className="line-clamp-1 text-sm font-bold text-gray-900">
                    {template.name}
                </h3>

                <div className="flex items-center gap-2">

                    <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
                </div>
            </div>
        </Card>
    );
}, (prev, next) => {
    // Custom templates may be refetched, producing new object references; compare on fields we render/use.
    return (
        prev.template.id === next.template.id &&
        prev.template.name === next.template.name &&
        prev.template.layoutCount === next.template.layoutCount
    );
});

const InbuiltTemplateCard = React.memo(function InbuiltTemplateCard({
    template,
    onOpen,
    locked,
}: {
    template: TemplateLayoutsWithSettings;
    onOpen: (id: string) => void;
    locked?: boolean;
}) {
    const previewLayouts = useMemo(() => template.layouts.slice(0, 4), [template.layouts]);
    const cardRef = useRef<HTMLDivElement>(null);
    const shouldRenderPreview = useInViewport(cardRef);
    const handleOpen = useCallback(() => {
        onOpen(template.id);
    }, [onOpen, template.id]);

    return (
        <Card
            ref={cardRef}
            key={template.id}
            className={`${CARD_CLASS} ${locked ? "opacity-80" : ""}`}
            onClick={handleOpen}
        >
            {locked && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/40 gap-2">
                    <div className="bg-white/90 rounded-full p-2.5 shadow">
                        <Lock className="w-5 h-5 text-amber-600" />
                    </div>
                    <span className="text-xs font-semibold text-white bg-amber-600/90 px-3 py-1 rounded-full shadow">
                        Premium — Upgrade to unlock
                    </span>
                </div>
            )}
            <img src="/card_bg.svg" alt="" className={CARD_BACKGROUND_CLASS} />
            <div className="p-4">
                <div className="grid grid-cols-2 gap-2">
                    {shouldRenderPreview ? previewLayouts.map((layout: TemplateWithData, index: number) => {
                        const LayoutComponent = layout.component;
                        return (
                            <div
                                key={`${template.id}-preview-${index}`}
                                className={PREVIEW_TILE_CLASS}
                            >
                                <div className="absolute inset-0 bg-transparent z-10 pointer-events-none" />
                                <div
                                    className="transform scale-[0.12] origin-top-left"
                                    style={PREVIEW_SCALE_STYLE}
                                >
                                    <LayoutComponent data={layout.sampleData} />
                                </div>
                            </div>
                        );
                    }) : PREVIEW_PLACEHOLDERS.map((index) => (
                        <div
                            key={`${template.id}-placeholder-${index}`}
                            className="relative aspect-video overflow-hidden rounded border border-gray-200 bg-gradient-to-br from-slate-50 to-violet-50"
                        />
                    ))}
                </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 z-40 flex items-center justify-between border-t border-[#EDEEEF] bg-white px-4 py-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 capitalize flex items-center gap-1.5">
                        {template.name}
                        {locked && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                    </h3>
                    <p className="mt-1 line-clamp-1 text-xs text-gray-600">
                        {template.description}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                </div>
            </div>
        </Card>
    );
});

interface PptxDesignerTemplate {
    id: number;
    name: string;
    description: string;
    tier: "free" | "premium";
    slide_count: number;
    thumbnail_urls: string[];
    color_scheme: Record<string, string> | null;
    font_scheme: Record<string, string> | null;
    locked: boolean;
}

const DesignerTemplateCard = React.memo(function DesignerTemplateCard({
    template,
}: {
    template: PptxDesignerTemplate;
}) {
    const router = useRouter();
    const handleClick = useCallback(() => {
        if (template.locked) {
            router.push("/settings/billing");
            return;
        }
        router.push(`/template-preview/designer-${template.id}`);
    }, [router, template.id, template.locked]);

    return (
        <Card
            className={`${CARD_CLASS} ${template.locked ? "opacity-80" : ""}`}
            onClick={handleClick}
        >
            {template.locked && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/40 gap-2">
                    <div className="bg-white/90 rounded-full p-2.5 shadow">
                        <Lock className="w-5 h-5 text-amber-600" />
                    </div>
                    <span className="text-xs font-semibold text-white bg-amber-600/90 px-3 py-1 rounded-full shadow">
                        Premium — Upgrade to unlock
                    </span>
                </div>
            )}
            <img src="/card_bg.svg" alt="" className={CARD_BACKGROUND_CLASS} />
            <div className="p-4">
                {template.thumbnail_urls.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                        {template.thumbnail_urls.slice(0, 4).map((url, i) => (
                            <div key={url} className={PREVIEW_TILE_CLASS}>
                                <img src={url} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="aspect-video bg-gradient-to-br from-purple-50 to-indigo-50 rounded flex flex-col items-center justify-center gap-2">
                        <FileDown className="w-8 h-8 text-purple-300" />
                        <span className="text-xs text-slate-400">Thumbnails generating…</span>
                    </div>
                )}
            </div>
            <div className="absolute inset-x-0 bottom-0 z-40 flex items-center justify-between border-t border-[#EDEEEF] bg-white px-4 py-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 capitalize flex items-center gap-1.5">
                        {template.name}
                        {template.locked && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                    </h3>
                    {template.description && (
                        <p className="mt-1 line-clamp-1 text-xs text-gray-600">{template.description}</p>
                    )}
                    {template.color_scheme && (
                        <div className="flex gap-1 mt-1">
                            {Object.values(template.color_scheme).slice(0, 6).map((color, i) => (
                                <div key={i} className="w-3 h-3 rounded-sm border border-white shadow-sm" style={{ background: color }} />
                            ))}
                        </div>
                    )}
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
            </div>
        </Card>
    );
});

type TemplatePanelLayout = "shelf" | "grid" | "user-grid" | "user-vertical";

const LayoutPreview = ({ layout = "shelf" }: { layout?: TemplatePanelLayout }) => {
    const [query, setQuery] = useState("");
    const [activeTag, setActiveTag] = useState<string | null>(null);
    const router = useRouter();
    const { isLocked } = useTemplateTiers();
    const { templates: customTemplates, loading: customLoading } = useCustomTemplateSummaries();
    const [designerTemplates, setDesignerTemplates] = useState<PptxDesignerTemplate[]>([]);
    const [designerLoading, setDesignerLoading] = useState(false);
    const isUserGeneratedOnly = layout === "user-grid" || layout === "user-vertical";

    useEffect(() => {
        if (isUserGeneratedOnly) return;
        setDesignerLoading(true);
        api.get<PptxDesignerTemplate[]>("/api/v1/account/pptx-templates")
            .then(setDesignerTemplates)
            .catch(() => {})
            .finally(() => setDesignerLoading(false));
    }, [isUserGeneratedOnly]);

    const normalizedQuery = query.trim().toLowerCase();

    const getCustomTags = useCallback(
        (template: CustomTemplates) => getTagsFromText(`${template.name} ${template.id}`),
        [],
    );

    const getDesignerTags = useCallback(
        (template: PptxDesignerTemplate) => [
            template.tier,
            ...getTagsFromText(`${template.name} ${template.description ?? ""}`),
        ],
        [],
    );

    const getInbuiltTags = useCallback(
        (template: TemplateLayoutsWithSettings) => getTagsFromText(`${template.name} ${template.description ?? ""}`),
        [],
    );

    const tagOptions = useMemo(() => {
        const tags = new Map<string, number>();
        const addTag = (tag: string) => tags.set(tag, (tags.get(tag) ?? 0) + 1);

        customTemplates.forEach((template) => getCustomTags(template).forEach(addTag));
        if (!isUserGeneratedOnly) {
            templates.forEach((template) => getInbuiltTags(template).forEach(addTag));
            designerTemplates.forEach((template) => getDesignerTags(template).forEach(addTag));
        }

        return Array.from(tags.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, 12)
            .map(([tag, count]) => ({ tag, count }));
    }, [customTemplates, designerTemplates, getCustomTags, getDesignerTags, getInbuiltTags, isUserGeneratedOnly]);

    const filteredInbuiltTemplates = useMemo(
        () =>
            templates.filter((template: TemplateLayoutsWithSettings) => {
                const searchable = `${template.name} ${template.description ?? ""}`.toLowerCase();
                const matchesSearch = !normalizedQuery || searchable.includes(normalizedQuery);
                const matchesTag = !activeTag || getInbuiltTags(template).includes(activeTag);
                return matchesSearch && matchesTag;
            }),
        [activeTag, getInbuiltTags, normalizedQuery],
    );

    const filteredCustomTemplates = useMemo(
        () =>
            customTemplates.filter((template: CustomTemplates) => {
                const searchable = `${template.name} ${template.id}`.toLowerCase();
                const matchesSearch = !normalizedQuery || searchable.includes(normalizedQuery);
                const matchesTag = !activeTag || getCustomTags(template).includes(activeTag);
                return matchesSearch && matchesTag;
            }),
        [activeTag, customTemplates, getCustomTags, normalizedQuery],
    );

    const filteredDesignerTemplates = useMemo(
        () =>
            designerTemplates.filter((template: PptxDesignerTemplate) => {
                const searchable = `${template.name} ${template.description ?? ""}`.toLowerCase();
                const matchesSearch = !normalizedQuery || searchable.includes(normalizedQuery);
                const matchesTag = !activeTag || getDesignerTags(template).includes(activeTag);
                return matchesSearch && matchesTag;
            }),
        [activeTag, designerTemplates, getDesignerTags, normalizedQuery],
    );

    const totalVisible =
        filteredCustomTemplates.length +
        (isUserGeneratedOnly ? 0 : filteredInbuiltTemplates.length + filteredDesignerTemplates.length);

    const handleOpenPreview = useCallback((id: string) => router.push(`/template-preview/${id}`), [router]);

    const inbuiltTemplateCards = useMemo(
        () =>
            filteredInbuiltTemplates.map((template: TemplateLayoutsWithSettings) => (
                <InbuiltTemplateCard
                    key={template.id}
                    template={template}
                    onOpen={handleOpenPreview}
                    locked={isLocked(template.id)}
                />
            )),
        [filteredInbuiltTemplates, handleOpenPreview, isLocked],
    );

    const customTemplateCards = useMemo(
        () => filteredCustomTemplates.map((template: CustomTemplates) => <CustomTemplateCard key={template.id} template={template} />),
        [filteredCustomTemplates],
    );

    const isGridLayout = layout === "grid" || layout === "user-grid";

    if (isUserGeneratedOnly) {
        return (
            <div className="min-h-screen bg-white font-syne text-slate-950">
                <div className="rounded-b-[28px] bg-[linear-gradient(115deg,#b7f3ee_0%,#f9fbff_44%,#d7b6ff_100%)] px-6 pb-12 pt-14 md:px-10">
                    <div className="mx-auto flex max-w-5xl flex-col items-center">
                        <h1 className="font-unbounded text-[34px] font-semibold tracking-[-0.02em] md:text-[42px]">
                            Templates
                        </h1>
                        <div className="relative mt-7 w-full max-w-3xl">
                            <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-700" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search your templates"
                                className="h-16 w-full rounded-2xl border border-violet-200 bg-white/95 pl-14 pr-5 text-sm text-slate-900 shadow-[0_18px_50px_rgba(124,58,237,0.12)] outline-none transition placeholder:text-slate-500 focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                            />
                        </div>
                    </div>
                </div>

                <main className="px-6 py-8 md:px-10">
                    <section>
                        <div className="mb-4 flex items-center justify-between gap-4">
                            <h2 className="text-2xl font-bold tracking-[-0.01em]">Explore templates</h2>
                            <span className="text-xs font-semibold text-slate-500">
                                {filteredCustomTemplates.length} available
                            </span>
                        </div>
                    </section>

                    <div className="mt-8 flex flex-wrap items-center gap-2">
                        <button
                            className={`inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold transition ${
                                activeTag === null
                                    ? "bg-slate-950 text-white shadow-sm"
                                    : "border border-violet-200 bg-white text-slate-700 hover:bg-violet-50"
                            }`}
                            onClick={() => setActiveTag(null)}
                        >
                            All
                        </button>
                        {tagOptions.map(({ tag, count }) => (
                            <button
                                key={tag}
                                className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-xs font-semibold capitalize transition ${
                                    activeTag === tag
                                        ? "bg-slate-950 text-white shadow-sm"
                                        : "border border-violet-200 bg-white text-slate-700 hover:bg-violet-50"
                                }`}
                                onClick={() => setActiveTag(tag)}
                            >
                                {tag}
                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeTag === tag ? "bg-white/15 text-white" : "bg-violet-50 text-violet-700"}`}>
                                    {count}
                                </span>
                            </button>
                        ))}
                    </div>

                    <section className="mt-8">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-2xl font-bold tracking-[-0.01em]">Create your custom designs</h2>
                            <a href="/custom-template" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50" aria-label="Create template">
                                <ArrowRight className="h-4 w-4" />
                            </a>
                        </div>

                        {customLoading ? (
                            <TemplateGridSkeleton includeCreateCard={!normalizedQuery && !activeTag} />
                        ) : filteredCustomTemplates.length === 0 && (normalizedQuery || activeTag) ? (
                            <EmptyTemplates label="matching" />
                        ) : (
                            <div className="grid grid-cols-1 gap-6 pb-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                {!normalizedQuery && !activeTag && (
                                    <div className="w-full">
                                        <CreateCustomTemplate />
                                    </div>
                                )}
                                {customTemplateCards}
                            </div>
                        )}
                    </section>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white font-syne text-slate-950">
            <div className="rounded-b-[28px] bg-[linear-gradient(115deg,#b7f3ee_0%,#f9fbff_44%,#d7b6ff_100%)] px-6 pb-12 pt-14 md:px-10">
                <div className="mx-auto flex max-w-5xl flex-col items-center">
                    <h1 className="font-unbounded text-[34px] font-semibold tracking-[-0.02em] md:text-[42px]">
                        Templates
                    </h1>
                    <div className="relative mt-7 w-full max-w-3xl">
                        <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-700" />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search millions of templates"
                            className="h-16 w-full rounded-2xl border border-violet-200 bg-white/95 pl-14 pr-5 text-sm text-slate-900 shadow-[0_18px_50px_rgba(124,58,237,0.12)] outline-none transition placeholder:text-slate-500 focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                        />
                    </div>
                </div>
            </div>

            <main className="px-6 py-8 md:px-10">
                <section>
                    <div className="mb-4 flex items-center justify-between gap-4">
                        <h2 className="text-2xl font-bold tracking-[-0.01em]">Explore templates</h2>
                        <span className="text-xs font-semibold text-slate-500">
                            {totalVisible} available
                        </span>
                    </div>
                </section>

                <div className="mt-8 flex flex-wrap items-center gap-2">
                    <button
                        className={`inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold transition ${
                            activeTag === null
                                ? "bg-slate-950 text-white shadow-sm"
                                : "border border-violet-200 bg-white text-slate-700 hover:bg-violet-50"
                        }`}
                        onClick={() => setActiveTag(null)}
                    >
                        All
                    </button>
                    {tagOptions.map(({ tag, count }) => (
                        <button
                            key={tag}
                            className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-xs font-semibold capitalize transition ${
                                activeTag === tag
                                    ? "bg-slate-950 text-white shadow-sm"
                                    : "border border-violet-200 bg-white text-slate-700 hover:bg-violet-50"
                            }`}
                            onClick={() => setActiveTag(tag)}
                        >
                            {tag}
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeTag === tag ? "bg-white/15 text-white" : "bg-violet-50 text-violet-700"}`}>
                                {count}
                            </span>
                        </button>
                    ))}
                </div>

                <section className="mt-8">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-2xl font-bold tracking-[-0.01em]">Create your custom designs</h2>
                        <button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50" aria-label="More templates">
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>

                    {customLoading || designerLoading ? (
                        <TemplateGridSkeleton includeCreateCard={!normalizedQuery && !activeTag} />
                    ) : totalVisible === 0 && (normalizedQuery || activeTag) ? (
                        <EmptyTemplates label="matching" />
                    ) : (
                        <div
                            className={
                                isGridLayout
                                    ? "grid grid-cols-1 gap-6 pb-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                                    : "flex gap-6 overflow-x-auto pb-3"
                            }
                        >
                            {!normalizedQuery && !activeTag && (
                                <div className={isGridLayout ? "w-full" : "min-w-[340px]"}>
                                    <CreateCustomTemplate />
                                </div>
                            )}
                            {inbuiltTemplateCards}
                            {customTemplateCards}
                            {filteredDesignerTemplates.map((t) => (
                                <DesignerTemplateCard key={t.id} template={t} />
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default LayoutPreview;
