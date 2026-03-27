import React from "react";
import * as z from "zod";
import { ImageSchema } from "../defaultSchemes";

export const layoutId = "metrics-with-description-image";
export const layoutName = "Metrics With Description and Image Slide Layout";
export const layoutDescription =
  "Metrics with description slide layout with an image as whole for the slide";

const marketSizeSlideSchema = z.object({
  title: z.string().min(3).max(15).default("市場規模").meta({
    description: "Main slide title",
  }),


  mapImage: ImageSchema.default({
    __image_url__:
      "https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg", // You can quickly find a world map image via a Google search or use a free resource like Wikimedia Commons
    __image_prompt__: "World map with location pins or points",
  }),
  marketStats: z
    .array(
      z.object({
        label: z.string().min(3).max(30),
        value: z.string().min(3).max(30),
        description: z.string().min(3).max(130),
      }),
    )
    .min(1)
    .max(4)
    .default([
      {
        label: "ターゲット市場規模（TAM）",
        value: "14億",
        description:
          "TAMのセクションでは、提供物を購入できる潜在的な人数や、企業が提供物を販売することで得られる最大収益を記入できます。",
      },
      {
        label: "サービス提供可能市場（SAM）",
        value: "1億9400万",
        description:
          "製品の種類、利用可能な技術、地理的条件を考慮して、企業のターゲット市場となる可能性のあるTAMの一部です。",
      },
      {
        label: "ターゲット市場規模（TAM）",
        value: "14億",
        description:
          "TAMのセクションでは、提供物を購入できる潜在的な人数や、企業が提供物を販売することで得られる最大収益を記入できます。",
      },
      {
        label: "サービス提供可能市場（SAM）",
        value: "1億9400万",
        description:
          "製品の種類、利用可能な技術、地理的条件を考慮して、企業のターゲット市場となる可能性のあるTAMの一部です。",
      }
    ])
    .meta({
      description:
        "Market statistics including TAM, SAM, and SOM with labels, values, and descriptions.",
    }),
  description: z
    .string()
    .default(
      "市場規模とは、ステークホルダーが直接確認できるすべての売上と顧客の合計です。この指標は通常年末に算出され、企業が将来の市場とビジネスの可能性を判断するために活用されます。特に新規企業にとって、サービスに興味を持つ顧客へのアプローチに非常に役立ちます。",
    )
    .meta({
      description: "Main description text for the slide",
    }),
});

export const Schema = marketSizeSlideSchema;
export type MarketSizeSlideData = z.infer<typeof marketSizeSlideSchema>;

interface MarketSizeSlideProps {
  data?: Partial<MarketSizeSlideData>;
}

const MarketSizeSlideLayout: React.FC<MarketSizeSlideProps> = ({
  data: slideData,
}) => {
  const stats = slideData?.marketStats || [];

  return (
    <>
      {/* Montserrat Font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap"
        rel="stylesheet"
      />

      <div
        className="w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video relative z-20 mx-auto overflow-hidden"
        style={{
          fontFamily: "var(--heading-font-family,Montserrat)",
          backgroundColor: 'var(--background-color, #FFFFFF)'
        }}
      >
        {/* Header */}
        {((slideData as any)?.__companyName__ || (slideData as any)?._logo_url__) && (
          <div className="absolute top-0 left-0 right-0 px-8 sm:px-12 lg:px-20 pt-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">

                {(slideData as any)?._logo_url__ && <img src={(slideData as any)?._logo_url__} alt="logo" className="w-6 h-6" />}
                {(slideData as any)?.__companyName__ && <span className="text-sm sm:text-base font-semibold" style={{ color: 'var(--background-text, #111827)' }}>
                  {(slideData as any)?.__companyName__ || 'Company Name'}
                </span>}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex h-full px-16 pb-16">
          {/* Title and Map on the left */}
          <div className="flex flex-col items-center justify-center w-[48%] pr-8 h-full">
            <div className="flex flex-col items-left justify-center h-full w-full">
              {/* Move the title down to align with the top of the market stats */}
              <h1
                className="text-5xl font-bold mb-8 leading-tight text-left"
                style={{ color: 'var(--background-text, #1E4CD9)' }}>
                {slideData?.title || "市場規模"}
              </h1>
              <div className="w-full bg-[#CBE3CC] rounded-md mb-8 flex items-center justify-center">
                {slideData?.mapImage?.__image_url__ && (
                  <img
                    src={slideData?.mapImage?.__image_url__}
                    alt="Market World Map with Points"
                    className="w-full object-contain rounded-md"
                    style={{ maxHeight: 220 }}
                  />
                )}
              </div>
              {slideData?.description && (
                <p className="text-sm leading-relaxed font-normal mb-12 max-w-lg text-left" style={{ color: 'var(--background-text, #234CD9)' }}>
                  {slideData?.description}
                </p>
              )}
            </div>
          </div>

          {/* Market Stats on the right - vertically centered */}
          <div className="flex flex-col items-start justify-center w-[52%] gap-8">
            <div className="w-full space-y-10">
              {stats.map((stat, index) => (
                <div key={index}>
                  <div className="space-y-2">
                    <div className="text-white text-sm font-semibold px-3 py-1 inline-block rounded-sm" style={{ backgroundColor: 'var(--primary-color, #234CD9)', color: 'var(--primary-text, #ffffff)' }}>
                      <span className="text-sm">{stat.label}</span>
                    </div>
                    <div className="text-2xl font-bold" style={{ color: 'var(--primary-color, #1E4CD9)' }}>
                      {stat.value}
                    </div>
                  </div>
                  <p className="text-sm leading-snug" style={{ color: 'var(--background-text, #334155)' }}>
                    {stat.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MarketSizeSlideLayout;
