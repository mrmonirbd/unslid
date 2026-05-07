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
    .replace(/```html/g, "")
    .replace(/```/g, "")
    .replace(/<html>/g, "")
    .replace(/<\/html>/g, "")
    .replace(/html/g, "");
  return (
    <div
      onBlur={(event) => {
        onHtmlChange?.(event.currentTarget.innerHTML);
      }}
      dangerouslySetInnerHTML={{
        __html: cleanHtml,
      }}
    />
  );
});

export default SlideContent;
