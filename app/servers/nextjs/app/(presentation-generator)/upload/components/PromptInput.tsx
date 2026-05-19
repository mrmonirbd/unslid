import { Textarea } from "@/components/ui/textarea";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  "data-testid"?: string;
}

export function PromptInput({ value, onChange, "data-testid": testId }: PromptInputProps) {


  const handleChange = (val: string) => {

    onChange(val);
  };

  return (
    <div className="space-y-2 font-syne">
      <div className="relative">
        <Textarea
          value={value}
          rows={5}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Tell us what this presentation should cover..."
          data-testid={testId ?? "prompt-input"}
          className="min-h-[240px] max-h-[420px] resize-none overflow-y-auto rounded-xl border border-slate-200 bg-white px-4 py-3 font-instrument_sans text-base font-medium leading-7 text-slate-800 shadow-sm outline-none custom_scrollbar placeholder:text-slate-400 focus-visible:border-violet-300 focus-visible:ring-2 focus-visible:ring-violet-100 focus-visible:ring-offset-0"
        />
      </div>

    </div>
  );
}
