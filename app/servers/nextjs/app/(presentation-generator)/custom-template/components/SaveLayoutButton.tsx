import React from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";

interface SaveLayoutButtonProps {
  onSave: () => void;
  isSaving: boolean;
  isProcessing: boolean;
}

export const SaveLayoutButton: React.FC<SaveLayoutButtonProps> = ({
  onSave,
  isSaving,
  isProcessing,
}) => {

  return (
    <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 md:bottom-6">
      <Button
        onClick={onSave}
        disabled={isSaving || isProcessing}
        className="rounded-xl bg-violet-600 px-8 py-5 text-base font-semibold text-white shadow-lg shadow-violet-500/25 transition-all duration-200 hover:bg-violet-500 hover:shadow-xl disabled:opacity-60"
        size="lg"
      >
        {isSaving ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Saving Template...
          </>
        ) : (
          <>
            <FileText className="w-5 h-5 mr-2" />
            Save as Template
          </>
        )}
      </Button>
    </div>
  );
};
