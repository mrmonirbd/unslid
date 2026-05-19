import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { ProcessedSlide } from "../types";
import Timer from "./Timer";

interface FileUploadSectionProps {
  selectedFile: File | null;
  handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  selectFile: (file: File | undefined | null) => void;
  removeFile: () => void;
  processFile: () => void;
  isProcessingPptx: boolean;
  slides: ProcessedSlide[];
  completedSlides: number;
}

export const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  selectedFile,
  handleFileSelect,
  selectFile,
  removeFile,
  processFile,
  isProcessingPptx,
  slides,
  completedSlides,
}) => {
  const isBusy = isProcessingPptx || slides.some((s) => s.processing);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:p-5">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Upload className="h-4 w-4 text-violet-500" />
            Upload source file
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Select a PDF or PowerPoint file to process. Maximum file size: 100MB.
          </p>
        </div>
        {slides.length > 0 && (
          <div className="inline-flex items-center justify-end gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">
            {slides.some((s) => s.processing) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {completedSlides}/{slides.length} slides completed
          </div>
        )}
      </div>
      <div className="space-y-4 p-4 md:p-5">
        {!selectedFile ? (
          <div
            className="relative rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center shadow-sm transition-all hover:border-violet-300 hover:bg-violet-50/40"
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              selectFile(event.dataTransfer.files?.[0]);
            }}
          >
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
              <Upload className="h-6 w-6" />
            </span>
            <Label htmlFor="file-upload" className="cursor-pointer">
              <span className="text-sm font-semibold text-slate-800">
                Drop a PDF or PPTX, or <span className="text-violet-600">browse files</span>
              </span>
              <input
                id="file-upload"
                type="file"
                accept=".pdf,.pptx"
                onChange={handleFileSelect}
                className="opacity-0 w-full h-full cursor-pointer absolute top-0 left-0 z-10"
              />
            </Label>
            <p className="mt-2 text-xs font-medium text-slate-400">
              The file will be converted into editable slide layouts.
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-violet-100 bg-violet-50/70 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-slate-500">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={removeFile}
              disabled={
                isBusy
              }
              className="text-red-500 hover:bg-red-50 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Button
            onClick={processFile}
            disabled={!selectedFile || isBusy}
            className="h-10 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white shadow-sm shadow-violet-500/25 hover:bg-violet-500 sm:w-auto"
          >
            {isProcessingPptx
              ? "Extracting Slides..."
              : !selectedFile
              ? "Select a PDF or PPTX file"
              : "Process File"}
          </Button>
          {isProcessingPptx && <Timer duration={90} />}
        </div>
      </div>
    </section>
  );
};
