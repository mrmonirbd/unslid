"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import {
    ArrowRight,
    ArrowUpRight,
    Check,
    CreditCard,
    Lock,
    Loader2,
    Search,
    Sparkles,
} from "lucide-react";
import { templates } from "@/app/presentation-templates";
import { getTemplateRouteId, TemplateWithData, TemplateLayoutsWithSettings } from "@/app/presentation-templates/utils";
import {
    useCustomTemplateSummaries,
    useCustomTemplatePreview,
    CustomTemplates,
} from "@/app/hooks/useCustomTemplates";
import { CompiledLayout } from "@/app/hooks/compileLayout";
import CreateCustomTemplate from "./CreateCustomTemplate";
import { api, BillingStatus, UserProfile } from "@/lib/api";
import { useUser } from "@/app/hooks/useUser";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface TemplateTierEntry {
    template_id: string;
    name: string;
    tier: "free" | "premium";
}

interface EditedStaticTemplateSummary {
    id: string;
    templateId: string;
    name: string;
    description: string;
    layoutCount: number;
    updatedAt: string;
}

interface PlanPricingEntry {
    price_monthly: number;
    price_annual: number;
    currency: string;
    stripe_price_id_monthly: string;
    stripe_price_id_annual: string;
    features: string[];
}

interface BillingStatusWithPricing extends BillingStatus {
    plan_pricing?: {
        free: PlanPricingEntry;
        pro: PlanPricingEntry;
        team: PlanPricingEntry;
    };
}

const CARD_CLASS =
    "relative h-[280px] min-w-[340px] cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md";
const CARD_BACKGROUND_CLASS = "hidden";
const PREVIEW_TILE_CLASS = "relative aspect-video overflow-hidden rounded-[4px] border border-slate-200 bg-white shadow-sm";
const PREVIEW_SCALE_STYLE = { width: "833.33%", height: "833.33%" };
const PREVIEW_PLACEHOLDERS = [0, 1, 2, 3];
const TEMPLATE_SKELETONS = [0, 1, 2, 3, 4, 5, 6, 7];
const STATIC_TEMPLATE_EDIT_INDEX_PREFIX = "static-template-edits:index:";
const STATIC_TEMPLATE_EDIT_STORAGE_PREFIX = "static-template-edits";
const FREE_BUILT_IN_TEMPLATE_LIMIT = 10;
const DEFAULT_PLAN_PRICING: NonNullable<BillingStatusWithPricing["plan_pricing"]> = {
    free: {
        price_monthly: 0,
        price_annual: 0,
        currency: "USD",
        stripe_price_id_monthly: "",
        stripe_price_id_annual: "",
        features: ["5 presentations / month", "1 concurrent generation", "PDF & PPTX export", "Community support"],
    },
    pro: {
        price_monthly: 19,
        price_annual: 190,
        currency: "USD",
        stripe_price_id_monthly: "",
        stripe_price_id_annual: "",
        features: ["Unlimited presentations", "Premium templates", "PDF & PPTX export", "Priority support"],
    },
    team: {
        price_monthly: 49,
        price_annual: 490,
        currency: "USD",
        stripe_price_id_monthly: "",
        stripe_price_id_annual: "",
        features: ["Everything in Pro", "Team workspace", "Shared template access", "Dedicated support"],
    },
};
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

const PreviewPlaceholder = ({ className = "" }: { className?: string }) => (
    <div
        className={`relative aspect-video overflow-hidden rounded-[4px] border border-slate-200 bg-gradient-to-br from-slate-50 to-violet-50 shadow-sm ${className}`}
    />
);

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

const formatPlanPrice = (entry: PlanPricingEntry) => {
    if (entry.price_monthly === 0) return "Free";
    const amount = entry.price_monthly % 1 === 0 ? entry.price_monthly.toFixed(0) : entry.price_monthly.toFixed(2);
    return `$${amount}`;
};

