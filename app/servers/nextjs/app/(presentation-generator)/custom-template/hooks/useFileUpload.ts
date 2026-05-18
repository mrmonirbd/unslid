import { useState, useCallback } from "react";
import { toast } from "sonner";

export const useFileUpload = (onFileChange?: () => void) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const selectFile = useCallback((file: File | undefined | null) => {
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isPptx = lowerName.endsWith(".pptx");
    const isPdf = lowerName.endsWith(".pdf");
    if (!isPptx && !isPdf) {
      toast.error("Please select a valid PDF or PPTX file");
      return;
    }

    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File size must be less than 100MB");
      return;
    }

    onFileChange?.();
    setSelectedFile(file);
  }, [onFileChange]);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      selectFile(event.target.files?.[0]);
      event.target.value = "";
    },
    [selectFile]
  );

  const removeFile = useCallback(() => {
    onFileChange?.();
    setSelectedFile(null);
  }, [onFileChange]);

  return {
    selectedFile,
    handleFileSelect,
    selectFile,
    removeFile,
  };
}; 
