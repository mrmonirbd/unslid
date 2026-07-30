/**
 * UploadPage Component
 * 
 * This component handles the presentation generation upload process, allowing users to:
 * - Configure presentation settings (slides, language)
 * - Input prompts
 * 
 * @component
 */

"use client";
import React, { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useDispatch } from "react-redux";
import { clearOutlines, setPresentationId } from "@/store/slices/presentationGeneration";
import { PromptInput } from "./PromptInput";
import { LanguageType, PresentationConfig, ToneType, VerbosityType } from "../type";
import { Button } from "@/components/ui/button";
import { ChevronRight, FileText, GalleryVertical, Settings2, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";
import { OverlayLoader } from "@/components/ui/overlay-loader";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { ConfigurationSelects } from "./ConfigurationSelects";
import { useUser } from "@/app/hooks/useUser";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { checkPresentationGenerationLimit } from "../../utils/presentationLimit";
import { withIframeSearch } from "@/app/(presentation-generator)/(dashboard)/Components/IframeAwareShell";

// Types for loading state
interface LoadingState {
  isLoading: boolean;
  message: string;
  duration?: number;
  showProgress?: boolean;
  extra_info?: string;
}

const FREE_SLIDE_OPTIONS = new Set<string>(["5", "8"]);

const UploadPage = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const { user } = useUser();
  const isFreePlan = (user?.plan ?? "free").toLowerCase() === "free";

  // State management
  const [showFreeLimitDialog, setShowFreeLimitDialog] = useState(false);
  const [config, setConfig] = useState<PresentationConfig>({
    slides: "5",
    language: LanguageType.English,
    prompt: "",
    tone: ToneType.Default,
    verbosity: VerbosityType.Standard,
    instructions: "",
    includeTableOfContents: false,
    includeTitleSlide: false,
    webSearch: false,
  });

  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    message: "",
    duration: 4,
    showProgress: false,
    extra_info: "",
  });

  /**
   * Updates the presentation configuration
   * @param key - Configuration key to update
   * @param value - New value for the configuration
   */
  const handleConfigChange = (key: keyof PresentationConfig, value: PresentationConfig[keyof PresentationConfig]) => {
    if (key === "slides" && isFreePlan && typeof value === "string" && !FREE_SLIDE_OPTIONS.has(value)) {
      toast.error("Upgrade required", {
        description: "Free members can create 5 or 8 pages. Upgrade your membership for more slide counts.",
      });
      return;
    }

    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * Validates the current configuration
   * @returns boolean indicating if the configuration is valid
   */
  const validateConfiguration = (): boolean => {
    if (!config.language || !config.slides) {
      toast.error("Please select number of Slides & Language");
      return false;
    }

    if (!config.prompt.trim()) {
      toast.error("Please provide a prompt");
      return false;
    }

    if (isFreePlan && !FREE_SLIDE_OPTIONS.has(config.slides)) {
      toast.error("Upgrade required", {
        description: "Free members can create 5 or 8 pages. Upgrade your membership for more slide counts.",
      });
      return false;
    }

    return true;
  };

  /**
   * Handles the presentation generation process
   */
  const handleGeneratePresentation = async () => {
    if (!validateConfiguration()) return;

    try {
      const limitCheck = await checkPresentationGenerationLimit();
      console.log(checkPresentationGenerationLimit());
      if (!limitCheck.allowed) {
        toast.error("Presentation limit reached", {
          description: limitCheck.message,
        });
        return;
      }

      await handleDirectPresentationGeneration();
    } catch (error) {
      handleGenerationError(error);
    }
  };

  /**
   * Handles direct presentation generation without documents
   */
  const handleDirectPresentationGeneration = async () => {
    setLoadingState({
      isLoading: true,
      message: "Generating outlines...",
      showProgress: true,
      duration: 30,
    });

    // Use the first available layout group for direct generation
    trackEvent(MixpanelEvent.Upload_Create_Presentation_API_Call);
    const createResponse = await PresentationGenerationApi.createPresentation({
      content: config?.prompt ?? "",
      n_slides: config?.slides ? parseInt(config.slides) : null,
      file_paths: [],
      language: config?.language ?? "",
      tone: config?.tone,
      verbosity: config?.verbosity,
      instructions: config?.instructions || null,
      include_table_of_contents: !!config?.includeTableOfContents,
      include_title_slide: !!config?.includeTitleSlide,
      web_search: !!config?.webSearch,
    });


    dispatch(setPresentationId(createResponse.id));
    dispatch(clearOutlines())
    const outlineUrl = withIframeSearch(`/outline?id=${encodeURIComponent(createResponse.id)}`, searchParams);
    trackEvent(MixpanelEvent.Navigation, { from: pathname, to: outlineUrl });
    router.push(outlineUrl);
  };

  /**
   * Handles errors during presentation generation
   */
  const handleGenerationError = (error: any) => {
    console.error("Error in upload page", error);
    setLoadingState({
      isLoading: false,
      message: "",
      duration: 0,
      showProgress: false,
    });
    // Free plan slot limit (HTTP 429) — show a dedicated dialog instead of a raw toast
    if ((error as any)?.status === 429) {
      console.log('here');
      setShowFreeLimitDialog(true);
      return;
    }
    toast.error("Error", {
      description: error.message || "Error in upload page.",
    });
  };

  return (
    <div className="min-h-full px-4 pb-8 font-syne sm:px-6 md:px-8 md:pb-12">
      {/* Free plan limit dialog */}
      <Dialog open={showFreeLimitDialog} onOpenChange={setShowFreeLimitDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <span className="text-2xl">🎯</span> Free Plan Limit Reached
            </DialogTitle>
            <DialogDescription className="text-slate-600 pt-1">
              Your free plan includes <strong>5 presentations per month</strong>.
              You have reached this month&apos;s limit. Upgrade to Pro for unlimited presentations.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Button
              onClick={() => {
                setShowFreeLimitDialog(false);
                router.push(withIframeSearch("/dashboard", searchParams));
              }}
              variant="outline"
              className="w-full flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <ChevronRight className="w-4 h-4" />
              View Dashboard
            </Button>
            <Button
              onClick={() => {
                setShowFreeLimitDialog(false);
                router.push(withIframeSearch("/settings/billing", searchParams));
              }}
              className="w-full flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Zap className="w-4 h-4" />
              Upgrade to Pro — Unlimited Presentations
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <OverlayLoader
        show={loadingState.isLoading}
        text={loadingState.message}
        showProgress={loadingState.showProgress}
        duration={loadingState.duration}
        extra_info={loadingState.extra_info}
      />

      <div className="pt-8 pb-6">
        <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Create presentation
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Start from a prompt and configure how the deck should be generated.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <div className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-100 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 shadow-sm sm:px-4">
              <GalleryVertical className="h-4 w-4 text-violet-500" />
              {config.slides} slides
            </div>
            <div className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-100 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 shadow-sm sm:px-4">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              Prompt mode
            </div>
          </div>
        </div>

        <div className="mt-6 grid max-w-2xl grid-cols-1 gap-3 min-[520px]:grid-cols-2 sm:gap-4">
          <div className="rounded-xl border border-violet-100 bg-white/95 px-4 py-3 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <FileText className="h-4 w-4 text-violet-500" />
              <span className="text-xs font-medium text-slate-500">Content</span>
            </div>
            <p className="text-lg font-bold text-slate-900">Prompt</p>
            <p className="mt-0.5 text-xs text-slate-400">Idea or full brief</p>
          </div>

          <div className="rounded-xl border border-violet-100 bg-white/95 px-4 py-3 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-violet-500" />
              <span className="text-xs font-medium text-slate-500">Settings</span>
            </div>
            <p className="truncate text-lg font-bold text-slate-900">{config.language}</p>
            <p className="mt-0.5 text-xs text-slate-400">{config.tone} tone</p>
          </div>
        </div>
      </div>

      <div className="mb-6 border-t border-slate-200" />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-4 md:flex-row md:items-center md:p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Presentation setup</h2>
            <p className="mt-1 text-sm text-slate-500">Choose slide count, language, and generation preferences.</p>
          </div>
          <ConfigurationSelects
            config={config}
            onConfigChange={handleConfigChange}
            isFreePlan={isFreePlan}
          />
        </div>

        <div>
          <div className="p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Content brief</h3>
                <p className="mt-1 text-xs text-slate-400">Describe the story, audience, and outcome.</p>
              </div>
              <span className="hidden rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 sm:inline-flex">
                Required
              </span>
            </div>
            <PromptInput
              value={config.prompt}
              onChange={(value) => handleConfigChange("prompt", value)}
              data-testid="prompt-input"
            />
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50/70 p-4 md:p-5">
          <Button
            onClick={handleGeneratePresentation}
            className="flex w-full items-center justify-center rounded-xl bg-violet-600 py-5 text-base font-semibold text-white shadow-sm shadow-violet-500/25 hover:bg-violet-500 focus-visible:ring-2 focus-visible:ring-violet-200 sm:ml-auto sm:w-auto sm:px-7"
            data-testid="next-button"
          >
            <span>Generate presentation</span>
            <ChevronRight className="ml-1.5 !h-5 !w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
