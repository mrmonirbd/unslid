"use client";

import React, { useMemo, useRef } from "react";
import EditableLayoutWrapper from "../components/EditableLayoutWrapper";
import SlideErrorBoundary from "../components/SlideErrorBoundary";
import TiptapTextReplacer from "../components/TiptapTextReplacer";
import { validate as uuidValidate } from 'uuid';
import { getLayoutByLayoutId } from "@/app/presentation-templates";
import { useCustomTemplateDetails } from "@/app/hooks/useCustomTemplates";
import { updateSlideContent } from "@/store/slices/presentationGeneration";
import { useDispatch, useSelector } from "react-redux";
import { Loader2 } from "lucide-react";
import { RootState } from "@/store/store";
import DesignerTemplateSlideRender from "./DesignerTemplateSlideRender";

/** Extract YouTube/Loom/Vimeo embed URL from a user-pasted URL */
function getEmbedSrc(url: string): string | null {
  if (!url) return null;
  // YouTube
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  // Loom
  const loomMatch = url.match(/loom\.com\/share\/([A-Za-z0-9]+)/);
  if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;
  return null;
}

/** Overlay for embedded media inside a slide */
const EmbedOverlay = ({ embed }: { embed: { url: string; type: string } }) => {
  const src = getEmbedSrc(embed.url);
  if (!src) return null;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
      <iframe
        src={src}
        className="w-[90%] h-[85%] rounded-xl shadow-2xl border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};




export const V1ContentRender = ({ slide, isEditMode, theme }: { slide: any, isEditMode: boolean, theme?: any, enableEditMode?: boolean }) => {
    const dispatch = useDispatch();
    const pptxTemplateId = useSelector(
        (state: RootState) => state.presentationGeneration.presentationData?.pptx_template_id
    );
    const containerRef = useRef<HTMLDivElement | null>(null);

    const customTemplateId = slide.layout_group.startsWith("custom-") ? slide.layout_group.split("custom-")[1] : slide.layout_group;
    const isCustomTemplate = uuidValidate(customTemplateId) || slide.layout_group.startsWith("custom-");

    // Always call the hook (React hooks rule), but with empty id when not a custom template
    const { template: customTemplate, loading: customLoading, fonts } = useCustomTemplateDetails({
        id: isCustomTemplate ? customTemplateId : "",
        name: isCustomTemplate ? slide.layout_group : "",
        description: ""
    });
    if (fonts && typeof fonts === 'object') {
        // useFontLoader(fonts as unknown as Record<string, string>);
    }

    // Memoize layout resolution to prevent unnecessary recalculations
    const Layout = useMemo(() => {
        if (isCustomTemplate) {
            if (customTemplate) {
                const layoutId = slide.layout.startsWith("custom-") ? slide.layout.split(":").pop() : slide.layout;


                const compiledLayout = customTemplate.layouts.find(
                    (layout) => layout.layoutId === layoutId
                );


                return compiledLayout?.component ?? null;
            }
            return null;
        } else {
            const template = getLayoutByLayoutId(slide.layout);
            return template?.component ?? null;
        }
    }, [isCustomTemplate, customTemplate, slide.layout]);

    if (pptxTemplateId) {
        return (
            <DesignerTemplateSlideRender
                templateId={pptxTemplateId}
                slideIndex={slide.index ?? 0}
                slideContent={slide.content}
            />
        );
    }

    // Show loading state for custom templates
    if (isCustomTemplate && customLoading) {
        return (
            <div className="flex flex-col items-center justify-center aspect-video h-full bg-gray-100 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
            </div>
        );
    }


    if (!Layout) {
        if (Object.keys(slide.content).length === 0) {
            return (
                <div className="flex flex-col items-center cursor-pointer justify-center aspect-video h-full bg-gray-100 rounded-lg">
                    <p className="text-gray-600 text-center text-base">Blank Slide</p>
                    <p className="text-gray-600 text-center text-sm">This slide is empty. Please add content to it using the edit button.</p>
                </div>
            )
        }
        return (
            <div className="flex flex-col items-center justify-center aspect-video h-full bg-gray-100 rounded-lg">
                <p className="text-gray-600 text-center text-base">
                    Layout &quot;{slide.layout}&quot; not found in &quot;
                    {slide.layout_group}&quot; Template
                </p>
            </div>
        );
    }
    const LayoutComp = Layout as React.ComponentType<{ data: any }>;
    const isMegaTemplate = slide.layout_group?.startsWith("mega-");

    if (isEditMode) {
        return (
            <SlideErrorBoundary label={`Slide ${slide.index + 1}`}>
                <div ref={containerRef} data-slide-content="true" className={`w-full h-full border border-[#EDEEEF] `}>

                    <EditableLayoutWrapper
                        slideIndex={slide.index}
                        slideData={slide.content}
                        properties={slide.properties}
                    >
                        <TiptapTextReplacer
                            key={slide.id}
                            renderKey={`${slide.id ?? slide.index}-${slide.layout}`}
                            isolated={isMegaTemplate}
                            slideData={slide.content}
                            slideIndex={slide.index}
                            onContentChange={(
                                content: string,
                                dataPath: string,
                                slideIndex?: number
                            ) => {
                                if (dataPath && slideIndex !== undefined) {
                                    dispatch(
                                        updateSlideContent({
                                            slideIndex: slideIndex,
                                            dataPath: dataPath,
                                            content: content,
                                        })
                                    );
                                }
                            }}
                        >
                            <LayoutComp data={{
                                ...slide.content,
                                _logo_url__: theme ? theme.logo_url : null,
                                __companyName__: (theme && theme.company_name) ? theme.company_name : null,
                            }} />
                        </TiptapTextReplacer>
                    </EditableLayoutWrapper>



                    {slide.content?.__embed__ && (
                        <EmbedOverlay embed={slide.content.__embed__} />
                    )}
                </div>
            </SlideErrorBoundary>

        );
    }
    return (
        <div className="relative w-full h-full">
            <LayoutComp data={{
                ...slide.content,
                _logo_url__: theme ? theme.logo_url : null,
                __companyName__: (theme && theme.company_name) ? theme.company_name : null,
            }} />
            {slide.content?.__embed__ && (
                <EmbedOverlay embed={slide.content.__embed__} />
            )}
        </div>
    )
};
