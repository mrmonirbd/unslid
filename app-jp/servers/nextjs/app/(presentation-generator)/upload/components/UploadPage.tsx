/**
 * UploadPage Component
 * 
 * This component handles the presentation generation upload process, allowing users to:
 * - Configure presentation settings (slides, language)
 * - Input prompts
 * - Upload supporting documents
 * 
 * @component
 */

"use client";
import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useDispatch } from "react-redux";
import { clearOutlines, setPresentationId } from "@/store/slices/presentationGeneration";
import { PromptInput } from "./PromptInput";
import { LanguageType, PresentationConfig, ToneType, VerbosityType } from "../type";
import SupportingDoc from "./SupportingDoc";
import { Button } from "@/components/ui/button";
import { ChevronRight, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";
import { OverlayLoader } from "@/components/ui/overlay-loader";
import Wrapper from "@/components/Wrapper";
import { setPptGenUploadState } from "@/store/slices/presentationGenUpload";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { ConfigurationSelects } from "./ConfigurationSelects";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Types for loading state
interface LoadingState {
  isLoading: boolean;
  message: string;
  duration?: number;
  showProgress?: boolean;
  extra_info?: string;
}

const UploadPage = () => {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();

  // State management
  const [files, setFiles] = useState<File[]>([]);
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
  const handleConfigChange = (key: keyof PresentationConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * Validates the current configuration and files
   * @returns boolean indicating if the configuration is valid
   */
  const validateConfiguration = (): boolean => {
    if (!config.language || !config.slides) {
      toast.error("スライド数と言語を選択してください");
      return false;
    }

    if (!config.prompt.trim() && files.length === 0) {
      toast.error("プロンプトまたはドキュメントが入力されていません");
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
      const hasUploadedAssets = files.length > 0;

      if (hasUploadedAssets) {
        await handleDocumentProcessing();
      } else {
        await handleDirectPresentationGeneration();
      }
    } catch (error) {
      handleGenerationError(error);
    }
  };

  /**
   * Handles document processing
   */
  const handleDocumentProcessing = async () => {
    setLoadingState({
      isLoading: true,
      message: "ドキュメントを処理中...",
      showProgress: true,
      duration: 90,
      extra_info: files.length > 0 ? "大きなドキュメントの場合、数分かかる場合があります。" : "",
    });

    let documents = [];

    if (files.length > 0) {
      trackEvent(MixpanelEvent.Upload_Upload_Documents_API_Call);
      const uploadResponse = await PresentationGenerationApi.uploadDoc(files);
      documents = uploadResponse;
    }

    const promises: Promise<any>[] = [];

    if (documents.length > 0) {
      trackEvent(MixpanelEvent.Upload_Decompose_Documents_API_Call);
      promises.push(PresentationGenerationApi.decomposeDocuments(documents));
    }
    const responses = await Promise.all(promises);
    dispatch(setPptGenUploadState({
      config,
      files: responses,
    }));
    dispatch(clearOutlines())
    trackEvent(MixpanelEvent.Navigation, { from: pathname, to: "/documents-preview" });
    router.push("/documents-preview");
  };

  /**
   * Handles direct presentation generation without documents
   */
  const handleDirectPresentationGeneration = async () => {
    setLoadingState({
      isLoading: true,
      message: "アウトラインを生成中...",
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
    trackEvent(MixpanelEvent.Navigation, { from: pathname, to: "/outline" });
    router.push("/outline");
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
      setShowFreeLimitDialog(true);
      return;
    }
    toast.error("エラー", {
      description: error.message || "アップロードページでエラーが発生しました。",
    });
  };

  return (
    <Wrapper className="pb-10 lg:max-w-[70%] xl:max-w-[65%]">
      {/* Free plan limit dialog */}
      <Dialog open={showFreeLimitDialog} onOpenChange={setShowFreeLimitDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <span className="text-2xl">🎯</span> 無料プランの上限に達しました
            </DialogTitle>
            <DialogDescription className="text-slate-600 pt-1">
              無料プランでは同時に<strong>1件のプレゼン</strong>のみ利用できます。
              新しいプレゼンを作成するには既存のものを削除するか、Proにアップグレードして無制限でご利用ください。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Button
              onClick={() => {
                setShowFreeLimitDialog(false);
                router.push("/dashboard");
              }}
              variant="outline"
              className="w-full flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <Trash2 className="w-4 h-4" />
              ダッシュボードに移動してプレゼンを削除
            </Button>
            <Button
              onClick={() => {
                setShowFreeLimitDialog(false);
                router.push("/settings/billing");
              }}
              className="w-full flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Zap className="w-4 h-4" />
              Proにアップグレード — 無制限のプレゼン
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
      <div className="rounded-2xl border border-slate-200/70 bg-white/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60" >
        <div className="flex flex-col gap-4 md:items-center md:flex-row justify-between p-4">
          <div >
            <h2 className="text-lg font-unbounded tracking-tight text-slate-900 ">設定</h2>
            <p className="text-sm text-slate-500 font-syne">スライド数、トーン、言語の設定を選択してください。</p>
          </div>
          <ConfigurationSelects
            config={config}
            onConfigChange={handleConfigChange}
          />
        </div>
        <div className="border-t border-slate-200/70" />

        <div className="p-4 md:p-6">
          <h3 className="text-base font-normal font-unbounded  text-slate-900 mb-2">コンテンツ</h3>
          <div className="relative">
            <PromptInput
              value={config.prompt}
              onChange={(value) => handleConfigChange("prompt", value)}
              data-testid="prompt-input"
            />
          </div>
        </div>
        <div className="border-t border-slate-200/70" />
        <div className="p-4 md:p-6">
          <h3 className="text-base font-normal font-unbounded text-slate-900 mb-2">添付ファイル（任意）</h3>


          <SupportingDoc
            files={[...files]}
            onFilesChange={setFiles}
            data-testid="file-upload-input"
          />
        </div>
        <div className="border-t border-slate-200/70" />

        <div className="p-4 md:p-6">
          <Button
            onClick={handleGeneratePresentation}
            className="w-full rounded-[28px] flex items-center justify-center py-5 bg-[#5141e5] text-white font-syne font-semibold text-lg hover:bg-[#5141e5]/85 focus-visible:ring-2 focus-visible:ring-[#5141e5]/40"
            data-testid="next-button"
          >
            <span>プレゼンを生成</span>
            <ChevronRight className="!w-5 !h-5 ml-1.5" />
          </Button>
        </div>



      </div>
    </Wrapper>
  );
};

export default UploadPage;