const PricingModal = ({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) => {
    const router = useRouter();
    const [pricing, setPricing] = useState(DEFAULT_PLAN_PRICING);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;

        let mounted = true;
        setLoading(true);
        api.get<BillingStatusWithPricing>("/api/v1/billing/status")
            .then((status) => {
                if (mounted && status.plan_pricing) setPricing(status.plan_pricing);
            })
            .catch(() => {
                if (mounted) setPricing(DEFAULT_PLAN_PRICING);
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, [open]);

    const handleUpgrade = () => {
        onOpenChange(false);
        router.push("/settings/billing");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto p-0">
                <div className="border-b border-slate-200 bg-gradient-to-br from-violet-50 via-white to-amber-50 px-6 py-5">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl text-slate-950">
                            <Lock className="h-5 w-5 text-amber-500" />
                            Unlock paid templates
                        </DialogTitle>
                        <DialogDescription className="text-slate-600">
                            This template is available for paid members. Compare plans and upgrade to continue.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="space-y-5 px-6 pb-6">
                    {loading && (
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading latest pricing...
                        </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                        {(["pro", "team"] as const).map((planKey) => {
                            const entry = pricing[planKey];
                            const isPro = planKey === "pro";

                            return (
                                <div
                                    key={planKey}
                                    className={`relative rounded-lg border-2 bg-white p-5 shadow-sm ${
                                        isPro ? "border-violet-300" : "border-slate-200"
                                    }`}
                                >
                                    {isPro && (
                                        <span className="absolute -top-3 right-4 rounded-full bg-violet-600 px-3 py-0.5 text-xs font-semibold text-white shadow">
                                            Best for templates
                                        </span>
                                    )}
                                    <div className="mb-4">
                                        <div className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                            isPro ? "bg-violet-100 text-violet-700" : "bg-purple-100 text-purple-700"
                                        }`}>
                                            {isPro ? <Sparkles className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
                                            {isPro ? "Pro" : "Team"}
                                        </div>
                                        <div className="flex items-end gap-1">
                                            <span className="text-4xl font-extrabold text-slate-950">
                                                {formatPlanPrice(entry)}
                                            </span>
                                            <span className="mb-1 text-sm text-slate-500">/mo</span>
                                        </div>
                                        {entry.price_annual > 0 && (
                                            <p className="mt-1 text-xs text-slate-500">
                                                Annual: ${entry.price_annual}/yr
                                            </p>
                                        )}
                                    </div>

                                    <ul className="space-y-2">
                                        {entry.features.filter(Boolean).slice(0, 5).map((feature) => (
                                            <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                                                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-500" />
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-slate-500">
                            Paid members get premium template access plus higher generation limits.
                        </p>
                        <button
                            onClick={handleUpgrade}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-500"
                        >
                            See billing options
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

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
        (templateId: string, templateIndex?: number): boolean => {
            // Only lock if tiers are loaded, template is premium, and user is free
            if (!loaded) return false;
            if (plan === "pro" || plan === "team") return false;
            if (typeof templateIndex === "number") {
                return templateIndex >= FREE_BUILT_IN_TEMPLATE_LIMIT;
            }
            return tierMap[templateId] === "premium";
        },
        [loaded, plan, tierMap],
    );

    return { isLocked, plan, loaded };
}

function useEditedStaticTemplates(userKey: string) {
    const [editedTemplates, setEditedTemplates] = useState<EditedStaticTemplateSummary[]>([]);

    const loadEditedTemplates = useCallback(() => {
        if (typeof window === "undefined") return;
        const saved = window.localStorage.getItem(`${STATIC_TEMPLATE_EDIT_INDEX_PREFIX}${userKey}`);
        if (!saved) {
            setEditedTemplates([]);
            return;
        }

        try {
            const parsed = JSON.parse(saved) as EditedStaticTemplateSummary[];
            setEditedTemplates(Array.isArray(parsed) ? parsed : []);
        } catch {
            setEditedTemplates([]);
        }
    }, [userKey]);

    useEffect(() => {
        loadEditedTemplates();
        window.addEventListener("focus", loadEditedTemplates);
        return () => window.removeEventListener("focus", loadEditedTemplates);
    }, [loadEditedTemplates]);

    return editedTemplates;
}

function useSavedStaticLayoutHtml(userKey: string, templateId: string, layouts: TemplateWithData[]) {
    const [savedLayoutHtml, setSavedLayoutHtml] = useState<Record<string, string>>({});

    useEffect(() => {
        if (typeof window === "undefined" || !layouts.length) {
            setSavedLayoutHtml({});
            return;
        }

        const nextSavedLayouts: Record<string, string> = {};
        layouts.forEach((layout) => {
            const savedHtml = window.localStorage.getItem(
                [STATIC_TEMPLATE_EDIT_STORAGE_PREFIX, userKey, templateId, layout.layoutId].join(":"),
            );
            if (savedHtml) {
                nextSavedLayouts[layout.layoutId] = savedHtml;
            }
        });
        setSavedLayoutHtml(nextSavedLayouts);
    }, [layouts, templateId, userKey]);

    return savedLayoutHtml;
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
            <div className="p-4 pb-0">

                {/* Layout previews */}
                <div className="grid grid-cols-2 gap-3">
                    {!shouldLoadPreview || loading ? (
                        // Loading placeholders
                        PREVIEW_PLACEHOLDERS.map((index) => (
                            <div
                                key={`${template.id}-loading-${index}`}
                                className="relative flex aspect-video items-center justify-center overflow-hidden rounded-[4px] border border-slate-200 bg-gradient-to-br from-slate-50 to-violet-50 shadow-sm"
                            >
                                {shouldLoadPreview && <Loader2 className="w-4 h-4 text-violet-300 animate-spin" />}
                            </div>
                        ))
                    ) : (
                        // Actual layout previews
                        PREVIEW_PLACEHOLDERS.map((slot) => {
                            const layout = previewLayouts[slot] as CompiledLayout | undefined;
                            if (!layout) {
                                return <PreviewPlaceholder key={`${template.id}-empty-${slot}`} />;
                            }
                            const LayoutComponent = layout.component;
                            return (
                                <div
                                    key={`${template.id}-preview-${slot}`}
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

                    <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-violet-600 transition-colors" />
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
    onLockedOpen,
    locked,
    editedTemplate,
    userKey,
}: {
    template: TemplateLayoutsWithSettings;
    onOpen: (template: TemplateLayoutsWithSettings) => void;
    onLockedOpen: () => void;
    locked?: boolean;
    editedTemplate?: EditedStaticTemplateSummary;
    userKey: string;
}) {
    const previewLayouts = useMemo(() => template.layouts.slice(0, 4), [template.layouts]);
    const savedLayoutHtml = useSavedStaticLayoutHtml(userKey, template.id, template.layouts);
    const hasEdits = !!editedTemplate;
    const previewItems = useMemo(() => {
        const editedItems = template.layouts
            .filter((layout) => savedLayoutHtml[layout.layoutId])
            .map((layout) => ({ type: "edited" as const, layout, html: savedLayoutHtml[layout.layoutId] }));

        const originalItems = template.layouts
            .filter((layout) => !savedLayoutHtml[layout.layoutId])
            .map((layout) => ({ type: "original" as const, layout }));

        return [...editedItems, ...originalItems].slice(0, 4);
    }, [savedLayoutHtml, template.layouts]);
    const cardRef = useRef<HTMLDivElement>(null);
    const shouldRenderPreview = useInViewport(cardRef);
    const handleOpen = useCallback(() => {
        if (locked) {
            onLockedOpen();
            return;
        }
        onOpen(template);
    }, [locked, onLockedOpen, onOpen, template]);

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
                        Paid — Upgrade to unlock
                    </span>
                </div>
            )}
            {hasEdits && !locked && (
                <div className="absolute left-3 top-3 z-20 rounded-full bg-violet-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                    Edited
                </div>
            )}
            <img src="/card_bg.svg" alt="" className={CARD_BACKGROUND_CLASS} />
            <div className="p-4 pb-0">
                <div className="grid grid-cols-2 gap-3">
                    {shouldRenderPreview ? PREVIEW_PLACEHOLDERS.map((slot) => {
                        const item = previewItems[slot];
                        if (!item) {
                            return <PreviewPlaceholder key={`${template.id}-empty-${slot}`} />;
                        }
                        const LayoutComponent = item.layout.component;
                        return (
                            <div
                                key={`${template.id}-preview-${item.layout.layoutId}-${slot}`}
                                className={PREVIEW_TILE_CLASS}
                            >
                                <div className="absolute inset-0 bg-transparent z-10 pointer-events-none" />
                                {item.type === "edited" ? (
                                    <div
                                        className="transform scale-[0.12] origin-top-left"
                                        style={PREVIEW_SCALE_STYLE}
                                        dangerouslySetInnerHTML={{ __html: item.html }}
                                    />
                                ) : (
                                    <div
                                        className="transform scale-[0.12] origin-top-left"
                                        style={PREVIEW_SCALE_STYLE}
                                    >
                                        <LayoutComponent data={item.layout.sampleData} />
                                    </div>
                                )}
                            </div>
                        );
                    }) : PREVIEW_PLACEHOLDERS.map((index) => (
                        <PreviewPlaceholder
                            key={`${template.id}-placeholder-${index}`}
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
                    {locked && (
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-600">
                            Paid member only
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-violet-600 transition-colors" />
                </div>
            </div>
        </Card>
    );
});

const EditedStaticTemplateCard = React.memo(function EditedStaticTemplateCard({
    template,
    sourceTemplate,
    userKey,
}: {
    template: EditedStaticTemplateSummary;
    sourceTemplate?: TemplateLayoutsWithSettings;
    userKey: string;
}) {
    const router = useRouter();
    const sourceLayouts = useMemo(() => sourceTemplate?.layouts ?? [], [sourceTemplate?.layouts]);
    const savedLayoutHtml = useSavedStaticLayoutHtml(userKey, template.templateId, sourceLayouts);
    const previewRouteId = sourceTemplate ? getTemplateRouteId(sourceTemplate) : template.templateId;

    const previewItems = useMemo(() => {
        const editedItems = sourceLayouts
            .filter((layout) => savedLayoutHtml[layout.layoutId])
            .map((layout) => ({ type: "edited" as const, layout, html: savedLayoutHtml[layout.layoutId] }));

        const originalItems = sourceLayouts
            .filter((layout) => !savedLayoutHtml[layout.layoutId])
            .map((layout) => ({ type: "original" as const, layout }));

        return [...editedItems, ...originalItems].slice(0, 4);
    }, [savedLayoutHtml, sourceLayouts]);

    return (
        <Card
            className={CARD_CLASS}
            onClick={() => router.push(`/template-preview/${previewRouteId}`)}
        >
            <img src="/card_bg.svg" alt="" className={CARD_BACKGROUND_CLASS} />
            <div className="p-4 pb-0">
                <div className="grid grid-cols-2 gap-3">
                    {PREVIEW_PLACEHOLDERS.map((slot) => {
                        const item = previewItems[slot];
                        if (!item) {
                            return <PreviewPlaceholder key={`${template.id}-empty-${slot}`} />;
                        }
                        const LayoutComponent = item.layout.component;
                        return (
                            <div
                                key={`${template.id}-preview-${item.layout.layoutId}-${slot}`}
                                className={PREVIEW_TILE_CLASS}
                            >
                                <div className="absolute inset-0 bg-transparent z-10 pointer-events-none" />
                                {item.type === "edited" ? (
                                    <div
                                        className="transform scale-[0.12] origin-top-left"
                                        style={PREVIEW_SCALE_STYLE}
                                        dangerouslySetInnerHTML={{ __html: item.html }}
                                    />
                                ) : (
                                    <div
                                        className="transform scale-[0.12] origin-top-left"
                                        style={PREVIEW_SCALE_STYLE}
                                    >
                                        <LayoutComponent data={item.layout.sampleData} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="absolute left-3 top-3 z-20 rounded-full bg-violet-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                Edited
            </div>
            <div className="absolute inset-x-0 bottom-0 z-40 flex items-center justify-between border-t border-[#EDEEEF] bg-white px-4 py-3">
                <div className="min-w-0">
                    <h3 className="line-clamp-1 text-sm font-bold text-gray-900">
                        {template.name}
                    </h3>
                    <p className="mt-1 line-clamp-1 text-xs text-gray-600">
                        {template.layoutCount} saved layouts • {template.description}
                    </p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-violet-600 transition-colors" />
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
    onLockedOpen,
}: {
    template: PptxDesignerTemplate;
    onLockedOpen: () => void;
}) {
    const router = useRouter();
    const handleClick = useCallback(() => {
        if (template.locked) {
            onLockedOpen();
            return;
        }
        router.push(`/template-preview/designer-${template.id}`);
    }, [onLockedOpen, router, template.id, template.locked]);

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
            <div className="p-4 pb-0">
                {template.thumbnail_urls.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                        {PREVIEW_PLACEHOLDERS.map((slot) => {
                            const url = template.thumbnail_urls[slot];
                            if (!url) {
                                return <PreviewPlaceholder key={`${template.id}-empty-${slot}`} />;
                            }
                            return (
                                <div key={`${url}-${slot}`} className={PREVIEW_TILE_CLASS}>
                                    <img src={url} alt={`Slide ${slot + 1}`} className="w-full h-full object-cover" />
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {PREVIEW_PLACEHOLDERS.map((slot) => (
                            <PreviewPlaceholder key={`${template.id}-generating-${slot}`} />
                        ))}
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
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-violet-600 transition-colors" />
            </div>
        </Card>
    );
});

type TemplatePanelLayout = "shelf" | "grid" | "user-grid" | "user-vertical";

const LayoutPreview = ({ layout = "shelf" }: { layout?: TemplatePanelLayout }) => {
    const [query, setQuery] = useState("");
    const [activeTag, setActiveTag] = useState<string | null>(null);
    const [pricingModalOpen, setPricingModalOpen] = useState(false);
    const router = useRouter();
    const { isLocked } = useTemplateTiers();
    const { user } = useUser();
    const userKey = String(user?.id || user?.email || "guest");
    const editedStaticTemplates = useEditedStaticTemplates(userKey);
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

    const getEditedTags = useCallback(
        (template: EditedStaticTemplateSummary) => ["edited", ...getTagsFromText(`${template.name} ${template.description ?? ""}`)],
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
        if (isUserGeneratedOnly) {
            editedStaticTemplates.forEach((template) => getEditedTags(template).forEach(addTag));
        }
        if (!isUserGeneratedOnly) {
            templates.forEach((template) => getInbuiltTags(template).forEach(addTag));
            designerTemplates.forEach((template) => getDesignerTags(template).forEach(addTag));
        }

        return Array.from(tags.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, 12)
            .map(([tag, count]) => ({ tag, count }));
    }, [customTemplates, designerTemplates, editedStaticTemplates, getCustomTags, getDesignerTags, getEditedTags, getInbuiltTags, isUserGeneratedOnly]);

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

    const filteredEditedStaticTemplates = useMemo(
        () =>
            editedStaticTemplates.filter((template: EditedStaticTemplateSummary) => {
                const searchable = `${template.name} ${template.description ?? ""}`.toLowerCase();
                const matchesSearch = !normalizedQuery || searchable.includes(normalizedQuery);
                const matchesTag = !activeTag || getEditedTags(template).includes(activeTag);
                return matchesSearch && matchesTag;
            }),
        [activeTag, editedStaticTemplates, getEditedTags, normalizedQuery],
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
        (isUserGeneratedOnly ? filteredEditedStaticTemplates.length : 0) +
        (isUserGeneratedOnly ? 0 : filteredInbuiltTemplates.length + filteredDesignerTemplates.length);

    const handleOpenPreview = useCallback((template: TemplateLayoutsWithSettings) => {
        router.push(`/template-preview/${getTemplateRouteId(template)}`);
    }, [router]);

    const handleLockedTemplateOpen = useCallback(() => {
        setPricingModalOpen(true);
    }, []);

    const editedStaticTemplateMap = useMemo(() => {
        const map = new Map<string, EditedStaticTemplateSummary>();
        editedStaticTemplates.forEach((template) => {
            map.set(template.templateId, template);
        });
        return map;
    }, [editedStaticTemplates]);

    const inbuiltTemplateCards = useMemo(
        () =>
            filteredInbuiltTemplates.map((template: TemplateLayoutsWithSettings) => (
                <InbuiltTemplateCard
                    key={template.id}
                    template={template}
                    onOpen={handleOpenPreview}
                    onLockedOpen={handleLockedTemplateOpen}
                    locked={isLocked(template.id, templates.findIndex((source) => source.id === template.id))}
                    editedTemplate={editedStaticTemplateMap.get(template.id)}
                    userKey={userKey}
                />
            )),
        [editedStaticTemplateMap, filteredInbuiltTemplates, handleLockedTemplateOpen, handleOpenPreview, isLocked, userKey],
    );

    const customTemplateCards = useMemo(
        () => filteredCustomTemplates.map((template: CustomTemplates) => <CustomTemplateCard key={template.id} template={template} />),
        [filteredCustomTemplates],
    );

    const editedStaticTemplateCards = useMemo(
        () => filteredEditedStaticTemplates.map((template) => (
            <EditedStaticTemplateCard
                key={template.id}
                template={template}
                sourceTemplate={templates.find((source) => source.id === template.templateId)}
                userKey={userKey}
            />
        )),
        [filteredEditedStaticTemplates, userKey],
    );

    const isGridLayout = layout === "grid" || layout === "user-grid";

    if (isUserGeneratedOnly) {
        return (
            <div className="min-h-screen bg-transparent font-syne text-slate-950">
                <PricingModal open={pricingModalOpen} onOpenChange={setPricingModalOpen} />
                <div className="rounded-b-[28px] bg-[linear-gradient(115deg,#ede9fe_0%,#fbf9ff_48%,#f5f3ff_100%)] px-6 pb-12 pt-14 md:px-10">
                    <div className="mx-auto flex max-w-5xl flex-col items-center">
                        <h1 className="font-unbounded text-[34px] font-semibold tracking-[-0.02em] md:text-[42px]">
                            My Templates
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

                <main className="px-4 pb-32 pt-8 sm:px-6 md:px-10 md:pb-8">
                    <section>
                        <div className="mb-4 flex items-center justify-between gap-4">
                            <h2 className="text-2xl font-bold tracking-[-0.01em]">Explore templates</h2>
                            <span className="text-xs font-semibold text-slate-500">
                                {filteredCustomTemplates.length + filteredEditedStaticTemplates.length} available
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
                        ) : filteredCustomTemplates.length + filteredEditedStaticTemplates.length === 0 && (normalizedQuery || activeTag) ? (
                            <EmptyTemplates label="matching" />
                        ) : (
                            <div className="grid grid-cols-1 gap-6 pb-24 md:grid-cols-2 md:pb-3 xl:grid-cols-3 2xl:grid-cols-4">
                                {!normalizedQuery && !activeTag && (
                                    <div className="w-full">
                                        <CreateCustomTemplate />
                                    </div>
                                )}
                                {editedStaticTemplateCards}
                                {customTemplateCards}
                            </div>
                        )}
                    </section>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-transparent font-syne text-slate-950">
            <PricingModal open={pricingModalOpen} onOpenChange={setPricingModalOpen} />
            <div className="rounded-b-[28px] bg-[linear-gradient(115deg,#ede9fe_0%,#fbf9ff_48%,#f5f3ff_100%)] px-6 pb-12 pt-14 md:px-10">
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

            <main className="px-4 pb-32 pt-8 sm:px-6 md:px-10 md:pb-8">
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
                                    ? "grid grid-cols-1 gap-6 pb-24 md:grid-cols-2 md:pb-3 xl:grid-cols-3 2xl:grid-cols-4"
                                    : "flex gap-6 overflow-x-auto pb-24 md:pb-3"
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
                                <DesignerTemplateCard key={t.id} template={t} onLockedOpen={handleLockedTemplateOpen} />
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default LayoutPreview;
