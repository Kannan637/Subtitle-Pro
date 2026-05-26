/* eslint-disable react-refresh/only-export-components */
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export interface TemplateStyle {
    fontFamily: string;
    fontSize: number;
    fontWeight: number | string;
    color: string;
    textOpacity?: number;
    underline?: boolean;
    textCase?: "original" | "upper" | "lower" | "title";
    strokeColor?: string;
    strokeWidth?: number;
    shadowColor?: string;
    background?: string;
    uppercase?: boolean;
    letterSpacing?: number;
    borderRadius?: number;
    enterAnim: string;
    animDuration: number;
    animDelay?: number;
    wordByWord?: boolean;
    highlightWord?: boolean;
    highlightColor?: string;
    highlightTextColor?: string;
    position?: "bottom" | "center" | "top";
    align?: "left" | "center" | "right";
    italic?: boolean;
    lineHeight?: number;
    glowColor?: string;
    offsetX?: number;
    offsetY?: number;
    maxWidthPct?: number;
    tag?: string;
    captionMode?: "word" | "chunk" | "sentence";
    chunkSize?: number;
}

export interface CaptionViewportMetrics {
    width: number;
    height: number;
    aspectRatio?: string;
}

export const KOMIKA_AXIS_FONT_FAMILY = "Komika Axis";
export const KOMIKA_AXIS_FONT_STACK = `"${KOMIKA_AXIS_FONT_FAMILY}", "Bangers", "Anton", Impact, sans-serif`;

