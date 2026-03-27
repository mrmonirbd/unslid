import * as z from 'zod';
import React from 'react';

export const Schema = z.object({
    title: z.string().max(30).describe('The main title of the slide').default('重要なポイント'),
    description: z.string().max(300).describe('The main paragraph description on the slide').default('金融サービス、ヘルスケア、テクノロジーセクターで500名以上の従業員を持つ企業に注力。アカウントベースのマーケティングとコンテンツ主導の戦略により、CACを$150以下に抑えながら$3.5Mの新規パイプラインを目標とします。'),
    bullets: z.array(z.object({
        heading: z.string().max(40).describe('The heading for this bullet point'),
        description: z.string().max(120).describe('The description for this bullet point'),
    })).max(5).describe('A list of up to 5 bullet points, each with a heading and description').default([
        { heading: '市場拡大', description: '強い需要を持つ高成長分野と地域を優先します。' },
        { heading: '顧客維持', description: '積極的なサポートとカスタマイズされた成功プログラムでチャーンを削減します。' },
        { heading: '製品革新', description: '顧客のリクエストと利用データに合わせた機能を提供します。' },
        { heading: '業務効率化', description: '繰り返しのワークフローを自動化し、戦略的業務に集中できる体制を作ります。' },
        { heading: 'チーム強化', description: 'チームが規模拡大で成果を出せるよう、研修とツールに投資します。' },
    ]),
});

export const layoutId = 'title-description-bullet-list';
export const layoutName = 'Title Description Bullet List';
export const layoutDescription = 'A clean two-column layout with a main title and description on the left, and up to 5 bullet points on the right. Each bullet has a heading and a short description. Ideal for key takeaways, feature highlights, or structured lists with context.';

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, description, bullets } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap"
                rel="stylesheet"
            />
            <div
                className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-white z-20 mx-auto overflow-hidden"
                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Montserrat)',
                }}
            >
                <div className="flex h-full w-full items-center justify-between px-[115px] gap-20">
                    {/* Left Section: Title + Description */}
                    <div className="flex flex-col flex-[1.2] justify-center">
                        {title && (
                            <h1
                                className="text-[42.7px] font-bold mb-6 leading-tight"
                                style={{ letterSpacing: '-1.6px', color: 'var(--background-text,#002BB2)' }}
                            >
                                {title}
                            </h1>
                        )}
                        {description && (
                            <p
                                className="text-[16px] leading-[28.5px] max-w-[475px]"
                                style={{ color: 'var(--background-text,#002BB2)' }}
                            >
                                {description}
                            </p>
                        )}
                    </div>

                    {/* Right Section: Bullet list */}
                    <div className="flex flex-col flex-1 justify-center gap-5">
                        {bullets?.map((item, index) => (
                            <div
                                key={index}
                                className="flex flex-col justify-center px-5 py-4 rounded-[3.4px] border-l-4"
                                style={{
                                    backgroundColor: 'var(--card-color,#F7F8FF)',
                                    borderLeftColor: 'var(--stroke,#4C68DF)',
                                }}
                            >
                                <h3
                                    className="text-[17.5px] font-bold leading-[21px]"
                                    style={{ color: 'var(--background-text,#002BB2)' }}
                                >
                                    {item.heading}
                                </h3>
                                <p
                                    className="text-[15.3px] leading-[18.4px] mt-1"
                                    style={{ color: 'var(--background-text,#002BB2)' }}
                                >
                                    {item.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

export default dynamicSlideLayout;
