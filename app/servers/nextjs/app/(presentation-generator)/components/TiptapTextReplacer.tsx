"use client";

import React, { useRef, useEffect, ReactNode, useCallback } from "react";
import { flushSync } from "react-dom";
import ReactDOM from "react-dom/client";
import TiptapText from "./TiptapText";

interface TiptapTextReplacerProps {
  children: ReactNode;
  slideData?: any;
  slideIndex?: number;
  isolated?: boolean;
  renderKey?: string;
  onContentChange?: (
    content: string,
    path: string,
    slideIndex?: number
  ) => void;
}

const TiptapTextReplacer: React.FC<TiptapTextReplacerProps> = ({
  children,
  slideData,
  slideIndex,
  isolated = false,
  renderKey,
  onContentChange = () => {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const processedElementsRef = useRef(new Set<HTMLElement>());
  const isolatedRootRef = useRef<ReturnType<typeof ReactDOM.createRoot> | null>(
    null
  );
  const slideDataRef = useRef(slideData);
  const slideIndexRef = useRef(slideIndex);
  const onContentChangeRef = useRef(onContentChange);
  const childrenRef = useRef(children);

  slideDataRef.current = slideData;
  slideIndexRef.current = slideIndex;
  onContentChangeRef.current = onContentChange;
  childrenRef.current = children;

  // Track created React roots to update content when slideData changes
  const rootsRef = useRef<
    Map<
      HTMLElement,
      {
        root: ReturnType<typeof ReactDOM.createRoot>;
        dataPath: string;
        fallbackText: string;
      }
    >
  >(new Map());

  const cleanupEditorRoots = useCallback(() => {
    rootsRef.current.forEach(({ root }) => {
      try {
        root.unmount();
      } catch {
        // The root may already be detached by React during slide changes.
      }
    });
    rootsRef.current.clear();
    processedElementsRef.current.clear();
  }, []);

  const replaceTextElements = useCallback(
    (container: HTMLElement) => {
      const allElements = container.querySelectorAll("*");

      allElements.forEach((element) => {
        const htmlElement = element as HTMLElement;

        // Skip if already processed
        if (
          processedElementsRef.current.has(htmlElement) ||
          htmlElement.classList.contains("tiptap-text-editor") ||
          htmlElement.closest(".tiptap-text-editor")
        ) {
          return;
        }

        // console.log("htmlElement", htmlElement);
        // Skip if element is inside an ignored element tree
        if (isInIgnoredElementTree(htmlElement)) return;

        // Get direct text content (not from child elements)
        const directTextContent = getDirectTextContent(htmlElement);
        const trimmedText = directTextContent.trim();

        // Check if element has meaningful text content
        if (!trimmedText || trimmedText.length <= 2) return;
        
        // Skip elements that contain other elements with text (to avoid double processing)
        if (hasTextChildren(htmlElement)) return;
        
        // Skip certain element types that shouldn't be editable
        if (shouldSkipElement(htmlElement)) return;

        // Get all computed styles to preserve them
        const allClasses = Array.from(htmlElement.classList);
        const allStyles = htmlElement.getAttribute("style");

        const dataPath = findDataPath(slideDataRef.current, trimmedText);

        // Create a container for the TiptapText
        const tiptapContainer = document.createElement("div");
        tiptapContainer.style.cssText = allStyles || "";
        tiptapContainer.className = Array.from(allClasses).join(" ");
    
        // Replace the element
        if (htmlElement.parentNode) {
          htmlElement.parentNode.replaceChild(tiptapContainer, htmlElement);
          // Mark as processed
          htmlElement.innerHTML = "";
        }
        processedElementsRef.current.add(htmlElement);
        // Render TiptapText
        const root = ReactDOM.createRoot(tiptapContainer);
        const initialContent = dataPath.path
          ? getValueByPath(slideDataRef.current, dataPath.path) ?? trimmedText
          : trimmedText;
        rootsRef.current.set(tiptapContainer, {
          root,
          dataPath: dataPath.path,
        
          fallbackText: trimmedText,
        });
        root.render(
          <TiptapText
            content={initialContent}
           
            onContentChange={(content: string) => {
              if (dataPath && onContentChangeRef.current) {
                onContentChangeRef.current(
                  content,
                  dataPath.path,
                  slideIndexRef.current
                );
              }
            }}
            placeholder="Enter text..."
          />
        );
      });
    },
    []
  );

  useEffect(() => {
    if (!containerRef.current || isolated) return;

    const container = containerRef.current;

    // Replace text elements after a short delay to ensure DOM is ready
    const timer = setTimeout(() => replaceTextElements(container), 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [isolated, replaceTextElements]);

  useEffect(() => {
    if (!containerRef.current || !isolated) return;

    const container = containerRef.current;
    cleanupEditorRoots();

    container.replaceChildren();

    const reactMount = document.createElement("div");
    reactMount.className = "tiptap-isolated-render w-full h-full";
    container.appendChild(reactMount);

    const root = ReactDOM.createRoot(reactMount);
    isolatedRootRef.current = root;
    flushSync(() => {
      root.render(<>{childrenRef.current}</>);
    });
    const originalRenderedHtml = reactMount.innerHTML;

    const timer = setTimeout(() => replaceTextElements(reactMount), 100);

    return () => {
      clearTimeout(timer);
      cleanupEditorRoots();
      reactMount.innerHTML = originalRenderedHtml;
      try {
        root.unmount();
      } catch {
        // Safe during rapid slide switches or hot reload.
      }
      if (isolatedRootRef.current === root) {
        isolatedRootRef.current = null;
      }
    };
  }, [
    isolated,
    renderKey,
    children,
    cleanupEditorRoots,
    replaceTextElements,
  ]);
  
  // When slideData changes, update existing editors' content using the stored dataPath
  useEffect(() => {
    if (!rootsRef.current || rootsRef.current.size === 0) return;
    rootsRef.current.forEach(({ root, dataPath,  fallbackText }) => {
      const newContent = dataPath ? getValueByPath(slideData, dataPath) ?? fallbackText : fallbackText;
      root.render(
        <TiptapText
          content={newContent}
          onContentChange={(content: string) => {
            if (dataPath && onContentChange) {
              onContentChange(content, dataPath, slideIndex);
            }
          }}
          placeholder="Enter text..."
        />
      );
    });
  }, [slideData, slideIndex]);
  // helper functions
    // Function to check if element is inside an ignored element tree
    const isInIgnoredElementTree = (element: HTMLElement): boolean => {
      // List of element types that should be ignored entirely with all their children
      const ignoredElementTypes = [
        "TABLE",
        "TBODY",
        "THEAD",
        "TFOOT",
        "TR",
        "TD",
        "TH", // Table elements
        "SVG",
        "G",
        "PATH",
        "CIRCLE",
        "RECT",
        "LINE", // SVG elements
        "CANVAS", // Canvas element
        "VIDEO",
        "AUDIO", // Media elements
        "IFRAME",
        "EMBED",
        "OBJECT", // Embedded content
        "SELECT",
        "OPTION",
        "OPTGROUP", // Select dropdown elements
        "SCRIPT",
        "STYLE",
        "NOSCRIPT", // Script/style elements
      ];

      // List of class patterns that indicate ignored element trees
      const ignoredClassPatterns = [
        "chart",
        "graph",
        "visualization", // Chart/graph components
        "menu",
        "dropdown",
        "tooltip", // UI components
        "editor",
        "wysiwyg", // Editor components
        "calendar",
        "datepicker", // Date picker components
        "slider",
        "carousel",
        "flowchart",
        "mermaid",
        "diagram",
      ];

      // Check if current element or any parent is in ignored list
      let currentElement: HTMLElement | null = element;
      while (currentElement) {
        // Check element type
        if (ignoredElementTypes.includes(currentElement.tagName)) {
          return true;
        }

        // Check class patterns
        const className =
          currentElement.className.length > 0
            ? currentElement.className.toLowerCase()
            : "";
        if (
          ignoredClassPatterns.some((pattern) => className.includes(pattern))
        ) {
          return true;
        }
        if (currentElement.id.includes("mermaid")) {
          return true;
        }

        // Check for specific attributes that indicate non-text content
        if (
          currentElement.hasAttribute("contenteditable") ||
          currentElement.hasAttribute("data-chart") ||
          currentElement.hasAttribute("data-visualization") ||
          currentElement.hasAttribute("data-interactive")
        ) {
          return true;
        }

        currentElement = currentElement.parentElement;
      }
      return false;
    };

    // Resolve nested values by path like "a.b[0].c"
    const getValueByPath = (obj: any, path: string): any => {
      if (!obj || !path) return undefined;
      const tokens = path
        .replace(/\[(\d+)\]/g, ".$1")
        .split(".")
        .filter(Boolean);
      let current: any = obj;
      for (const token of tokens) {
        if (current == null) return undefined;
        current = current[token as keyof typeof current];
      }
      return current;
    };

    // Helper function to get only direct text content (not from children)
    const getDirectTextContent = (element: HTMLElement): string => {
      let text = "";
      const childNodes = Array.from(element.childNodes);
      for (const node of childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent || "";
        }
      }
      return text;
    };

    // Helper function to check if element has child elements with text
    const hasTextChildren = (element: HTMLElement): boolean => {
      const children = Array.from(element.children) as HTMLElement[];
      return children.some((child) => {
        const childText = getDirectTextContent(child).trim();
        return childText.length > 1;
      });
    };

    // Helper function to determine if element should be skipped
    const shouldSkipElement = (element: HTMLElement): boolean => {
      // Skip form elements
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(element.tagName)) {
        return true;
      }

      // Skip elements with certain roles or types
      if (
        element.hasAttribute("role") ||
        element.hasAttribute("aria-label") ||
        element.hasAttribute("data-testid")
      ) {
        return true;
      }

      // Skip elements that contain interactive content (simplified since we now use isInIgnoredElementTree)
      if (
        element.querySelector(
          "img, svg, button, input, textarea, select, a[href]"
        )
      ) {
        return true;
      }

      // Skip container elements (elements that primarily serve as layout containers)
      const containerClasses = [
        "grid",
        "flex",
        "space-",
        "gap-",
        "container",
        "wrapper",
      ];
      const hasContainerClass = containerClasses.some((cls) =>
        element.className.length > 0 ? element.className.includes(cls) : false
      );
      if (hasContainerClass) return true;

      // Skip very short text that might be UI elements
      const text = getDirectTextContent(element).trim();
      if (text.length < 2) return true;

      // Skip elements that look like numbers or single characters (might be icons/UI)
      // if (/^[0-9]+$/.test(text) || text.length === 1) return true;
      if (text.length <3) return true;

      return false;
    };

    // Helper function to find data path for text content
    const findDataPath = (
      data: any,
      targetText: string,
      path = ""
    ): {
      path: string;
      originalText: string;
    } => {
      if (!data || typeof data !== "object")
        return { path: "", originalText: "" };

      for (const [key, value] of Object.entries(data)) {
        const currentPath = path ? `${path}.${key}` : key;

        if (typeof value === "string" && value.trim() === targetText.trim()) {
          return { path: currentPath, originalText: value };
        }

        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            const result = findDataPath(
              value[i],
              targetText,
              `${currentPath}[${i}]`
            );
            if (result.path) return result;
          }
        } else if (typeof value === "object" && value !== null) {
          const result = findDataPath(value, targetText, currentPath);
          if (result.path) return result;
        }
      }
      return { path: "", originalText: "" };
    };


  if (isolated) {
    return <div ref={containerRef} className="tiptap-text-replacer w-full h-full" />;
  }

  return (
    <div ref={containerRef} className="tiptap-text-replacer">
      {children}
    </div>
  );
};

export default TiptapTextReplacer;