const MODERN_TEMPLATES: Record<string, TemplateStyle> = {
    komika_axis: {
        fontFamily: KOMIKA_AXIS_FONT_STACK,
        fontSize: 40,
        fontWeight: 900,
        color: "#FFFFFF",
        strokeColor: "#000000",
        strokeWidth: 3.2,
        shadowColor: "rgba(0,0,0,0.9)",
        background: "transparent",
        uppercase: true,
        letterSpacing: 0.4,
        lineHeight: 1.06,
        enterAnim: "BeastPop",
        animDuration: 180,
        position: "bottom",
        align: "center",
        maxWidthPct: 82,
        captionMode: "chunk",
        tag: "social",
    },
    clean_modern: {
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        fontSize: 34,
        fontWeight: 800,
        color: "#FFFFFF",
        strokeColor: "#111827",
        strokeWidth: 2,
        shadowColor: "rgba(0,0,0,0.7)",
        background: "transparent",
        letterSpacing: 0.2,
        lineHeight: 1.15,
        enterAnim: "FadeSlideUp",
        animDuration: 240,
        position: "bottom",
        align: "center",
        captionMode: "chunk",
        tag: "pro",
    },
    social_bold: {
        fontFamily: KOMIKA_AXIS_FONT_STACK,
        fontSize: 38,
        fontWeight: 900,
        color: "#FFFFFF",
        strokeColor: "#000000",
        strokeWidth: 3,
        shadowColor: "rgba(0,0,0,0.85)",
        letterSpacing: 0.4,
        lineHeight: 1.12,
        enterAnim: "BeastPop",
        animDuration: 210,
        position: "bottom",
        align: "center",
        captionMode: "word",
        tag: "social",
    },
    broadcast_news: {
        fontFamily: "'Source Sans 3', 'Inter', sans-serif",
        fontSize: 28,
        fontWeight: 700,
        color: "#FFFFFF",
        strokeColor: "transparent",
        strokeWidth: 0,
        background: "rgba(10,18,32,0.82)",
        borderRadius: 4,
        letterSpacing: 0.2,
        lineHeight: 1.2,
        enterAnim: "FadeIn",
        animDuration: 220,
        position: "bottom",
        align: "left",
        maxWidthPct: 70,
        captionMode: "sentence",
        tag: "broadcast",
    },
    doc_subtle: {
        fontFamily: "'Merriweather', Georgia, serif",
        fontSize: 24,
        fontWeight: 600,
        color: "#F8FAFC",
        strokeColor: "#000000",
        strokeWidth: 1.2,
        shadowColor: "rgba(0,0,0,0.9)",
        letterSpacing: 0.15,
        lineHeight: 1.2,
        enterAnim: "FadeIn",
        animDuration: 300,
        position: "bottom",
        align: "center",
        captionMode: "sentence",
        tag: "cinematic",
    },
    podcast_dark: {
        fontFamily: "'DM Sans', 'Inter', sans-serif",
        fontSize: 30,
        fontWeight: 700,
        color: "#FFFFFF",
        strokeColor: "transparent",
        strokeWidth: 0,
        background: "rgba(0,0,0,0.7)",
        borderRadius: 6,
        lineHeight: 1.18,
        letterSpacing: 0.1,
        enterAnim: "FadeSlideUp",
        animDuration: 260,
        position: "bottom",
        align: "center",
        captionMode: "chunk",
        tag: "podcast",
    },
    podcast_light: {
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        fontSize: 29,
        fontWeight: 700,
        color: "#0F172A",
        strokeColor: "transparent",
        strokeWidth: 0,
        background: "rgba(255,255,255,0.88)",
        borderRadius: 6,
        lineHeight: 1.18,
        letterSpacing: 0.1,
        enterAnim: "FadeSlideUp",
        animDuration: 260,
        position: "bottom",
        align: "center",
        captionMode: "chunk",
        tag: "podcast",
    },
    cinema_soft: {
        fontFamily: "'Playfair Display', 'Merriweather', serif",
        fontSize: 26,
        fontWeight: 600,
        color: "#F8F5ED",
        strokeColor: "transparent",
        strokeWidth: 0,
        shadowColor: "rgba(0,0,0,0.85)",
        background: "rgba(0,0,0,0.45)",
        borderRadius: 4,
        italic: true,
        letterSpacing: 0.8,
        lineHeight: 1.22,
        enterAnim: "FadeIn",
        animDuration: 420,
        position: "bottom",
        align: "center",
        captionMode: "sentence",
        tag: "cinematic",
    },
    minimal_clean: {
        fontFamily: "'IBM Plex Sans', 'Inter', sans-serif",
        fontSize: 23,
        fontWeight: 600,
        color: "#E5E7EB",
        strokeColor: "transparent",
        strokeWidth: 0,
        background: "rgba(15,23,42,0.52)",
        borderRadius: 4,
        letterSpacing: 0,
        lineHeight: 1.18,
        enterAnim: "FadeIn",
        animDuration: 200,
        position: "bottom",
        align: "center",
        captionMode: "sentence",
        tag: "minimal",
    },
    focus_karaoke: {
        fontFamily: "'Montserrat', 'Inter', sans-serif",
        fontSize: 34,
        fontWeight: 800,
        color: "#FFFFFF",
        strokeColor: "#000000",
        strokeWidth: 2,
        shadowColor: "rgba(0,0,0,0.8)",
        highlightWord: true,
        highlightColor: "#FDE047",
        highlightTextColor: "#0F172A",
        enterAnim: "FadeIn",
        animDuration: 140,
        position: "bottom",
        align: "center",
        captionMode: "word",
        tag: "social",
    },
    corporate_blue: {
        fontFamily: "'Manrope', 'Inter', sans-serif",
        fontSize: 30,
        fontWeight: 800,
        color: "#FFFFFF",
        strokeColor: "transparent",
        strokeWidth: 0,
        background: "rgba(29,78,216,0.82)",
        borderRadius: 6,
        letterSpacing: 0.2,
        lineHeight: 1.16,
        enterAnim: "FadeSlideUp",
        animDuration: 220,
        position: "bottom",
        align: "center",
        captionMode: "chunk",
        tag: "broadcast",
    },
    reels_punch: {
        fontFamily: KOMIKA_AXIS_FONT_STACK,
        fontSize: 46,
        fontWeight: 700,
        color: "#FFFFFF",
        strokeColor: "#000000",
        strokeWidth: 2.5,
        shadowColor: "rgba(0,0,0,0.9)",
        uppercase: true,
        letterSpacing: 1.2,
        lineHeight: 1.05,
        enterAnim: "HormoziSlam",
        animDuration: 170,
        position: "center",
        align: "center",
        captionMode: "word",
        tag: "social",
    },
    sports_flash: {
        fontFamily: "'Oswald', 'Roboto Condensed', sans-serif",
        fontSize: 36,
        fontWeight: 700,
        color: "#FFFFFF",
        strokeColor: "#0F172A",
        strokeWidth: 2,
        background: "rgba(185,28,28,0.8)",
        borderRadius: 4,
        uppercase: true,
        letterSpacing: 0.8,
        lineHeight: 1.1,
        enterAnim: "BeastPop",
        animDuration: 180,
        position: "bottom",
        align: "center",
        captionMode: "chunk",
        tag: "social",
    },
    premium_gold: {
        fontFamily: "'Cormorant Garamond', 'Playfair Display', serif",
        fontSize: 30,
        fontWeight: 700,
        color: "#FDE68A",
        strokeColor: "transparent",
        strokeWidth: 0,
        shadowColor: "rgba(0,0,0,0.8)",
        background: "rgba(15,15,15,0.68)",
        borderRadius: 5,
        letterSpacing: 1,
        lineHeight: 1.2,
        enterAnim: "FadeIn",
        animDuration: 380,
        position: "bottom",
        align: "center",
        captionMode: "sentence",
        tag: "cinematic",
    },
    mono_tech: {
        fontFamily: "'Space Grotesk', 'IBM Plex Sans', sans-serif",
        fontSize: 27,
        fontWeight: 700,
        color: "#E2E8F0",
        strokeColor: "#0F172A",
        strokeWidth: 1,
        background: "rgba(2,6,23,0.75)",
        borderRadius: 4,
        letterSpacing: 0.5,
        lineHeight: 1.15,
        enterAnim: "FadeIn",
        animDuration: 220,
        position: "bottom",
        align: "left",
        maxWidthPct: 68,
        captionMode: "chunk",
        tag: "pro",
    },
    soft_card: {
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        fontSize: 28,
        fontWeight: 700,
        color: "#0F172A",
        strokeColor: "transparent",
        strokeWidth: 0,
        background: "rgba(248,250,252,0.9)",
        borderRadius: 8,
        shadowColor: "rgba(15,23,42,0.35)",
        letterSpacing: 0,
        lineHeight: 1.16,
        enterAnim: "FadeSlideUp",
        animDuration: 250,
        position: "bottom",
        align: "center",
        captionMode: "chunk",
        tag: "pro",
    },
    impact_caps: {
        fontFamily: KOMIKA_AXIS_FONT_STACK,
        fontSize: 40,
        fontWeight: 900,
        color: "#FFFFFF",
        strokeColor: "#000000",
        strokeWidth: 3,
        shadowColor: "rgba(0,0,0,0.9)",
        uppercase: true,
        letterSpacing: 0.9,
        lineHeight: 1.08,
        enterAnim: "BeastPop",
        animDuration: 200,
        position: "bottom",
        align: "center",
        captionMode: "word",
        tag: "social",
    },
};

