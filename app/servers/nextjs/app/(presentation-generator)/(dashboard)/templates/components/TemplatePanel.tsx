"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ArrowUpRight, ChevronRight, Lock, Loader2, FileDown } from "lucide-react";
import { templates } from "@/app/presentation-templates";
import { TemplateWithData, TemplateLayoutsWithSettings } from "@/app/presentation-templates/utils";
import {
    useCustomTemplateSummaries,
    useCustomTemplatePreview,
    CustomTemplates,
} from "@/app/hooks/useCustomTemplates";
import { CompiledLayout } from "@/app/hooks/compileLayout";
import CreateCustomTemplate from "./CreateCustomTemplate";
import Link from "next/link";
import { api, UserProfile } from "@/lib/api";

interface TemplateTierEntry {
    template_id: string;
    name: string;
    tier: "free" | "premium";
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
    const { previewLayouts, loading, totalLayouts } = useCustomTemplatePreview(`${template.id}`);
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
            className="cursor-pointer flex flex-col justify-between shadow-none sm:shadow-none relative hover:shadow-lg transition-all duration-200 group overflow-hidden"
            onClick={handleOpen}
        >

            <img src="/card_bg.svg" alt="" className="absolute top-0 left-0 w-full h-full object-cover" />
            <span className="text-xs font-syne absolute top-2 flex gap-1 capitalize  items-center left-2 rounded-[100px]  px-2.5 py-1 bg-[#3A3A3AF5] text-white font-semibold  z-40">
                Layouts- {totalLayouts}
            </span>
            <div className="p-5">

