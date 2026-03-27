import React from "react"
import * as z from "zod"

const layoutId = "SwiftTableOfContents"
const layoutName = "Table Of Contents"
const layoutDescription = "Swift: Table of contents with up to 10 items (title + description)"

const ToCItemSchema = z
  .object({
    title: z.string().min(3).max(40).default("はじめに"),
    description: z
      .string()
      .min(0)
      .max(60)
      .default("セクションの簡単な概要。"),
  })
  .default({ title: "はじめに", description: "セクションの簡単な概要。" })

const Schema = z
  .object({
    title: z
      .string()
      .min(3)
      .max(60)
      .default("目次"),
    items: z
      .array(ToCItemSchema)
      .min(1)
      .max(10)
      .default([
        { title: "はじめに", description: "会社と目標の簡単な説明。" },
        { title: "チーム", description: "リーダーシップとコアメンバー。" },
        { title: "タイムライン", description: "高レベルの実行計画とマイルストーン。" },
        { title: "推奨事項", description: "初期要件に基づく重要な提案。" },
        { title: "解決策", description: "私たちの提案とその有効性。" },
        { title: "市場", description: "対象者、セグメント、機会の規模。" },
        { title: "ビジネスモデル", description: "価値の創出と獲得の方法。" },
        { title: "まとめ", description: "締めくくりと次のステップ。" },
        { title: "ビジネスモデル", description: "価値の創出と獲得の方法。" },
        { title: "まとめ", description: "締めくくりと次のステップ。" },
      ]),
    website: z.string().min(6).max(60).default("www.yourwebsite.com"),
  })
  .default({
    title: "目次",
    items: [
      { title: "はじめに", description: "会社と目標の簡単な説明。" },
      { title: "チーム", description: "リーダーシップとコアメンバー。" },
      { title: "タイムライン", description: "高レベルの実行計画とマイルストーン。" },
      { title: "推奨事項", description: "初期要件に基づく重要な提案。" },
      { title: "解決策", description: "私たちの提案とその有効性。" },
      { title: "市場", description: "対象者、セグメント、機会の規模。" },
      { title: "ビジネスモデル", description: "価値の創出と獲得の方法。" },
      { title: "まとめ", description: "締めくくりと次のステップ。" },
      { title: "ビジネスモデル", description: "価値の創出と獲得の方法。" },
      { title: "まとめ", description: "締めくくりと次のステップ。" },

    ],
    website: "www.yourwebsite.com",
  })

type SlideData = z.infer<typeof Schema>

interface SlideLayoutProps {
  data?: Partial<SlideData>
}

const TableOfContents: React.FC<SlideLayoutProps> = ({ data: slideData }) => {
  const items = slideData?.items || []
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <div
        className=" w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video relative z-20 mx-auto overflow-hidden"
        style={{
          fontFamily: "var(--heading-font-family,Albert Sans)",
          backgroundColor: "var(--background-color, #FFFFFF)",
        }}
      >
        {/* Header */}
        <div className="px-12 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rotate-45" style={{ backgroundColor: "var(--background-text, #111827)" }}></div>
            <div className="flex items-center gap-1">

              {(slideData as any)?._logo_url__ && <img src={(slideData as any)?._logo_url__} alt="logo" className="w-6 h-6" />}
              {(slideData as any)?.__companyName__ && <span className="text-[16px]" style={{ color: "var(--background-text, #6B7280)" }}>{(slideData as any)?.__companyName__}</span>}
            </div>
          </div>
        </div>

        <div className="px-12 pt-3">
          <h1 className="text-[48px] leading-[1.1] font-semibold" style={{ color: "var(--background-text, #111827)" }}>{slideData?.title}</h1>
        </div>

        {/* List */}
        <div className="px-12 pt-8">
          <div className="grid grid-cols-2 gap-x-12 gap-y-6 max-w-[1180px]">
            {items.slice(0, 10).map((item, idx) => (
              <div key={idx} className="relative">
                <div className="flex items-start gap-6">
                  <div className="flex-none">
                    <div
                      className="leading-none font-semibold"
                      style={{
                        fontSize: 48,
                        color: "var(--primary-color, #BFF4FF)",
                      }}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 pt-1">
                    <div className="text-[22px] leading-[1.2] font-semibold" style={{ color: "var(--background-text, #111827)" }}>
                      {item.title}
                    </div>
                    {item.description && (
                      <div className="mt-2 text-[14px] leading-[1.6]" style={{ color: "var(--background-text, #6B7280)" }}>
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 h-px" style={{ backgroundColor: "var(--stroke, #E5E7EB)" }}></div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer (standardized like IntroSlideLayout) */}
        <div className="absolute bottom-8 left-12 right-12 flex items-center">
          <span className="text-[14px]" style={{ color: "var(--background-text, #6B7280)" }}>{slideData?.website}</span>
          <div className="ml-6 h-[2px] flex-1" style={{ backgroundColor: "var(--background-text, #111827)" }}></div>
        </div>
        <div className="absolute bottom-7 right-6 w-8 h-8 rotate-45" style={{ backgroundColor: "var(--background-text, #111827)" }}></div>
      </div>
    </>
  )
}

export { Schema, layoutId, layoutName, layoutDescription }
export default TableOfContents