const LEGACY_TEMPLATE_ALIASES: Record<string, keyof typeof MODERN_TEMPLATES> = {
    mrbeast: "social_bold",
    pewdiepie: "impact_caps",
    markiplier: "clean_modern",
    jacksepticeye: "reels_punch",
    dude_perfect: "sports_flash",
    hormozi: "impact_caps",
    graham_stephan: "podcast_dark",
    andrei_jikh: "premium_gold",
    meet_kevin: "corporate_blue",
    iman: "podcast_dark",
    ali_abdaal: "podcast_light",
    huberman: "doc_subtle",
    veritasium: "doc_subtle",
    kurzgesagt: "corporate_blue",
    motivation: "reels_punch",
    david_goggins: "impact_caps",
    andrew_tate: "premium_gold",
    yes_theory: "social_bold",
    streamer: "mono_tech",
    gaming_rgb: "mono_tech",
    valorant: "sports_flash",
    minecraft: "minimal_clean",
    neon_twitch: "mono_tech",
    netflix: "broadcast_news",
    cinematic: "cinema_soft",
    documentary: "doc_subtle",
    vlog_aesthetic: "soft_card",
    pop: "social_bold",
    tiktok_bold: "reels_punch",
    instagram_minimal: "clean_modern",
    karaoke: "focus_karaoke",
    neon_reels: "social_bold",
    emma_chamberlain: "soft_card",
    lilly_singh: "social_bold",
    nas_daily: "impact_caps",
    fire: "reels_punch",
    holographic: "mono_tech",
    newspaper: "doc_subtle",
    comic: "komika_axis",
    horror: "cinema_soft",
    luxury: "premium_gold",
    minimal: "minimal_clean",
};

