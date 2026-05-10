"use client";
import React, { useState, useEffect } from "react";
import { Loader2, Download, CheckCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { RootState } from "@/store/store";
import { useSelector } from "react-redux";
import { handleSaveLLMConfig } from "@/utils/storeHelpers";
import {
  checkIfSelectedOllamaModelIsPulled,
  pullOllamaModel,
} from "@/utils/providerUtils";
import { useRouter, usePathname } from "next/navigation";
import { LLMConfig } from "@/types/llm_config";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import SettingSideBar from "./SettingSideBar";
import TextProvider from "./TextProvider";
import ImageProvider from "./ImageProvider";
import { IMAGE_PROVIDERS, LLM_PROVIDERS } from "@/utils/providerConstants";

// Button state interface
interface ButtonState {
  isLoading: boolean;
  isDisabled: boolean;
  text: string;
  showProgress: boolean;
  progressPercentage?: number;
  status?: string;
}

const SettingsPage = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<'nanobanana' | 'unslid'>('unslid')
  const [selectedProvider, setSelectedProvider] = useState<'text-provider' | 'image-provider'>('text-provider')
  const userConfigState = useSelector((state: RootState) => state.userConfig);
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(
    userConfigState.llm_config
  );
  const canChangeKeys = userConfigState.can_change_keys;
  const [buttonState, setButtonState] = useState<ButtonState>({
    isLoading: false,
    isDisabled: false,
    text: "Save Configuration",
    showProgress: false,
  });

  const [downloadingModel, setDownloadingModel] = useState<{
    name: string;
    size: number | null;
    downloaded: number | null;
    status: string;
    done: boolean;
  } | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState<boolean>(false);

  const downloadProgress = React.useMemo(() => {
    if (
      downloadingModel &&
      downloadingModel.downloaded !== null &&
      downloadingModel.size !== null
    ) {
      return Math.round(
        (downloadingModel.downloaded / downloadingModel.size) * 100
      );
    }
    return 0;
  }, [downloadingModel?.downloaded, downloadingModel?.size]);

  const handleSaveConfig = async () => {
    trackEvent(MixpanelEvent.Settings_SaveConfiguration_Button_Clicked, { pathname });
    try {
      setButtonState(prev => ({
        ...prev,
        isLoading: true,
        isDisabled: true,
        text: "Saving Configuration...",
      }));
      trackEvent(MixpanelEvent.Settings_SaveConfiguration_API_Call);
      await handleSaveLLMConfig(llmConfig);
      if (llmConfig.LLM === "ollama" && llmConfig.OLLAMA_MODEL) {
        trackEvent(MixpanelEvent.Settings_CheckOllamaModelPulled_API_Call);
        const isPulled = await checkIfSelectedOllamaModelIsPulled(
          llmConfig.OLLAMA_MODEL
        );
        if (!isPulled) {
          setShowDownloadModal(true);
          trackEvent(MixpanelEvent.Settings_DownloadOllamaModel_API_Call);
          await handleModelDownload();
        }
      }
      toast.info("Configuration saved successfully");
      setButtonState(prev => ({
        ...prev,
        isLoading: false,
        isDisabled: false,
        text: "Save Configuration",
      }));
      trackEvent(MixpanelEvent.Navigation, { from: pathname, to: "/upload" });
      router.push("/upload");
    } catch (error) {
      toast.info(error instanceof Error ? error.message : "Failed to save configuration");
      setButtonState(prev => ({
        ...prev,
        isLoading: false,
        isDisabled: false,
        text: "Save Configuration",
      }));
    }
  };

  const handleModelDownload = async () => {
    try {
      await pullOllamaModel(llmConfig.OLLAMA_MODEL!, setDownloadingModel);
    }
    finally {
      setDownloadingModel(null);
      setShowDownloadModal(false);
    }
  };

  useEffect(() => {
    if (
      downloadingModel &&
      downloadingModel.downloaded !== null &&
      downloadingModel.size !== null
    ) {
      const percentage = Math.round(
        (downloadingModel.downloaded / downloadingModel.size) * 100
      );
      setButtonState({
        isLoading: true,
        isDisabled: true,
        text: `Downloading Model (${percentage}%)`,
        showProgress: true,
        progressPercentage: percentage,
        status: downloadingModel.status,
      });
    }

    if (downloadingModel && downloadingModel.done) {
      setTimeout(() => {
        setShowDownloadModal(false);
        setDownloadingModel(null);
        toast.info("Model downloaded successfully!");
      }, 2000);
    }
  }, [downloadingModel]);

  useEffect(() => {
    if (!canChangeKeys) {
      router.push("/dashboard");
    }
  }, [canChangeKeys, router]);

  if (!canChangeKeys) {
    return null;
  }


  const textProviderKey = llmConfig.LLM || "openai";
  const textProviderLabel =
    LLM_PROVIDERS[textProviderKey]?.label || textProviderKey;
  const selectedTextModel =
    textProviderKey === "openai"
      ? llmConfig.OPENAI_MODEL
      : textProviderKey === "google"
        ? llmConfig.GOOGLE_MODEL
        : textProviderKey === "anthropic"
          ? llmConfig.ANTHROPIC_MODEL
          : textProviderKey === "ollama"
            ? llmConfig.OLLAMA_MODEL
            : textProviderKey === "custom"
              ? llmConfig.CUSTOM_MODEL
              : "";
  const textSummary = selectedTextModel
    ? `${textProviderLabel} (${selectedTextModel})`
    : textProviderLabel;

  const imageSummary = llmConfig.DISABLE_IMAGE_GENERATION
    ? "Image generation disabled"
    : llmConfig.IMAGE_PROVIDER
      ? IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER]?.label || llmConfig.IMAGE_PROVIDER
      : "No image provider";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden font-syne md:h-screen">
      <div
        className='fixed z-0 bottom-[-14.5rem] left-0 w-full h-full'
        style={{
          height: "341px",
          borderRadius: '1440px',
          background: 'radial-gradient(5.92% 104.69% at 50% 100%, rgba(122, 90, 248, 0.00) 0%, rgba(255, 255, 255, 0.00) 100%), radial-gradient(50% 50% at 50% 50%, rgba(122, 90, 248, 0.80) 0%, rgba(122, 90, 248, 0.00) 100%)',
        }}
      />

      <main className="mx-auto flex w-full flex-1 flex-col gap-4 overflow-y-auto px-4 pb-28 md:flex-row md:gap-6 md:overflow-hidden md:px-0">
        <SettingSideBar mode={mode} setMode={setMode} selectedProvider={selectedProvider} setSelectedProvider={setSelectedProvider} />
        <div className="min-w-0 w-full md:overflow-y-auto md:pr-5">
          <div className="sticky top-0 right-0 z-50 mb-4 py-4 backdrop-blur md:py-[28px]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <h3 className="flex items-center gap-2 font-unbounded text-2xl font-normal tracking-[-0.84px] text-black sm:text-[28px]">
                Settings
              </h3>
              <p className="w-fit max-w-full rounded-[50px] border border-[#EDEEEF] px-2.5 py-0.5 text-[10px] font-medium text-[#7A5AF8]">
                {textSummary} · {imageSummary}
              </p>

            </div>
          </div>

          {mode === 'nanobanana' && <div className=" w-full bg-[#F9F8F8] p-7 rounded-[20px]">
            <h4>Nano Banana</h4>
          </div>}
          {mode === 'unslid' && selectedProvider === 'text-provider' && <TextProvider


            onInputChange={(value, field) => {
              setLlmConfig(prev => ({
                ...prev,
                [field]: value
              }));
            }}
            llmConfig={llmConfig}
          />}
          {mode === 'unslid' && selectedProvider === 'image-provider' && <ImageProvider llmConfig={llmConfig} setLlmConfig={setLlmConfig} />}

        </div>
      </main>

      {/* Fixed Bottom Button */}
      <div className="fixed inset-x-4 bottom-24 z-50 mx-auto md:inset-x-auto md:bottom-20 md:right-5">
        <button
          onClick={handleSaveConfig}
          disabled={buttonState.isDisabled}
          style={{
            background: "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)",
            color: "#101323",
          }}
          className={`w-full font-syne font-semibold flex items-center justify-center gap-2 py-3 px-5 rounded-[58px] transition-all duration-500 ${buttonState.isDisabled
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:ring-4 focus:ring-violet-200"
            } text-white`}
        >
          {buttonState.isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {buttonState.text}
            </div>
          ) : (
            buttonState.text
          )}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Download Progress Modal */}
      {showDownloadModal && downloadingModel && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl max-w-md w-full p-6 relative">
            {/* Modal Content */}
            <div className="text-center">
              {/* Icon */}
              <div className="mb-4">
                {downloadingModel.done ? (
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
                ) : (
                  <Download className="w-12 h-12 text-violet-600 mx-auto animate-pulse" />
                )}
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {downloadingModel.done
                  ? "Download Complete!"
                  : "Downloading Model"}
              </h3>

              {/* Model Name */}
              <p className="text-sm text-gray-600 mb-6">
                {llmConfig.OLLAMA_MODEL}
              </p>

              {/* Progress Bar */}
              {downloadProgress > 0 && (
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-violet-600 h-3 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {downloadProgress}% Complete
                  </p>
                </div>
              )}

              {/* Status */}
              {downloadingModel.status && (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 capitalize">
                    {downloadingModel.status}
                  </span>
                </div>
              )}

              {/* Status Message */}
              {downloadingModel.status &&
                downloadingModel.status !== "pulled" && (
                  <div className="text-xs text-gray-500">
                    {downloadingModel.status === "downloading" &&
                      "Downloading model files..."}
                    {downloadingModel.status === "verifying" &&
                      "Verifying model integrity..."}
                    {downloadingModel.status === "pulling" &&
                      "Pulling model from registry..."}
                  </div>
                )}

              {/* Download Info */}
              {downloadingModel.downloaded && downloadingModel.size && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>
                      Downloaded:{" "}
                      {(downloadingModel.downloaded / 1024 / 1024).toFixed(1)}{" "}
                      MB
                    </span>
                    <span>
                      Total: {(downloadingModel.size / 1024 / 1024).toFixed(1)}{" "}
                      MB
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
