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
    footerWebsite: z.string().max(30).describe('The website URL displayed in the footer').default('www.hello.com'),
});

export const layoutId = 'title-description-bullet-list';
export const layoutName = 'Title Description Bullet List';
export const layoutDescription = 'A clean two-column layout with a main title and description on the left, and up to 5 bullet points on the right. Each bullet has a heading and a short description. Ideal for key takeaways, feature highlights, or structured lists with context.';

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, description, bullets, footerWebsite } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div
                className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden text-[#101828]"
                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Albert Sans)',
                }}
            >
                {/* Top diamond */}
                <div className="absolute left-[65.3px] top-[175.5px] w-[17.6px] h-[17.6px]">
                    <svg viewBox="0 0 17.6 17.6" className="w-full h-full">
                        <path d="M 8.8 0.0 L 17.6 8.8 L 8.8 17.6 L 0.0 8.8 L 8.8 0.0 Z" fill="#4D5463" style={{ fill: 'var(--background-text,#4D5463)' }} />
                    </svg>
                </div>

                {/* Main content */}
                <div className="flex h-full w-full px-[72px] gap-[60px]">
                    {/* Left: title + description */}
                    <div className="flex flex-col basis-[45%] pt-[190px] pb-[90px]">
                        <h1
                            className="text-[42.7px] font-bold leading-[1.1] tracking-[-1.6px] mb-[28px]"
                            style={{ color: 'var(--background-text,#000000)' }}
                        >
                            {title}
                        </h1>
                        <p
                            className="text-[16px] leading-[1.78]"
                            style={{ color: 'var(--background-text,#000000)' }}
                        >
                            {description}
                        </p>
                    </div>

                    {/* Right: bullet list */}
                    <div className="flex flex-col basis-[55%] justify-center">
                        <div className="flex flex-col w-full max-w-[450px] ml-auto">
                            {bullets?.map((item, index) => (
                                <div key={index} className="relative">
                                    <div className="w-full h-[1px] bg-[#DCE2FA]" style={{ backgroundColor: 'var(--stroke,#DCE2FA)' }} />
                                    <div className="flex gap-[20px] py-[20px] items-start">
                                        <div className="flex-shrink-0 w-[8px] h-[8px] rounded-full mt-[8px] bg-[#4D5463]" style={{ backgroundColor: 'var(--background-text,#4D5463)' }} />
                                        <div className="flex flex-col">
                                            <h3 className="text-[20.6px] font-bold mb-[4px]" style={{ color: 'var(--background-text,#000000)' }}>
                                                {item.heading}
                                            </h3>
                                            <p className="text-[13.2px] leading-[1.4]" style={{ color: 'var(--background-text,#4D5463)' }}>
                                                {item.description}
                                            </p>
                                        </div>
                                    </div>
                                    {index === (bullets?.length ?? 0) - 1 && (
                                        <div className="w-full h-[1px] bg-[#DCE2FA]" style={{ backgroundColor: 'var(--stroke,#DCE2FA)' }} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="absolute bottom-[20px] left-[72px] right-[72px] flex items-center gap-[20px]">
                    <div className="text-[16px] min-w-fit" style={{ color: 'var(--background-text,#000000)' }}>{footerWebsite}</div>
                    <div className="h-[2.7px] flex-grow bg-[#55626E]" style={{ backgroundColor: 'var(--background-text,#55626E)' }} />
                    <div className="w-[58.1px] h-[58.1px]">
                        <svg viewBox="0 0 58.1 58.1" className="w-full h-full">
                            <path d="M 29.1 0.0 L 58.1 29.1 L 29.1 58.1 L 0.0 29.1 L 29.1 0.0 Z" fill="#4D5463" style={{ fill: 'var(--background-text,#4D5463)' }} />
                        </svg>
                    </div>
                </div>
            </div>
        </>
    );
};

export default dynamicSlideLayout;