const aliasConfig = Object.fromEntries(
    Object.entries(LEGACY_TEMPLATE_ALIASES).map(([legacyId, modernId]) => [
        legacyId,
        { ...MODERN_TEMPLATES[modernId] },
    ]),
) as Record<string, TemplateStyle>;

export const TEMPLATES_CONFIG: Record<string, TemplateStyle> = {
    ...MODERN_TEMPLATES,
    ...aliasConfig,
};

export const TEMPLATES = [
    { id: "komika_axis", label: "Komika Axis", bg: "#FACC15", tc: "#111827" },
    { id: "clean_modern", label: "Clean Modern", bg: "#111827", tc: "#FFFFFF" },
    { id: "social_bold", label: "Social Bold", bg: "#0F172A", tc: "#FFFFFF" },
    { id: "broadcast_news", label: "Broadcast News", bg: "#1E293B", tc: "#FFFFFF" },
    { id: "doc_subtle", label: "Documentary", bg: "#111827", tc: "#F8FAFC" },
    { id: "podcast_dark", label: "Podcast Dark", bg: "#0F172A", tc: "#FFFFFF" },
    { id: "podcast_light", label: "Podcast Light", bg: "#E2E8F0", tc: "#0F172A" },
    { id: "cinema_soft", label: "Cinema Soft", bg: "#1F2937", tc: "#F8F5ED" },
    { id: "minimal_clean", label: "Minimal Clean", bg: "#334155", tc: "#E5E7EB" },
    { id: "focus_karaoke", label: "Focus Karaoke", bg: "#0F172A", tc: "#FFFFFF" },
    { id: "corporate_blue", label: "Corporate Blue", bg: "#1D4ED8", tc: "#FFFFFF" },
    { id: "reels_punch", label: "Reels Punch", bg: "#111827", tc: "#FFFFFF" },
    { id: "sports_flash", label: "Sports Flash", bg: "#B91C1C", tc: "#FFFFFF" },
    { id: "premium_gold", label: "Premium Gold", bg: "#111111", tc: "#FDE68A" },
    { id: "mono_tech", label: "Mono Tech", bg: "#020617", tc: "#E2E8F0" },
    { id: "soft_card", label: "Soft Card", bg: "#E2E8F0", tc: "#0F172A" },
    { id: "impact_caps", label: "Impact Caps", bg: "#111827", tc: "#FFFFFF" },
];

export const CATEGORIES = [
    { id: "all", label: "All" },
    { id: "pro", label: "Pro" },
    { id: "social", label: "Social" },
    { id: "broadcast", label: "Broadcast" },
    { id: "podcast", label: "Podcast" },
    { id: "cinematic", label: "Cinematic" },
    { id: "minimal", label: "Minimal" },
];

