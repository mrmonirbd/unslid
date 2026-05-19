import { cn } from "@/lib/utils"
import { ProgressBar } from "./progress-bar"
import { useEffect, useState } from "react"

export interface LoaderTheme {
    name?: string
    accentColor?: string
    secondaryColor?: string
    backgroundColor?: string
    surfaceColor?: string
    foregroundColor?: string
}

interface OverlayLoaderProps {
    text?: string
    className?: string
    show: boolean
    showProgress?: boolean
    duration?: number
    extra_info?: string
    onProgressComplete?: () => void
    theme?: LoaderTheme
}

export const OverlayLoader = ({
    text,
    className,
    show,
    showProgress = false,
    duration = 10,
    onProgressComplete,
    extra_info,
    theme
}: OverlayLoaderProps) => {
    const [isVisible, setIsVisible] = useState(false);
    const accentColor = theme?.accentColor || "#7E3AF2";
    const secondaryColor = theme?.secondaryColor || "#22D3EE";
    const backgroundColor = theme?.backgroundColor || "#09070F";
    const surfaceColor = theme?.surfaceColor || "#111827";
    const foregroundColor = theme?.foregroundColor || "#FFFFFF";

    useEffect(() => {
        if (show) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [show]);

    if (!show) return null;

    return (
        <div
            style={{
                zIndex: 1000
            }}
            className={cn(
                "fixed inset-0 bg-black/70 z-50 flex items-center justify-center transition-opacity duration-300",
                isVisible ? "opacity-100" : "opacity-0"
            )}
        >
            <div
                className={cn(
                    "flex flex-col items-center justify-center px-6 pt-6 pb-8 rounded-xl shadow-2xl",
                    "min-w-[280px] sm:min-w-[330px] border border-white/10 transition-all duration-400 ease-out",
                    isVisible ? "opacity-100 scale-100" : "opacity-0 scale-90",
                    className
                )}
                style={{
                    background: `radial-gradient(circle at 50% 0%, ${accentColor}26, transparent 48%), ${backgroundColor}`,
                    boxShadow: `0 24px 80px ${accentColor}30, inset 0 1px 0 rgba(255,255,255,0.08)`,
                }}

            >
                <div className="relative mb-2 h-[190px] w-[250px] overflow-hidden rounded-lg border border-white/10" aria-hidden="true">
                    <div
                        className="absolute inset-0"
                        style={{
                            background: `linear-gradient(135deg, ${surfaceColor}, ${backgroundColor} 58%, ${secondaryColor}1F)`,
                        }}
                    />
                    <div
                        className="absolute inset-0 opacity-25"
                        style={{
                            backgroundImage: `linear-gradient(${accentColor}24 1px, transparent 1px), linear-gradient(90deg, ${accentColor}24 1px, transparent 1px)`,
                            backgroundSize: "28px 28px",
                        }}
                    />
                    <div className="absolute left-1/2 top-1/2 h-24 w-36 -translate-x-1/2 -translate-y-1/2">
                        {[0, 1, 2].map((item) => (
                            <div
                                key={item}
                                className="theme-loader-slide absolute left-1/2 h-8 w-28 -translate-x-1/2 rounded-md border border-white/20"
                                style={{
                                    top: `${item * 28}px`,
                                    background: `linear-gradient(90deg, ${accentColor}, ${secondaryColor})`,
                                    boxShadow: `0 0 28px ${accentColor}70`,
                                    animationDelay: `${item * 0.18}s`,
                                }}
                            />
                        ))}
                        <div
                            className="theme-loader-dot absolute left-1/2 top-[-18px] h-2.5 w-2.5 -translate-x-1/2 rounded-full"
                            style={{ backgroundColor: secondaryColor, boxShadow: `0 0 20px ${secondaryColor}` }}
                        />
                    </div>
                    <div
                        className="absolute bottom-0 left-0 h-14 w-full"
                        style={{ background: `linear-gradient(0deg, ${backgroundColor}, transparent)` }}
                    />
                </div>
                {showProgress ? (
                    <div className="w-full space-y-6 pt-4">
                        <ProgressBar
                            duration={duration}
                            onComplete={onProgressComplete}
                            accentColor={accentColor}
                            secondaryColor={secondaryColor}
                        />
                        {text && (
                            <div className="space-y-1">
                                <p className="text-base text-center font-semibold font-inter" style={{ color: foregroundColor }}>
                                    {text}
                                </p>
                                {theme?.name && <p className="text-white/60 text-[11px] text-center font-medium font-inter">{theme.name}</p>}
                                {extra_info && <p className="text-white/80 text-xs text-center font-semibold font-inter">{extra_info}</p>}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <p className="text-base text-center font-semibold font-inter" style={{ color: foregroundColor }}>
                            {text}
                        </p>
                        {theme?.name && <p className="text-white/60 text-[11px] text-center font-medium font-inter">{theme.name}</p>}
                        {extra_info && <p className="text-white/80 text-xs text-center font-semibold font-inter">{extra_info}</p>}
                    </>

                )}
            </div>
            <style jsx>{`
                .theme-loader-slide {
                    animation: themed-slide-float 1.35s ease-in-out infinite;
                    transform-origin: center;
                }
                .theme-loader-dot {
                    animation: themed-dot-drop 1.35s ease-in-out infinite;
                }
                @keyframes themed-slide-float {
                    0%, 100% {
                        transform: translateX(-50%) perspective(180px) rotateX(56deg) scaleX(0.74);
                        opacity: 0.52;
                    }
                    50% {
                        transform: translateX(-50%) perspective(180px) rotateX(56deg) translateY(-8px) scaleX(1);
                        opacity: 1;
                    }
                }
                @keyframes themed-dot-drop {
                    0%, 100% {
                        transform: translateX(-50%) translateY(0);
                        opacity: 0.45;
                    }
                    50% {
                        transform: translateX(-50%) translateY(68px);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    )
}