                {/* Layout previews */}
                <div className="grid grid-cols-2 gap-2">
                    {loading ? (
                        // Loading placeholders
                        [...Array(Math.min(4, template.layoutCount))].map((_, index) => (
                            <div
                                key={`${template.id}-loading-${index}`}
                                className="relative bg-gradient-to-br from-purple-50 to-blue-50 border border-gray-200 overflow-hidden aspect-video rounded flex items-center justify-center"
                            >
                                <Loader2 className="w-4 h-4 text-purple-300 animate-spin" />
                            </div>
                        ))
                    ) : previewLayouts.length > 0 && (
                        // Actual layout previews
                        previewLayouts.slice(0, 4).map((layout: CompiledLayout, index: number) => {
                            const LayoutComponent = layout.component;
                            return (
                                <div
                                    key={`${template.id}-preview-${index}`}
                                    className="relative bg-gray-100 border border-gray-200 overflow-hidden aspect-video rounded"
                                >
                                    <div className="absolute inset-0 bg-transparent z-10" />
                                    <div
                                        className="transform scale-[0.12] origin-top-left"
                                        style={{ width: "833.33%", height: "833.33%" }}
                                    >
                                        <LayoutComponent data={layout.sampleData} />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>


            </div>
            <div className="flex items-center justify-between p-5 bg-white border-t border-[#EDEEEF] relative z-40  ">
                <h3 className="text-sm font-bold w-[191px] text-gray-900">
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
    const router = useRouter();
    const handleOpen = useCallback(() => {
        if (locked) {
            router.push("/settings/billing");
            return;
        }
        onOpen(template.id);
    }, [locked, onOpen, template.id, router]);

    return (
        <Card
            key={template.id}
            className={`cursor-pointer relative sm:shadow-none shadow-none hover:shadow-lg transition-all duration-200 group overflow-hidden ${locked ? "opacity-80" : ""}`}
            onClick={handleOpen}
        >
            <span className="text-xs font-syne absolute top-2 flex gap-1 capitalize items-center left-2 rounded-[100px] px-2.5 py-1 bg-[#3A3A3AF5] text-white font-semibold z-40">
                Layouts- {template.layouts.length}
            </span>
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
            <img src="/card_bg.svg" alt="" className="absolute top-0 left-0 w-full h-full object-cover" />
            <div className="p-5">
                <div className="grid grid-cols-2 gap-2">
                    {previewLayouts.map((layout: TemplateWithData, index: number) => {
                        const LayoutComponent = layout.component;
                        return (
                            <div
                                key={`${template.id}-preview-${index}`}
                                className="relative bg-gray-100 border border-gray-200 overflow-hidden aspect-video rounded"
                            >
                                <div className="absolute inset-0 bg-transparent z-10" />
                                <div
                                    className="transform scale-[0.12] origin-top-left"
                                    style={{ width: "833.33%", height: "833.33%" }}
                                >
                                    <LayoutComponent data={layout.sampleData} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="flex items-center justify-between p-5 bg-white border-t border-[#EDEEEF] relative z-40">
                <div className="w-[191px]">
                    <h3 className="text-sm font-bold text-gray-900 capitalize flex items-center gap-1.5">
                        {template.name}
                        {locked && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                    </h3>
                    <p className="text-xs text-gray-600 mb-4 line-clamp-2">
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
    const handleClick = () => {
        if (template.locked) {
            router.push("/settings/billing");
            return;
        }
        router.push(`/template-preview/designer-${template.id}`);
    };

    return (
        <Card
            className={`cursor-pointer relative sm:shadow-none shadow-none hover:shadow-lg transition-all duration-200 group overflow-hidden ${template.locked ? "opacity-80" : ""}`}
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
            <span className="text-xs font-syne absolute top-2 flex gap-1 capitalize items-center left-2 rounded-[100px] px-2.5 py-1 bg-[#3A3A3AF5] text-white font-semibold z-40">
                Layouts- {template.slide_count}
            </span>
            <img src="/card_bg.svg" alt="" className="absolute top-0 left-0 w-full h-full object-cover" />
            <div className="p-5">
                {template.thumbnail_urls.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                        {template.thumbnail_urls.slice(0, 4).map((url, i) => (
                            <div key={i} className="relative bg-gray-100 border border-gray-200 overflow-hidden aspect-video rounded">
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
            <div className="flex items-center justify-between p-5 bg-white border-t border-[#EDEEEF] relative z-40">
                <div className="w-[191px]">
                    <h3 className="text-sm font-bold text-gray-900 capitalize flex items-center gap-1.5">
                        {template.name}
                        {template.locked && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                    </h3>
                    {template.description && (
                        <p className="text-xs text-gray-600 mb-2 line-clamp-2">{template.description}</p>
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

const LayoutPreview = () => {
    const [tab, setTab] = useState<'custom' | 'default' | 'designer'>('default');
    const router = useRouter();
    const { templates: customTemplates, loading: customLoading } = useCustomTemplateSummaries();
    const { isLocked } = useTemplateTiers();
    const [designerTemplates, setDesignerTemplates] = useState<PptxDesignerTemplate[]>([]);
    const [designerLoading, setDesignerLoading] = useState(false);

    useEffect(() => {
        setDesignerLoading(true);
        api.get<PptxDesignerTemplate[]>("/api/v1/account/pptx-templates")
            .then(setDesignerTemplates)
            .catch(() => {})
            .finally(() => setDesignerLoading(false));
    }, []);

    useEffect(() => {
        const existingScript = document.querySelector('script[src*="tailwindcss.com"]');
        if (!existingScript) {
            const script = document.createElement("script");
            script.src = "https://cdn.tailwindcss.com";
            script.async = true;
            document.head.appendChild(script);
        }
    }, []);

    const handleOpenPreview = useCallback((id: string) => router.push(`/template-preview/${id}`), [router]);

    const inbuiltTemplateCards = useMemo(
        () =>
            templates.map((template: TemplateLayoutsWithSettings) => (
                <InbuiltTemplateCard
                    key={template.id}
                    template={template}
                    onOpen={handleOpenPreview}
                    locked={isLocked(template.id)}
                />
            )),
        [handleOpenPreview, isLocked],
    );

    const customTemplateCards = useMemo(
        () => customTemplates.map((template: CustomTemplates) => <CustomTemplateCard key={template.id} template={template} />),
        [customTemplates],
    );

    return (
        <div className="min-h-screen  relative font-syne">
            <div
                className='fixed z-0 bottom-[-16.5rem] left-0 w-full h-full'
                style={{
                    height: "341px",
                    borderRadius: '1440px',
                    background: 'radial-gradient(5.92% 104.69% at 50% 100%, rgba(122, 90, 248, 0.00) 0%, rgba(255, 255, 255, 0.00) 100%), radial-gradient(50% 50% at 50% 50%, rgba(122, 90, 248, 0.80) 0%, rgba(122, 90, 248, 0.00) 100%)',
                }}
            />
            <div className="sticky top-0 right-0 z-50 py-[28px] px-6   backdrop-blur ">
                <div className="flex xl:flex-row flex-col gap-6 xl:gap-0 items-center justify-between">
                    <h3 className=" text-[28px] tracking-[-0.84px] font-unbounded font-normal text-[#101828] flex items-center gap-2">
                        Templates
                    </h3>
                    <div className="flex  gap-2.5 max-sm:w-full max-md:justify-center max-sm:flex-wrap">




                        <Link
                            href="/custom-template"
                            className="inline-flex items-center font-syne font-semibold gap-2 rounded-xl px-4 py-2.5 text-black text-sm  shadow-sm hover:shadow-md"
                            aria-label="Create new template"
                            style={{
                                borderRadius: "48px",
                                background: "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)",
                            }}
                        >
                            <span className="hidden md:inline">New Template</span>
                            <span className="md:hidden">New</span>
                            <ChevronRight className="w-4 h-4" />
                        </Link>

                    </div>
                </div>
            </div>

            <div className="l mx-auto px-6 py-8">
                <div className='p-1 rounded-[40px] bg-[#ffffff] w-fit border border-[#EDEEEF] flex items-center justify-center '>
                    <button className='px-5 py-2 text-xs font-medium text-[#3A3A3A] rounded-[70px]'
                        onClick={() => setTab('custom')}
                        style={{ background: tab === 'custom' ? '#F4F3FF' : 'transparent', color: tab === 'custom' ? '#5146E5' : '#3A3A3A' }}
                    >Custom</button>
                    <svg xmlns="http://www.w3.org/2000/svg" className='mx-1' width="2" height="17" viewBox="0 0 2 17" fill="none">
                        <path d="M1 0V16.5" stroke="#EDECEC" strokeWidth="2" />
                    </svg>
                    <button className='px-5 py-2 text-xs font-medium text-[#3A3A3A] rounded-[70px]'
                        onClick={() => setTab('default')}
                        style={{ background: tab === 'default' ? '#F4F3FF' : 'transparent', color: tab === 'default' ? '#5146E5' : '#3A3A3A' }}
                    >Built-in</button>
                    {designerTemplates.length > 0 && (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className='mx-1' width="2" height="17" viewBox="0 0 2 17" fill="none">
                                <path d="M1 0V16.5" stroke="#EDECEC" strokeWidth="2" />
                            </svg>
                            <button className='px-5 py-2 text-xs font-medium text-[#3A3A3A] rounded-[70px]'
                                onClick={() => setTab('designer')}
                                style={{ background: tab === 'designer' ? '#F4F3FF' : 'transparent', color: tab === 'designer' ? '#5146E5' : '#3A3A3A' }}
                            >Designer</button>
                        </>
                    )}
                </div>

                {/* Built-in Templates Section */}
                {tab === 'default' && <section className="my-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {inbuiltTemplateCards}
                    </div>
                </section>}

                {/* Custom Templates Section */}
                {tab === 'custom' && <section className="my-12">
                    {customLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            <span className="ml-3 text-gray-600">Loading custom templates...</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <CreateCustomTemplate />
                            {customTemplateCards}
                        </div>
                    )}
                </section>}

                {/* Designer Templates Section */}
                {tab === 'designer' && <section className="my-12">
                    {designerLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                            <span className="ml-3 text-gray-600">Loading designer templates...</span>
                        </div>
                    ) : designerTemplates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <FileDown className="w-12 h-12 mb-3 text-slate-300" />
                            <p className="text-sm font-medium">No designer templates available yet.</p>
                            <p className="text-xs mt-1">Check back soon.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {designerTemplates.map((t) => (
                                <DesignerTemplateCard key={t.id} template={t} />
                            ))}
                        </div>
                    )}
                </section>}
            </div>
        </div>
    );
};

export default LayoutPreview;
