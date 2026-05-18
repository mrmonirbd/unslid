import React, { useEffect, useState } from "react";
import { Loader2, PlusIcon, Pencil, Trash, MessageSquare, CheckCircle2, Reply, X, Video } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";
import ToolTip from "@/components/ToolTip";
import { RootState } from "@/store/store";
import { useDispatch, useSelector } from "react-redux";
import {
  deletePresentationSlide,
  updateSlide,
} from "@/store/slices/presentationGeneration";
import { usePathname } from "next/navigation";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { addToHistory } from "@/store/slices/undoRedoSlice";
import { V1ContentRender } from "../../components/V1ContentRender";
import NewSlide from "./NewSlide";

interface SlideContentProps {
  slide: any;
  index: number;
  presentationId: string;
  theme?: any;
}

const ASPECT_RATIO_VALUES: Record<string, string> = {
  "16:9": "16 / 9",
  "4:3": "4 / 3",
  "9:16": "9 / 16",
  "1:1": "1 / 1",
  A4: "1240 / 1754",
};

const SlideContent = ({ slide, index, presentationId, theme }: SlideContentProps) => {
  const dispatch = useDispatch();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showNewSlideSelection, setShowNewSlideSelection] = useState(false);
  const [isEditPopoverOpen, setIsEditPopoverOpen] = useState(false);
  const [isSpeakerPopoverOpen, setIsSpeakerPopoverOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [noteText, setNoteText] = useState(slide?.speaker_note ?? "");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [commentSaving, setCommentSaving] = useState(false);
  const [isElementEditOpen, setIsElementEditOpen] = useState(false);
  const [elementEditPath, setElementEditPath] = useState("");
  const [elementEditPrompt, setElementEditPrompt] = useState("");
  const [elementEditing, setElementEditing] = useState(false);
  const [isEmbedOpen, setIsEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState("");
  const { presentationData, isStreaming } = useSelector(
    (state: RootState) => state.presentationGeneration
  );
  const aspectRatioKey = theme?.aspect_ratio || "16:9";
  const slideAspectRatio = ASPECT_RATIO_VALUES[aspectRatioKey] || ASPECT_RATIO_VALUES["16:9"];

  useEffect(() => {
    setNoteText(slide?.speaker_note ?? "");
  }, [slide?.speaker_note]);

  const pathname = usePathname();

  const handleSubmit = async () => {
    if (!editPrompt.trim()) {
      toast.error("Please enter a prompt before submitting");
      return;
    }
    setIsUpdating(true);

    try {
      trackEvent(MixpanelEvent.Slide_Update_From_Prompt_Button_Clicked, { pathname });
      trackEvent(MixpanelEvent.Slide_Edit_API_Call);
      const response = await PresentationGenerationApi.editSlide(
        slide.id,
        editPrompt
      );

      if (response) {
        dispatch(updateSlide({ index: slide.index, slide: response }));
        toast.success("Slide updated successfully");
        setEditPrompt("");
      }
    } catch (error: any) {
      console.error("Error in slide editing:", error);
      toast.error("Error in slide editing.", {
        description: error.message || "Error in slide editing.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveNote = async () => {
    if (noteText === (slide?.speaker_note ?? "")) return;
    setIsSavingNote(true);
    try {
      await PresentationGenerationApi.updateSlideNote(slide.id, noteText);
      dispatch(updateSlide({ index: slide.index, slide: { ...slide, speaker_note: noteText } }));
    } catch {
      toast.error("Failed to save speaker note");
    } finally {
      setIsSavingNote(false);
    }
  };

  const loadComments = async () => {
    try {
      const { getHeader } = await import("../../services/api/header");
      const res = await fetch(`/api/v1/ppt/presentation/${presentationId}/comments`, {
        headers: await getHeader(),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        setComments(data.filter((c: any) => c.slide_index === slide.index));
      }
    } catch {}
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setCommentSaving(true);
    try {
      const { getHeader } = await import("../../services/api/header");
      const res = await fetch(`/api/v1/ppt/presentation/${presentationId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getHeader()) },
        body: JSON.stringify({ slide_index: slide.index, body: newComment.trim(), parent_id: replyTo }),
      });
      const data = await res.json();
      setComments((prev) => [...prev, data]);
      setNewComment("");
      setReplyTo(null);
    } finally {
      setCommentSaving(false);
    }
  };

  const handleResolveComment = async (commentId: number) => {
    const { getHeader } = await import("../../services/api/header");
    await fetch(`/api/v1/ppt/presentation/${presentationId}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await getHeader()) },
      body: JSON.stringify({ resolved: true }),
    });
    setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, resolved: true } : c));
  };

  const getTextPaths = (obj: any, prefix = ""): string[] => {
    if (!obj || typeof obj !== "object") return [];
    const paths: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string" && !k.startsWith("__") && !path.includes("color") && !path.includes("font") && !path.includes("image") && !path.includes("icon") && !path.includes("url") && v.length > 3) {
        paths.push(path);
      } else if (Array.isArray(v)) {
        v.forEach((item, i) => {
          if (typeof item === "string" && item.length > 3) paths.push(`${path}.${i}`);
          else if (typeof item === "object") paths.push(...getTextPaths(item, `${path}.${i}`));
        });
      } else if (typeof v === "object") {
        paths.push(...getTextPaths(v, path));
      }
    }
    return paths;
  };

  const handleElementEdit = async () => {
    if (!elementEditPath || !elementEditPrompt.trim()) return;
    setElementEditing(true);
    try {
      const { getHeader } = await import("../../services/api/header");
      const res = await fetch("/api/v1/ppt/slide/edit-element", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getHeader()) },
        body: JSON.stringify({
          slide_id: slide.id,
          element_path: elementEditPath,
          prompt: elementEditPrompt.trim(),
          element_type: "text",
        }),
      });
      const data = await res.json();
      if (data.updated_content) {
        const updatedSlide = { ...slide, content: data.updated_content, id: data.id || slide.id };
        dispatch(updateSlide({ index: slide.index, slide: updatedSlide }));
        toast.success("Element updated");
        setIsElementEditOpen(false);
        setElementEditPrompt("");
      } else {
        toast.error("Failed to update element");
      }
    } catch {
      toast.error("Error updating element");
    } finally {
      setElementEditing(false);
    }
  };

  const handleAddEmbed = () => {
    if (!embedUrl.trim()) return;
    const updatedSlide = {
      ...slide,
      content: { ...slide.content, __embed__: { type: "embed", url: embedUrl.trim() } },
    };
    // Dispatch to Redux — auto-save will persist the change
    dispatch(updateSlide({ index: slide.index, slide: updatedSlide }));
    setIsEmbedOpen(false);
    setEmbedUrl("");
    toast.success("Embed added — it will be saved automatically");
  };

  const handleRemoveEmbed = () => {
    const { __embed__, ...restContent } = slide.content || {};
    const updatedSlide = { ...slide, content: restContent };
    dispatch(updateSlide({ index: slide.index, slide: updatedSlide }));
    toast.success("Embed removed");
  };

  const onDeleteSlide = async () => {
    try {
      trackEvent(MixpanelEvent.Slide_Delete_Slide_Button_Clicked, { pathname });
      trackEvent(MixpanelEvent.Slide_Delete_API_Call);
      // Add current state to past
      dispatch(addToHistory({
        slides: presentationData?.slides,
        actionType: "DELETE_SLIDE"
      }));
      dispatch(deletePresentationSlide(slide.index));

    } catch (error: any) {
      console.error("Error deleting slide:", error);
      toast.error("Error deleting slide.", {
        description: error.message || "Error deleting slide.",
      });
    }
  };
  // Scroll to the new slide when streaming and new slides are being generated
  useEffect(() => {
    if (
      presentationData &&
      presentationData?.slides &&
      presentationData.slides.length > 1 &&
      isStreaming
    ) {
      // Scroll to the last slide (newly generated during streaming)
      const lastSlideIndex = presentationData.slides.length - 1;
      const slideElement = document.getElementById(
        `slide-${presentationData.slides[lastSlideIndex].index}`
      );
      if (slideElement) {
        slideElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [presentationData?.slides?.length, isStreaming]);



  useEffect(() => {

    if (slide.layout.includes("custom")) {

      const existingScript = document.querySelector(
        'script[src*="tailwindcss.com"]'
      );
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://cdn.tailwindcss.com";
        script.async = true;
        document.head.appendChild(script);
      }
    }
  }, [slide, isStreaming]);

  return (
    <>
      <div
        id={`slide-${slide.index}`}
        data-speaker-note={slide.speaker_note ?? ""}
        data-slide-index={slide.index}
        className=" w-full  main-slide flex items-center max-md:mb-4  justify-center relative"
      >
        {isStreaming && (
          <Loader2 className="w-8 h-8 absolute right-2 top-2 z-30 text-blue-800 animate-spin" />
        )}
        <div
          data-layout={slide.layout}
          data-group={slide.layout_group}
          className="slide-aspect-canvas w-full group font-syne"
          style={{ aspectRatio: slideAspectRatio }}
        >
          <style>
            {`
              #slide-${slide.index} .slide-aspect-canvas [data-slide-content="true"],
              #slide-${slide.index} .slide-aspect-canvas [data-slide-content="true"] > *,
              #slide-${slide.index} .slide-aspect-canvas [data-slide-content="true"] > * > *,
              #slide-${slide.index} .slide-aspect-canvas [data-slide-content="true"] > * > * > * {
                width: 100% !important;
                height: 100% !important;
                max-width: none !important;
                max-height: none !important;
              }

              #slide-${slide.index} .slide-aspect-canvas [data-slide-content="true"] > * > * > * {
                aspect-ratio: auto !important;
              }
            `}
          </style>
          <V1ContentRender slide={slide} isEditMode={true} theme={theme} />
          {!showNewSlideSelection && (
            <div className="group-hover:opacity-100 hidden md:block opacity-0 transition-opacity my-4 duration-300">
              <ToolTip content="Add new slide below">
                {!isStreaming && (
                  <div
                    onClick={() => {
                      trackEvent(MixpanelEvent.Slide_Add_New_Slide_Button_Clicked, { pathname });
                      setShowNewSlideSelection(true);
                    }}
                    className="  bg-white shadow-md w-[80px] py-2 border hover:border-[#5141e5] duration-300  flex items-center justify-center rounded-lg cursor-pointer mx-auto"
                  >
                    <PlusIcon className="text-gray-500 text-base cursor-pointer" />
                  </div>
                )}
              </ToolTip>
            </div>
          )}
          {showNewSlideSelection && (
            <NewSlide
              index={index}
              templateID={slide.layout.includes(":") ? slide.layout.split(":")[0] : slide.layout_group}
              setShowNewSlideSelection={setShowNewSlideSelection}
              presentationId={presentationId}
            />
          )}

          {!isStreaming && (
            <div
              className={`absolute right-3 top-3 z-30 hidden md:flex flex-row items-center gap-2 rounded-[28px] border border-gray-200/80 bg-white/95 px-2.5 py-2 ${isEditPopoverOpen || isSpeakerPopoverOpen
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
                }`}
              style={{
                boxShadow: "0 2px 13.2px 0 rgba(0, 0, 0, 0.10)"
              }}
            >
              <Popover open={isEditPopoverOpen} onOpenChange={setIsEditPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex px-3.5 py-2.5 items-center justify-center rounded-full bg-[#F7F6F9] font-syne"
                  >
                    <ToolTip content="Update slide using prompt">
                      <Pencil className="h-4 w-4" />
                    </ToolTip>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="center"
                  sideOffset={12}
                  className="z-30 w-[340px] rounded-2xl border border-gray-200 bg-white p-0 shadow-2xl font-syne"
                >
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">Update slide</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Describe how this slide should be improved.
                    </p>
                  </div>
                  <form
                    className="flex flex-col gap-3 p-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSubmit();
                    }}
                  >
                    <Textarea
                      id={`slide-${slide.index}-prompt`}
                      value={editPrompt}
                      placeholder="Enter your prompt here..."
                      className="min-h-[110px] max-h-[180px] w-full resize-none rounded-xl border border-gray-200 p-3 text-sm focus-visible:ring-1 focus-visible:ring-[#5141e5]"
                      disabled={isUpdating}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      rows={5}
                      wrap="soft"
                    />
                    <button
                      disabled={isUpdating}
                      type="submit"
                      className={`ml-auto flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#9034EA] to-[#5146E5] px-4 py-2 text-sm font-medium text-white transition-opacity ${isUpdating ? "cursor-not-allowed opacity-70" : "hover:opacity-90"}`}
                    >
                      {isUpdating ? "Updating..." : "Update"}
                      <SendHorizontal className="h-4 w-4" />
                    </button>
                  </form>
                </PopoverContent>
              </Popover>

              <Popover open={isSpeakerPopoverOpen} onOpenChange={setIsSpeakerPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    style={{
                      background: "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)",

                    }}
                    className={`flex px-4 py-2.5 items-center justify-center rounded-full border font-syne ${slide?.speaker_note
                      ? "border-violet-200 bg-violet-50 text-violet-700"
                      : "border-gray-200 bg-white text-gray-600"
                      }`}
                  >
                    <ToolTip content="Edit speaker notes">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M5.13334 11.6665V9.27482L6.24167 9.39149C6.56434 9.37356 6.86969 9.23977 7.1016 9.01472C7.33351 8.78966 7.4764 8.48847 7.50401 8.16649V4.84149C7.50787 4.0011 7.17774 3.1936 6.58624 2.59663C5.99473 1.99965 5.1903 1.6621 4.34992 1.65824C3.50954 1.65437 2.70204 1.9845 2.10506 2.57601C1.50809 3.16751 1.17054 3.97194 1.16667 4.81232C1.16667 6.44565 1.54934 6.59382 1.75001 7.46649C1.88562 7.99351 1.89143 8.54556 1.76692 9.07532L1.16667 11.6665" stroke="black" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M11.55 10.3833C12.3701 9.56317 12.8309 8.45095 12.8312 7.29115C12.8316 6.13134 12.3714 5.01886 11.5518 4.19824" stroke="black" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M9.91667 8.74974C10.1075 8.55893 10.2586 8.33217 10.3613 8.08258C10.464 7.83299 10.5161 7.56553 10.5148 7.29566C10.5134 7.02578 10.4586 6.75885 10.3534 6.51031C10.2482 6.26177 10.0948 6.03654 9.90208 5.84766" stroke="black" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </ToolTip>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="center"
                  sideOffset={12}
                  className="z-30 w-[340px] rounded-2xl border border-gray-200 bg-white p-0 shadow-2xl font-syne"
                >
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">Speaker notes</p>
                    <p className="mt-0.5 text-xs text-gray-500">Click outside the text box to auto-save</p>
                  </div>
                  <div className="space-y-3 p-4">
                    <Textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onBlur={handleSaveNote}
                      placeholder="Add speaker notes for this slide…"
                      className="max-h-[220px] min-h-[100px] w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 focus-visible:ring-1 focus-visible:ring-[#5141e5]"
                      disabled={isSavingNote}
                    />
                    <button
                      onClick={handleSaveNote}
                      disabled={isSavingNote || noteText === (slide?.speaker_note ?? "")}
                      className="ml-auto flex items-center gap-2 rounded-full bg-gradient-to-r from-[#9034EA] to-[#5146E5] px-4 py-2 text-xs font-medium text-white transition-opacity disabled:opacity-50"
                    >
                      {isSavingNote ? "Saving…" : "Save"}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* AI Element Edit */}
              <Popover open={isElementEditOpen} onOpenChange={setIsElementEditOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex px-3.5 py-2.5 items-center justify-center rounded-full bg-[#F7F6F9] font-syne"
                  >
                    <ToolTip content="Edit specific element with AI">
                      <span className="text-xs font-bold text-slate-500">AI</span>
                    </ToolTip>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="center"
                  sideOffset={12}
                  className="z-30 w-[320px] rounded-2xl border border-gray-200 bg-white p-0 shadow-2xl font-syne"
                >
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">Edit element with AI</p>
                    <p className="text-xs text-gray-500 mt-0.5">Choose a text field and describe the change.</p>
                  </div>
                  <div className="p-4 space-y-3">
                    <select
                      value={elementEditPath}
                      onChange={(e) => setElementEditPath(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#5141e5]"
                    >
                      <option value="">Select a text field…</option>
                      {getTextPaths(slide?.content || {}).map((path) => (
                        <option key={path} value={path}>{path}</option>
                      ))}
                    </select>
                    <Textarea
                      value={elementEditPrompt}
                      onChange={(e) => setElementEditPrompt(e.target.value)}
                      placeholder="e.g. Make this shorter, or more formal…"
                      className="min-h-[80px] resize-none text-sm"
                      disabled={elementEditing}
                    />
                    <button
                      onClick={handleElementEdit}
                      disabled={elementEditing || !elementEditPath || !elementEditPrompt.trim()}
                      className="w-full flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#9034EA] to-[#5146E5] px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
                    >
                      {elementEditing ? "Editing…" : "Edit element"}
                      <SendHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Embed media */}
              <Popover open={isEmbedOpen} onOpenChange={setIsEmbedOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex px-3.5 py-2.5 items-center justify-center rounded-full bg-[#F7F6F9] font-syne"
                  >
                    <ToolTip content={slide.content?.__embed__ ? "Change or remove embed" : "Embed video"}>
                      <Video className={`h-4 w-4 ${slide.content?.__embed__ ? "text-purple-500" : ""}`} />
                    </ToolTip>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="center"
                  sideOffset={12}
                  className="z-30 w-[320px] rounded-2xl border border-gray-200 bg-white p-0 shadow-2xl font-syne"
                >
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">Embed video</p>
                    <p className="text-xs text-gray-500 mt-0.5">YouTube, Loom, or Vimeo URL</p>
                  </div>
                  <div className="p-4 space-y-3">
                    {slide.content?.__embed__ && (
                      <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                        <p className="text-xs text-purple-700 truncate">{slide.content.__embed__.url}</p>
                        <button onClick={handleRemoveEmbed} className="text-purple-400 hover:text-red-400 ml-2">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <input
                      value={embedUrl}
                      onChange={(e) => setEmbedUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#5141e5]"
                    />
                    <button
                      onClick={handleAddEmbed}
                      disabled={!embedUrl.trim()}
                      className="w-full flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#9034EA] to-[#5146E5] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {slide.content?.__embed__ ? "Update embed" : "Add embed"}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Comments button */}
              <button
                type="button"
                onClick={() => { setShowComments(true); loadComments(); }}
                className="relative flex px-4 py-2.5 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 font-syne"
              >
                <ToolTip content="Slide comments">
                  <MessageSquare className="h-4 w-4" />
                </ToolTip>
                {comments.filter(c => !c.resolved).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                    {comments.filter(c => !c.resolved).length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={onDeleteSlide}
                className="flex px-4 py-2.5 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 font-syne"
              >
                <ToolTip content="Delete slide">
                  <Trash className="h-4 w-4" />
                </ToolTip>
              </button>
            </div>
          )}
        </div>

        {/* Comments panel (slide-over) */}
        {showComments && (
          <div className="fixed inset-0 z-[200] flex" onClick={() => setShowComments(false)}>
            <div className="flex-1" />
            <div
              className="w-80 bg-white h-full flex flex-col shadow-2xl border-l border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <span className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-500" />
                  Slide {slide.index + 1} comments
                </span>
                <button onClick={() => setShowComments(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {comments.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">No comments yet for this slide.</p>
                )}
                {comments.filter(c => !c.parent_id).map((comment) => (
                  <div key={comment.id} className={`rounded-xl border p-3 ${comment.resolved ? "border-slate-100 opacity-60" : "border-slate-200"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-slate-700">{comment.user_name}</p>
                        <p className="text-sm text-slate-800 mt-0.5">{comment.body}</p>
                        <p className="text-xs text-slate-400 mt-1">{new Date(comment.created_at).toLocaleString()}</p>
                      </div>
                      {!comment.resolved && (
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => setReplyTo(comment.id)} className="text-slate-400 hover:text-indigo-500" title="Reply">
                            <Reply className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleResolveComment(comment.id)} className="text-slate-400 hover:text-green-500" title="Mark resolved">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      {comment.resolved && <span className="text-xs text-green-600 shrink-0">Resolved</span>}
                    </div>
                    {/* Replies */}
                    {comments.filter(r => r.parent_id === comment.id).map((reply) => (
                      <div key={reply.id} className="mt-2 ml-4 border-l-2 border-indigo-100 pl-3">
                        <p className="text-xs font-semibold text-slate-600">{reply.user_name}</p>
                        <p className="text-sm text-slate-700">{reply.body}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="px-4 py-3 border-t border-slate-200 space-y-2">
                {replyTo && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    Replying to comment
                    <button onClick={() => setReplyTo(null)} className="ml-1 text-slate-400 hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </p>
                )}
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment…"
                  className="min-h-[60px] resize-none text-sm"
                  disabled={commentSaving}
                />
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || commentSaving}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
                >
                  {commentSaving ? "Posting…" : "Post comment"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SlideContent;
