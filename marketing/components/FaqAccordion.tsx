"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
  className?: string;
}

export default function FaqAccordion({ items, className }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <div className={cn("divide-y divide-gray-200 border-t border-b border-gray-200", className)}>
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={i}>
            <button
              onClick={() => toggle(i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-6 py-5 text-left group"
            >
              <span className={cn(
                "text-base font-semibold transition-colors",
                isOpen ? "text-brand-600" : "text-gray-900 group-hover:text-brand-600"
              )}>
                {item.question}
              </span>
              <span className={cn(
                "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                isOpen ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-500 group-hover:bg-brand-50 group-hover:text-brand-600"
              )}>
                {isOpen ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              </span>
            </button>
            <div
              className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out",
                isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
              )}
            >
              <p className="pb-5 text-sm text-gray-600 leading-7 pr-12">
                {item.answer}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