export const REQUIRED_FONTS = `
@font-face{font-family:"Komika Axis";src:local("Komika Axis"),local("KomikaAxis");font-weight:400 900;font-style:normal;font-display:swap;}
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800;900&family=Montserrat:wght@700;800;900&family=Source+Sans+3:wght@600;700&family=Merriweather:wght@600&family=DM+Sans:wght@700&family=Playfair+Display:ital,wght@0,600;1,600&family=IBM+Plex+Sans:wght@600;700&family=Manrope:wght@800&family=Bebas+Neue&family=Oswald:wght@700&family=Space+Grotesk:wght@700&family=Cormorant+Garamond:wght@700&display=swap');
`;

function hasVisibleBackground(value?: string) {
    return Boolean(value && value.trim() && value !== "transparent" && value !== "none");
}

function captionFontFamily(value?: string) {
    const raw = value?.trim();
    if (!raw) return KOMIKA_AXIS_FONT_STACK;
    const primary = raw.split(",")[0]?.replace(/["']/g, "").trim().toLowerCase();
    if (primary === KOMIKA_AXIS_FONT_FAMILY.toLowerCase()) {
        return KOMIKA_AXIS_FONT_STACK;
    }
    return raw;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(min, Math.min(max, numeric));
}

function clampCaptionFontSize(value?: number) {
    const size = clampNumber(value, 10, 80, 30);
    return `clamp(10px, ${size}px, min(11vw, 11vh))`;
}

function normalizeEnterAnim(value?: string) {
    if (value === "Pop") return "BeastPop";
    if (value === "Fade In") return "FadeIn";
    if (value === "Slide Up") return "FadeSlideUp";
    if (value === "Bounce") return "BounceIn";
    return value || "FadeIn";
}

function applyTextCase(text: string, textCase?: TemplateStyle["textCase"], uppercaseFallback?: boolean) {
    if (textCase === "upper" || uppercaseFallback) return text.toUpperCase();
    if (textCase === "lower") return text.toLowerCase();
    if (textCase === "title") {
        return text
            .split(" ")
            .map((part) => (part ? `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}` : part))
            .join(" ");
    }
    return text;
}

function readableCaptionStyle(style: TemplateStyle): TemplateStyle {
    const anim = normalizeEnterAnim(style.enterAnim);
    const normalizedCase = (() => {
        const raw = String(style.textCase || "").toLowerCase().trim();
        if (raw === "upper" || raw === "lower" || raw === "title" || raw === "original") {
            return raw as TemplateStyle["textCase"];
        }
        return style.uppercase ? "upper" : "original";
    })();
    return {
        ...style,
        fontFamily: captionFontFamily(style.fontFamily),
        strokeColor: style.strokeColor ?? "#000000",
        enterAnim: anim,
        textCase: normalizedCase,
        fontSize: clampNumber(style.fontSize, 10, 80, 30),
        strokeWidth: clampNumber(style.strokeWidth, 0, 10, 3.2),
        letterSpacing: clampNumber(style.letterSpacing, 0, 6, 0),
        animDuration: clampNumber(style.animDuration, 100, 2000, 260),
        animDelay: clampNumber(style.animDelay, 0, 1000, 0),
        lineHeight: clampNumber(style.lineHeight, 1.0, 2.0, 1.16),
        textOpacity: clampNumber(style.textOpacity, 0.2, 1, 1),
        offsetX: clampNumber(style.offsetX, -240, 240, 0),
        offsetY: clampNumber(style.offsetY, -240, 240, 0),
        maxWidthPct: clampNumber(style.maxWidthPct, 40, 100, 88),
    };
}

const CAPTION_SAFE_X = 6;
const CAPTION_SAFE_Y = 8;
const CAPTION_MAX_WIDTH = `${100 - CAPTION_SAFE_X * 2}%`;
const CAPTION_REFERENCE_WIDTH = 600;
const CAPTION_REFERENCE_HEIGHT = 338;
const CAPTION_MIN_SCALE = 0.58;
const CAPTION_MAX_SCALE = 1.35;

function getPositionStyle(position?: TemplateStyle["position"]) {
    if (position === "center") {
        return { top: "50%" } as const;
    }
    if (position === "top") {
        return { top: `${CAPTION_SAFE_Y}%` } as const;
    }
    return { bottom: `${CAPTION_SAFE_Y}%` } as const;
}

function getHorizontalStyle(align?: TemplateStyle["align"]) {
    if (align === "left") {
        return { left: `${CAPTION_SAFE_X}%` } as const;
    }
    if (align === "right") {
        return { right: `${CAPTION_SAFE_X}%` } as const;
    }
    return { left: "50%" } as const;
}

function getCaptionTransform(
    position?: TemplateStyle["position"],
    align?: TemplateStyle["align"],
    offsetX?: number,
    offsetY?: number,
) {
    const parts: string[] = [];
    if (align === "center" || !align) parts.push("translateX(-50%)");
    if (position === "center") parts.push("translateY(-50%)");
    if ((offsetX ?? 0) !== 0 || (offsetY ?? 0) !== 0) {
        parts.push(`translate(${offsetX ?? 0}px, ${offsetY ?? 0}px)`);
    }
    return parts.join(" ");
}

function getCaptionTransformOrigin(position?: TemplateStyle["position"], align?: TemplateStyle["align"]) {
    const x = align === "left" ? "left" : align === "right" ? "right" : "center";
    const y = position === "top" ? "top" : position === "bottom" || !position ? "bottom" : "center";
    return `${x} ${y}`;
}

let textMeasureContext: CanvasRenderingContext2D | null = null;

function getTextMeasureContext() {
    if (textMeasureContext) return textMeasureContext;
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    textMeasureContext = canvas.getContext("2d");
    return textMeasureContext;
}

function getCaptionResponsiveScale(viewport?: CaptionViewportMetrics) {
    if (!viewport) return 1;
    const width = clampNumber(viewport.width, 1, 5000, CAPTION_REFERENCE_WIDTH);
    const height = clampNumber(viewport.height, 1, 5000, CAPTION_REFERENCE_HEIGHT);
    const widthScale = width / CAPTION_REFERENCE_WIDTH;
    const heightScale = height / CAPTION_REFERENCE_HEIGHT;
    const areaScale = Math.sqrt(widthScale * heightScale);
    const aspect = width / Math.max(1, height);
    const aspectBias = aspect < 1 ? 0.94 : 1;
    return clampNumber(areaScale * aspectBias, CAPTION_MIN_SCALE, CAPTION_MAX_SCALE, 1);
}

function fitTextToWidth(
    text: string,
    preferredPx: number,
    maxWidthPx: number,
    fontFamily: string,
    fontWeight: number | string,
    letterSpacing: number,
) {
    const ctx = getTextMeasureContext();
    if (!ctx || !text || maxWidthPx <= 0) {
        return preferredPx;
    }
    const preferred = clampNumber(preferredPx, 10, 120, 30);
    const weight = String(fontWeight || 700);
    ctx.font = `${weight} ${preferred}px ${fontFamily}`;
    const measured = ctx.measureText(text).width + Math.max(0, text.length - 1) * Math.max(0, letterSpacing);
    if (measured <= maxWidthPx) return preferred;
    const scaled = preferred * (maxWidthPx / Math.max(1, measured));
    return clampNumber(scaled, 10, preferred, 10);
}

export function AnimatedWord({
    text,
    combinedStyle,
    viewport,
}: {
    text: string;
    combinedStyle: TemplateStyle;
    viewport?: CaptionViewportMetrics;
}) {
    const animatedRef = useRef<HTMLDivElement>(null);
    const safeStyle = readableCaptionStyle(combinedStyle);
    const responsiveScale = getCaptionResponsiveScale(viewport);
    const fontFamily = captionFontFamily(safeStyle.fontFamily);
    const scaledFontSize = clampNumber((safeStyle.fontSize ?? 30) * responsiveScale, 10, 96, 30);
    const scaledStrokeWidth = clampNumber((safeStyle.strokeWidth ?? 0) * responsiveScale, 0, 12, 0);
    const scaledLetterSpacing = clampNumber((safeStyle.letterSpacing ?? 0) * responsiveScale, 0, 10, 0);
    const scaledBorderRadius = clampNumber((safeStyle.borderRadius ?? 4) * responsiveScale, 0, 30, 4);
    const scaledOffsetX = clampNumber((safeStyle.offsetX ?? 0) * responsiveScale, -240, 240, 0);
    const scaledOffsetY = clampNumber((safeStyle.offsetY ?? 0) * responsiveScale, -240, 240, 0);

    useGSAP(() => {
        if (!animatedRef.current) return;

        const node = animatedRef.current;
        const animType = safeStyle.enterAnim || "FadeIn";
        const duration = (safeStyle.animDuration ?? 260) / 1000;
        const delay = (safeStyle.animDelay ?? 0) / 1000;

        gsap.killTweensOf(node);
        gsap.set(node, { scale: 1, opacity: 1, y: 0, x: 0, rotation: 0, skewX: 0 });

        if (animType === "BeastPop") {
            gsap.from(node, { scale: 0.88, opacity: 0, duration, delay, ease: "power2.out" });
        } else if (animType === "BounceIn") {
            gsap.from(node, { y: -12, opacity: 0, scale: 0.98, duration, delay, ease: "power2.out" });
        } else if (animType === "FadeSlideUp") {
            gsap.from(node, { y: 14, opacity: 0, duration, delay, ease: "power2.out" });
        } else if (animType === "Glitch") {
            gsap.fromTo(node, { x: -4, opacity: 0.75 }, { x: 0, opacity: 1, duration, delay, ease: "power2.out" });
        } else if (animType === "HormoziSlam") {
            gsap.from(node, { scale: 1.08, opacity: 0, duration, delay, ease: "power2.out" });
        } else {
            gsap.from(node, { opacity: 0, duration, delay, ease: "power2.out" });
        }
    }, [safeStyle.enterAnim, safeStyle.animDuration, safeStyle.animDelay]);

    const strokeVisible = Boolean(scaledStrokeWidth && safeStyle.strokeColor && safeStyle.strokeColor !== "transparent");
    let textShadow = "0 2px 8px rgba(0,0,0,0.88)";
    if (strokeVisible) {
        const c = safeStyle.strokeColor;
        const w = Math.max(1, Math.round(scaledStrokeWidth));
        textShadow = `${w}px 0 ${c}, -${w}px 0 ${c}, 0 ${w}px ${c}, 0 -${w}px ${c}, 0 2px 8px rgba(0,0,0,0.9)`;
    }
    if (safeStyle.shadowColor) {
        textShadow = `${textShadow}, 0 3px 8px ${safeStyle.shadowColor}`;
    }
    if (safeStyle.glowColor) {
        textShadow = `${textShadow}, 0 0 8px ${safeStyle.glowColor}`;
    }

    const positionStyle = getPositionStyle(safeStyle.position);
    const horizontalStyle = getHorizontalStyle(safeStyle.align);
    const transform = getCaptionTransform(
        safeStyle.position,
        safeStyle.align,
        scaledOffsetX,
        scaledOffsetY,
    );
    const transformOrigin = getCaptionTransformOrigin(safeStyle.position, safeStyle.align);
    const backgroundVisible = hasVisibleBackground(safeStyle.background);
    const displayText = applyTextCase(text, safeStyle.textCase, safeStyle.uppercase)
        .replace(/\s+/g, " ")
        .trim();
    const singleTokenCaption = safeStyle.captionMode === "word" || !displayText.includes(" ");
    const maxWidth = `${Math.max(40, Math.min(100, safeStyle.maxWidthPct ?? 88))}%`;
    const resolvedMaxWidth = singleTokenCaption
        ? CAPTION_MAX_WIDTH
        : `min(${CAPTION_MAX_WIDTH}, ${maxWidth})`;
    const safeWidthPct = 100 - CAPTION_SAFE_X * 2;
    const maxWidthPercentForText = singleTokenCaption
        ? safeWidthPct
        : Math.min(safeWidthPct, Math.max(40, Math.min(100, safeStyle.maxWidthPct ?? 88)));
    const maxWidthPx = viewport?.width
        ? (viewport.width * maxWidthPercentForText) / 100
        : null;
    const longestToken = displayText.split(/\s+/).reduce((longest, token) => {
        return token.length > longest.length ? token : longest;
    }, "");
    const fitProbeText = singleTokenCaption ? displayText : longestToken;
    const fittedFontSizePx = maxWidthPx && fitProbeText
        ? fitTextToWidth(
            fitProbeText,
            scaledFontSize,
            maxWidthPx,
            fontFamily,
            safeStyle.fontWeight || "bold",
            scaledLetterSpacing,
        )
        : scaledFontSize;
    const resolvedFontSize = viewport
        ? `${fittedFontSizePx.toFixed(2)}px`
        : clampCaptionFontSize(scaledFontSize);

    return (
        <div style={{
            position: "absolute",
            ...positionStyle,
            ...horizontalStyle,
            ...(transform ? { transform } : {}),
            transformOrigin,
            pointerEvents: "none",
            zIndex: 30,
        }}>
            <div ref={animatedRef} style={{
                color: safeStyle.color || "#fff",
                opacity: safeStyle.textOpacity ?? 1,
                fontFamily,
                fontWeight: safeStyle.fontWeight || "bold",
                fontSize: resolvedFontSize,
                background: backgroundVisible ? safeStyle.background : "transparent",
                textTransform: "none",
                textDecorationLine: safeStyle.underline ? "underline" : "none",
                letterSpacing: `${scaledLetterSpacing}px`,
                fontStyle: safeStyle.italic ? "italic" : "normal",
                lineHeight: safeStyle.lineHeight || 1.16,
                borderRadius: scaledBorderRadius,
                textShadow,
                WebkitTextStroke: strokeVisible ? `${scaledStrokeWidth.toFixed(2)}px ${safeStyle.strokeColor}` : undefined,
                paintOrder: strokeVisible ? "stroke fill" : undefined,
                padding: backgroundVisible ? "0.26em 0.62em" : "0.12em 0.28em",
                whiteSpace: singleTokenCaption ? "nowrap" : "normal",
                textAlign: safeStyle.align || "center",
                display: "inline-block",
                width: "max-content",
                maxWidth: resolvedMaxWidth,
                boxSizing: "border-box",
                overflowWrap: "normal",
                wordBreak: singleTokenCaption ? "keep-all" : "normal",
                hyphens: singleTokenCaption ? "manual" : "auto",
                transformOrigin,
                willChange: "transform, opacity",
            }}>
                {safeStyle.highlightWord ? (
                    <span>
                        {displayText.split(" ").map((word, i, arr) => (
                            <span
                                key={i}
                                style={{
                                    color: i === Math.floor(arr.length / 2)
                                        ? (safeStyle.highlightTextColor || "#000000")
                                        : safeStyle.color,
                                    background: i === Math.floor(arr.length / 2)
                                        ? (safeStyle.highlightColor || "transparent")
                                        : "transparent",
                                    borderRadius: i === Math.floor(arr.length / 2) ? "0.26em" : undefined,
                                    padding: i === Math.floor(arr.length / 2) ? "0 0.18em" : undefined,
                                }}
                            >
                                {word}
                                {i < arr.length - 1 ? " " : ""}
                            </span>
                        ))}
                    </span>
                ) : (
                    displayText
                )}
            </div>
        </div>
    );
}
