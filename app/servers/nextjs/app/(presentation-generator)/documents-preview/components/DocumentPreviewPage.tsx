/**
 * DocumentPreviewPage Component
 *
 * A component that displays and manages document previews for presentation generation.
 * Features:
 * - Document content preview with markdown support
 * - Sidebar navigation for documents
 * - Document content editing and saving
 * - Presentation generation workflow
 *
 * @component
 */

"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { OverlayLoader } from "@/components/ui/overlay-loader";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";
import { setPresentationId } from "@/store/slices/presentationGeneration";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, usePathname } from "next/navigation";
import { RootState } from "@/store/store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import MarkdownRenderer from "./MarkdownRenderer";
import { getIconFromFile } from "../../utils/others";
import { ChevronRight, PanelRightOpen, X, Zap } from "lucide-react";
import ToolTip from "@/components/ToolTip";
import Header from "@/app/(presentation-generator)/(dashboard)/dashboard/components/Header";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Types
interface LoadingState {
  message: string;
  show: boolean;
  duration: number;
  progress: boolean;
}

interface TextContents {
  [key: string]: string;
}

interface FileItem {
  name: string;
  file_path: string;
}

const DocumentsPreviewPage: React.FC = () => {
  // Hooks
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showFreeLimitDialog, setShowFreeLimitDialog] = useState(false);

  // Redux state
  const { config, files } = useSelector(
    (state: RootState) => state.pptGenUpload
  );

  // Local state
  const [textContents, setTextContents] = useState<TextContents>({});
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [downloadingDocuments, setDownloadingDocuments] = useState<string[]>(
    []
  );
  const [isOpen, setIsOpen] = useState(true);
  const [showLoading, setShowLoading] = useState<LoadingState>({
    message: "",
    show: false,
    duration: 10,
    progress: false,
  });

  // Memoized computed values
  const fileItems: FileItem[] = useMemo(() => {
    if (!files || !Array.isArray(files) || files.length === 0) return [];
    return files
      .flat()
      .filter((item: any) => item && item.name && item.file_path);
  }, [files]);

  const documentKeys = useMemo(() => {
    return fileItems.map((file) => file.name);
  }, [fileItems]);

  const updateSelectedDocument = (value: string) => {
    setSelectedDocument(value);
    if (textareaRef.current) {
      textareaRef.current.value = textContents[value] || "";
    }
  };

  const readFile = async (filePath: string) => {
    const res = await fetch(`/api/read-file`, {
      method: "POST",
      body: JSON.stringify({ filePath }),
    });
    return res.json();
  };

  const maintainDocumentTexts = async () => {
    const newDocuments: string[] = [];
    const promises: Promise<{ content: string }>[] = [];

    // Process documents
    documentKeys.forEach((key: string) => {
      if (!(key in textContents)) {
        newDocuments.push(key);
        const fileItem = fileItems.find((item) => item.name === key);
        if (fileItem) {
          promises.push(readFile(fileItem.file_path));
        }
      }
    });

    if (promises.length > 0) {
      setDownloadingDocuments(newDocuments);
      try {
        const results = await Promise.all(promises);
        setTextContents((prev) => {
          const newContents = { ...prev };
          newDocuments.forEach((key, index) => {
            newContents[key] = results[index].content || "";
          });
          return newContents;
        });
      } catch (error) {
        console.error("Error reading files:", error);
        toast.error("Failed to read document content");
      }
      setDownloadingDocuments([]);
    }
  };

  const handleCreatePresentation = async () => {
    try {
      setShowLoading({
        message: "Generating presentation outline...",
        show: true,
        duration: 40,
        progress: true,
      });

      const documentPaths = fileItems.map(
        (fileItem: FileItem) => fileItem.file_path
      );
      trackEvent(MixpanelEvent.DocumentsPreview_Create_Presentation_API_Call);
      const createResponse = await PresentationGenerationApi.createPresentation(
        {
          content: config?.prompt ?? "",
          n_slides: config?.slides ? parseInt(config.slides) : null,
          file_paths: documentPaths,
          language: config?.language ?? "",
          tone: config?.tone,
          verbosity: config?.verbosity,
          instructions: config?.instructions || null,
          include_table_of_contents: !!config?.includeTableOfContents,
          include_title_slide: !!config?.includeTitleSlide,
          web_search: !!config?.webSearch,
        }
      );

      dispatch(setPresentationId(createResponse.id));
      const outlineUrl = `/outline?id=${encodeURIComponent(createResponse.id)}`;
      trackEvent(MixpanelEvent.Navigation, { from: pathname, to: outlineUrl });
      router.replace(outlineUrl);
    } catch (error: any) {
      console.error("Error in radar presentation creation:", error);
      // Free plan slot limit (HTTP 429) — show upgrade dialog
      if ((error as any)?.status === 429) {
        setShowFreeLimitDialog(true);
        setShowLoading({ message: "", show: false, duration: 0, progress: false });
        return;
      }
      toast.error("Error", {
        description: error.message || "Error in radar presentation creation.",
      });
      setShowLoading({
        message: "Error in radar presentation creation.",
        show: true,
        duration: 10,
        progress: false,
      });
    } finally {
      setShowLoading({
        message: "",
        show: false,
        duration: 10,
        progress: false,
      });
    }
  };

  // Effects
  useEffect(() => {
    if (documentKeys.length > 0) {
      setSelectedDocument(documentKeys[0]);
      maintainDocumentTexts();
    }
  }, [documentKeys]);

  // Render helpers
  const renderDocumentContent = () => {
    if (!selectedDocument) return null;

    const isDocument = documentKeys.includes(selectedDocument);

    if (!isDocument) return null;

    return (
      <div className="h-full md:mr-4">
        <div className="overflow-y-auto custom_scrollbar h-full">
          <div className="h-full w-full max-w-full flex flex-col mb-5">
            <h1 className="mb-5 text-xl font-medium sm:text-2xl">Content:</h1>
            {downloadingDocuments.includes(selectedDocument) ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <MarkdownRenderer
                content={textContents[selectedDocument] || ""}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSidebar = () => {
    if (!isOpen) return null;

    return (
      <div className={`fixed inset-y-4 left-4 z-50 w-[min(300px,calc(100vw-2rem))] rounded-md border-r border-gray-200 bg-white p-5 shadow-2xl transition-all duration-300 ease-in-out xl:relative xl:inset-auto xl:z-auto xl:h-[85vh] xl:max-w-[300px] xl:shadow-none`}>
        <X
          onClick={() => setIsOpen(false)}
          className="text-black mb-4 ml-auto mr-0 cursor-pointer hover:text-gray-600"
          size={20}
        />

        {documentKeys.length > 0 && (
          <div className="mt-8">
            <p className="text-xs mt-2 text-[#2E2E2E] opacity-70">DOCUMENTS</p>
            <div className="flex flex-col gap-2 mt-6">
              {documentKeys.map((key: string) => (
                <div
                  key={key}
                  onClick={() => updateSelectedDocument(key)}
                  className={`${selectedDocument === key ? "border border-blue-500" : ""
                    } flex p-2 rounded-sm gap-2 items-center cursor-pointer`}
                >
                  <img
                    className="h-6 w-6 border border-gray-200"
                    src={getIconFromFile(key)}
                    alt="Document icon"
                  />
                  <span className="text-sm h-6 text-[#2E2E2E] overflow-hidden">
                    {key.split("/").pop() ?? "file.txt"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`bg-white/90 min-h-screen flex flex-col w-full`}>
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
                router.push("/dashboard");
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
                router.push("/settings/billing");
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
        show={showLoading.show}
        text={showLoading.message}
        showProgress={showLoading.progress}
        duration={showLoading.duration}
      />
      <Header />
      <div className="mt-4 flex gap-4 px-3 font-instrument_sans sm:px-4 md:mt-6">
        {!isOpen && (
          <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50">
            <ToolTip content="Open Panel">
              <Button
                onClick={() => setIsOpen(true)}
                className="bg-[#5146E5] text-white p-3 shadow-lg"
              >
                <PanelRightOpen className="text-white" size={20} />
              </Button>
            </ToolTip>
          </div>
        )}

        {renderSidebar()}

        <div className="custom_scrollbar h-[calc(100dvh-170px)] w-full rounded-md bg-white px-4 py-5 sm:mx-4 sm:h-[calc(100vh-100px)] sm:py-6 sm:pl-6">
          {renderDocumentContent()}
        </div>

        <div className="fixed inset-x-4 bottom-24 z-40 sm:inset-x-auto sm:bottom-5 sm:right-5">
          <Button
            onClick={handleCreatePresentation}
            className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#5146E5] px-8 py-6 text-md hover:bg-[#5146E5]/90 sm:w-auto"
          >
            <span className="text-white font-semibold">Next</span>
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DocumentsPreviewPage;
