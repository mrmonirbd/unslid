"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RootState } from "@/store/store";
import { useDispatch, useSelector } from "react-redux";
import { OverlayLoader } from "@/components/ui/overlay-loader";
import Wrapper from "@/components/Wrapper";
import OutlineContent from "./OutlineContent";
import EmptyStateView from "./EmptyStateView";
import GenerateButton from "./GenerateButton";

import { TABS, Template } from "../types/index";
import { useOutlineStreaming } from "../hooks/useOutlineStreaming";
import { useOutlineManagement } from "../hooks/useOutlineManagement";
import { usePresentationGeneration } from "../hooks/usePresentationGeneration";
import TemplateSelection, { DesignerTemplateSelection } from "./TemplateSelection";
import { TemplateLayoutsWithSettings } from "@/app/presentation-templates/utils";
import { Separator } from "@/components/ui/separator";
import { useSearchParams } from "next/navigation";
import { setPresentationId } from "@/store/slices/presentationGeneration";
import type { LoaderTheme } from "@/components/ui/overlay-loader";

const NAMED_TEMPLATE_PALETTES: Record<string, LoaderTheme> = {
  modern: {
    accentColor: "#2563EB",
    secondaryColor: "#22D3EE",
    backgroundColor: "#07111F",
    surfaceColor: "#0F2742",
  },
  standard: {
    accentColor: "#4F46E5",
    secondaryColor: "#60A5FA",
    backgroundColor: "#0B1020",
    surfaceColor: "#182033",
  },
  swift: {
    accentColor: "#F97316",
    secondaryColor: "#FACC15",
    backgroundColor: "#160E08",
    surfaceColor: "#2A170A",
  },
  general: {
    accentColor: "#65A30D",
    secondaryColor: "#A3E635",
    backgroundColor: "#0C1308",
    surfaceColor: "#17220F",
  },
  mega: {
    accentColor: "#DB2777",
    secondaryColor: "#F59E0B",
    backgroundColor: "#170814",
    surfaceColor: "#2A1023",
  },
};

const pickColor = (scheme: Record<string, string> | null | undefined, keys: string[], fallback: string) => {
  if (!scheme) return fallback;
  const entries = Object.entries(scheme);
  for (const key of keys) {
    const direct = scheme[key];
    if (direct) return direct;
    const match = entries.find(([entryKey]) => entryKey.toLowerCase().includes(key.toLowerCase()));
    if (match?.[1]) return match[1];
  }
  return fallback;
};

const getLoaderTheme = (
  selectedTemplate: TemplateLayoutsWithSettings | string | DesignerTemplateSelection | null
): LoaderTheme => {
  if (!selectedTemplate) return {};
  if (typeof selectedTemplate === "string") {
    return {
      name: "Custom template",
      accentColor: "#7E3AF2",
      secondaryColor: "#10B981",
      backgroundColor: "#0D0716",
      surfaceColor: "#171024",
    };
  }
  if ("type" in selectedTemplate) {
    return {
      name: selectedTemplate.name,
      accentColor: pickColor(selectedTemplate.color_scheme, ["accent", "primary", "theme"], "#7E3AF2"),
      secondaryColor: pickColor(selectedTemplate.color_scheme, ["secondary", "highlight", "chart"], "#22D3EE"),
      backgroundColor: pickColor(selectedTemplate.color_scheme, ["background", "dark", "base"], "#08080B"),
      surfaceColor: pickColor(selectedTemplate.color_scheme, ["surface", "card", "muted"], "#111827"),
    };
  }

  const paletteKey =
    Object.keys(NAMED_TEMPLATE_PALETTES).find((key) =>
      `${selectedTemplate.id} ${selectedTemplate.name}`.toLowerCase().includes(key)
    ) || "standard";

  return {
    ...NAMED_TEMPLATE_PALETTES[paletteKey],
    name: selectedTemplate.name,
  };
};

