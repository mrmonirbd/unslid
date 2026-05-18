import React, { useEffect, useMemo, useRef, useState } from 'react'

import { V1ContentRender } from '../../(presentation-generator)/components/V1ContentRender';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';

const ASPECT_RATIO_VALUES: Record<string, { width: number; height: number; css: string }> = {
    "16:9": { width: 1280, height: 720, css: "16 / 9" },
    "4:3": { width: 1024, height: 768, css: "4 / 3" },
    "9:16": { width: 720, height: 1280, css: "9 / 16" },
    "1:1": { width: 1080, height: 1080, css: "1 / 1" },
    A4: { width: 1240, height: 1754, css: "1240 / 1754" },
};

const SlideScale = ({ slide }: { slide: any }) => {

    const containerRef = useRef<HTMLDivElement | null>(null);
    const [containerWidth, setContainerWidth] = useState<number>(0);
    const theme = useSelector(
        (state: RootState) => state.presentationGeneration.presentationData?.theme
    ) as any;
    const ratio = ASPECT_RATIO_VALUES[theme?.aspect_ratio || "16:9"] || ASPECT_RATIO_VALUES["16:9"];

    const scale = useMemo(() => {
        // Slight padding to avoid overflow due to borders/scrollbars
        const safeWidth = Math.max(0, containerWidth + 20);
        if (!safeWidth) return 1;
        return Math.min((safeWidth / ratio.width) * 0.98, 1);
    }, [containerWidth, ratio.width]);

    useEffect(() => {
        if (!containerRef.current) return;

        const el = containerRef.current;
        const ro = new ResizeObserver(() => {
            // Use clientWidth so we match the actual available column width
            setContainerWidth(el.clientWidth);
        });

        ro.observe(el);
        // Initial measure
        setContainerWidth(el.clientWidth);

        return () => ro.disconnect();
    }, []);
    return (<div
        ref={containerRef}
        className="relative w-full  shadow-md"
    >
        <div
            className="relative mx-auto max-w-[1280px] "
            style={{ height: `${ratio.height * scale}px`, overflow: "hidden", aspectRatio: ratio.css }}
        >
            <div
                className="absolute top-0 left-0"
                style={{
                    width: ratio.width,
                    height: ratio.height,
                    transformOrigin: "top left",
                    transform: `scale(${scale})`,
                }}
            >

                <div
                    className="relative w-full h-full"
                    data-slide-thumbnail={slide.id}
                    data-testid="slide-content"
                >

                    <div
                        className="absolute inset-0 bg-transparent z-30 w-full h-full pointer-events-none"
                        aria-hidden="true"

                    />
                    <style>
                        {`
                            [data-slide-thumbnail="${slide.id}"] [data-slide-content="true"],
                            [data-slide-thumbnail="${slide.id}"] [data-slide-content="true"] > *,
                            [data-slide-thumbnail="${slide.id}"] [data-slide-content="true"] > * > *,
                            [data-slide-thumbnail="${slide.id}"] [data-slide-content="true"] > * > * > * {
                                width: 100% !important;
                                height: 100% !important;
                                max-width: none !important;
                                max-height: none !important;
                            }

                            [data-slide-thumbnail="${slide.id}"] [data-slide-content="true"] > * > * > * {
                                aspect-ratio: auto !important;
                            }
                        `}
                    </style>
                    <V1ContentRender slide={slide} isEditMode={true} theme={theme} />
                </div>


            </div>
        </div>
    </div>
    )
}

export default SlideScale
