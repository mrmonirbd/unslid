'use client'

import React, { memo } from "react";

const SlideContent = memo(({
  slide,
  onHtmlChange,
}: {
  slide: any;
  onHtmlChange?: (html: string) => void;
}) => {
  const cleanHtml = slide.html
    .replace(/```html\s*/gi, "")
    .replace(/```/g, "")
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<\/?html[^>]*>/gi, "")
    .replace(/<\/?body[^>]*>/gi, "");
  return (
    <div
      onInput={(event) => {
        onHtmlChange?.(event.currentTarget.innerHTML);
      }}
      onBlur={(event) => {
        onHtmlChange?.(event.currentTarget.innerHTML);
      }}
      dangerouslySetInnerHTML={{
        __html: cleanHtml,
      }}
    />
  );
});

SlideContent.displayName = "SlideContent";

export default SlideContent;
