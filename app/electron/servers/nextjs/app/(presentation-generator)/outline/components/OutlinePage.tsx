"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RootState } from "@/store/store";
import { useSelector } from "react-redux";
import { OverlayLoader } from "@/components/ui/overlay-loader";
import Wrapper from "@/components/Wrapper";
import OutlineContent from "./OutlineContent";
import EmptyStateView from "./EmptyStateView";
import GenerateButton from "./GenerateButton";

import { TABS, Template } from "../types/index";
import { useOutlineStreaming } from "../hooks/useOutlineStreaming";
import { useOutlineManagement } from "../hooks/useOutlineManagement";
import { usePresentationGeneration } from "../hooks/usePresentationGeneration";
import TemplateSelection from "./TemplateSelection";
import { TemplateLayoutsWithSettings } from "@/app/presentation-templates/utils";
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

const getLoaderTheme = (
  selectedTemplate: TemplateLayoutsWithSettings | string | null
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
  const { presentation_id, outlines } = useSelector(
    (state: RootState) => state.presentationGeneration
  );

  const [activeTab, setActiveTab] = useState<string>(TABS.OUTLINE);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateLayoutsWithSettings | string | null>(null);
  // Custom hooks
  const streamState = useOutlineStreaming(presentation_id);
  const { handleDragEnd, handleAddSlide } = useOutlineManagement(outlines);
  const { loadingState, handleSubmit } = usePresentationGeneration(
    presentation_id,
    outlines,
    selectedTemplate,
    setActiveTab
  );
  const loaderTheme = React.useMemo(() => getLoaderTheme(selectedTemplate), [selectedTemplate]);
  if (!presentation_id) {
    return <EmptyStateView />;
  }


  return (
    <div className="h-[calc(100vh-72px)]">
      <OverlayLoader
        show={loadingState.isLoading}
        text={loadingState.message}
        showProgress={loadingState.showProgress}
        duration={loadingState.duration}
        theme={loaderTheme}
      />

      <Wrapper className="h-full flex flex-col w-full">
        <div className="flex-grow overflow-y-hidden w-[1200px] mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-[50%] mx-auto my-4 grid-cols-2">
              <TabsTrigger value={TABS.OUTLINE}>Outline & Content</TabsTrigger>
              <TabsTrigger value={TABS.LAYOUTS}>Select Template</TabsTrigger>
            </TabsList>

            <div className="flex-grow w-full mx-auto">
              <TabsContent value={TABS.OUTLINE} className="h-[calc(100vh-16rem)] overflow-y-auto custom_scrollbar"
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

              <TabsContent value={TABS.LAYOUTS} className="h-[calc(100vh-16rem)] overflow-y-auto custom_scrollbar">
                <div>
                  <TemplateSelection
                    selectedTemplate={selectedTemplate}
                    onSelectTemplate={setSelectedTemplate}
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Fixed Button */}
        <div className="py-4 border-t border-gray-200">
          <div className="max-w-[1200px] mx-auto">
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