const OutlinePage: React.FC = () => {
  const dispatch = useDispatch();
  const searchParams = useSearchParams();
  const queryPresentationId = searchParams.get("id");
  const { presentation_id, outlines } = useSelector(
    (state: RootState) => state.presentationGeneration
  );
  const activePresentationId = queryPresentationId || presentation_id;

  const [activeTab, setActiveTab] = useState<string>(TABS.OUTLINE);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateLayoutsWithSettings | string | DesignerTemplateSelection | null>(null);

  React.useEffect(() => {
    if (queryPresentationId && presentation_id !== queryPresentationId) {
      dispatch(setPresentationId(queryPresentationId));
    }
  }, [dispatch, presentation_id, queryPresentationId]);

  // Custom hooks
  const streamState = useOutlineStreaming(activePresentationId);
  const { handleDragEnd, handleAddSlide } = useOutlineManagement(outlines);
  const { loadingState, handleSubmit } = usePresentationGeneration(
    activePresentationId,
    outlines,
    selectedTemplate,
    setActiveTab
  );
  const loaderTheme = React.useMemo(() => getLoaderTheme(selectedTemplate), [selectedTemplate]);
  if (!activePresentationId) {
    return <EmptyStateView />;
  }


  return (
    <div className=" font-syne  pb-9">

      <OverlayLoader
        show={loadingState.isLoading}
        text={loadingState.message}
        showProgress={loadingState.showProgress}
        duration={loadingState.duration}
        theme={loaderTheme}
      />

      <Wrapper className="h-full  flex flex-col w-full relative px-5 sm:px-10 lg:px-20 ">
        <div className="flex-grow w-full hidden-scrollbar   mx-auto ">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="my-4 h-auto w-fit  rounded-full border border-[#EDEEEF] bg-white p-1.5">
              <TabsTrigger
                value={TABS.OUTLINE}
                className="rounded-full px-5 py-2  text-xs font-medium text-[#2D2D2D] shadow-none data-[state=active]:bg-[#F4F3FF] data-[state=active]:text-[#7E3AF2] data-[state=active]:shadow-none"
              >
                Outline & Content
              </TabsTrigger>
              <Separator orientation="vertical" className="h-6 mx-1" />
              <TabsTrigger
                value={TABS.LAYOUTS}
                className="relative rounded-full px-5  py-2 text-xs font-medium text-[#2D2D2D] shadow-none  data-[state=active]:bg-[#F4F3FF] data-[state=active]:text-[#7E3AF2] data-[state=active]:shadow-none"
              >
                Select Template
              </TabsTrigger>
            </TabsList>

            <div className="flex-grow w-full mx-auto">
              <TabsContent value={TABS.OUTLINE} className="h-[calc(100vh-15rem)]   overflow-y-auto hide-scrollbar"
              >
                <div>
                  <OutlineContent
                    outlines={outlines}
                    isLoading={streamState.isLoading}
                    isStreaming={streamState.isStreaming}
                    activeSlideIndex={streamState.activeSlideIndex}
                    highestActiveIndex={streamState.highestActiveIndex}
                    onDragEnd={handleDragEnd}
                    onAddSlide={handleAddSlide}
                  />
                </div>
              </TabsContent>

              <TabsContent value={TABS.LAYOUTS} className="h-[calc(100vh-16rem)] bg-white  overflow-y-auto hide-scrollbar">
                <div>
                  <TemplateSelection
                    selectedTemplate={selectedTemplate}
                    onSelectTemplate={setSelectedTemplate}
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>
          {/* Fixed Button */}

          <div className="absolute bottom-[26px] right-[26px] z-50">
            <GenerateButton
              outlineCount={outlines.length}
              loadingState={loadingState}
              streamState={streamState}
              selectedTemplate={selectedTemplate}
              onSubmit={handleSubmit}
            />
          </div>
        </div>



      </Wrapper>
    </div>
  );
};

export default OutlinePage;
