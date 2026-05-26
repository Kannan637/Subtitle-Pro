import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useTimeline, type AgentName, type AgentState } from "@/store/timelineStore";
import {
    projectsApi, mediaApi, transcriptionApi, subtitlesApi,
    orchestratorApi, exportApi, brollApi, motionGraphicsApi, controlPanelApi,
    AUTH_SESSION_RECOVERY_MESSAGE,
    getApiErrorMessage,
    getCurrentAuthToken,
    type BrollSuggestion, type MotionGraphicSuggestion, type MoodProfile, type MusicSuggestion, type SFXSuggestion, type CaptionControlStyle,
} from "@/lib/api";
import {
    TEMPLATES_CONFIG,
    TEMPLATES,
    AnimatedWord,
    KOMIKA_AXIS_FONT_FAMILY,
    type CaptionViewportMetrics,
} from "@/components/Templates/TextTemplates";
import {
    AudioWaveform,
    AlignCenter,
    AlignLeft,
    AlignRight,
    ArrowDownUp,
    Bold,
    Bot,
    Brain,
    CaseSensitive,
    ChevronLeft as ChevronLeftIcon,
    ChevronsLeft,
    ChevronsRight,
    CircleHelp,
    GripVertical,
    Highlighter,
    Italic as ItalicIcon,
    Layout,
    MoveHorizontal,
    MoveVertical,
    Music2,
    Pause,
    Play,
    Plus,
    Redo2,
    RefreshCw,
    Search,
    SlidersHorizontal,
    Sparkles,
    Trash2,
    Type,
    Undo2,
    Underline,
    AudioLines,
    Eye,
    EyeOff,
    Film,
    X,
} from "lucide-react";

// ── CSS tokens (index.css @theme) ─────────────────────────────────────────
const C = {
    primary: "var(--color-primary)",
    primaryHover: "var(--color-primary-hover)",
    primaryLight: "var(--color-primary-light)",
    primarySubtle: "var(--color-primary-subtle)",
    primaryDark: "var(--color-primary-dark)",
    accent: "var(--color-accent)",
    accentHover: "var(--color-accent-hover)",
    accentLight: "var(--color-accent-light)",
    success: "var(--color-success)",
    successLight: "var(--color-success-light)",
    warning: "var(--color-warning)",
    warningLight: "var(--color-warning-light)",
    danger: "var(--color-danger)",
    dangerLight: "var(--color-danger-light)",
    gray50: "var(--color-gray-50)",
    gray100: "var(--color-gray-100)",
    gray200: "var(--color-gray-200)",
    gray300: "var(--color-gray-300)",
    gray400: "var(--color-gray-400)",
    gray500: "var(--color-gray-500)",
    gray600: "var(--color-gray-600)",
    gray700: "var(--color-gray-700)",
    gray800: "var(--color-gray-800)",
    gray900: "var(--color-gray-900)",
    surface: "var(--color-surface)",
    surfaceSec: "var(--color-surface-secondary)",
    surfaceElev: "var(--color-surface-elevated)",
    dark: "var(--color-dark-surface)",
    darkSec: "var(--color-dark-surface-secondary)",
    darkElev: "var(--color-dark-surface-elevated)",
    font: "var(--font-sans)",
    fontMono: "var(--font-mono)",
    shadowMd: "var(--shadow-md)",
    shadowLg: "var(--shadow-lg)",
} as const;

const UI = {
    appBg: "oklch(0.985 0 0)",
    appBgSoft: "oklch(0.955 0 0)",
    appBgElev: "rgba(255,255,255,0.82)",
    borderStrong: "oklch(0.870 0 0)",
    borderSoft: "oklch(0.910 0 0)",
    textStrong: "oklch(0.180 0 0)",
    textBase: "oklch(0.320 0 0)",
    textMuted: "oklch(0.500 0 0)",
    textSubtle: "oklch(0.680 0 0)",
    glassBg: "rgba(255,255,255,0.62)",
    glassBgHeavy: "rgba(255,255,255,0.78)",
    stageBg: "oklch(0.140 0 0)",
    overlayBg: "rgba(0,0,0,0.48)",
    panelShadow: "none",
} as const;

const CAPTION_STUDIO_LIGHT_VARS = {
    "--color-primary": "oklch(0.585 0.190 255.0)",
    "--color-primary-hover": "oklch(0.525 0.190 255.0)",
    "--color-primary-light": "oklch(0.935 0.040 255.0)",
    "--color-primary-dark": "oklch(0.420 0.155 255.0)",
    "--color-primary-subtle": "color-mix(in oklch, oklch(0.585 0.190 255.0) 9%, white)",
    "--color-accent": "oklch(0.640 0.110 250.0)",
    "--color-accent-hover": "oklch(0.565 0.110 250.0)",
    "--color-accent-light": "oklch(0.910 0.030 250.0)",
    "--color-success": "oklch(0.620 0.145 145.0)",
    "--color-success-light": "oklch(0.940 0.045 145.0)",
    "--color-warning": "oklch(0.690 0.145 75.0)",
    "--color-warning-light": "oklch(0.945 0.060 82.0)",
    "--color-danger": "oklch(0.590 0.210 25.0)",
    "--color-danger-light": "oklch(0.955 0.040 23.0)",
    "--color-gray-50": "oklch(0.985 0 0)",
    "--color-gray-100": "oklch(0.955 0 0)",
    "--color-gray-200": "oklch(0.910 0 0)",
    "--color-gray-300": "oklch(0.850 0 0)",
    "--color-gray-400": "oklch(0.680 0 0)",
    "--color-gray-500": "oklch(0.500 0 0)",
    "--color-gray-600": "oklch(0.400 0 0)",
    "--color-gray-700": "oklch(0.320 0 0)",
    "--color-gray-800": "oklch(0.230 0 0)",
    "--color-gray-900": "oklch(0.180 0 0)",
    "--color-surface": "oklch(1.0000 0 0)",
    "--color-surface-secondary": "oklch(0.955 0 0)",
    "--color-surface-elevated": "oklch(1.0000 0 0)",
} as React.CSSProperties;

// -- Templates moved to TextTemplates.tsx --

// ── Timeline track config (drives bottom track rows) ─────────────────────
type LeftTab = "ai-caption" | "b-roll" | "template";
type RightTab = "type" | "fx" | "anime" | "layout";
type TimelineDropTarget = "broll" | "motion" | "music" | "sfx";
type LayerKey = "raw" | "captions" | "broll" | "motion" | "music" | "sfx" | "transitions" | "cuts";
type LayerVisibility = Record<LayerKey, boolean>;
type TimelineDragPayload =
    | { kind: "broll"; suggestion: BrollSuggestion }
    | { kind: "motion"; suggestion: MotionGraphicSuggestion }
    | { kind: "music"; suggestion: MusicSuggestion }
    | { kind: "sfx"; suggestion: SFXSuggestion };
type MediaPanelSection = AgentName | "motion";

// ── Helpers ───────────────────────────────────────────────────────────────
const AGENT_LABEL: Record<AgentName, string> = {
    broll: "B-Roll", music: "Music", gaps: "Gap Cut",
    sfx: "SFX", transitions: "Transition", crop: "Crop",
};
const IDLE_AGENT_STATUS: Record<AgentName, AgentState> = {
    broll: "idle",
    music: "idle",
    gaps: "idle",
    sfx: "idle",
    transitions: "idle",
    crop: "idle",
};
const btnBase: React.CSSProperties = {
    appearance: "none", border: "none", background: "none",
    fontFamily: "inherit", cursor: "pointer",
};
const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const getCueId = (cue: any) => cue?._id ?? cue?.id ?? "";
const pickPrimarySubtitleTrack = (tracks: any[] = []) =>
    tracks.find((track) => track?.is_original) ?? tracks[0] ?? null;

// Google Fonts Dynamic Loader
function normalizeGoogleFontFamily(fontFamily: string) {
    return fontFamily
        .split(",")[0]
        .replace(/["']/g, "")
        .trim();
}

function clamp01(value: number) {
    return Math.max(0, Math.min(1, value));
}

function pickActiveWord(text: string, startMs: number, endMs: number, currentTimeMs: number) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 1) return text.trim();
    const progress = clamp01((currentTimeMs - startMs) / Math.max(1, endMs - startMs));
    const idx = Math.min(words.length - 1, Math.floor(progress * words.length));
    return words[idx];
}

const GOOGLE_FONTS_API_KEY = String(import.meta.env.VITE_GOOGLE_FONTS_API_KEY || '').trim();

function loadGoogleFont(fontFamily: string) {
    const family = normalizeGoogleFontFamily(fontFamily);
    if (family === KOMIKA_AXIS_FONT_FAMILY) return;
    if (!family || ["Arial", "Courier New", "Impact", "sans-serif", "serif", "monospace"].includes(family)) return;
    const id = `gf-${family.replace(/[^a-z0-9_-]+/gi, '-')}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;600;700;800;900&display=swap`;
    document.head.appendChild(link);
}

function useGoogleFontsList() {
    const [fonts, setFonts] = useState<string[]>([KOMIKA_AXIS_FONT_FAMILY, 'Inter', 'DM Sans', 'Outfit', 'Montserrat']);
    useEffect(() => {
        if (!GOOGLE_FONTS_API_KEY) return;
        fetch(`https://www.googleapis.com/webfonts/v1/webfonts?key=${GOOGLE_FONTS_API_KEY}&sort=popularity`)
            .then(res => res.json())
            .then(data => {
                if (data.items) {
                    const families = data.items.slice(0, 100).map((font: { family: string }) => font.family);
                    setFonts((current) => [...new Set([...current, ...families])]);
                }
            })
            .catch(err => console.warn("Failed to fetch Google Fonts list:", err));
    }, []);
    return fonts;
}

const CAPTION_STYLE_KEYS: Array<keyof CaptionControlStyle> = [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "italic",
    "underline",
    "uppercase",
    "textCase",
    "color",
    "strokeColor",
    "strokeWidth",
    "shadowColor",
    "glowColor",
    "background",
    "borderRadius",
    "highlightWord",
    "highlightColor",
    "highlightTextColor",
    "align",
    "position",
    "offsetX",
    "offsetY",
    "maxWidthPct",
    "textOpacity",
    "enterAnim",
    "exitAnim",
    "animDuration",
    "animDelay",
    "lineHeight",
    "letterSpacing",
    "captionMode",
];

function sanitizeCaptionStyle(
    style: Partial<CaptionControlStyle> | Record<string, unknown> | null | undefined,
): CaptionControlStyle {
    const safe: CaptionControlStyle = {};
    if (!style || typeof style !== "object") return safe;
    for (const key of CAPTION_STYLE_KEYS) {
        const value = (style as Record<string, unknown>)[key];
        if (value !== undefined && value !== null) {
            (safe as Record<string, unknown>)[key] = value;
        }
    }
    return safe;
}

// ═════════════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════════════
export default function VideoCaptionPage() {
    const { projectId: routeProjectId } = useParams<{ projectId?: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const routeProjectIdParam = routeProjectId
        && !["new", "null", "undefined", ""].includes(routeProjectId.trim().toLowerCase())
        ? routeProjectId
        : null;
    const routeShouldAutostart = useMemo(
        () => new URLSearchParams(location.search).get("autostart") === "1",
        [location.search],
    );

    // ── Zustand slices ──────────────────────────────────────────────────
    const projectId = useTimeline((s) => s.projectId);
    const projectName = useTimeline((s) => s.projectName);
    const videoBlobUrl = useTimeline((s) => s.videoBlobUrl);
    const aspectRatio = useTimeline((s) => s.aspectRatio);
    const subtitleTrack = useTimeline((s) => s.subtitleTrack);
    const brollTrack = useTimeline((s) => s.brollTrack);
    const brollSuggestions = useTimeline((s) => s.brollSuggestions);
    const motionGraphicsTrack = useTimeline((s) => s.motionGraphicsTrack);
    const motionGraphicsSuggestions = useTimeline((s) => s.motionGraphicsSuggestions);
    const musicTrack = useTimeline((s) => s.musicTrack);
    const sfxTrack = useTimeline((s) => s.sfxTrack);
    const transitions = useTimeline((s) => s.transitions);
    const gapCuts = useTimeline((s) => s.gapCuts);
    const agentStatus = useTimeline((s) => s.agentStatus);
    const selectedCueId = useTimeline((s) => s.selectedCueId);
    const selectedTpl = useTimeline((s) => s.selectedTemplate);
    const customStyle = useTimeline((s) => s.customStyle);
    const durationMs = useTimeline((s) => s.durationMs);
    const currentTimeMs = useTimeline((s) => s.currentTimeMs);
    const isPlaying = useTimeline((s) => s.isPlaying);
    const zoom = useTimeline((s) => s.zoom);

    const {
        setProjectId, setProjectName, setVideoBlobUrl, setAspectRatio,
        setSubtitleTrack, addBroll, updateBroll, setBrollTrack, setBrollSuggestions,
        addMotionGraphic, updateMotionGraphic, setMotionGraphicsTrack, setMotionGraphicsSuggestions,
        setMusicTrack, setSFXTrack,
        setTransitions, setGapCuts, setAgentStatusBulk, setAgentStatus,
        selectCue, setSelectedTemplate, setCustomStyle, replaceCustomStyle, clearCustomStyle, setZoom,
        setTime, setDuration, setPlaying,
    } = useTimeline.getState();

    // ── Local UI state ─────────────────────────────────────────────────
    const [leftTab, setLeftTab] = useState<LeftTab>("ai-caption");
    const [rightTab, setRightTab] = useState<RightTab>("type");
    const [uploadPct, setUploadPct] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [exportLoading, setExportLoading] = useState(false);
    const [moodProfile, setMoodProfile] = useState<MoodProfile | null>(null);
    const [musicSuggestions, setMusicSuggestions] = useState<MusicSuggestion[]>([]);
    const [musicEmptyReason, setMusicEmptyReason] = useState<string | null>(null);
    const [sfxSuggestions, setSfxSuggestions] = useState<SFXSuggestion[]>([]);
    const [sfxEmptyReason, setSfxEmptyReason] = useState<string | null>(null);
    const [timelineDragPayload, setTimelineDragPayload] = useState<TimelineDragPayload | null>(null);
    const [panelSaveState, setPanelSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [panelHydratedProjectId, setPanelHydratedProjectId] = useState<string | null>(null);
    const [previewViewport, setPreviewViewport] = useState<{ width: number; height: number } | null>(null);
    const [leftPanelWidth, setLeftPanelWidth] = useState(320);
    const [rightPanelWidth, setRightPanelWidth] = useState(352);
    const [leftCollapsed, setLeftCollapsed] = useState(false);
    const [rightCollapsed, setRightCollapsed] = useState(false);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const [toast, setToast] = useState<{ id: number; message: string; tone: "info" | "success" | "error" } | null>(null);
    const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
        raw: true,
        captions: true,
        broll: true,
        motion: true,
        music: true,
        sfx: true,
        transitions: true,
        cuts: true,
    });

    const videoRef = useRef<HTMLVideoElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const sseRef = useRef<EventSource | null>(null);
    const panelHydratingRef = useRef(false);
    const panelSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const routeLoadRef = useRef<string | null>(null);
    const autoStartedRef = useRef<string | null>(null);

    const pushToast = useCallback((message: string, tone: "info" | "success" | "error" = "info") => {
        setToast({ id: Date.now(), message, tone });
    }, []);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 2800);
        return () => clearTimeout(timer);
    }, [toast]);

    // ── Playback ticker ─────────────────────────────────────────────────
    useEffect(() => {
        const vid = videoRef.current;
        if (!vid) return;
        const onTime = () => setTime(Math.round(vid.currentTime * 1000));
        const onDur = () => {
            const nextDurationMs = Number.isFinite(vid.duration) && vid.duration > 0
                ? Math.round(vid.duration * 1000)
                : 0;
            setDuration(nextDurationMs);
        };
        vid.addEventListener("timeupdate", onTime);
        vid.addEventListener("loadedmetadata", onDur);
        vid.addEventListener("durationchange", onDur);
        if (vid.readyState >= 1) onDur();
        return () => {
            vid.removeEventListener("timeupdate", onTime);
            vid.removeEventListener("loadedmetadata", onDur);
            vid.removeEventListener("durationchange", onDur);
        };
    }, [videoBlobUrl, setDuration, setTime]);

    // Preload template fonts dynamically on mount
    useEffect(() => {
        Object.values(TEMPLATES_CONFIG).forEach(cfg => {
            if (cfg.fontFamily) loadGoogleFont(cfg.fontFamily);
        });
    }, []);

    useEffect(() => {
        const vid = videoRef.current;
        if (!vid) return;
        isPlaying ? vid.play().catch(() => { }) : vid.pause();
    }, [isPlaying]);

    // Load persisted control-panel settings for the active project.
    useEffect(() => {
        if (!projectId) {
            setPanelHydratedProjectId(null);
            setPanelSaveState("idle");
            return;
        }

        let cancelled = false;
        panelHydratingRef.current = true;
        setPanelSaveState("idle");

        controlPanelApi.get(projectId)
            .then((res) => {
                if (cancelled) return;
                const selectedTemplate = res.data?.selected_template ?? null;
                const customStylePayload = (res.data?.custom_style ?? {}) as CaptionControlStyle;
                setSelectedTemplate(selectedTemplate);
                replaceCustomStyle(customStylePayload);
                setPanelHydratedProjectId(projectId);
            })
            .catch(() => {
                if (cancelled) return;
                // Keep defaults if nothing is persisted yet.
                setPanelHydratedProjectId(projectId);
            })
            .finally(() => {
                if (!cancelled) {
                    panelHydratingRef.current = false;
                }
            });

        return () => {
            cancelled = true;
        };
    }, [projectId, setSelectedTemplate, replaceCustomStyle]);

    // Debounced autosave for control-panel template/style state.
    useEffect(() => {
        if (!projectId) return;
        if (panelHydratedProjectId !== projectId) return;
        if (panelHydratingRef.current) return;

        if (panelSaveTimerRef.current) clearTimeout(panelSaveTimerRef.current);
        setPanelSaveState("saving");
        panelSaveTimerRef.current = setTimeout(async () => {
            try {
                const templateStyle = sanitizeCaptionStyle(
                    selectedTpl ? (TEMPLATES_CONFIG[selectedTpl] as unknown as Record<string, unknown>) : undefined,
                );
                const customStylePayload = sanitizeCaptionStyle(customStyle as Record<string, unknown>);
                const resolvedStyle = sanitizeCaptionStyle({ ...templateStyle, ...customStylePayload });
                await controlPanelApi.save(projectId, {
                    selected_template: selectedTpl ?? null,
                    custom_style: customStylePayload,
                    resolved_style: Object.keys(resolvedStyle).length > 0 ? resolvedStyle : undefined,
                });
                setPanelSaveState("saved");
            } catch {
                setPanelSaveState("error");
            }
        }, 550);

        return () => {
            if (panelSaveTimerRef.current) {
                clearTimeout(panelSaveTimerRef.current);
                panelSaveTimerRef.current = null;
            }
        };
    }, [projectId, panelHydratedProjectId, selectedTpl, customStyle]);

    // ── SSE watcher ─────────────────────────────────────────────────────
    const applyOrchestrationResults = useCallback((pid: string, results: any, requestedAspect?: "16:9" | "9:16") => {
        const analysis = results?.analysis ?? {};
        if (analysis.mood_profile) {
            setMoodProfile(analysis.mood_profile as MoodProfile);
        }

        // Hydrate suggestions only. Timeline is mutated explicitly by user actions.
        if (results?.broll) {
            setBrollSuggestions(results.broll as BrollSuggestion[]);
        }
        if (results?.music) {
            const payload = results.music as { suggestions?: MusicSuggestion[]; empty_reason?: string | null };
            setMusicSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
            setMusicEmptyReason(payload.empty_reason ?? null);
        }
        if (results?.sfx) {
            const payload = results.sfx as { suggestions?: SFXSuggestion[]; empty_reason?: string | null };
            setSfxSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
            setSfxEmptyReason(payload.empty_reason ?? null);
        }
        if (results?.transitions) { setTransitions(results.transitions as any[]); }
        if (results?.gaps) { setGapCuts(results.gaps as any[]); }
        if (results?.crop) {
            const ratio = requestedAspect ?? useTimeline.getState().aspectRatio;
            mediaApi.getAuthenticatedStreamUrl(pid, ratio)
                .then((blobUrl) => setVideoBlobUrl(blobUrl))
                .catch(() => {
                    setError("Converted video is not ready yet. Please retry in a moment.");
                });
        }
    }, []);

    const openSSE = useCallback(async (pid: string, requestedAspect?: "16:9" | "9:16") => {
        sseRef.current?.close();
        let token: string | null = null;
        try {
            token = await getCurrentAuthToken({ forceRefresh: true });
        } catch {
            token = null;
        }
        if (!token) {
            setError(AUTH_SESSION_RECOVERY_MESSAGE);
            setAgentStatusBulk(IDLE_AGENT_STATUS);
            return;
        }
        const url = orchestratorApi.streamUrl(pid, token);
        const es = new EventSource(url);
        sseRef.current = es;

        es.addEventListener("progress", (e) => {
            const data = JSON.parse((e as MessageEvent).data);
            setAgentStatusBulk(data.agent_status ?? {});
        });

        es.addEventListener("complete", (e) => {
            const data = JSON.parse((e as MessageEvent).data);
            const results = data.results ?? {};
            applyOrchestrationResults(pid, results, requestedAspect);
            es.close();
        });

        es.addEventListener("error", (e) => {
            const maybeData = (e as MessageEvent).data;
            if (typeof maybeData === "string" && maybeData.trim()) {
                try {
                    const payload = JSON.parse(maybeData) as {
                        message?: string;
                        failed_agents?: string[];
                        results?: any;
                    };
                    if (payload.results) {
                        applyOrchestrationResults(pid, payload.results, requestedAspect);
                    }
                    const failed = Array.isArray(payload.failed_agents) ? payload.failed_agents : [];
                    failed.forEach((agent) => {
                        setAgentStatus(agent as AgentName, "error");
                    });
                    setError(payload.message || "One or more AI agents failed.");
                } catch {
                    setError("One or more AI agents failed.");
                }
            } else {
                void orchestratorApi.status(pid)
                    .then((res) => {
                        const statusPayload = res.data as {
                            status?: string;
                            agent_status?: Partial<Record<AgentName, AgentState>>;
                            results?: any;
                        };
                        if (statusPayload.agent_status) {
                            setAgentStatusBulk(statusPayload.agent_status);
                        }
                        if (statusPayload.status === "complete") {
                            applyOrchestrationResults(pid, statusPayload.results ?? {}, requestedAspect);
                            return;
                        }
                        if (statusPayload.status === "error") {
                            const failed = Object.entries(statusPayload.agent_status ?? {})
                                .filter(([, state]) => state === "error")
                                .map(([agent]) => agent);
                            failed.forEach((agent) => setAgentStatus(agent as AgentName, "error"));
                            if (statusPayload.results) {
                                applyOrchestrationResults(pid, statusPayload.results, requestedAspect);
                            }
                            setError("One or more AI agents failed.");
                            return;
                        }
                        if (es.readyState !== EventSource.CONNECTING) {
                            setError("Connection to orchestrator stream was interrupted.");
                        }
                    })
                    .catch(() => {
                        if (es.readyState !== EventSource.CONNECTING) {
                            setError("Connection to orchestrator stream was interrupted.");
                        }
                    });
            }
            es.close();
        });
    }, [applyOrchestrationResults]);

    const runInitialCaptionPipeline = useCallback(async (pid: string, requestedAspect: "16:9" | "9:16") => {
        setAgentStatus("gaps", "running");
        try {
            await transcriptionApi.start(pid);
            let cuesHydrated = false;

            for (let tries = 0; tries < 60; tries += 1) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                const res = await subtitlesApi.get(pid);
                const track = pickPrimarySubtitleTrack(res.data.tracks || []);
                const cues = track?.cues || [];
                if (cues.length > 0) {
                    setSubtitleTrack(cues);
                    selectCue(getCueId(cues[0]) || null);
                    cuesHydrated = true;
                    break;
                }
            }

            if (!cuesHydrated) {
                throw new Error("Transcription did not produce captions yet. Please retry from the caption studio.");
            }

            setAgentStatus("gaps", "idle");
            const agents: AgentName[] = ["broll", "music", "gaps", "sfx", "transitions"];
            await orchestratorApi.run(pid, agents, { aspect_ratio: requestedAspect });
            agents.forEach((agent) => setAgentStatus(agent, "queued"));
            openSSE(pid, requestedAspect);
        } catch (err) {
            setAgentStatus("gaps", "error");
            throw err;
        }
    }, [openSSE, selectCue, setAgentStatus, setSubtitleTrack]);

    useEffect(() => {
        if (!routeProjectIdParam) {
            if (routeProjectId === "new" && routeLoadRef.current !== "new") {
                routeLoadRef.current = "new";
                sseRef.current?.close();
                setProjectId(null);
                setProjectName("Untitled");
                setVideoBlobUrl(null);
                setSubtitleTrack([]);
                setBrollTrack([]);
                setBrollSuggestions([]);
                setMotionGraphicsTrack([]);
                setMotionGraphicsSuggestions([]);
                setMusicTrack(null);
                setSFXTrack([]);
                setTransitions([]);
                setGapCuts([]);
                setAgentStatusBulk(IDLE_AGENT_STATUS);
                selectCue(null);
                setTime(0);
                setDuration(0);
                setPlaying(false);
                setError(null);
                setUploadPct(null);
            }
            if (routeProjectId && routeProjectId !== "new") {
                navigate("/dashboard/translate", { replace: true });
            }
            return;
        }

        const routePid = routeProjectIdParam!;
        if (routeLoadRef.current === routePid) return;
        routeLoadRef.current = routePid;

        let cancelled = false;
        const requestedAspect = useTimeline.getState().aspectRatio;

        const loadRouteProject = async () => {
            sseRef.current?.close();
            setError(null);
            setUploadPct(null);
            setProjectId(routePid);
            setProjectName("Loading project...");
            setVideoBlobUrl(null);
            setSubtitleTrack([]);
            setBrollTrack([]);
            setBrollSuggestions([]);
            setMotionGraphicsTrack([]);
            setMotionGraphicsSuggestions([]);
            setMusicTrack(null);
            setSFXTrack([]);
            setTransitions([]);
            setGapCuts([]);
            setAgentStatusBulk(IDLE_AGENT_STATUS);
            selectCue(null);
            setTime(0);
            setDuration(0);
            setPlaying(false);

            try {
                const [projectRes, videoUrl, subtitlesRes] = await Promise.allSettled([
                    projectsApi.get(routePid),
                    mediaApi.getAuthenticatedStreamUrl(routePid, requestedAspect),
                    subtitlesApi.get(routePid),
                ]);
                if (cancelled) return;

                if (projectRes.status === "fulfilled") {
                    setProjectName(projectRes.value.data.name || "Untitled");
                } else {
                    setProjectName("Untitled");
                }

                if (videoUrl.status === "fulfilled") {
                    setVideoBlobUrl(videoUrl.value);
                } else {
                    setError("Unable to load project media. Upload may still be processing.");
                }

                const track = subtitlesRes.status === "fulfilled"
                    ? pickPrimarySubtitleTrack(subtitlesRes.value.data.tracks || [])
                    : null;
                const cues = track?.cues || [];
                if (cues.length > 0) {
                    setSubtitleTrack(cues);
                    selectCue(getCueId(cues[0]) || null);
                }

                if (routeShouldAutostart && cues.length === 0 && autoStartedRef.current !== routePid) {
                    autoStartedRef.current = routePid;
                    runInitialCaptionPipeline(routePid, requestedAspect).catch((err: any) => {
                        if (cancelled) return;
                        setError(getApiErrorMessage(err, "Caption generation failed. Please retry."));
                    });
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError(getApiErrorMessage(err, "Failed to load caption project."));
                }
            }
        };

        void loadRouteProject();

        return () => {
            cancelled = true;
        };
    }, [
        navigate,
        routeProjectId,
        routeProjectIdParam,
        routeShouldAutostart,
        runInitialCaptionPipeline,
        selectCue,
        setAgentStatusBulk,
        setBrollSuggestions,
        setBrollTrack,
        setMotionGraphicsSuggestions,
        setMotionGraphicsTrack,
        setDuration,
        setGapCuts,
        setMusicTrack,
        setPlaying,
        setProjectId,
        setProjectName,
        setSFXTrack,
        setSubtitleTrack,
        setTime,
        setTransitions,
        setVideoBlobUrl,
    ]);

    // ── Upload handler ───────────────────────────────────────────────────
    const handleFileSelected = useCallback(async (file: File) => {
        setError(null);
        setMoodProfile(null);
        setMusicSuggestions([]);
        setMusicEmptyReason(null);
        setSfxSuggestions([]);
        setSfxEmptyReason(null);
        setMotionGraphicsTrack([]);
        setMotionGraphicsSuggestions([]);
        try {
            // 1. Create project
            const proj = await projectsApi.create(file.name.replace(/\.[^.]+$/, ""), "video-caption");
            const pid = proj.data.id;
            setProjectId(pid);
            setProjectName(proj.data.name);
            routeLoadRef.current = pid;

            // 2. Upload media
            setUploadPct(0);
            await mediaApi.upload(pid, file, (e) => {
                if (e.total) setUploadPct(Math.round((e.loaded / e.total) * 100));
            });
            setUploadPct(null);

            // 3. Get video blob URL for preview
            const blobUrl = await mediaApi.getAuthenticatedStreamUrl(pid, aspectRatio);
            setVideoBlobUrl(blobUrl);
            navigate(`/dashboard/caption-editor/${pid}`, { replace: true });
            await runInitialCaptionPipeline(pid, aspectRatio);

            // 4. Transcribe → captions
        } catch (err: any) {
            setError(getApiErrorMessage(err, "Upload failed"));
            setUploadPct(null);
        }
    }, [aspectRatio, navigate, runInitialCaptionPipeline, setMotionGraphicsSuggestions, setMotionGraphicsTrack, setProjectId, setProjectName, setVideoBlobUrl]);

    // ── Aspect ratio change → trigger crop ──────────────────────────────
    const handleAspectChange = useCallback(async (r: "16:9" | "9:16") => {
        setAspectRatio(r);
        if (!projectId) return;
        setAgentStatus("crop", "queued");
        try {
            await orchestratorApi.run(projectId, ["crop"], { aspect_ratio: r });
            openSSE(projectId, r);
        } catch {
            setAgentStatus("crop", "error");
        }
    }, [projectId, openSSE]);

    const handleSelectTemplate = useCallback((templateId: string) => {
        setSelectedTemplate(templateId);
        clearCustomStyle();
    }, [setSelectedTemplate, clearCustomStyle]);

    const handleResetPanelStyle = useCallback(() => {
        setSelectedTemplate(null);
        clearCustomStyle();
    }, [setSelectedTemplate, clearCustomStyle]);

    // ── Cue Handlers ───────────────────────────────────────────────────
    const onUpdateCue = async (cueId: string, updates: any) => {
        const idx = subtitleTrack.findIndex((c: any) => getCueId(c) === cueId);
        if (idx === -1) return;
        const newTrack = [...subtitleTrack];
        newTrack[idx] = { ...newTrack[idx], ...updates };
        setSubtitleTrack(newTrack);
        try {
            if (cueId.startsWith("split_") && projectId) {
                const res = await subtitlesApi.updateAllCues(projectId, newTrack);
                if (res.data.cues) setSubtitleTrack(res.data.cues);
            } else {
                const res = await subtitlesApi.updateCue(cueId, updates);
                if (res.data) {
                    const saved = res.data as any;
                    setSubtitleTrack(newTrack.map((cue: any) => getCueId(cue) === cueId ? { ...cue, ...saved } : cue));
                }
            }
        } catch (err: any) {
            setError("Failed to save cue update.");
        }
    };

    const onDeleteCue = async (cueId: string) => {
        if (!projectId) return;
        const newTrack = subtitleTrack.filter((c: any) => getCueId(c) !== cueId);
        setSubtitleTrack(newTrack);
        try {
            const res = await subtitlesApi.updateAllCues(projectId, newTrack);
            if (res.data.cues) setSubtitleTrack(res.data.cues);
        } catch (err: any) {
            setError("Failed to delete cue.");
        }
    };

    const onSplitCue = async (cueId: string, charIndex: number) => {
        if (!projectId) return;
        const idx = subtitleTrack.findIndex((c: any) => getCueId(c) === cueId);
        if (idx === -1) return;

        const cue = subtitleTrack[idx];
        const text1 = cue.text.substring(0, charIndex).trim();
        const text2 = cue.text.substring(charIndex).trim();
        if (!text1 || !text2) return;

        const duration = cue.end_ms - cue.start_ms;
        const textLen = cue.text?.length || 1;
        const ratio = charIndex / textLen;
        const splitMs = Math.round(cue.start_ms + (duration * ratio));

        const cue1 = { ...cue, text: text1, end_ms: splitMs };
        const cue2 = { ...cue, _id: `split_${crypto.randomUUID()}`, id: undefined, text: text2, start_ms: splitMs };

        const newTrack = [
            ...subtitleTrack.slice(0, idx),
            cue1,
            cue2,
            ...subtitleTrack.slice(idx + 1)
        ];

        setSubtitleTrack(newTrack);
        try {
            const res = await subtitlesApi.updateAllCues(projectId, newTrack);
            if (res.data.cues) setSubtitleTrack(res.data.cues);
        } catch (err: any) {
            setError("Failed to split cue.");
        }
    };

    // ── Individual agent re-run ──────────────────────────────────────────
    const onInsertCueAfter = useCallback(async (cueId: string) => {
        if (!projectId) return;
        const idx = subtitleTrack.findIndex((c: any) => getCueId(c) === cueId);
        if (idx === -1) return;

        const current = subtitleTrack[idx];
        const next = subtitleTrack[idx + 1];
        const currentText = String(current.text ?? "").trim();
        const availableGap = next ? Math.max(0, Number(next.start_ms) - Number(current.end_ms)) : Number.POSITIVE_INFINITY;

        if (availableGap < 180 && currentText.length > 2) {
            const splitIdx = Math.max(1, Math.floor(currentText.length * 0.6));
            await onSplitCue(cueId, splitIdx);
            return;
        }

        const startMs = Math.max(0, Math.round(Number(current.end_ms) || 0));
        const baseDuration = Math.max(450, Math.min(1400, Math.round((Number(current.end_ms) - Number(current.start_ms)) * 0.65)));
        const maxEndByNext = next ? Math.max(startMs + 120, Math.round(Number(next.start_ms) - 10)) : startMs + baseDuration;
        const endMs = Math.max(startMs + 120, Math.min(startMs + baseDuration, maxEndByNext));

        const newCue = {
            ...current,
            _id: `insert_${crypto.randomUUID()}`,
            id: undefined,
            start_ms: startMs,
            end_ms: endMs,
            text: "New Caption",
        };

        const newTrack = [
            ...subtitleTrack.slice(0, idx + 1),
            newCue,
            ...subtitleTrack.slice(idx + 1),
        ];

        setSubtitleTrack(newTrack);
        selectCue(newCue._id);

        try {
            const res = await subtitlesApi.updateAllCues(projectId, newTrack);
            if (res.data.cues) {
                setSubtitleTrack(res.data.cues);
                const persisted = res.data.cues.find((cue: any) =>
                    Math.round(Number(cue.start_ms) || 0) === startMs &&
                    Math.round(Number(cue.end_ms) || 0) === endMs &&
                    String(cue.text ?? "").trim() === "New Caption",
                );
                if (persisted) selectCue(getCueId(persisted));
            }
        } catch {
            setError("Failed to insert cue.");
        }
    }, [projectId, subtitleTrack, onSplitCue, selectCue]);

    const runAgent = useCallback(async (agent: AgentName) => {
        if (!projectId) return;
        setAgentStatus(agent, "queued");
        try {
            await orchestratorApi.run(projectId, [agent]);
            openSSE(projectId);
            pushToast(`${AGENT_LABEL[agent]} started`, "info");
        } catch {
            setAgentStatus(agent, "error");
            pushToast(`${AGENT_LABEL[agent]} failed to start`, "error");
        }
    }, [projectId, openSSE, pushToast]);

    const runAllAgents = useCallback(async () => {
        if (!projectId) return;
        const agents: AgentName[] = ["broll", "music", "gaps", "sfx", "transitions", "crop"];
        agents.forEach((agent) => setAgentStatus(agent, "queued"));
        try {
            await orchestratorApi.run(projectId, agents);
            openSSE(projectId);
            pushToast("All AI agents started", "info");
        } catch {
            agents.forEach((agent) => setAgentStatus(agent, "error"));
            pushToast("Failed to start AI run", "error");
        }
    }, [projectId, openSSE, pushToast]);

    const fitCaptionsToAspect = useCallback(() => {
        if (aspectRatio === "9:16") {
            setCustomStyle({
                fontSize: Math.max(30, Number(customStyle.fontSize ?? 34)),
                maxWidthPct: 72,
                lineHeight: 1.12,
                position: "bottom",
            });
        } else {
            setCustomStyle({
                fontSize: Math.max(26, Number(customStyle.fontSize ?? 30)),
                maxWidthPct: 88,
                lineHeight: 1.16,
                position: "bottom",
            });
        }
        pushToast("Caption layout fitted to aspect ratio", "success");
    }, [aspectRatio, customStyle.fontSize, setCustomStyle, pushToast]);

    const startPanelResize = useCallback((side: "left" | "right", e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = side === "left" ? leftPanelWidth : rightPanelWidth;
        const onMove = (ev: PointerEvent) => {
            const delta = ev.clientX - startX;
            if (side === "left") {
                setLeftPanelWidth(clampPanel(startWidth + delta, 270, 460));
            } else {
                setRightPanelWidth(clampPanel(startWidth - delta, 300, 480));
            }
        };
        const onUp = () => {
            document.body.style.cursor = "";
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };
        document.body.style.cursor = "col-resize";
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    }, [leftPanelWidth, rightPanelWidth]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
                e.preventDefault();
                setLeftCollapsed((prev) => !prev);
            } else if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
                e.preventDefault();
                setRightCollapsed((prev) => !prev);
            } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "r") {
                e.preventDefault();
                void runAllAgents();
            } else if (e.key === "?" || (e.shiftKey && e.key === "/")) {
                e.preventDefault();
                setShortcutsOpen((prev) => !prev);
            } else if (e.key === "Escape") {
                setShortcutsOpen(false);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [runAllAgents]);

    const applyMusicSuggestion = useCallback((track: MusicSuggestion, mode: "add" | "replace" = "add", dropStartMs?: number) => {
        if (mode === "add" && musicTrack) return;
        const suggestedStartMs = Number.isFinite(Number(track.timeline_start_ms))
            ? Math.max(0, Math.round(Number(track.timeline_start_ms)))
            : 0;
        const suggestedEndMs = Number.isFinite(Number(track.timeline_end_ms))
            ? Math.max(suggestedStartMs + 1, Math.round(Number(track.timeline_end_ms)))
            : Math.max(suggestedStartMs + 1000, suggestedStartMs + Math.round((track.duration || Math.max(30, Math.round(durationMs / 1000))) * 1000));
        const clipDurationMs = Math.max(1000, suggestedEndMs - suggestedStartMs);
        const rawStartMs = Number.isFinite(Number(dropStartMs)) ? Number(dropStartMs) : suggestedStartMs;
        const boundedStartMs = Math.max(0, Math.round(rawStartMs));
        const projectLimit = durationMs > 0 ? Math.round(durationMs) : Number.POSITIVE_INFINITY;
        const maxStart = Number.isFinite(projectLimit) ? Math.max(0, projectLimit - clipDurationMs) : boundedStartMs;
        const startMs = Math.min(boundedStartMs, maxStart);
        const endMs = Number.isFinite(projectLimit) ? Math.min(startMs + clipDurationMs, projectLimit) : startMs + clipDurationMs;
        const durationSec = Math.max(0.1, (endMs - startMs) / 1000);
        setMusicTrack({
            id: track.id || `music-${Date.now()}`,
            name: track.name,
            preview_url: track.preview_url ?? null,
            start_ms: startMs,
            end_ms: endMs,
            duration: durationSec,
            trim_start_ms: Number.isFinite(Number(track.trim_start_ms)) ? Math.max(0, Math.round(Number(track.trim_start_ms))) : 0,
            trim_end_ms: Number.isFinite(Number(track.trim_end_ms)) ? Math.max(1, Math.round(Number(track.trim_end_ms))) : undefined,
            volume_db: -15,
        });
    }, [musicTrack, durationMs]);

    const removeMusicTrack = useCallback(() => {
        setMusicTrack(null);
    }, []);

    const sfxTimelineId = (s: SFXSuggestion) => `sfx-${s.cue_id}`;
    const isSfxInTimeline = useCallback((s: SFXSuggestion) => sfxTrack.some((clip: any) => clip.id === sfxTimelineId(s)), [sfxTrack]);

    const applySfxSuggestion = useCallback((s: SFXSuggestion, mode: "add" | "replace" = "add", dropStartMs?: number) => {
        const suggestedStartMs = Number.isFinite(Number(s.start_ms)) ? Math.max(0, Math.round(Number(s.start_ms))) : 0;
        const suggestedEndMs = Number.isFinite(Number(s.end_ms))
            ? Math.max(suggestedStartMs + 1, Math.round(Number(s.end_ms)))
            : suggestedStartMs + Math.max(100, Math.round(Number(s.sfx?.duration ?? 0.6) * 1000));
        const clipDurationMs = Math.max(90, suggestedEndMs - suggestedStartMs);
        const rawStartMs = Number.isFinite(Number(dropStartMs)) ? Number(dropStartMs) : suggestedStartMs;
        const boundedStartMs = Math.max(0, Math.round(rawStartMs));
        const projectLimit = durationMs > 0 ? Math.round(durationMs) : Number.POSITIVE_INFINITY;
        const maxStart = Number.isFinite(projectLimit) ? Math.max(0, projectLimit - clipDurationMs) : boundedStartMs;
        const startMs = Math.min(boundedStartMs, maxStart);
        const endMs = Number.isFinite(projectLimit) ? Math.min(startMs + clipDurationMs, projectLimit) : startMs + clipDurationMs;
        const nextClip = {
            id: sfxTimelineId(s),
            name: s.sfx?.name ?? "SFX",
            file_url: s.sfx?.file_url ?? "",
            mood: s.sfx?.mood ?? [],
            duration: Math.max(0.1, (endMs - startMs) / 1000),
            start_ms: startMs,
            end_ms: endMs,
            trim_start_ms: Number.isFinite(Number(s.trim_start_ms)) ? Math.max(0, Math.round(Number(s.trim_start_ms))) : 0,
            trim_end_ms: Number.isFinite(Number(s.trim_end_ms)) ? Math.max(1, Math.round(Number(s.trim_end_ms))) : undefined,
            volume_db: -7,
        };
        if (mode === "replace") {
            const others = sfxTrack.filter((clip: any) => clip.id !== nextClip.id);
            setSFXTrack([...others, nextClip] as any);
            return;
        }
        if (sfxTrack.some((clip: any) => clip.id === nextClip.id)) return;
        setSFXTrack([...sfxTrack, nextClip] as any);
    }, [sfxTrack, durationMs]);

    const removeSfxSuggestion = useCallback((s: SFXSuggestion) => {
        const targetId = sfxTimelineId(s);
        setSFXTrack(sfxTrack.filter((clip: any) => clip.id !== targetId) as any);
    }, [sfxTrack]);

    const makeTimelineBrollId = useCallback((s: BrollSuggestion) => `${s.cue_id}-${s.broll?.pexels_id ?? "clip"}`, []);
    const resolveDroppedBrollWindow = useCallback((s: BrollSuggestion, dropStartMs: number) => {
        const cue = subtitleTrack.find((c: any) => String(getCueId(c)) === String(s.cue_id));
        const cueStart = cue ? Number(cue.start_ms) : Number.NaN;
        const cueEnd = cue ? Number(cue.end_ms) : Number.NaN;
        const suggestedStart = Number(s.start_ms);
        const suggestedEnd = Number(s.end_ms);
        const fallbackStart = Number.isFinite(suggestedStart)
            ? Math.max(0, Math.round(suggestedStart))
            : Number.isFinite(cueStart)
                ? Math.max(0, Math.round(cueStart))
                : 0;
        const fallbackEnd = Number.isFinite(suggestedEnd) && suggestedEnd > fallbackStart
            ? Math.round(suggestedEnd)
            : Number.isFinite(cueEnd) && cueEnd > fallbackStart
                ? Math.round(cueEnd)
                : fallbackStart + 3000;
        const clipDurationMs = Math.max(34, Math.min(3000, fallbackEnd - fallbackStart));
        const projectEnd = durationMs > 0 ? Math.round(durationMs) : Number.POSITIVE_INFINITY;
        const boundedStart = Math.max(0, Math.round(dropStartMs));
        const maxStart = Number.isFinite(projectEnd) ? Math.max(0, projectEnd - clipDurationMs) : boundedStart;
        const startMs = Math.min(boundedStart, maxStart);
        const endMs = Number.isFinite(projectEnd) ? Math.min(startMs + clipDurationMs, projectEnd) : startMs + clipDurationMs;
        return { startMs, endMs: Math.max(startMs + 1, Math.round(endMs)) };
    }, [subtitleTrack, durationMs]);

    const makeTimelineMotionId = useCallback((s: MotionGraphicSuggestion) => String(s.clip_id || `${s.cue_id}-${s.start_ms}`), []);
    const resolveDroppedMotionWindow = useCallback((s: MotionGraphicSuggestion, dropStartMs: number) => {
        const suggestedStart = Number(s.start_ms);
        const suggestedEnd = Number(s.end_ms);
        const fallbackStart = Number.isFinite(suggestedStart) ? Math.max(0, Math.round(suggestedStart)) : 0;
        const fallbackEnd = Number.isFinite(suggestedEnd) && suggestedEnd > fallbackStart
            ? Math.round(suggestedEnd)
            : fallbackStart + 1800;
        const clipDurationMs = Math.max(100, Math.min(3000, fallbackEnd - fallbackStart));
        const projectEnd = durationMs > 0 ? Math.round(durationMs) : Number.POSITIVE_INFINITY;
        const boundedStart = Math.max(0, Math.round(dropStartMs));
        const maxStart = Number.isFinite(projectEnd) ? Math.max(0, projectEnd - clipDurationMs) : boundedStart;
        const startMs = Math.min(boundedStart, maxStart);
        const endMs = Number.isFinite(projectEnd) ? Math.min(startMs + clipDurationMs, projectEnd) : startMs + clipDurationMs;
        return { startMs, endMs: Math.max(startMs + 1, Math.round(endMs)) };
    }, [durationMs]);

    const handleTimelineDragStart = useCallback((payload: TimelineDragPayload) => {
        setTimelineDragPayload(payload);
    }, []);

    const handleTimelineDragEnd = useCallback(() => {
        setTimelineDragPayload(null);
    }, []);

    const handleTimelineExternalDrop = useCallback((target: TimelineDropTarget, startMs: number) => {
        if (!timelineDragPayload) return;

        if (timelineDragPayload.kind === "broll" && target === "broll") {
            const s = timelineDragPayload.suggestion;
            if (s.broll?.video_url) {
                const timelineId = makeTimelineBrollId(s);
                const { startMs: nextStart, endMs: nextEnd } = resolveDroppedBrollWindow(s, startMs);
                const existing = brollTrack.find((clip: any) => String(clip.pexels_id) === String(timelineId));
                if (existing) {
                    updateBroll(timelineId, { start_ms: nextStart, end_ms: nextEnd } as any);
                } else {
                    addBroll({
                        ...s.broll,
                        pexels_id: timelineId,
                        original_pexels_id: s.broll.pexels_id,
                        start_ms: nextStart,
                        end_ms: nextEnd,
                        cue_text: s.text,
                    } as any);
                }
            }
        }

        if (timelineDragPayload.kind === "motion" && target === "motion") {
            const s = timelineDragPayload.suggestion;
            const timelineId = makeTimelineMotionId(s);
            const { startMs: nextStart, endMs: nextEnd } = resolveDroppedMotionWindow(s, startMs);
            const existing = motionGraphicsTrack.find((clip: any) => String(clip.clip_id) === timelineId);
            if (existing) {
                updateMotionGraphic(timelineId, { start_ms: nextStart, end_ms: nextEnd } as any);
            } else {
                addMotionGraphic({
                    ...s,
                    clip_id: timelineId,
                    start_ms: nextStart,
                    end_ms: nextEnd,
                    cue_text: s.source_text || s.text,
                } as any);
            }
        }

        if (timelineDragPayload.kind === "music" && target === "music") {
            applyMusicSuggestion(timelineDragPayload.suggestion, musicTrack ? "replace" : "add", startMs);
        }

        if (timelineDragPayload.kind === "sfx" && target === "sfx") {
            const s = timelineDragPayload.suggestion;
            const mode: "add" | "replace" = sfxTrack.some((clip: any) => clip.id === sfxTimelineId(s)) ? "replace" : "add";
            applySfxSuggestion(s, mode, startMs);
        }

        setTimelineDragPayload(null);
    }, [timelineDragPayload, brollTrack, addBroll, updateBroll, makeTimelineBrollId, resolveDroppedBrollWindow, motionGraphicsTrack, addMotionGraphic, updateMotionGraphic, makeTimelineMotionId, resolveDroppedMotionWindow, applyMusicSuggestion, musicTrack, applySfxSuggestion, sfxTrack]);

    // ── Export ───────────────────────────────────────────────────────────
    const handleExport = useCallback(async () => {
        if (!projectId) return;
        setExportLoading(true);
        try {
            const templateStyle = sanitizeCaptionStyle(
                selectedTpl && TEMPLATES_CONFIG[selectedTpl]
                    ? (TEMPLATES_CONFIG[selectedTpl] as unknown as Record<string, unknown>)
                    : undefined,
            );
            const customStylePayload = sanitizeCaptionStyle(customStyle as Record<string, unknown>);
            const style = sanitizeCaptionStyle({ ...templateStyle, ...customStylePayload });
            const exportBrollTrack = brollTrack
                .filter((clip: any) => !!clip?.video_url)
                .map((clip: any) => ({
                    video_url: String(clip.video_url),
                    pexels_id: clip.pexels_id ? String(clip.pexels_id) : undefined,
                    start_ms: Number.isFinite(Number(clip.start_ms)) ? Number(clip.start_ms) : 0,
                    end_ms: Number.isFinite(Number(clip.end_ms)) ? Number(clip.end_ms) : 0,
                }));
            const exportMusicTrack = musicTrack?.preview_url
                ? {
                    preview_url: String(musicTrack.preview_url),
                    start_ms: Number.isFinite(Number(musicTrack.start_ms)) ? Number(musicTrack.start_ms) : 0,
                    end_ms: Number.isFinite(Number(musicTrack.end_ms))
                        ? Number(musicTrack.end_ms)
                        : Number.isFinite(Number(musicTrack.duration))
                            ? Number(musicTrack.start_ms ?? 0) + Math.round(Number(musicTrack.duration) * 1000)
                            : undefined,
                    duration: Number.isFinite(Number(musicTrack.duration)) ? Number(musicTrack.duration) : undefined,
                    trim_start_ms: Number.isFinite(Number(musicTrack.trim_start_ms)) ? Number(musicTrack.trim_start_ms) : 0,
                    trim_end_ms: Number.isFinite(Number(musicTrack.trim_end_ms)) ? Number(musicTrack.trim_end_ms) : undefined,
                    volume_db: Number.isFinite(Number(musicTrack.volume_db)) ? Number(musicTrack.volume_db) : -15,
                }
                : undefined;
            const exportMotionGraphicsTrack = motionGraphicsTrack
                .filter((clip: any) => !!clip?.text)
                .map((clip: any) => ({
                    clip_id: String(clip.clip_id),
                    cue_id: clip.cue_id ? String(clip.cue_id) : undefined,
                    text: String(clip.text || clip.keyword || "Key moment"),
                    keyword: clip.keyword ? String(clip.keyword) : undefined,
                    source_text: clip.source_text ? String(clip.source_text) : undefined,
                    start_ms: Number.isFinite(Number(clip.start_ms)) ? Number(clip.start_ms) : 0,
                    end_ms: Number.isFinite(Number(clip.end_ms)) ? Number(clip.end_ms) : 0,
                    style: clip.style ? String(clip.style) : undefined,
                    style_family: clip.style_family ? String(clip.style_family) : undefined,
                    moment_type: clip.moment_type ? String(clip.moment_type) : undefined,
                    motion_role: clip.motion_role ? String(clip.motion_role) : undefined,
                    motion_principle: clip.motion_principle ? String(clip.motion_principle) : undefined,
                    important_words: Array.isArray(clip.important_words) ? clip.important_words.map((word: any) => String(word)).filter(Boolean).slice(0, 3) : undefined,
                    placement: clip.placement ? String(clip.placement) : undefined,
                    accent_color: clip.accent_color ? String(clip.accent_color) : undefined,
                    background: clip.background ? String(clip.background) : undefined,
                    solid_background: clip.solid_background ? String(clip.solid_background) : undefined,
                    image_url: clip.image_url ? String(clip.image_url) : undefined,
                    image_alt: clip.image_alt ? String(clip.image_alt) : undefined,
                    image_pexels_id: clip.image_pexels_id ? String(clip.image_pexels_id) : undefined,
                    image_credit: clip.image_credit ? String(clip.image_credit) : undefined,
                    image_query: clip.image_query ? String(clip.image_query) : undefined,
                    animation: clip.animation ? String(clip.animation) : undefined,
                    sound_cue: clip.sound_cue ? String(clip.sound_cue) : undefined,
                    editing_note: clip.editing_note ? String(clip.editing_note) : undefined,
                }));
            const exportSfxTrack = sfxTrack
                .filter((clip: any) => !!clip?.file_url)
                .map((clip: any) => ({
                    file_url: String(clip.file_url),
                    start_ms: Number.isFinite(Number(clip.start_ms)) ? Number(clip.start_ms) : 0,
                    end_ms: Number.isFinite(Number(clip.end_ms))
                        ? Number(clip.end_ms)
                        : Number.isFinite(Number(clip.duration))
                            ? Number(clip.start_ms ?? 0) + Math.round(Number(clip.duration) * 1000)
                            : undefined,
                    duration: Number.isFinite(Number(clip.duration)) ? Number(clip.duration) : undefined,
                    trim_start_ms: Number.isFinite(Number(clip.trim_start_ms)) ? Number(clip.trim_start_ms) : 0,
                    trim_end_ms: Number.isFinite(Number(clip.trim_end_ms)) ? Number(clip.trim_end_ms) : undefined,
                    volume_db: Number.isFinite(Number(clip.volume_db)) ? Number(clip.volume_db) : -7,
                }));
            const res = await exportApi.mp4(
                projectId,
                subtitleTrack,
                Object.keys(style).length > 0 ? style : undefined,
                aspectRatio,
                previewViewport ?? undefined,
                exportBrollTrack.length > 0 ? exportBrollTrack : undefined,
                exportMotionGraphicsTrack.length > 0 ? exportMotionGraphicsTrack : undefined,
                exportMusicTrack,
                exportSfxTrack.length > 0 ? exportSfxTrack : undefined,
            );
            const url = URL.createObjectURL(res.data);
            const a = document.createElement("a");
            a.href = url; a.download = `${projectName}.mp4`; a.click();
            URL.revokeObjectURL(url);
            pushToast("Export completed", "success");
        } catch (err: any) {
            const message = getApiErrorMessage(err, "Export failed");
            setError(message);
            pushToast(message, "error");
        } finally { setExportLoading(false); }
    }, [projectId, subtitleTrack, brollTrack, motionGraphicsTrack, musicTrack, sfxTrack, selectedTpl, customStyle, aspectRatio, projectName, previewViewport, pushToast]);

    // ── Progress bar click ───────────────────────────────────────────────
    const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const rect = progressRef.current?.getBoundingClientRect();
        if (!rect || !videoRef.current) return;
        const newTimeMs = (e.clientX - rect.left) / (zoom / 1000);
        videoRef.current.currentTime = Math.max(0, Math.min(newTimeMs / 1000, videoRef.current.duration || 0));
    }, [zoom]);

    // ── Derived ──────────────────────────────────────────────────────────
    const playheadPct = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0;

    // ── Render ───────────────────────────────────────────────────────────
    return (
        <div
            style={{
                ...CAPTION_STUDIO_LIGHT_VARS,
                colorScheme: "light",
                display: "flex",
                flexDirection: "column",
                height: "100vh",
                overflow: "hidden",
                background: `linear-gradient(180deg, oklch(0.992 0 0), ${UI.appBg} 42%, ${UI.appBgSoft})`,
                fontFamily: C.font,
                color: UI.textStrong,
            }}
        >
            {/* Top bar */}
            <TopBar
                projectName={projectName}
                onExport={handleExport}
                exportLoading={exportLoading}
                leftCollapsed={leftCollapsed}
                rightCollapsed={rightCollapsed}
                onToggleLeft={() => setLeftCollapsed((prev) => !prev)}
                onToggleRight={() => setRightCollapsed((prev) => !prev)}
            />

            <WorkspaceToolbar
                onRunAllAgents={runAllAgents}
                onFitCaptions={fitCaptionsToAspect}
                onToggleShortcuts={() => setShortcutsOpen(true)}
                selectedTemplate={selectedTpl}
                cueCount={subtitleTrack.length}
                aspectRatio={aspectRatio}
                activeLeftTab={leftTab}
                activeRightTab={rightTab}
                onFocusCaptions={() => setLeftTab("ai-caption")}
                onFocusMedia={() => setLeftTab("b-roll")}
                onFocusMotion={() => {
                    setRightTab("anime");
                    setRightCollapsed(false);
                }}
                onFocusLooks={() => {
                    setLeftTab("template");
                    setRightTab("type");
                    setRightCollapsed(false);
                }}
            />

            {/* Error banner */}
            {error && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.dangerLight, color: C.danger, fontSize: 12, padding: "9px 18px", borderBottom: `1px solid color-mix(in oklch, ${C.danger} 35%, white)`, flexShrink: 0, fontWeight: 750 }}>
                    {error}
                    <button onClick={() => setError(null)} style={{ ...btnBase, marginLeft: "auto", color: C.danger, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
                </div>
            )}

            {/* 3-column layout */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0, position: "relative", padding: "16px 18px 0", gap: 0 }}>
                {!leftCollapsed && (
                    <div style={{ width: leftPanelWidth, minWidth: 0, display: "flex", minHeight: 0 }}>
                        <LeftPanel
                            activeTab={leftTab} setActiveTab={setLeftTab}
                            currentTimeMs={currentTimeMs} selectedCueId={selectedCueId} onSelectCue={selectCue}
                            onUpdateCue={onUpdateCue} onSplitCue={onSplitCue} onDeleteCue={onDeleteCue} onInsertCueAfter={onInsertCueAfter} durationMs={durationMs}
                            brollTrack={brollTrack} brollSuggestions={brollSuggestions}
                            motionGraphicsTrack={motionGraphicsTrack}
                            motionGraphicsSuggestions={motionGraphicsSuggestions}
                            agentStatus={agentStatus}
                            templates={TEMPLATES} selectedTpl={selectedTpl} onSelectTpl={handleSelectTemplate}
                            onRunAgent={runAgent}
                            onTimelineDragStart={handleTimelineDragStart}
                            onTimelineDragEnd={handleTimelineDragEnd}
                            musicTrack={musicTrack}
                            moodProfile={moodProfile}
                            musicSuggestions={musicSuggestions}
                            musicEmptyReason={musicEmptyReason}
                            sfxSuggestions={sfxSuggestions}
                            sfxEmptyReason={sfxEmptyReason}
                            onAddMusic={applyMusicSuggestion}
                            onReplaceMusic={(track: MusicSuggestion) => applyMusicSuggestion(track, "replace")}
                            onRemoveMusic={removeMusicTrack}
                            onAddSfx={applySfxSuggestion}
                            onReplaceSfx={(s: SFXSuggestion) => applySfxSuggestion(s, "replace")}
                            onRemoveSfx={removeSfxSuggestion}
                            isSfxInTimeline={isSfxInTimeline}
                            projectId={projectId}
                            setBrollSuggestions={setBrollSuggestions}
                            setMotionGraphicsSuggestions={setMotionGraphicsSuggestions}
                        />
                    </div>
                )}
                {!leftCollapsed && (
                    <div
                        onPointerDown={(e) => startPanelResize("left", e)}
                        style={{ width: 10, cursor: "col-resize", background: "transparent", flexShrink: 0 }}
                    />
                )}

                <div style={{ flex: 1, minWidth: 0, display: "flex", minHeight: 0 }}>
                    <CenterCanvas
                        videoRef={videoRef} videoBlobUrl={videoBlobUrl}
                        aspectRatio={aspectRatio} onAspectChange={handleAspectChange}
                        uploadPct={uploadPct}
                        onFileSelected={handleFileSelected}
                        onViewportChange={setPreviewViewport}
                        fileInputRef={fileInputRef}
                        subtitleTrack={subtitleTrack} currentTimeMs={currentTimeMs}
                        isPlaying={isPlaying}
                        selectedTpl={selectedTpl} templates={TEMPLATES}
                        cropState={agentStatus.crop}
                        customStyle={customStyle}
                        brollTrack={brollTrack}
                        motionGraphicsTrack={motionGraphicsTrack}
                        musicTrack={musicTrack}
                        sfxTrack={sfxTrack}
                        layerVisibility={layerVisibility}
                    />
                </div>

                {!rightCollapsed && (
                    <div
                        onPointerDown={(e) => startPanelResize("right", e)}
                        style={{ width: 10, cursor: "col-resize", background: "transparent", flexShrink: 0 }}
                    />
                )}
                {!rightCollapsed && (
                    <div style={{ width: rightPanelWidth, minWidth: 0, display: "flex", minHeight: 0 }}>
                        <SimpleRightPanel
                            activeTab={rightTab} setActiveTab={setRightTab}
                            selectedTpl={selectedTpl}
                            onSelectTpl={handleSelectTemplate}
                            templates={TEMPLATES}
                            customStyle={customStyle}
                            setCustomStyle={setCustomStyle}
                            subtitleTrack={subtitleTrack}
                            selectedCueId={selectedCueId}
                            saveState={panelSaveState}
                            onResetStyles={handleResetPanelStyle}
                            projectId={projectId}
                            motionGraphicsTrack={motionGraphicsTrack}
                            motionGraphicsSuggestions={motionGraphicsSuggestions}
                            setMotionGraphicsSuggestions={setMotionGraphicsSuggestions}
                            onTimelineDragStart={handleTimelineDragStart}
                            onTimelineDragEnd={handleTimelineDragEnd}
                        />
                    </div>
                )}

                {leftCollapsed && (
                    <button
                        onClick={() => setLeftCollapsed(false)}
                        title="Show left panel"
                        style={{
                            ...btnBase,
                            position: "absolute",
                            left: 8,
                            top: 10,
                            width: 30,
                            height: 30,
                            borderRadius: 7,
                            background: UI.appBgElev,
                            border: `1px solid ${UI.borderStrong}`,
                            color: UI.textStrong,
                            zIndex: 80,
                        }}
                    >
                        <ChevronsRight size={14} />
                    </button>
                )}
                {rightCollapsed && (
                    <button
                        onClick={() => setRightCollapsed(false)}
                        title="Show right panel"
                        style={{
                            ...btnBase,
                            position: "absolute",
                            right: 8,
                            top: 10,
                            width: 30,
                            height: 30,
                            borderRadius: 7,
                            background: UI.appBgElev,
                            border: `1px solid ${UI.borderStrong}`,
                            color: UI.textStrong,
                            zIndex: 80,
                        }}
                    >
                        <ChevronsLeft size={14} />
                    </button>
                )}
            </div>

            {/* Timeline */}
            <TimelinePanel
                subtitleTrack={subtitleTrack} brollTrack={brollTrack} motionGraphicsTrack={motionGraphicsTrack}
                gapCuts={gapCuts} sfxTrack={sfxTrack} transitions={transitions}
                musicTrack={musicTrack}
                externalDragPayload={timelineDragPayload}
                onExternalDrop={handleTimelineExternalDrop}
                isPlaying={isPlaying} onPlayPause={() => setPlaying(!isPlaying)}
                onStepBack={() => { if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5); }}
                onStepFwd={() => { if (videoRef.current) videoRef.current.currentTime += 5; }}
                playheadPct={playheadPct} durationMs={durationMs} currentTimeMs={currentTimeMs}
                zoom={zoom} onZoom={setZoom}
                progressRef={progressRef} onProgressClick={handleProgressClick}
                layerVisibility={layerVisibility}
                onToggleLayerVisibility={(layer: LayerKey) =>
                    setLayerVisibility((prev) => ({ ...prev, [layer]: !prev[layer] }))
                }
            />

            {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}

            {toast && (
                <div
                    style={{
                        position: "fixed",
                        right: 18,
                        bottom: 18,
                        zIndex: 120,
                        minWidth: 220,
                        maxWidth: 360,
                        borderRadius: 10,
                        padding: "10px 12px",
                        color: UI.textStrong,
                        fontSize: 12,
                        fontWeight: 600,
                        background: toast.tone === "success"
                                ? C.success
                            : toast.tone === "error"
                                ? C.danger
                                : UI.appBgElev,
                        border: `1px solid ${UI.borderStrong}`,
                        boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
                    }}
                >
                    {toast.message}
                </div>
            )}
        </div>
    );
}

// ── TopBar ────────────────────────────────────────────────────────────────
function TopBar({ projectName, onExport, exportLoading, leftCollapsed, rightCollapsed, onToggleLeft, onToggleRight }: {
    projectName: string;
    onExport: () => void; exportLoading: boolean;
    leftCollapsed: boolean;
    rightCollapsed: boolean;
    onToggleLeft: () => void;
    onToggleRight: () => void;
}) {
    return (
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, padding: "10px 18px", height: 66, background: "rgba(251,251,253,0.86)", backdropFilter: "blur(24px) saturate(180%)", borderBottom: `1px solid ${UI.borderStrong}`, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <a href="/dashboard" title="Back to dashboard" style={{ ...btnBase, width: 40, height: 40, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", color: UI.textStrong, background: UI.appBgElev, border: `1px solid ${UI.borderStrong}` }}><ChevronLeftIcon size={18} /></a>
                <div style={{ width: 40, height: 40, borderRadius: 14, display: "grid", placeItems: "center", color: "#fff", background: "linear-gradient(180deg, oklch(0.300 0 0), oklch(0.160 0 0))", fontWeight: 950, letterSpacing: -0.5 }}>SP</div>
                <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 950, color: C.primaryDark, letterSpacing: "0.12em", textTransform: "uppercase" }}>AI Caption Studio</span>
                        <span style={{ width: 5, height: 5, borderRadius: 99, background: C.success }} />
                        <span style={{ fontSize: 11, color: UI.textMuted, fontWeight: 800 }}>Auto saved</span>
                    </div>
                    <div style={{ fontSize: 17, lineHeight: 1.15, fontWeight: 900, color: UI.textStrong, maxWidth: 520, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: -0.2 }}>{projectName}</div>
                </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={onToggleLeft} title="Toggle left panel" style={{ ...btnBase, background: leftCollapsed ? C.primarySubtle : UI.glassBg, border: `1px solid ${leftCollapsed ? C.primary : UI.borderStrong}`, color: leftCollapsed ? C.primaryDark : UI.textBase, width: 40, height: 38, borderRadius: 13, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{leftCollapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}</button>
                <button onClick={onToggleRight} title="Toggle right panel" style={{ ...btnBase, background: rightCollapsed ? C.primarySubtle : UI.glassBg, border: `1px solid ${rightCollapsed ? C.primary : UI.borderStrong}`, color: rightCollapsed ? C.primaryDark : UI.textBase, width: 40, height: 38, borderRadius: 13, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{rightCollapsed ? <ChevronsLeft size={15} /> : <ChevronsRight size={15} />}</button>
                <button style={{ ...btnBase, background: UI.appBgElev, border: `1px solid ${UI.borderStrong}`, color: UI.textStrong, padding: "0 17px", height: 38, borderRadius: 13, fontSize: 12, fontWeight: 900 }}>Preview</button>
                <button onClick={onExport} disabled={exportLoading} style={{ ...btnBase, background: C.primary, color: "#fff", padding: "0 18px", height: 40, borderRadius: 14, fontSize: 13, fontWeight: 850, display: "flex", alignItems: "center", gap: 7, opacity: exportLoading ? 0.65 : 1, cursor: exportLoading ? "not-allowed" : "pointer", border: `1px solid ${C.primaryHover}` }}>
                    {exportLoading ? <Spinner size={12} /> : null} Export <ChevronRight />
                </button>
            </div>
        </header>
    );
}

// ── BRollPanel ────────────────────────────────────────────────────────────
function WorkspaceToolbar({
    onRunAllAgents,
    onFitCaptions,
    onToggleShortcuts,
    selectedTemplate,
    cueCount,
    aspectRatio,
    activeLeftTab,
    activeRightTab,
    onFocusCaptions,
    onFocusMedia,
    onFocusMotion,
    onFocusLooks,
}: {
    onRunAllAgents: () => void;
    onFitCaptions: () => void;
    onToggleShortcuts: () => void;
    selectedTemplate: string | null;
    cueCount: number;
    aspectRatio: "16:9" | "9:16";
    activeLeftTab: LeftTab;
    activeRightTab: RightTab;
    onFocusCaptions: () => void;
    onFocusMedia: () => void;
    onFocusMotion: () => void;
    onFocusLooks: () => void;
}) {
    const workflowItems = [
        { key: "captions", label: "Captions", icon: Type, active: activeLeftTab === "ai-caption", onClick: onFocusCaptions },
        { key: "media", label: "Media", icon: Film, active: activeLeftTab === "b-roll", onClick: onFocusMedia },
        { key: "motion", label: "Motion", icon: Sparkles, active: activeRightTab === "anime", onClick: onFocusMotion },
        { key: "looks", label: "Looks", icon: Highlighter, active: activeLeftTab === "template", onClick: onFocusLooks },
    ] as const;

    return (
        <div style={{ minHeight: 62, display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", background: "rgba(251,251,253,0.72)", backdropFilter: "blur(18px) saturate(160%)", borderBottom: `1px solid ${UI.borderSoft}`, flexShrink: 0 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: 4, borderRadius: 18, border: `1px solid ${UI.borderSoft}`, background: "rgba(255,255,255,0.72)" }}>
                {workflowItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.key}
                            onClick={item.onClick}
                            style={{
                                ...btnBase,
                                height: 38,
                                borderRadius: 14,
                                padding: "0 13px",
                                border: `1px solid ${item.active ? C.primary : "transparent"}`,
                                background: item.active ? C.primary : "transparent",
                                color: item.active ? "#fff" : UI.textBase,
                                fontSize: 12,
                                fontWeight: 900,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 7,
                                transition: "background 120ms ease, color 120ms ease, border-color 120ms ease",
                            }}
                        >
                            <Icon size={14} /> {item.label}
                        </button>
                    );
                })}
            </div>

            <button onClick={onRunAllAgents} style={{ ...btnBase, borderRadius: 15, border: `1px solid ${C.primaryHover}`, background: C.primary, color: "#fff", fontSize: 12, fontWeight: 900, padding: "10px 14px", display: "inline-flex", alignItems: "center", gap: 7 }}>
                <Bot size={14} /> Generate all
            </button>
            <button onClick={onFitCaptions} style={{ ...btnBase, borderRadius: 15, border: `1px solid ${UI.borderStrong}`, background: UI.appBgElev, color: UI.textStrong, fontSize: 12, fontWeight: 900, padding: "10px 13px", display: "inline-flex", alignItems: "center", gap: 7 }}>
                <Type size={13} /> Fit Captions
            </button>
            <button onClick={onToggleShortcuts} style={{ ...btnBase, borderRadius: 15, border: `1px solid ${UI.borderStrong}`, background: UI.appBgElev, color: UI.textBase, fontSize: 12, fontWeight: 900, padding: "10px 13px", display: "inline-flex", alignItems: "center", gap: 7 }}>
                <CircleHelp size={13} /> Shortcuts
            </button>
            <div style={{ flex: 1 }} />
            {[
                ["Template", selectedTemplate || "None"],
                ["Cues", String(cueCount)],
                ["Aspect", aspectRatio],
            ].map(([label, value]) => (
                <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, borderRadius: 12, border: `1px solid ${UI.borderSoft}`, background: UI.glassBg, padding: "0 10px", fontSize: 11, color: UI.textMuted, fontWeight: 850 }}>
                    {label}<strong style={{ color: UI.textStrong, fontWeight: 900 }}>{value}</strong>
                </span>
            ))}
        </div>
    );
}

function ShortcutsModal({ onClose }: { onClose: () => void }) {
    const Item = ({ keyCombo, label }: { keyCombo: string; label: string }) => (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "8px 0", borderBottom: `1px solid ${UI.borderSoft}` }}>
            <span style={{ fontSize: 12, color: UI.textBase }}>{label}</span>
            <code style={{ fontSize: 11, color: UI.textStrong, background: UI.glassBg, border: `1px solid ${UI.borderStrong}`, borderRadius: 6, padding: "2px 6px" }}>{keyCombo}</code>
        </div>
    );

    return (
        <div style={{ position: "fixed", inset: 0, background: UI.overlayBg, zIndex: 130, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ width: 460, maxWidth: "100%", borderRadius: 12, border: `1px solid ${UI.borderStrong}`, background: UI.appBgSoft, boxShadow: UI.panelShadow, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: `1px solid ${UI.borderSoft}` }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: UI.textStrong, fontSize: 14, fontWeight: 700 }}>
                        <CircleHelp size={15} /> Keyboard Shortcuts
                    </div>
                    <button onClick={onClose} style={{ ...btnBase, width: 26, height: 26, borderRadius: 6, color: UI.textBase, background: UI.glassBg, border: `1px solid ${UI.borderStrong}` }}>
                        <X size={14} />
                    </button>
                </div>
                <div style={{ padding: "4px 14px 10px" }}>
                    <Item keyCombo="Space" label="Play / Pause" />
                    <Item keyCombo="← / →" label="Nudge playhead 1 frame" />
                    <Item keyCombo="Shift + ← / →" label="Nudge playhead 1 second" />
                    <Item keyCombo="Del / Backspace" label="Delete selected clip" />
                    <Item keyCombo="Ctrl/Cmd + Z" label="Undo" />
                    <Item keyCombo="Ctrl/Cmd + Shift + Z" label="Redo" />
                    <Item keyCombo="Ctrl/Cmd + B" label="Toggle left panel" />
                    <Item keyCombo="Ctrl/Cmd + \\" label="Toggle right panel" />
                    <Item keyCombo="Ctrl/Cmd + Shift + R" label="Run all AI agents" />
                </div>
            </div>
        </div>
    );
}

function BRollPanel({
    suggestions = [],
    agentStatus,
    musicAgentStatus = "idle",
    sfxAgentStatus = "idle",
    transitionAgentStatus = "idle",
    projectId,
    onRunAgent,
    onTimelineDragStart,
    onTimelineDragEnd,
    brollTrack = [],
    motionGraphicsTrack = [],
    motionGraphicsSuggestions = [],
    setBrollSuggestions,
    setMotionGraphicsSuggestions,
    moodProfile = null,
    musicSuggestions = [],
    musicEmptyReason = null,
    sfxSuggestions = [],
    sfxEmptyReason = null,
    musicTrack = null,
    onAddMusic,
    onReplaceMusic,
    onRemoveMusic,
    onAddSfx,
    onReplaceSfx,
    onRemoveSfx,
    isSfxInTimeline,
}: {
    suggestions: BrollSuggestion[];
    agentStatus: AgentState;
    musicAgentStatus?: AgentState;
    sfxAgentStatus?: AgentState;
    transitionAgentStatus?: AgentState;
    projectId: string | null;
    onRunAgent: (a: AgentName) => void;
    onTimelineDragStart?: (payload: TimelineDragPayload) => void;
    onTimelineDragEnd?: () => void;
    brollTrack?: any[];
    motionGraphicsTrack?: any[];
    motionGraphicsSuggestions?: MotionGraphicSuggestion[];
    setBrollSuggestions: (s: BrollSuggestion[]) => void;
    setMotionGraphicsSuggestions?: (s: MotionGraphicSuggestion[]) => void;
    moodProfile?: MoodProfile | null;
    musicSuggestions?: MusicSuggestion[];
    musicEmptyReason?: string | null;
    sfxSuggestions?: SFXSuggestion[];
    sfxEmptyReason?: string | null;
    musicTrack?: any | null;
    onAddMusic?: (track: MusicSuggestion) => void;
    onReplaceMusic?: (track: MusicSuggestion) => void;
    onRemoveMusic?: () => void;
    onAddSfx?: (s: SFXSuggestion) => void;
    onReplaceSfx?: (s: SFXSuggestion) => void;
    onRemoveSfx?: (s: SFXSuggestion) => void;
    isSfxInTimeline?: (s: SFXSuggestion) => boolean;
}) {
    const [coverage, setCoverage] = useState(0.5);
    const [motionDensity, setMotionDensity] = useState(0.35);
    const [orientation, setOrientation] = useState<'landscape' | 'portrait' | 'square'>('landscape');
    const [swappingId, setSwappingId] = useState<string | null>(null);
    const [editingKeyword, setEditingKeyword] = useState<Record<string, string>>({});

    // Accordion state
    const [expanded, setExpanded] = useState<MediaPanelSection | null>('broll');
    const toggle = (sec: MediaPanelSection) => setExpanded(e => e === sec ? null : sec);
    const [generating, setGenerating] = useState(false);
    const [generatingMotion, setGeneratingMotion] = useState(false);
    const addBroll = useTimeline((s) => s.addBroll);
    const removeBroll = useTimeline((s) => s.removeBroll);
    const addMotionGraphic = useTimeline((s) => s.addMotionGraphic);
    const removeMotionGraphic = useTimeline((s) => s.removeMotionGraphic);
    const subtitleTrack = useTimeline((s) => s.subtitleTrack);
    const durationMs = useTimeline((s) => s.durationMs);
    const MAX_BROLL_DURATION_MS = 3000;
    const MIN_BROLL_DURATION_MS = 34;

    const handleGenerate = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!projectId) return;
        setBrollSuggestions([]);
        setGenerating(true);
        try {
            const res = await brollApi.suggest(projectId, coverage, orientation);
            if (res.data?.suggestions) {
                setBrollSuggestions(res.data.suggestions);
            }
            setExpanded('broll');
        } catch { } finally {
            setGenerating(false);
        }
    };

    const handleGenerateMotion = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!projectId) return;
        setMotionGraphicsSuggestions?.([]);
        setGeneratingMotion(true);
        try {
            const res = await motionGraphicsApi.suggest(projectId, motionDensity, 14);
            setMotionGraphicsSuggestions?.(res.data?.suggestions ?? []);
            setExpanded('motion');
        } catch { /* global API layer surfaces auth/network state */ }
        finally { setGeneratingMotion(false); }
    };

    const handleSwap = async (s: BrollSuggestion) => {
        if (!projectId) return;
        const kw = editingKeyword[s.cue_id] ?? s.keyword;
        setSwappingId(s.cue_id);
        try {
            const res = await brollApi.preview(projectId, kw, orientation);
            if (res.data) {
                setBrollSuggestions(safeSuggestions.map(c =>
                    c.cue_id === s.cue_id ? { ...c, broll: res.data } : c
                ));
            }
        } catch { /* ignore */ }
        finally { setSwappingId(null); }
    };

    const makeTimelineBrollId = (s: BrollSuggestion) => `${s.cue_id}-${s.broll?.pexels_id ?? "clip"}`;

    const isAddedToTimeline = (s: BrollSuggestion) => brollTrack.some((clip: any) => String(clip.pexels_id) === makeTimelineBrollId(s));

    const resolveBrollWindow = (s: BrollSuggestion) => {
        const cue = subtitleTrack.find((c: any) => String(getCueId(c)) === String(s.cue_id));
        const cueStart = cue ? Number(cue.start_ms) : Number.NaN;
        const cueEnd = cue ? Number(cue.end_ms) : Number.NaN;
        const suggestedStart = Number(s.start_ms);
        const suggestedEnd = Number(s.end_ms);

        const startMs = Number.isFinite(suggestedStart)
            ? Math.max(0, Math.round(suggestedStart))
            : Number.isFinite(cueStart)
                ? Math.max(0, Math.round(cueStart))
                : 0;

        const audioEnd = Number.isFinite(suggestedEnd) && suggestedEnd > startMs
            ? Math.round(suggestedEnd)
            : Number.isFinite(cueEnd) && cueEnd > startMs
                ? Math.round(cueEnd)
                : startMs + MAX_BROLL_DURATION_MS;

        const projectEnd = durationMs > 0 ? Math.round(durationMs) : Number.POSITIVE_INFINITY;
        let endMs = Math.min(audioEnd, startMs + MAX_BROLL_DURATION_MS, projectEnd);
        if (!(endMs > startMs)) {
            const fallbackEnd = Math.min(startMs + MAX_BROLL_DURATION_MS, projectEnd);
            endMs = fallbackEnd > startMs ? fallbackEnd : startMs + MIN_BROLL_DURATION_MS;
        }
        return {
            startMs,
            endMs: Math.max(startMs + 1, Math.round(endMs)),
        };
    };

    const handleAddToTimeline = (s: BrollSuggestion) => {
        if (!s.broll || isAddedToTimeline(s)) return;
        const { startMs, endMs } = resolveBrollWindow(s);
        addBroll({
            ...s.broll,
            pexels_id: makeTimelineBrollId(s),
            original_pexels_id: s.broll.pexels_id,
            start_ms: startMs,
            end_ms: endMs,
            cue_text: s.text,
        } as any);
    };

    const handleDelete = (s: BrollSuggestion) => {
        if (isAddedToTimeline(s)) removeBroll(makeTimelineBrollId(s));
        setBrollSuggestions(safeSuggestions.map(c => c.cue_id === s.cue_id ? { ...c, broll: null } : c));
    };

    const isMotionAddedToTimeline = (s: MotionGraphicSuggestion) =>
        motionGraphicsTrack.some((clip: any) => String(clip.clip_id) === String(s.clip_id));

    const handleAddMotionToTimeline = (s: MotionGraphicSuggestion) => {
        if (isMotionAddedToTimeline(s)) return;
        addMotionGraphic({ ...s, cue_text: s.source_text || s.text } as any);
    };

    const handleDeleteMotion = (s: MotionGraphicSuggestion) => {
        if (isMotionAddedToTimeline(s)) removeMotionGraphic(s.clip_id);
        setMotionGraphicsSuggestions?.(motionGraphicsSuggestions.filter((item) => item.clip_id !== s.clip_id));
    };

    // Filter to show only items with importance > 0 or that actually have broll
    const safeSuggestions = Array.isArray(suggestions) ? suggestions : [];
    const displayClips = safeSuggestions.filter(s => s.broll || (s.importance && s.importance > 0));

    // Section Header Renderer
    const renderHeader = (
        id: MediaPanelSection,
        label: string,
        btnLabel: string,
        onBtnClick: (e: React.MouseEvent) => void,
        state: string,
        extra?: React.ReactNode,
        icon?: React.ReactNode,
        btnIcon?: React.ReactNode,
    ) => (
        <div onClick={() => toggle(id)} style={{ padding: '12px', background: expanded === id ? C.surfaceElev : C.surfaceSec, borderBottom: `1px solid ${C.gray200}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'background 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: expanded === id ? C.primary : C.gray700 }}>
                <div style={{ transform: expanded === id ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'flex', alignItems: 'center' }}>
                    <Diamond color={expanded === id ? C.primary : C.gray500} size={10} />
                </div>
                {icon}
                {label}
                {extra}
            </div>
            <button onClick={onBtnClick} disabled={!projectId || state === 'running'} style={{ ...btnBase, padding: '4px 12px', fontSize: 11, fontWeight: 700, borderRadius: 12, border: `1px solid ${state === 'running' ? C.warning : expanded === id ? C.primary : C.gray300}`, color: state === 'running' ? C.warning : expanded === id ? C.primary : C.gray600, background: state === 'running' ? 'transparent' : expanded === id ? C.primarySubtle : '#fff' }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {btnIcon}
                    {state === 'running' ? 'Running...' : btnLabel}
                </span>
            </button>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>

            {/* ── B-ROLL ── */}
            {renderHeader('broll', 'AI B-Roll', 'Generate', handleGenerate, generating ? 'running' : agentStatus,
                displayClips.length > 0 && <span style={{ fontSize: 10, color: C.gray400, fontWeight: 400 }}>({displayClips.length})</span>,
                <Bot size={14} />,
                <Brain size={12} />
            )}

            {expanded === 'broll' && (
                <div style={{ background: C.surfaceElev, borderBottom: `1px solid ${C.gray200}`, paddingBottom: 8 }}>
                    {/* Controls */}
                    <div style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 11, color: C.gray500 }}>Coverage</span>
                            <input type="range" min={0.1} max={1} step={0.1} value={coverage} onChange={e => setCoverage(parseFloat(e.target.value))} style={{ flex: 1, accentColor: C.primary }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.gray700, minWidth: 32 }}>{Math.round(coverage * 100)}%</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {(['landscape', 'portrait', 'square'] as const).map(o => (
                                <button key={o} onClick={() => setOrientation(o)} style={{ ...btnBase, flex: 1, padding: '5px 0', fontSize: 11, fontWeight: 600, borderRadius: 6, border: `1px solid ${orientation === o ? C.primary : C.gray200}`, background: orientation === o ? C.primarySubtle : '#fff', color: orientation === o ? C.primary : C.gray600, cursor: 'pointer', textTransform: 'capitalize' }}>{o}</button>
                            ))}
                        </div>
                    </div>

                    {/* Clip list */}
                    <div>
                        {agentStatus === 'running' && (
                            <div style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.gray500, fontSize: 12 }}>
                                <Spinner size={14} /> AI is finding the best B-roll…
                            </div>
                        )}
                        {displayClips.length === 0 && agentStatus !== 'running' && (
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 32 }}>
                                <Diamond color={C.gray300} size={28} />
                                <p style={{ fontSize: 12, color: C.gray400, textAlign: "center" }}>Click Generate to find AI-matched B-roll clips.</p>
                            </div>
                        )}
                        {displayClips.map((s) => {
                            const clip = s.broll;
                            const isSwapping = swappingId === s.cue_id;
                            const kwVal = editingKeyword[s.cue_id] ?? s.keyword;
                            const importancePct = Math.round((s.importance ?? 0) * 100);

                            return (
                                <div key={s.cue_id} style={{ borderTop: `1px solid ${C.gray100}`, padding: '12px 16px', background: '#fff' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontSize: 12, color: C.gray800, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{s.text}"</p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <div style={{ width: 60, height: 4, background: C.gray100, borderRadius: 2 }}>
                                                    <div style={{ height: '100%', width: `${importancePct}%`, background: importancePct > 70 ? C.success : importancePct > 40 ? C.warning : C.danger, borderRadius: 2 }} />
                                                </div>
                                                <span style={{ fontSize: 10, color: C.gray500 }}>Drop chance: {importancePct}%</span>
                                            </div>
                                        </div>
                                        {clip && (
                                            <button
                                                draggable
                                                onDragStart={(e) => {
                                                    e.dataTransfer.effectAllowed = "copy";
                                                    e.dataTransfer.setData("text/plain", `broll:${s.cue_id}`);
                                                    onTimelineDragStart?.({ kind: "broll", suggestion: s });
                                                }}
                                                onDragEnd={() => onTimelineDragEnd?.()}
                                                style={{ ...btnBase, color: C.gray500, padding: 4, cursor: 'grab', flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                                title="Drag to B-Roll track"
                                            >
                                                <GripVertical size={14} />
                                            </button>
                                        )}
                                        {clip && <button onClick={() => handleDelete(s)} style={{ ...btnBase, color: C.danger, fontSize: 18, lineHeight: 1, padding: 4, cursor: 'pointer', flexShrink: 0 }} title="Remove suggestion and timeline clip">x</button>}
                                    </div>

                                    {clip ? (
                                        <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: C.gray200, marginBottom: 8, height: 90 }}>
                                            {clip.thumbnail && <img src={clip.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isSwapping ? 0.4 : 1, transition: 'opacity 0.2s' }} />}
                                            {isSwapping && (
                                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Spinner size={20} />
                                                </div>
                                            )}
                                            <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 10, borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>
                                                {clip.duration}s | {clip.width}×{clip.height}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ height: 40, background: C.gray50, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.gray400, marginBottom: 8, border: `1px dashed ${C.gray300}` }}>
                                            No suitable clip found
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <input
                                            value={kwVal}
                                            onChange={e => setEditingKeyword(prev => ({ ...prev, [s.cue_id]: e.target.value }))}
                                            onKeyDown={e => e.key === 'Enter' && handleSwap(s)}
                                            placeholder="Keyword override..."
                                            style={{ flex: 1, padding: '6px 10px', fontSize: 11, borderRadius: 6, border: `1px solid ${C.gray200}`, background: C.surface, color: C.gray800 }}
                                        />
                                        <button onClick={() => handleSwap(s)} disabled={isSwapping} style={{ ...btnBase, padding: '6px 12px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: C.primary, color: '#fff', cursor: isSwapping ? 'not-allowed' : 'pointer', border: 'none', opacity: isSwapping ? 0.6 : 1 }}>Swap</button>
                                        <button onClick={() => handleAddToTimeline(s)} disabled={!clip || isAddedToTimeline(s)} style={{ ...btnBase, padding: '6px 12px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: isAddedToTimeline(s) ? C.successLight : C.success, color: isAddedToTimeline(s) ? C.success : '#fff', cursor: !clip || isAddedToTimeline(s) ? 'not-allowed' : 'pointer', border: 'none', opacity: !clip ? 0.45 : 1 }}>{isAddedToTimeline(s) ? 'Added' : 'Add'}</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Motion graphics */}
            {renderHeader(
                'motion',
                'AI Motion Graphics',
                'Generate',
                handleGenerateMotion,
                generatingMotion ? 'running' : 'idle',
                motionGraphicsSuggestions.length > 0 ? <span style={{ fontSize: 10, color: C.gray400, fontWeight: 400 }}>({motionGraphicsSuggestions.length})</span> : undefined,
                <Sparkles size={14} />,
                <Brain size={12} />,
            )}
            {expanded === 'motion' && (
                <div style={{ background: C.surfaceElev, borderBottom: `1px solid ${C.gray200}`, paddingBottom: 8 }}>
                    <div style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: C.gray500 }}>Density</span>
                            <input type="range" min={0.1} max={1} step={0.05} value={motionDensity} onChange={e => setMotionDensity(parseFloat(e.target.value))} style={{ flex: 1, accentColor: C.primary }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.gray700, minWidth: 32 }}>{Math.round(motionDensity * 100)}%</span>
                        </div>
                    </div>
                    {generatingMotion && (
                        <div style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.gray500, fontSize: 12 }}>
                            <Spinner size={14} /> AI is scoring hooks, emotion, pacing, and CTA beats...
                        </div>
                    )}
                    {motionGraphicsSuggestions.length === 0 && !generatingMotion && (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 30 }}>
                            <Sparkles size={28} color={C.gray300} />
                            <p style={{ fontSize: 12, color: C.gray400, textAlign: "center" }}>Generate premium animated callouts from the strongest caption moments.</p>
                        </div>
                    )}
                    {motionGraphicsSuggestions.map((s) => {
                        const added = isMotionAddedToTimeline(s);
                        const importancePct = Math.round((s.importance ?? 0) * 100);
                        const momentLabel = String(s.moment_type || "motion").replace(/_/g, " ");
                        const styleLabel = String(s.style_family || s.style || "clean").replace(/_/g, " ");
                        const roleLabel = String(s.motion_role || "secondary").replace(/_/g, " ");
                        const soundLabel = String(s.sound_cue || "soft whoosh").replace(/_/g, " ");
                        const note = s.editing_note || s.reason;
                        return (
                            <div key={s.clip_id} style={{ borderTop: `1px solid ${C.gray100}`, padding: '12px 16px', background: '#fff' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <div style={{ width: 92, height: 52, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.gray200}`, background: C.gray50, flexShrink: 0 }}>
                                        <MotionGraphicPreview clip={s} compact />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 800, color: C.gray800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.text}</div>
                                        <div style={{ fontSize: 10, color: C.gray500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note}</div>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                                            {[momentLabel, styleLabel, roleLabel, soundLabel].map(label => (
                                                <span key={label} style={{ fontSize: 9, lineHeight: 1, textTransform: "capitalize", color: C.gray600, background: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: 999, padding: "4px 6px" }}>
                                                    {label}
                                                </span>
                                            ))}
                                        </div>
                                        {Array.isArray(s.important_words) && s.important_words.length > 0 && (
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                                                {s.important_words.slice(0, 3).map(word => (
                                                    <span key={word} style={{ fontSize: 9, lineHeight: 1, color: s.accent_color || C.primary, background: C.primarySubtle, borderRadius: 999, padding: "4px 6px", fontWeight: 800 }}>
                                                        {word}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                                            <div style={{ width: 58, height: 4, background: C.gray100, borderRadius: 2 }}>
                                                <div style={{ height: '100%', width: `${importancePct}%`, background: s.accent_color || C.primary, borderRadius: 2 }} />
                                            </div>
                                            <span style={{ fontSize: 10, color: C.gray500 }}>Impact {importancePct}%</span>
                                        </div>
                                    </div>
                                    <button
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.effectAllowed = "copy";
                                            e.dataTransfer.setData("text/plain", `motion:${s.clip_id}`);
                                            onTimelineDragStart?.({ kind: "motion", suggestion: s });
                                        }}
                                        onDragEnd={() => onTimelineDragEnd?.()}
                                        style={{ ...btnBase, color: C.gray500, padding: 4, cursor: 'grab', flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                        title="Drag to Motion track"
                                    >
                                        <GripVertical size={14} />
                                    </button>
                                    <button onClick={() => handleDeleteMotion(s)} style={{ ...btnBase, color: C.danger, fontSize: 18, lineHeight: 1, padding: 4, cursor: 'pointer', flexShrink: 0 }} title="Remove motion graphic">x</button>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={() => handleAddMotionToTimeline(s)} disabled={added} style={{ ...btnBase, flex: 1, padding: '6px 12px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: added ? C.successLight : C.success, color: added ? C.success : '#fff', cursor: added ? 'not-allowed' : 'pointer', border: 'none' }}>{added ? 'Added' : 'Add to timeline'}</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── MUSIC ── */}
            {renderHeader(
                'music',
                'AI Background Music',
                'Analyze',
                (e) => { e.stopPropagation(); onRunAgent('music'); },
                musicAgentStatus,
                musicSuggestions.length > 0 ? <span style={{ fontSize: 10, color: C.gray400, fontWeight: 400 }}>({musicSuggestions.length})</span> : undefined,
                <Music2 size={14} />,
                <Brain size={12} />,
            )}
            {expanded === 'music' && (
                <div style={{ background: C.surfaceElev, borderBottom: `1px solid ${C.gray200}` }}>
                    {moodProfile && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: `1px solid ${C.gray200}` }}>
                            <Brain size={14} color={C.primary} />
                            <div style={{ fontSize: 11, color: C.gray700, flex: 1 }}>
                                Mood: <strong>{moodProfile.primary_mood}</strong> | Confidence {Math.round((moodProfile.confidence ?? 0) * 100)}%
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: C.success, background: C.successLight, borderRadius: 10, padding: "2px 8px" }}>Library</span>
                        </div>
                    )}
                    {musicSuggestions.length === 0 ? (
                        <div style={{ padding: '18px 14px', textAlign: 'center' }}>
                            <p style={{ fontSize: 12, color: C.gray500 }}>{musicEmptyReason || 'Run Analyze to get mood-matched background music suggestions.'}</p>
                        </div>
                    ) : (
                        <div>
                            {musicSuggestions.map((track) => {
                                const applied = musicTrack?.id === track.id;
                                return (
                                    <div key={track.id} style={{ borderTop: `1px solid ${C.gray100}`, padding: "10px 12px", background: "#fff" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <AudioWaveform size={14} color={C.success} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: C.gray800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.name}</div>
                                                <div style={{ fontSize: 10, color: C.gray500 }}>
                                                    Score {Math.round((track.score ?? 0) * 100)}% | {track.reason}
                                                </div>
                                                {track.matched_tags?.length > 0 && (
                                                    <div style={{ fontSize: 10, color: C.gray500 }}>Tags: {track.matched_tags.join(", ")}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                                            <button onClick={() => onAddMusic?.(track)} disabled={!!musicTrack} style={{ ...btnBase, flex: 1, borderRadius: 6, padding: "6px 8px", background: musicTrack ? C.gray100 : C.success, color: musicTrack ? C.gray500 : "#fff", border: `1px solid ${musicTrack ? C.gray200 : C.success}` }}>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Plus size={12} /> Add</span>
                                            </button>
                                            <button onClick={() => onReplaceMusic?.(track)} disabled={!musicTrack} style={{ ...btnBase, flex: 1, borderRadius: 6, padding: "6px 8px", background: musicTrack ? C.primary : C.gray100, color: musicTrack ? "#fff" : C.gray500, border: `1px solid ${musicTrack ? C.primary : C.gray200}` }}>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><RefreshCw size={12} /> Replace</span>
                                            </button>
                                            <button onClick={() => onRemoveMusic?.()} disabled={!applied} style={{ ...btnBase, flex: 1, borderRadius: 6, padding: "6px 8px", background: applied ? C.danger : C.gray100, color: applied ? "#fff" : C.gray500, border: `1px solid ${applied ? C.danger : C.gray200}` }}>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><X size={12} /> Remove</span>
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); onRunAgent('music'); }} style={{ ...btnBase, borderRadius: 6, padding: "6px 10px", background: C.primarySubtle, color: C.primary, border: `1px solid ${C.primary}` }} title="Regenerate">
                                                <RefreshCw size={12} />
                                            </button>
                                            <button
                                                draggable={!!track.preview_url}
                                                onDragStart={(e) => {
                                                    if (!track.preview_url) return;
                                                    e.dataTransfer.effectAllowed = "copy";
                                                    e.dataTransfer.setData("text/plain", `music:${track.id ?? track.name ?? "track"}`);
                                                    onTimelineDragStart?.({ kind: "music", suggestion: track });
                                                }}
                                                onDragEnd={() => onTimelineDragEnd?.()}
                                                style={{ ...btnBase, borderRadius: 6, padding: "6px 8px", background: "#fff", color: C.gray600, border: `1px solid ${C.gray200}`, cursor: track.preview_url ? "grab" : "not-allowed", opacity: track.preview_url ? 1 : 0.45 }}
                                                title="Drag to Music track"
                                            >
                                                <GripVertical size={12} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── SFX ── */}
            {renderHeader(
                'sfx',
                'AI Sound Effects',
                'Analyze',
                (e) => { e.stopPropagation(); onRunAgent('sfx'); },
                sfxAgentStatus,
                sfxSuggestions.length > 0 ? <span style={{ fontSize: 10, color: C.gray400, fontWeight: 400 }}>({sfxSuggestions.length})</span> : undefined,
                <Sparkles size={14} />,
                <Bot size={12} />,
            )}
            {expanded === 'sfx' && (
                <div style={{ background: C.surfaceElev, borderBottom: `1px solid ${C.gray200}` }}>
                    {moodProfile && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: `1px solid ${C.gray200}` }}>
                            <AudioLines size={14} color={C.warning} />
                            <div style={{ fontSize: 11, color: C.gray700, flex: 1 }}>
                                Energy: <strong>{moodProfile.energy_level}</strong> | Pace: <strong>{moodProfile.pace_level}</strong>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: C.success, background: C.successLight, borderRadius: 10, padding: "2px 8px" }}>Library</span>
                        </div>
                    )}
                    {sfxSuggestions.length === 0 ? (
                        <div style={{ padding: '18px 14px', textAlign: 'center' }}>
                            <p style={{ fontSize: 12, color: C.gray500 }}>{sfxEmptyReason || 'Run Analyze to generate adaptive SFX placements.'}</p>
                        </div>
                    ) : (
                        <div>
                            {sfxSuggestions.map((s) => {
                                const added = isSfxInTimeline?.(s) ?? false;
                                return (
                                    <div key={`${s.cue_id}-${s.start_ms}`} style={{ borderTop: `1px solid ${C.gray100}`, padding: "10px 12px", background: "#fff" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <AudioLines size={14} color={C.warning} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: C.gray800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.sfx?.name || "SFX"}</div>
                                                <div style={{ fontSize: 10, color: C.gray500 }}>{s.cue_text || "Cue"} | Score {Math.round((s.score ?? 0) * 100)}%</div>
                                                <div style={{ fontSize: 10, color: C.gray500 }}>{s.placement_reason}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                                            <button onClick={() => onAddSfx?.(s)} disabled={added} style={{ ...btnBase, flex: 1, borderRadius: 6, padding: "6px 8px", background: added ? C.gray100 : C.success, color: added ? C.gray500 : "#fff", border: `1px solid ${added ? C.gray200 : C.success}` }}>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Plus size={12} /> Add</span>
                                            </button>
                                            <button onClick={() => onReplaceSfx?.(s)} style={{ ...btnBase, flex: 1, borderRadius: 6, padding: "6px 8px", background: C.primary, color: "#fff", border: `1px solid ${C.primary}` }}>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><RefreshCw size={12} /> Replace</span>
                                            </button>
                                            <button onClick={() => onRemoveSfx?.(s)} disabled={!added} style={{ ...btnBase, flex: 1, borderRadius: 6, padding: "6px 8px", background: added ? C.danger : C.gray100, color: added ? "#fff" : C.gray500, border: `1px solid ${added ? C.danger : C.gray200}` }}>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><X size={12} /> Remove</span>
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); onRunAgent('sfx'); }} style={{ ...btnBase, borderRadius: 6, padding: "6px 10px", background: C.primarySubtle, color: C.primary, border: `1px solid ${C.primary}` }} title="Regenerate">
                                                <RefreshCw size={12} />
                                            </button>
                                            <button
                                                draggable={!!s.sfx?.file_url}
                                                onDragStart={(e) => {
                                                    if (!s.sfx?.file_url) return;
                                                    e.dataTransfer.effectAllowed = "copy";
                                                    e.dataTransfer.setData("text/plain", `sfx:${s.cue_id}`);
                                                    onTimelineDragStart?.({ kind: "sfx", suggestion: s });
                                                }}
                                                onDragEnd={() => onTimelineDragEnd?.()}
                                                style={{ ...btnBase, borderRadius: 6, padding: "6px 8px", background: "#fff", color: C.gray600, border: `1px solid ${C.gray200}`, cursor: s.sfx?.file_url ? "grab" : "not-allowed", opacity: s.sfx?.file_url ? 1 : 0.45 }}
                                                title="Drag to SFX track"
                                            >
                                                <GripVertical size={12} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── TRANSITIONS ── */}
            {renderHeader('transitions', 'AI Transitions', 'Add', (e) => { e.stopPropagation(); onRunAgent('transitions'); }, transitionAgentStatus)}
            {expanded === 'transitions' && (
                <div style={{ padding: '24px 16px', background: C.surfaceElev, borderBottom: `1px solid ${C.gray200}`, textAlign: 'center' }}>
                    <p style={{ fontSize: 12, color: C.gray500 }}>Smart visual transitions on cuts and high-energy moments.</p>
                </div>
            )}

        </div>
    );
}

// ── LeftPanel ─────────────────────────────────────────────────────────────
function CaptionWorkspace({
    subtitleTrack = [],
    selectedCueId,
    onSelectCue,
    onUpdateCue,
    onDeleteCue,
    onInsertCueAfter,
}: any) {
    const [panelMode, setPanelMode] = useState<"captions" | "text">("captions");
    const [searchText, setSearchText] = useState("");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const [onlySelected, setOnlySelected] = useState(false);
    const [editingCueId, setEditingCueId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState("");

    const sortedCues = useMemo(() => {
        const ordered = [...subtitleTrack].sort((a: any, b: any) => Number(a.start_ms) - Number(b.start_ms));
        if (sortDirection === "desc") ordered.reverse();
        return ordered;
    }, [subtitleTrack, sortDirection]);

    const filteredCues = useMemo(() => {
        const q = searchText.trim().toLowerCase();
        return sortedCues.filter((cue: any) => {
            const cueId = getCueId(cue);
            const text = String(cue.text ?? "").toLowerCase();
            if (onlySelected && cueId !== selectedCueId) return false;
            if (!q) return true;
            return text.includes(q);
        });
    }, [sortedCues, searchText, onlySelected, selectedCueId]);

    const transcriptText = useMemo(
        () => sortedCues.map((cue: any) => String(cue.text ?? "").trim()).filter(Boolean).join(" "),
        [sortedCues],
    );

    useEffect(() => {
        if (!editingCueId) return;
        if (!subtitleTrack.some((cue: any) => getCueId(cue) === editingCueId)) {
            setEditingCueId(null);
            setEditingText("");
        }
    }, [subtitleTrack, editingCueId]);

    const beginEdit = useCallback((cue: any) => {
        const cueId = getCueId(cue);
        setEditingCueId(cueId);
        setEditingText(String(cue.text ?? ""));
        onSelectCue?.(cueId);
    }, [onSelectCue]);

    const commitEdit = useCallback((cue: any) => {
        const cueId = getCueId(cue);
        const nextText = editingText.trim();
        setEditingCueId(null);
        if (!nextText) return;
        const prevText = String(cue.text ?? "").trim();
        if (nextText === prevText) return;
        onUpdateCue?.(cueId, { text: nextText });
    }, [editingText, onUpdateCue]);

    const normalizeSelectedCueText = useCallback(() => {
        if (!selectedCueId) return;
        const cue = subtitleTrack.find((item: any) => getCueId(item) === selectedCueId);
        if (!cue) return;
        const normalized = String(cue.text ?? "").replace(/\s+/g, " ").trim();
        if (normalized && normalized !== String(cue.text ?? "")) {
            onUpdateCue?.(selectedCueId, { text: normalized });
        }
    }, [selectedCueId, subtitleTrack, onUpdateCue]);

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, background: "transparent", color: UI.textBase }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px", borderBottom: `1px solid ${UI.borderSoft}`, background: UI.glassBg, flexShrink: 0 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 7, height: 36, borderRadius: 13, padding: "0 10px", background: UI.appBgElev, border: `1px solid ${UI.borderSoft}` }}>
                    <Search size={13} color={UI.textSubtle} />
                    <input
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder="Search"
                        style={{ flex: 1, border: "none", background: "transparent", outline: "none", color: UI.textBase, fontSize: 12, fontWeight: 750 }}
                    />
                </div>
                <button onClick={normalizeSelectedCueText} title="Normalize spaces" style={{ ...btnBase, width: 30, height: 30, borderRadius: 10, border: `1px solid ${UI.borderStrong}`, color: UI.textMuted, background: UI.appBgElev, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <CaseSensitive size={13} />
                </button>
                <button onClick={() => setSortDirection((prev) => prev === "asc" ? "desc" : "asc")} title="Sort by time" style={{ ...btnBase, width: 30, height: 30, borderRadius: 10, border: `1px solid ${UI.borderStrong}`, color: UI.textMuted, background: UI.appBgElev, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <ArrowDownUp size={13} />
                </button>
                <button onClick={() => setOnlySelected((prev) => !prev)} title="Filter selected cue" style={{ ...btnBase, width: 30, height: 30, borderRadius: 10, border: `1px solid ${onlySelected ? C.primary : UI.borderStrong}`, color: onlySelected ? C.primaryDark : UI.textMuted, background: onlySelected ? C.primarySubtle : UI.appBgElev, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <SlidersHorizontal size={13} />
                </button>
                <button
                    onClick={() => setPanelMode((prev) => (prev === "captions" ? "text" : "captions"))}
                    title={panelMode === "text" ? "Show caption rows" : "Show transcript"}
                    style={{ ...btnBase, width: 30, height: 30, borderRadius: 10, border: `1px solid ${panelMode === "text" ? C.primary : UI.borderStrong}`, color: panelMode === "text" ? C.primaryDark : UI.textMuted, background: panelMode === "text" ? C.primarySubtle : UI.appBgElev, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                >
                    <Type size={13} />
                </button>
                <button title="Caption tools" style={{ ...btnBase, width: 30, height: 30, borderRadius: 10, border: `1px solid ${UI.borderStrong}`, color: UI.textMuted, background: UI.appBgElev, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <CircleHelp size={13} />
                </button>
            </div>

            {panelMode === "text" ? (
                <div style={{ flex: 1, minHeight: 0, padding: "12px 14px", overflowY: "auto", color: UI.textBase, fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {transcriptText || "No caption text available yet."}
                </div>
            ) : (
                <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                    {filteredCues.length === 0 ? (
                        <div style={{ padding: "20px 14px", color: UI.textMuted, fontSize: 12 }}>
                            {subtitleTrack.length === 0 ? "Upload a video to generate captions automatically." : "No captions match this search."}
                        </div>
                    ) : (
                        filteredCues.map((cue: any, index: number) => {
                            const cueId = getCueId(cue);
                            const selected = cueId === selectedCueId;
                            const showActions = selected;
                            return (
                                <div
                                    key={cueId}
                                    onClick={() => onSelectCue?.(cueId)}
                                    style={{
                                        minHeight: 54,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "8px 10px",
                                        borderBottom: `1px solid ${UI.borderSoft}`,
                                        background: selected ? C.primarySubtle : "transparent",
                                        cursor: "pointer",
                                    }}
                                >
                                    <div style={{ width: 22, height: 22, borderRadius: 8, display: "grid", placeItems: "center", flexShrink: 0, textAlign: "center", color: selected ? "#fff" : UI.textSubtle, background: selected ? C.primary : UI.appBgElev, border: `1px solid ${selected ? C.primaryHover : UI.borderSoft}`, fontSize: 10, fontFamily: C.fontMono, fontWeight: 900 }}>
                                        {index + 1}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {editingCueId === cueId ? (
                                            <input
                                                value={editingText}
                                                autoFocus
                                                onChange={(e) => setEditingText(e.target.value)}
                                                onBlur={() => commitEdit(cue)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        commitEdit(cue);
                                                    }
                                                    if (e.key === "Escape") {
                                                        setEditingCueId(null);
                                                        setEditingText("");
                                                    }
                                                }}
                                                style={{ width: "100%", border: "none", borderBottom: `1px solid ${C.primary}`, background: "transparent", color: UI.textStrong, outline: "none", fontSize: 12, padding: "2px 0" }}
                                            />
                                        ) : (
                                            <div
                                                onDoubleClick={() => beginEdit(cue)}
                                                style={{ color: selected ? UI.textStrong : UI.textBase, fontSize: 12, fontWeight: selected ? 850 : 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                                            >
                                                {String(cue.text ?? "").trim() || "Untitled caption"}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ width: 52, display: "flex", justifyContent: "flex-end", gap: 4 }}>
                                        {showActions && (
                                            <>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onInsertCueAfter?.(cueId);
                                                    }}
                                                    title="Insert caption"
                                                    style={{ ...btnBase, width: 24, height: 24, borderRadius: 8, background: UI.appBgElev, color: UI.textBase, border: `1px solid ${UI.borderSoft}`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                                >
                                                    <Plus size={13} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeleteCue?.(cueId);
                                                    }}
                                                    title="Delete caption"
                                                    style={{ ...btnBase, width: 24, height: 24, borderRadius: 8, background: UI.appBgElev, color: C.danger, border: `1px solid ${UI.borderSoft}`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

function LeftPanel({
    activeTab, setActiveTab, subtitleTrack = [], selectedCueId, onSelectCue, onUpdateCue, onSplitCue, onDeleteCue, onInsertCueAfter,
    brollTrack = [], brollSuggestions = [], motionGraphicsTrack = [], motionGraphicsSuggestions = [], agentStatus, templates = [], selectedTpl, onSelectTpl, onRunAgent, projectId, setBrollSuggestions, setMotionGraphicsSuggestions,
    onTimelineDragStart, onTimelineDragEnd,
    moodProfile, musicSuggestions, musicEmptyReason, sfxSuggestions, sfxEmptyReason, musicTrack,
    onAddMusic, onReplaceMusic, onRemoveMusic, onAddSfx, onReplaceSfx, onRemoveSfx, isSfxInTimeline,
}: any) {
    const TABS = [
        { key: "ai-caption", label: "Captions", icon: Type },
        { key: "b-roll", label: "Media", icon: Film },
        { key: "template", label: "Looks", icon: Sparkles },
    ] as const;
    return (
        <aside style={{ width: "100%", flexShrink: 0, background: "rgba(251,251,253,0.82)", backdropFilter: "blur(22px) saturate(160%)", border: `1px solid ${UI.borderStrong}`, borderRadius: 24, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Tab bar */}
            <div style={{ padding: 12, borderBottom: `1px solid ${UI.borderSoft}`, background: UI.glassBg, flexShrink: 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, padding: 4, borderRadius: 16, background: UI.appBgElev, border: `1px solid ${UI.borderSoft}` }}>
                    {TABS.map(t => {
                        const Icon = t.icon;
                        const active = activeTab === t.key;
                        return (
                    <button key={t.key} onClick={() => setActiveTab(t.key as LeftTab)} style={{ ...btnBase, minWidth: 0, height: 36, borderRadius: 12, fontSize: 12, fontWeight: 850, background: active ? C.primary : "transparent", color: active ? "#fff" : UI.textMuted, border: active ? `1px solid ${C.primaryHover}` : "1px solid transparent", transition: "all 0.15s", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <Icon size={13} /> {t.label}
                    </button>
                        );
                    })}
                </div>
            </div>

            {/* ── AI Caption tab ── */}
            {activeTab === "ai-caption" && (
                <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", flex: 1 }}>
                    <CaptionWorkspace
                        subtitleTrack={subtitleTrack}
                        selectedCueId={selectedCueId}
                        onSelectCue={onSelectCue}
                        onUpdateCue={onUpdateCue}
                        onSplitCue={onSplitCue}
                        onDeleteCue={onDeleteCue}
                        onInsertCueAfter={onInsertCueAfter}
                    />
                </div>
            )}

            {/* ── B-Roll tab ── */}
            {activeTab === "b-roll" && (
                <BRollPanel
                    suggestions={brollSuggestions}
                    agentStatus={agentStatus.broll}
                    musicAgentStatus={agentStatus.music}
                    sfxAgentStatus={agentStatus.sfx}
                    transitionAgentStatus={agentStatus.transitions}
                    projectId={projectId}
                    onRunAgent={onRunAgent}
                    onTimelineDragStart={onTimelineDragStart}
                    onTimelineDragEnd={onTimelineDragEnd}
                    brollTrack={brollTrack}
                    motionGraphicsTrack={motionGraphicsTrack}
                    motionGraphicsSuggestions={motionGraphicsSuggestions}
                    setBrollSuggestions={setBrollSuggestions}
                    setMotionGraphicsSuggestions={setMotionGraphicsSuggestions}
                    moodProfile={moodProfile}
                    musicSuggestions={musicSuggestions}
                    musicEmptyReason={musicEmptyReason}
                    sfxSuggestions={sfxSuggestions}
                    sfxEmptyReason={sfxEmptyReason}
                    musicTrack={musicTrack}
                    onAddMusic={onAddMusic}
                    onReplaceMusic={onReplaceMusic}
                    onRemoveMusic={onRemoveMusic}
                    onAddSfx={onAddSfx}
                    onReplaceSfx={onReplaceSfx}
                    onRemoveSfx={onRemoveSfx}
                    isSfxInTimeline={isSfxInTimeline}
                />
            )}

            {/* ── Template tab ── */}
            {activeTab === "template" && (
                <div style={{ flex: 1, overflowY: "auto" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 14px", fontSize: 12, fontWeight: 950, color: C.primaryDark, background: UI.glassBg, borderBottom: `1px solid ${UI.borderSoft}`, position: "sticky", top: 0, zIndex: 1 }}>
                        <Diamond color={C.primary} /> Text Effect Templates
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, padding: 12 }}>
                        {templates.map((tpl: any) => (
                            <button key={tpl.id} onClick={() => onSelectTpl(tpl.id)} className={selectedTpl === tpl.id ? tpl.animClass : undefined}
                                aria-pressed={selectedTpl === tpl.id} aria-label={tpl.label}
                                style={{ ...btnBase, height: 84, borderRadius: 18, background: tpl.bg, color: "#fff", fontSize: 11, fontWeight: 950, textAlign: "center", padding: 10, lineHeight: 1.3, outline: selectedTpl === tpl.id ? `3px solid ${C.primary}` : "none", outlineOffset: 2, cursor: "pointer", boxShadow: "none", border: "1px solid rgba(0,0,0,0.14)" }}>
                                {tpl.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </aside>
    );
}

function normalizeMotionWord(value: string) {
    const match = String(value || "").match(/[A-Za-z0-9']+/);
    return match ? match[0].toLowerCase() : "";
}

function MotionStageVisuals({
    accent,
    mode,
    compact,
    isVertical,
    solidStage,
}: {
    accent: string;
    mode: string;
    compact: boolean;
    isVertical: boolean;
    solidStage: boolean;
}) {
    if (compact && !solidStage) {
        return null;
    }

    const barCount = compact ? 4 : 7;
    const bars = Array.from({ length: barCount }, (_, index) => index);
    const ringSize = compact ? 54 : isVertical ? 138 : 190;
    const gridOpacity = compact ? 0.12 : 0.18;
    const visualOpacity = compact ? 0.42 : 0.82;

    return (
        <>
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: `linear-gradient(90deg, ${accent}14 1px, transparent 1px), linear-gradient(0deg, ${accent}10 1px, transparent 1px)`, backgroundSize: compact ? "18px 18px" : isVertical ? "32px 32px" : "44px 44px", opacity: gridOpacity }} />
            <div style={{ position: "absolute", inset: "-18% -16%", pointerEvents: "none", background: `radial-gradient(circle at 25% 28%, ${accent}33, transparent 28%), radial-gradient(circle at 82% 78%, ${accent}24, transparent 32%)`, filter: "blur(10px)", opacity: visualOpacity, animation: "spMotionAmbient 1800ms cubic-bezier(.2,.9,.2,1) both" }} />
            <div style={{ position: "absolute", left: "-28%", top: 0, width: "28%", height: "100%", pointerEvents: "none", background: `linear-gradient(90deg, transparent, ${accent}28, transparent)`, transform: "skewX(-16deg)", animation: "spMotionSweep 1800ms cubic-bezier(.2,.9,.2,1) both" }} />

            {mode === "ui" && (
                <>
                    <div style={{ position: "absolute", right: compact ? 8 : isVertical ? 20 : 34, top: compact ? 8 : isVertical ? 24 : 34, width: compact ? 32 : isVertical ? 92 : 132, height: compact ? 20 : 58, borderTop: `2px solid ${accent}`, borderRight: `2px solid ${accent}`, opacity: 0.72, animation: "spMotionBracket 1800ms ease both" }} />
                    <div style={{ position: "absolute", left: compact ? 8 : isVertical ? 18 : 32, bottom: compact ? 8 : isVertical ? 24 : 34, width: compact ? 30 : isVertical ? 86 : 122, height: compact ? 18 : 52, borderLeft: `2px solid ${accent}`, borderBottom: `2px solid ${accent}`, opacity: 0.6, animation: "spMotionBracket 1800ms ease both" }} />
                    {!compact && <div style={{ position: "absolute", right: isVertical ? 18 : 34, bottom: isVertical ? 86 : 46, display: "grid", gap: 5, opacity: 0.72 }}>
                        {[0, 1, 2].map(index => <span key={index} style={{ display: "block", width: isVertical ? 50 + index * 12 : 78 + index * 16, height: 5, borderRadius: 999, background: accent, transformOrigin: "right center", animation: `spMotionDataLine 1800ms ${index * 70}ms ease both` }} />)}
                    </div>}
                </>
            )}

            {mode === "kinetic" && (
                <>
                    <div style={{ position: "absolute", left: "50%", top: "50%", width: ringSize, height: ringSize, marginLeft: -ringSize / 2, marginTop: -ringSize / 2, borderRadius: "50%", border: `2px solid ${accent}66`, opacity: 0.72, animation: "spMotionOrbit 1800ms cubic-bezier(.2,.9,.2,1) both" }} />
                    <div style={{ position: "absolute", left: "50%", top: "50%", width: ringSize * 0.68, height: ringSize * 0.68, marginLeft: -(ringSize * 0.68) / 2, marginTop: -(ringSize * 0.68) / 2, borderRadius: "50%", border: `1px dashed ${accent}88`, opacity: 0.58, animation: "spMotionOrbitReverse 1800ms cubic-bezier(.2,.9,.2,1) both" }} />
                    {!compact && bars.slice(0, 5).map((_, index) => (
                        <span key={index} style={{ position: "absolute", left: `${12 + index * 17}%`, top: `${20 + (index % 2) * 50}%`, width: isVertical ? 46 : 74, height: 4, borderRadius: 999, background: accent, opacity: 0.56, transform: `rotate(${index % 2 ? -18 : 18}deg)`, animation: `spMotionBurst 1800ms ${index * 55}ms ease both` }} />
                    ))}
                </>
            )}

            {mode === "stat" && (
                <>
                    <div style={{ position: "absolute", right: compact ? 8 : isVertical ? 18 : 36, bottom: compact ? 8 : isVertical ? 30 : 42, width: compact ? 46 : isVertical ? 92 : 132, height: compact ? 46 : isVertical ? 92 : 132, borderRadius: "50%", background: `conic-gradient(${accent} 0 72%, rgba(255,255,255,0.38) 72% 100%)`, opacity: 0.62, animation: "spMotionStatRing 1800ms ease both" }} />
                    <div style={{ position: "absolute", left: compact ? 8 : isVertical ? 18 : 36, bottom: compact ? 8 : isVertical ? 26 : 38, display: "flex", alignItems: "flex-end", gap: compact ? 3 : 7, height: compact ? 28 : isVertical ? 54 : 72, opacity: 0.74 }}>
                        {bars.map((_, index) => <span key={index} style={{ display: "block", width: compact ? 4 : 8, height: `${26 + ((index * 19) % 58)}%`, borderRadius: 999, background: accent, transformOrigin: "bottom", animation: `spMotionBarRise 1800ms ${index * 45}ms cubic-bezier(.2,.9,.2,1) both` }} />)}
                    </div>
                </>
            )}

            {mode === "alert" && (
                <>
                    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `repeating-linear-gradient(-18deg, ${accent}18 0 8px, transparent 8px 22px)`, opacity: compact ? 0.2 : 0.34, animation: "spMotionFlash 1800ms ease both" }} />
                    {!compact && <div style={{ position: "absolute", left: "-6%", top: isVertical ? "18%" : "24%", width: "112%", height: isVertical ? 22 : 30, background: accent, opacity: 0.24, transform: "rotate(-8deg)", animation: "spMotionImpactSlash 1800ms cubic-bezier(.2,.9,.2,1) both" }} />}
                </>
            )}

            {mode === "cta" && (
                <>
                    <div style={{ position: "absolute", left: compact ? 8 : "8%", right: compact ? 8 : "8%", bottom: compact ? 8 : isVertical ? "8%" : "9%", height: compact ? 12 : isVertical ? 34 : 42, borderRadius: 999, background: `linear-gradient(90deg, ${accent}, rgba(255,255,255,0.72))`, opacity: 0.26, animation: "spMotionCtaDock 1800ms ease both" }} />
                    {!compact && <div style={{ position: "absolute", right: isVertical ? 28 : 44, top: isVertical ? 46 : 42, width: isVertical ? 58 : 86, height: isVertical ? 58 : 86, borderRadius: 22, border: `2px solid ${accent}66`, transform: "rotate(10deg)", opacity: 0.54, animation: "spMotionCtaIcon 1800ms ease both" }} />}
                </>
            )}

            {mode === "cinematic" && (
                <>
                    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: compact ? 10 : isVertical ? 42 : 52, background: "linear-gradient(180deg, rgba(15,23,42,0.16), transparent)", opacity: 0.72 }} />
                    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: compact ? 10 : isVertical ? 42 : 52, background: "linear-gradient(0deg, rgba(15,23,42,0.14), transparent)", opacity: 0.72 }} />
                    <div style={{ position: "absolute", left: "-10%", top: "18%", width: "54%", height: compact ? 22 : 80, borderRadius: 999, background: `linear-gradient(90deg, transparent, ${accent}26, transparent)`, filter: "blur(14px)", transform: "rotate(-12deg)", animation: "spMotionLightLeak 1800ms ease both" }} />
                </>
            )}
        </>
    );
}

function MotionGraphicPreview({
    clip,
    compact = false,
    solidStage = false,
    aspectRatio = "16:9",
}: {
    clip: Partial<MotionGraphicSuggestion> & Record<string, any>;
    compact?: boolean;
    solidStage?: boolean;
    aspectRatio?: "16:9" | "9:16";
}) {
    const accent = String(clip.accent_color || C.primary);
    const background = String(clip.background || "rgba(239,246,255,0.92)");
    const solidBackground = String(clip.solid_background || "#F8FAFC");
    const imageUrl = String(clip.image_url || "");
    const imageAlt = String(clip.image_alt || clip.keyword || "Motion graphic image");
    const text = String(clip.text || clip.keyword || "Key Moment");
    const keyword = String(clip.keyword || "Motion");
    const momentType = String(clip.moment_type || "explanation").replace(/_/g, " ");
    const styleFamily = String(clip.style_family || "cinematic_creator");
    const styleName = String(clip.style || "").toLowerCase();
    const motionRole = String(clip.motion_role || "secondary");
    const importantWords = new Set(
        (Array.isArray(clip.important_words) ? clip.important_words : [])
            .map((word: string) => normalizeMotionWord(word))
            .filter(Boolean),
    );
    const placement = String(clip.placement || "lower_third");
    const isSoftMotion = motionRole === "ambient" || momentType === "emotion" || styleFamily === "cinematic_creator";
    const isVertical = aspectRatio === "9:16";
    const imageTextMode = styleName.includes("editorial_image_text") || styleName.includes("image_text");
    const visualMode =
        imageTextMode ? "image_text"
            : styleName.includes("stat") ? "stat"
            : styleName.includes("alert") ? "alert"
                : styleName.includes("ui") || styleFamily === "ui_motion" ? "ui"
                    : styleName.includes("cta") || momentType === "cta" ? "cta"
                        : momentType === "emotion" ? "cinematic"
                            : "kinetic";
    const wordCount = Math.max(1, text.trim().split(/\s+/).filter(Boolean).length);
    const titleFontSize = compact
        ? 11
        : isVertical
            ? wordCount <= 2 ? 27 : wordCount <= 4 ? 23 : 19
            : wordCount <= 2 ? 36 : wordCount <= 4 ? 30 : 25;
    const boxStyle: React.CSSProperties = compact
        ? { minWidth: 78, maxWidth: 120, padding: "6px 8px", borderRadius: 9, borderWidth: 2 }
        : {
            minWidth: isVertical ? 156 : 210,
            maxWidth: isVertical ? "84%" : "72%",
            padding: isVertical ? "12px 14px" : "16px 18px",
            borderRadius: isVertical ? 16 : 20,
            borderWidth: isVertical ? 3 : 4,
        };
    const placementStyle: React.CSSProperties =
        placement === "center"
            ? { left: "50%", top: "50%", translate: "-50% -50%" }
            : placement === "top_right"
                ? { right: compact ? 4 : isVertical ? "6%" : "7%", top: compact ? 4 : isVertical ? "8%" : "10%" }
                : placement === "top_left"
                    ? { left: compact ? 4 : isVertical ? "6%" : "7%", top: compact ? 4 : isVertical ? "8%" : "10%" }
                    : { left: "50%", bottom: compact ? 4 : isVertical ? "10%" : "14%", translate: "-50% 0" };

    if (imageTextMode) {
        const words = text.split(/(\s+)/);
        const cleanWords = text.trim().split(/\s+/).filter(Boolean);
        const ghostText = cleanWords.slice(-2).join(" ") || keyword || text;
        const posterAccent = String(accent || "#7E22CE");
        const posterSans = "var(--font-sans), Inter, -apple-system, BlinkMacSystemFont, sans-serif";
        const posterSerif = "var(--font-serif), 'Source Serif 4', 'New York', Georgia, serif";
        return (
            <div
                data-aspect={aspectRatio}
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    background: "#fbfbfb",
                    color: "#050505",
                }}
            >
                <style>{`
                    @keyframes spMotionEditorialImage {
                        0% { opacity: 0; transform: translate(-50%, 22px) scale(.88) rotate(-2deg); filter: blur(14px) grayscale(.8); }
                        24%, 78% { opacity: 1; transform: translate(-50%, 0) scale(1) rotate(0deg); filter: blur(0) grayscale(.05); }
                        100% { opacity: 0; transform: translate(-50%, -12px) scale(.98) rotate(1deg); filter: blur(2px) grayscale(.3); }
                    }
                    @keyframes spMotionEditorialGhost {
                        0% { opacity: 0; transform: translate(-50%, 18px) scale(.98); }
                        22%, 82% { opacity: .085; transform: translate(-50%, 0) scale(1); }
                        100% { opacity: 0; transform: translate(-50%, -12px) scale(1.03); }
                    }
                    @keyframes spMotionWordOpacity {
                        0%, 12% { opacity: 0; transform: translateY(12px) skewY(1deg); filter: blur(8px); }
                        26%, 78% { opacity: 1; transform: translateY(0) skewY(0deg); filter: blur(0); }
                        100% { opacity: .32; transform: translateY(-4px); filter: blur(0); }
                    }
                `}</style>
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage: `
                            linear-gradient(rgba(17,24,39,0.055) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(17,24,39,0.055) 1px, transparent 1px),
                            linear-gradient(180deg, rgba(0,0,0,0.025), transparent 25%, transparent 70%, rgba(0,0,0,0.09))
                        `,
                        backgroundSize: compact ? "24px 24px,24px 24px,100% 100%" : "44px 44px,44px 44px,100% 100%",
                    }}
                />
                <div style={{ position: "absolute", left: "50%", top: isVertical ? "64%" : "68%", width: "135%", translate: "-50% -50%", textAlign: "center", fontFamily: posterSerif, fontSize: compact ? 42 : isVertical ? 112 : 94, lineHeight: .82, fontStyle: "italic", fontWeight: 600, color: "#050505", pointerEvents: "none", animation: "spMotionEditorialGhost 1800ms ease both" }}>
                    {ghostText}
                </div>
                <div style={{ position: "absolute", left: "50%", top: compact ? "36%" : isVertical ? "45%" : "47%", width: compact ? "46%" : isVertical ? "58%" : "38%", height: compact ? "34%" : isVertical ? "32%" : "38%", transform: "translateX(-50%)", borderRadius: compact ? "50%" : "999px", overflow: "hidden", background: "#eeeeee", border: "1px solid rgba(0,0,0,0.08)", boxShadow: compact ? "0 12px 24px rgba(0,0,0,.18)" : "0 28px 58px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.75)", animation: "spMotionEditorialImage 1800ms cubic-bezier(.2,.9,.2,1) both" }}>
                    {imageUrl ? (
                        <img src={imageUrl} alt={imageAlt} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "saturate(.92) contrast(1.08)" }} />
                    ) : (
                        <div style={{ width: "100%", height: "100%", background: `radial-gradient(circle at 50% 45%, ${posterAccent}66, transparent 0 28%, #757575 29% 100%)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: compact ? 10 : 18, fontWeight: 850, letterSpacing: ".04em", fontFamily: posterSans }}>{keyword.slice(0, 10)}</div>
                    )}
                </div>
                <div style={{ position: "absolute", left: "50%", top: compact ? "72%" : isVertical ? "28%" : "30%", width: compact ? "90%" : isVertical ? "86%" : "72%", translate: "-50% -50%", textAlign: "center", zIndex: 3 }}>
                    <div style={{ fontSize: compact ? 13 : titleFontSize + (isVertical ? 12 : 13), lineHeight: isVertical ? .9 : .88, fontWeight: 850, color: "#050505", letterSpacing: 0, overflowWrap: "anywhere", fontFamily: posterSans }}>
                        {words.map((part, idx) => {
                            const isSpace = /^\s+$/.test(part);
                            const normalized = normalizeMotionWord(part);
                            const accented = importantWords.has(normalized) || (!isSpace && idx % 5 === 0);
                            const delay = Math.min(720, idx * 42);
                            return (
                                <span
                                    key={`${part}-${idx}`}
                                    style={isSpace ? undefined : {
                                        display: "inline-block",
                                        opacity: 0,
                                        color: accented ? posterAccent : "#242424",
                                        fontFamily: accented ? posterSerif : posterSans,
                                        fontStyle: accented ? "italic" : "normal",
                                        fontWeight: accented ? 600 : 850,
                                        animation: `spMotionWordOpacity 1800ms ${delay}ms cubic-bezier(.2,.9,.2,1) both`,
                                    }}
                                >
                                    {part}
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            data-aspect={aspectRatio}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                background: solidStage ? solidBackground : compact ? "linear-gradient(135deg,#f8fafc,#eef2ff)" : "transparent",
            }}
        >
            <style>{`
                @keyframes spMotionAmbient {
                    0% { opacity: 0; transform: scale(.96) translate3d(-2%, 2%, 0); }
                    22%, 82% { opacity: 1; transform: scale(1) translate3d(0, 0, 0); }
                    100% { opacity: 0; transform: scale(1.04) translate3d(2%, -1%, 0); }
                }
                @keyframes spMotionSweep {
                    0% { opacity: 0; transform: translateX(0) skewX(-16deg); }
                    20% { opacity: .85; }
                    70% { opacity: .55; }
                    100% { opacity: 0; transform: translateX(560%) skewX(-16deg); }
                }
                @keyframes spMotionBracket {
                    0% { opacity: 0; transform: scale(.76); }
                    18%, 78% { opacity: .76; transform: scale(1); }
                    100% { opacity: 0; transform: scale(1.08); }
                }
                @keyframes spMotionDataLine {
                    0% { transform: scaleX(0); opacity: 0; }
                    24%, 82% { transform: scaleX(1); opacity: 1; }
                    100% { transform: scaleX(.25); opacity: 0; }
                }
                @keyframes spMotionOrbit {
                    0% { opacity: 0; transform: rotate(-36deg) scale(.72); }
                    24%, 82% { opacity: .72; transform: rotate(18deg) scale(1); }
                    100% { opacity: 0; transform: rotate(58deg) scale(1.12); }
                }
                @keyframes spMotionOrbitReverse {
                    0% { opacity: 0; transform: rotate(36deg) scale(.78); }
                    24%, 82% { opacity: .6; transform: rotate(-18deg) scale(1); }
                    100% { opacity: 0; transform: rotate(-62deg) scale(1.1); }
                }
                @keyframes spMotionBurst {
                    0% { opacity: 0; transform: translateY(14px) rotate(var(--r, 16deg)) scaleX(0); }
                    24%, 72% { opacity: .64; transform: translateY(0) rotate(var(--r, 16deg)) scaleX(1); }
                    100% { opacity: 0; transform: translateY(-10px) rotate(var(--r, 16deg)) scaleX(.2); }
                }
                @keyframes spMotionStatRing {
                    0% { opacity: 0; transform: rotate(-24deg) scale(.72); filter: blur(4px); }
                    24%, 82% { opacity: .62; transform: rotate(12deg) scale(1); filter: blur(0); }
                    100% { opacity: 0; transform: rotate(36deg) scale(1.06); filter: blur(0); }
                }
                @keyframes spMotionBarRise {
                    0% { transform: scaleY(0); opacity: 0; }
                    24%, 82% { transform: scaleY(1); opacity: 1; }
                    100% { transform: scaleY(.22); opacity: 0; }
                }
                @keyframes spMotionFlash {
                    0%, 8% { opacity: 0; }
                    14% { opacity: .8; }
                    22%, 74% { opacity: .34; }
                    100% { opacity: 0; }
                }
                @keyframes spMotionImpactSlash {
                    0% { opacity: 0; transform: translateX(-20%) rotate(-8deg) scaleX(.4); }
                    18%, 74% { opacity: .24; transform: translateX(0) rotate(-8deg) scaleX(1); }
                    100% { opacity: 0; transform: translateX(18%) rotate(-8deg) scaleX(.6); }
                }
                @keyframes spMotionCtaDock {
                    0% { opacity: 0; transform: translateY(22px) scaleX(.72); }
                    24%, 82% { opacity: .28; transform: translateY(0) scaleX(1); }
                    100% { opacity: 0; transform: translateY(12px) scaleX(.86); }
                }
                @keyframes spMotionCtaIcon {
                    0% { opacity: 0; transform: rotate(-8deg) scale(.7); }
                    24%, 82% { opacity: .58; transform: rotate(10deg) scale(1); }
                    100% { opacity: 0; transform: rotate(22deg) scale(.9); }
                }
                @keyframes spMotionLightLeak {
                    0% { opacity: 0; transform: translateX(-12%) rotate(-12deg); }
                    26%, 82% { opacity: 1; transform: translateX(0) rotate(-12deg); }
                    100% { opacity: 0; transform: translateX(28%) rotate(-12deg); }
                }
                @keyframes spMotionGraphicPop {
                    0% { opacity: 0; transform: translateY(18px) scale(.88); }
                    18% { opacity: 1; transform: translateY(0) scale(1.04); }
                    34%, 82% { opacity: 1; transform: translateY(0) scale(1); }
                    100% { opacity: 0; transform: translateY(-10px) scale(.96); }
                }
                @keyframes spMotionGraphicSoft {
                    0% { opacity: 0; transform: translateY(12px) scale(.98); filter: blur(4px); }
                    24%, 82% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
                    100% { opacity: 0; transform: translateY(-8px) scale(.99); filter: blur(0); }
                }
                @keyframes spMotionGraphicLine {
                    0% { transform: scaleX(0); opacity: .4; }
                    24%, 82% { transform: scaleX(1); opacity: 1; }
                    100% { transform: scaleX(.35); opacity: 0; }
                }
                @keyframes spMotionGraphicWord {
                    0%, 12% { transform: translateY(8px) scale(.96); opacity: .75; }
                    24%, 82% { transform: translateY(0) scale(1.08); opacity: 1; }
                    100% { transform: translateY(-4px) scale(1); opacity: 1; }
                }
            `}</style>
            <MotionStageVisuals accent={accent} mode={visualMode} compact={compact} isVertical={isVertical} solidStage={solidStage} />
            <div
                style={{
                    position: "absolute",
                    ...placementStyle,
                    ...boxStyle,
                    background,
                    backdropFilter: compact ? undefined : "blur(18px) saturate(150%)",
                    borderStyle: "solid",
                    borderColor: accent,
                    overflow: "hidden",
                    boxShadow: compact ? "none" : isSoftMotion ? "0 14px 34px rgba(15,23,42,0.14)" : "0 18px 42px rgba(15,23,42,0.2)",
                    animation: `${isSoftMotion ? "spMotionGraphicSoft" : "spMotionGraphicPop"} 1800ms cubic-bezier(.2,.9,.2,1) both`,
                    color: "#111827",
                    textAlign: "center",
                }}
            >
                {!compact && (
                    <>
                        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: isVertical ? 4 : 5, background: `linear-gradient(90deg, ${accent}, rgba(255,255,255,0.5), ${accent})`, opacity: 0.9 }} />
                        <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle at 18% 18%, ${accent}18, transparent 18%), linear-gradient(135deg, rgba(255,255,255,0.34), transparent 46%)`, pointerEvents: "none" }} />
                        <div style={{ position: "absolute", left: 10, top: 10, width: 14, height: 14, borderLeft: `2px solid ${accent}`, borderTop: `2px solid ${accent}`, opacity: 0.7 }} />
                        <div style={{ position: "absolute", right: 10, bottom: 10, width: 14, height: 14, borderRight: `2px solid ${accent}`, borderBottom: `2px solid ${accent}`, opacity: 0.7 }} />
                    </>
                )}
                <div style={{ fontSize: compact ? 6 : isVertical ? 9 : 11, fontWeight: 950, color: accent, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {compact ? momentType : keyword}
                </div>
                <div style={{ marginTop: compact ? 2 : isVertical ? 5 : 6, fontSize: titleFontSize, lineHeight: isVertical ? 1.02 : 0.95, fontWeight: 1000, textTransform: "uppercase", color: "#0f172a", textShadow: "0 1px 0 rgba(255,255,255,0.72)", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                    {text.split(/(\s+)/).map((part, idx) => {
                        const normalized = normalizeMotionWord(part);
                        const highlight = normalized && importantWords.has(normalized);
                        return (
                            <span
                                key={`${part}-${idx}`}
                                style={highlight ? {
                                    display: "inline-block",
                                    color: accent,
                                    animation: "spMotionGraphicWord 1800ms cubic-bezier(.2,.9,.2,1) both",
                                    transformOrigin: "center bottom",
                                } : undefined}
                            >
                                {part}
                            </span>
                        );
                    })}
                </div>
                <div style={{ margin: compact ? "4px auto 0" : isVertical ? "8px auto 0" : "10px auto 0", width: compact ? 46 : isVertical ? 72 : 94, height: compact ? 3 : isVertical ? 4 : 5, borderRadius: 999, background: accent, transformOrigin: "left center", animation: "spMotionGraphicLine 1800ms ease both" }} />
            </div>
        </div>
    );
}

// -- AnimatedWord moved to TextTemplates.tsx --

// ── CenterCanvas ──────────────────────────────────────────────────────────
function CenterCanvas({
    videoRef,
    videoBlobUrl,
    aspectRatio,
    onAspectChange,
    uploadPct,
    onFileSelected,
    onViewportChange,
    fileInputRef,
    subtitleTrack = [],
    brollTrack = [],
    motionGraphicsTrack = [],
    musicTrack = null,
    sfxTrack = [],
    layerVisibility,
    currentTimeMs,
    isPlaying,
    selectedTpl,
    cropState,
    customStyle,
}: any) {
    const captionsVisible = layerVisibility?.captions ?? true;
    const rawVisible = layerVisibility?.raw ?? true;
    const brollVisible = layerVisibility?.broll ?? true;
    const motionVisible = layerVisibility?.motion ?? true;
    const musicVisible = layerVisibility?.music ?? true;
    const sfxVisible = layerVisibility?.sfx ?? true;
    const activeCue = captionsVisible
        ? subtitleTrack?.find((c: any) => c.start_ms <= currentTimeMs && c.end_ms > currentTimeMs)
        : null;
    const activeBroll = brollVisible
        ? brollTrack?.find((b: any) => b.start_ms <= currentTimeMs && b.end_ms > currentTimeMs)
        : null;
    const activeMotion = motionVisible
        ? motionGraphicsTrack?.find((clip: any) => clip.start_ms <= currentTimeMs && clip.end_ms > currentTimeMs)
        : null;
    const canvasRef = useRef<HTMLDivElement>(null);
    const musicAudioRef = useRef<HTMLAudioElement | null>(null);
    const sfxAudioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
    const [captionViewport, setCaptionViewport] = useState<CaptionViewportMetrics>({
        width: 0,
        height: 0,
        aspectRatio,
    });

    const combinedStyle = {
        ...(TEMPLATES_CONFIG[selectedTpl || ""] || {}),
        ...customStyle
    };
    const activeLayerCount = [rawVisible, captionsVisible, brollVisible, motionVisible, musicVisible, sfxVisible].filter(Boolean).length;
    const studioStatusItems = [
        { label: "Captions", value: `${subtitleTrack.length}`, icon: Type, active: captionsVisible },
        { label: "B-roll", value: `${brollTrack.length}`, icon: Film, active: brollVisible },
        { label: "Motion", value: `${motionGraphicsTrack.length}`, icon: Sparkles, active: motionVisible },
        { label: "Audio", value: `${musicTrack?.preview_url ? 1 : 0}/${Array.isArray(sfxTrack) ? sfxTrack.length : 0}`, icon: AudioLines, active: musicVisible || sfxVisible },
    ] as const;

    useEffect(() => {
        const node = canvasRef.current;
        if (!node) return;

        const syncViewport = () => {
            const rect = node.getBoundingClientRect();
            const width = Math.round(rect.width);
            const height = Math.round(rect.height);
            if (width > 0 && height > 0) {
                onViewportChange?.({ width, height });
            }
            setCaptionViewport((prev) => {
                if (prev.width === width && prev.height === height && prev.aspectRatio === aspectRatio) {
                    return prev;
                }
                return { width, height, aspectRatio };
            });
        };

        syncViewport();

        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(syncViewport);
            observer.observe(node);
            return () => observer.disconnect();
        }

        window.addEventListener("resize", syncViewport);
        return () => window.removeEventListener("resize", syncViewport);
    }, [aspectRatio]);

    useEffect(() => {
        const audio = musicAudioRef.current;
        if (!audio || !musicTrack?.preview_url) return;
        if (!musicVisible) {
            audio.pause();
            return;
        }

        const startMs = Number.isFinite(Number(musicTrack.start_ms)) ? Number(musicTrack.start_ms) : 0;
        const endMs = Number.isFinite(Number(musicTrack.end_ms))
            ? Number(musicTrack.end_ms)
            : startMs + Math.max(1000, Math.round(Number(musicTrack.duration || 0) * 1000));
        const trimStartMs = Number.isFinite(Number(musicTrack.trim_start_ms)) ? Number(musicTrack.trim_start_ms) : 0;
        const inRange = Boolean(isPlaying) && currentTimeMs >= startMs && currentTimeMs < endMs;
        const targetSec = Math.max(0, (trimStartMs + Math.max(0, currentTimeMs - startMs)) / 1000);
        const musicDb = Number.isFinite(Number(musicTrack.volume_db)) ? Number(musicTrack.volume_db) : -15;
        const musicVolume = Math.max(0, Math.min(1, Math.pow(10, musicDb / 20)));
        audio.volume = musicVolume;

        if (!inRange) {
            audio.pause();
            return;
        }

        if (Math.abs(audio.currentTime - targetSec) > 0.22) {
            audio.currentTime = targetSec;
        }
        if (audio.paused) {
            void audio.play().catch(() => { });
        }
    }, [musicTrack, currentTimeMs, isPlaying, musicVisible]);

    useEffect(() => {
        if (!sfxVisible) {
            Object.values(sfxAudioRefs.current).forEach((audio) => audio?.pause());
            return;
        }
        const tracks = Array.isArray(sfxTrack) ? sfxTrack : [];
        tracks.forEach((clip: any) => {
            const clipId = String(clip.id ?? `${clip.file_url}-${clip.start_ms}`);
            const audio = sfxAudioRefs.current[clipId];
            if (!audio || !clip?.file_url) return;

            const startMs = Number.isFinite(Number(clip.start_ms)) ? Number(clip.start_ms) : 0;
            const endMs = Number.isFinite(Number(clip.end_ms))
                ? Number(clip.end_ms)
                : startMs + Math.max(90, Math.round(Number(clip.duration || 0.35) * 1000));
            const trimStartMs = Number.isFinite(Number(clip.trim_start_ms)) ? Number(clip.trim_start_ms) : 0;
            const inRange = Boolean(isPlaying) && currentTimeMs >= startMs && currentTimeMs < endMs;
            const targetSec = Math.max(0, (trimStartMs + Math.max(0, currentTimeMs - startMs)) / 1000);
            const sfxDb = Number.isFinite(Number(clip.volume_db)) ? Number(clip.volume_db) : -7;
            const sfxVolume = Math.max(0, Math.min(1, Math.pow(10, sfxDb / 20)));
            audio.volume = sfxVolume;

            if (!inRange) {
                audio.pause();
                return;
            }

            if (Math.abs(audio.currentTime - targetSec) > 0.18) {
                audio.currentTime = targetSec;
            }
            if (audio.paused) {
                void audio.play().catch(() => { });
            }
        });
    }, [sfxTrack, currentTimeMs, isPlaying, sfxVisible]);

    return (
        <main style={{ flex: 1, background: "rgba(245,245,247,0.68)", border: `1px solid ${UI.borderStrong}`, borderRadius: 26, display: "flex", flexDirection: "column", alignItems: "center", overflow: "hidden", position: "relative" }}>
            {/* Aspect ratio toggle */}
            <div style={{ width: "100%", padding: "14px 18px 10px", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <div style={{ justifySelf: "start", maxWidth: "100%", display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 16, background: UI.appBgElev, border: `1px solid ${UI.borderStrong}` }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: isPlaying ? C.success : UI.textMuted }} />
                    <span style={{ fontSize: 12, color: UI.textBase, maxWidth: 310, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 800 }}>
                        {activeCue ? String(activeCue.text ?? "").trim() || "Caption active" : "No active caption"}
                    </span>
                </div>
                <div style={{ display: "flex", background: UI.appBgElev, borderRadius: 16, padding: 4, gap: 4, border: `1px solid ${UI.borderStrong}` }}>
                    {(["16:9", "9:16"] as const).map(r => (
                        <button key={r} onClick={() => onAspectChange(r)} style={{ ...btnBase, padding: "7px 19px", borderRadius: 12, fontSize: 12, fontWeight: 850, background: aspectRatio === r ? C.primary : "transparent", color: aspectRatio === r ? "#fff" : UI.textMuted, transition: "all 0.15s", border: aspectRatio === r ? `1px solid ${C.primaryHover}` : "1px solid transparent" }}>{r}</button>
                    ))}
                </div>
                <div style={{ justifySelf: "end", display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 16, background: UI.appBgElev, border: `1px solid ${UI.borderStrong}`, fontSize: 12, color: UI.textBase, fontWeight: 850 }}>
                    <span style={{ color: UI.textMuted }}>Layers</span>
                    <span>{activeLayerCount}/6 visible</span>
                </div>
                {cropState === "running" && <span style={{ gridColumn: "1 / -1", justifySelf: "center", fontSize: 11, color: C.warning, fontWeight: 850 }}>Cropping video...</span>}
            </div>

            {/* Video canvas */}
            <div ref={canvasRef} style={{ position: "relative", borderRadius: 28, overflow: "hidden", boxShadow: "none", border: `1px solid ${UI.borderStrong}`, outline: "8px solid rgba(255,255,255,0.72)", background: `linear-gradient(180deg, ${UI.stageBg}, oklch(0.090 0 0))`, ...(aspectRatio === "16:9" ? { width: "min(920px,93%)", aspectRatio: "16/9" } : { height: "min(586px,78%)", aspectRatio: "9/16" }) }}>
                {videoBlobUrl ? (
                    <video
                        ref={videoRef}
                        src={videoBlobUrl}
                        style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000", opacity: rawVisible ? 1 : 0, transition: "opacity 120ms ease" }}
                        playsInline
                    />
                ) : (
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, cursor: "pointer" }} onClick={() => fileInputRef.current?.click()}>
                        {uploadPct !== null ? (
                            <>
                                <div style={{ fontSize: 24, fontWeight: 700, color: C.primary }}>{uploadPct}%</div>
                                <div style={{ width: 160, height: 4, background: C.gray200, borderRadius: 2 }}>
                                    <div style={{ height: "100%", width: `${uploadPct}%`, background: C.primary, borderRadius: 2, transition: "width 0.2s" }} />
                                </div>
                                <p style={{ fontSize: 12, color: C.gray500 }}>Uploading...</p>
                            </>
                        ) : (
                            <>
                                <VideoIcon color={C.accentLight} />
                                <p style={{ fontSize: 13, color: "#fff", margin: 0, fontWeight: 900 }}>Drop or click to upload video</p>
                                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.68)", margin: 0 }}>MP4, MOV, WebM</p>
                            </>
                        )}
                    </div>
                )}

                {/* B-roll overlay (layer 1) */}
                {activeBroll && activeBroll.video_url && (
                    <video
                        src={activeBroll.video_url}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 10 }}
                        autoPlay loop muted playsInline
                    />
                )}

                {activeMotion && (
                    <div style={{ position: "absolute", inset: 0, zIndex: 24, pointerEvents: "none", overflow: "hidden" }}>
                        <MotionGraphicPreview clip={activeMotion} solidStage aspectRatio={aspectRatio} />
                    </div>
                )}

                {/* Caption overlay (layer 2) — template-aware text slicing */}
                {activeCue && (
                    <div style={{ position: "absolute", inset: 0, zIndex: 20, pointerEvents: "none", overflow: "hidden" }}>
                        <CaptionOverlay
                            cue={activeCue}
                            currentTimeMs={currentTimeMs}
                            combinedStyle={combinedStyle}
                            viewport={captionViewport}
                        />
                    </div>
                )}

                <div style={{ position: "absolute", left: 14, top: 14, zIndex: 24, display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 11px", borderRadius: 14, background: "rgba(255,255,255,0.88)", border: `1px solid ${UI.borderStrong}`, color: UI.textStrong, fontSize: 11, fontWeight: 950 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: isPlaying ? C.success : UI.textMuted }} />
                    {isPlaying ? "Playing" : "Paused"}
                </div>
                {activeBroll?.video_url && (
                    <div style={{ position: "absolute", right: 14, top: 14, zIndex: 24, padding: "7px 11px", borderRadius: 14, background: C.primary, color: "#fff", fontSize: 11, fontWeight: 950, border: `1px solid ${C.primaryHover}` }}>
                        B-roll
                    </div>
                )}
                {musicVisible && musicTrack?.preview_url && (
                    <div style={{ position: "absolute", right: 14, bottom: 14, zIndex: 24, padding: "7px 11px", borderRadius: 14, background: C.success, color: "#fff", fontSize: 11, fontWeight: 950, border: `1px solid ${C.success}` }}>
                        Music
                    </div>
                )}
            </div>

            <div style={{ width: "min(920px,93%)", display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 9, margin: "14px 0 0", flexShrink: 0 }}>
                {studioStatusItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <div key={item.label} style={{ minHeight: 48, borderRadius: 17, border: `1px solid ${item.active ? UI.borderStrong : UI.borderSoft}`, background: item.active ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.42)", display: "flex", alignItems: "center", gap: 10, padding: "0 12px", color: item.active ? UI.textStrong : UI.textMuted }}>
                            <span style={{ width: 30, height: 30, borderRadius: 12, display: "grid", placeItems: "center", background: item.active ? C.primarySubtle : "rgba(255,255,255,0.62)", color: item.active ? C.primaryDark : UI.textMuted }}>
                                <Icon size={14} />
                            </span>
                            <span style={{ minWidth: 0, flex: 1 }}>
                                <span style={{ display: "block", fontSize: 11, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                                <span style={{ display: "block", marginTop: 2, fontSize: 10, fontWeight: 750, color: UI.textMuted }}>{item.value} active</span>
                            </span>
                        </div>
                    );
                })}
            </div>

            {musicVisible && musicTrack?.preview_url && (
                <audio
                    ref={musicAudioRef}
                    src={musicTrack.preview_url}
                    preload="auto"
                    style={{ display: "none" }}
                />
            )}
            {(Array.isArray(sfxTrack) ? sfxTrack : []).map((clip: any) => {
                const clipId = String(clip.id ?? `${clip.file_url}-${clip.start_ms}`);
                if (!clip?.file_url) return null;
                return (
                    <audio
                        key={clipId}
                        ref={(node) => { sfxAudioRefs.current[clipId] = node; }}
                        src={clip.file_url}
                        preload="auto"
                        style={{ display: "none" }}
                    />
                );
            })}

            <input ref={fileInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelected(f); e.target.value = ""; }} />
        </main>
    );
}

// ── CaptionOverlay — aggregates adjacent cues based on captionMode ────────
// IMPORTANT: We only look BACKWARD (past cues) to build the display window.
// Never aggregate FORWARD into upcoming cues — that would show words before
// the audio speaks them, breaking sync.
function CaptionOverlay({ cue, currentTimeMs, combinedStyle, viewport }: {
    cue: any; currentTimeMs: number; combinedStyle: any; viewport?: CaptionViewportMetrics;
}) {
    const mode: string = combinedStyle.captionMode ?? "chunk";
    const cueText = String(cue.text ?? "").trim();

    let displayText = cueText;
    if (mode === "word") {
        displayText = pickActiveWord(cueText, cue.start_ms, cue.end_ms, currentTimeMs);
    }

    return (
        <AnimatedWord
            key={`${getCueId(cue)}-${mode}`}
            text={displayText}
            combinedStyle={combinedStyle}
            viewport={viewport}
        />
    );
}

const PANEL_TEXT_SWATCHES = ["#FFFFFF", "#FEF08A", "#4ADE80", "#38BDF8", "#F87171", "#A78BFA", "#000000"];
const PANEL_STROKE_SWATCHES = ["#000000", "#1F2937", "#14532D", "#831843", "#FFFFFF", "transparent"];
const PANEL_BG_SWATCHES = ["#000000", "#1F2937", "#334155", "#7C2D12", "#14532D", "#831843"];
const ENTER_ANIMATION_OPTIONS = ["Pop", "Fade In", "Slide Up", "Bounce", "Glitch", "BeastPop", "HormoziSlam"];
const EXIT_ANIMATION_OPTIONS = ["Fade Out", "Slide Down", "Zoom Out", "None"];

function clampPanel(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function parseColor(color: string, fallback: { r: number; g: number; b: number; a: number }) {
    const raw = (color || "").trim();
    const hex3 = raw.match(/^#([0-9a-fA-F]{3})$/);
    if (hex3) {
        const v = hex3[1];
        return {
            r: parseInt(v[0] + v[0], 16),
            g: parseInt(v[1] + v[1], 16),
            b: parseInt(v[2] + v[2], 16),
            a: 1,
        };
    }
    const hex6 = raw.match(/^#([0-9a-fA-F]{6})$/);
    if (hex6) {
        const v = hex6[1];
        return {
            r: parseInt(v.slice(0, 2), 16),
            g: parseInt(v.slice(2, 4), 16),
            b: parseInt(v.slice(4, 6), 16),
            a: 1,
        };
    }
    const rgba = raw.match(
        /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+)\s*)?\)$/i,
    );
    if (rgba) {
        return {
            r: clampPanel(Number(rgba[1]), 0, 255),
            g: clampPanel(Number(rgba[2]), 0, 255),
            b: clampPanel(Number(rgba[3]), 0, 255),
            a: clampPanel(rgba[4] ? Number(rgba[4]) : 1, 0, 1),
        };
    }
    return fallback;
}

function colorToHex(color: string, fallback = "#000000") {
    const parsed = parseColor(color, parseColor(fallback, { r: 0, g: 0, b: 0, a: 1 }));
    const toHex = (value: number) => Math.round(clampPanel(value, 0, 255)).toString(16).padStart(2, "0");
    return `#${toHex(parsed.r)}${toHex(parsed.g)}${toHex(parsed.b)}`.toUpperCase();
}

function colorAlpha(color: string, fallback = 1) {
    const parsed = parseColor(color, { r: 0, g: 0, b: 0, a: fallback });
    return clampPanel(parsed.a, 0, 1);
}

function withAlpha(color: string, alpha: number) {
    const parsed = parseColor(color, { r: 0, g: 0, b: 0, a: 1 });
    return `rgba(${Math.round(parsed.r)}, ${Math.round(parsed.g)}, ${Math.round(parsed.b)}, ${clampPanel(alpha, 0, 1).toFixed(2)})`;
}

// RightPanel ────────────────────────────────────────────────────────────
function RightPanelLegacy({
    activeTab,
    setActiveTab,
    selectedTpl,
    customStyle,
    setCustomStyle,
    saveState,
    onResetStyles,
}: {
    activeTab: RightTab;
    setActiveTab: (t: RightTab) => void;
    selectedTpl: string | null;
    customStyle: Record<string, any>;
    setCustomStyle: (patch: any) => void;
    saveState: "idle" | "saving" | "saved" | "error";
    onResetStyles: () => void;
}) {
    const TABS = [
        { key: "type", label: "Type", icon: Type },
        { key: "fx", label: "FX", icon: SlidersHorizontal },
        { key: "anime", label: "Anime", icon: Sparkles },
        { key: "layout", label: "Layout", icon: Layout },
    ] as const;
    const fontsList = useGoogleFontsList();
    const templateDefaults: Record<string, any> = useMemo(
        () => (selectedTpl && TEMPLATES_CONFIG[selectedTpl]) ? TEMPLATES_CONFIG[selectedTpl] : {},
        [selectedTpl],
    );
    const effectiveStyle: Record<string, any> = useMemo(
        () => ({ ...templateDefaults, ...customStyle }),
        [templateDefaults, customStyle],
    );

    const handleStyle = (patch: any) => setCustomStyle(patch);
    const saveTone = saveState === "error" ? C.danger : saveState === "saving" ? C.warning : C.success;
    const saveLabel = saveState === "saving" ? "Saving" : saveState === "error" ? "Save Failed" : "Saved";
    const backgroundValue = String(effectiveStyle.background || "").trim();
    const backgroundEnabled = Boolean(backgroundValue && backgroundValue !== "transparent" && backgroundValue !== "none");
    const bgHex = colorToHex(backgroundValue || "#000000", "#000000");
    const bgAlpha = colorAlpha(backgroundValue || "rgba(0,0,0,0.75)", 0.75);
    const shadowRaw = String(effectiveStyle.shadowColor || "").trim();
    const shadowEnabled = !!shadowRaw;
    const shadowHex = colorToHex(shadowRaw || "#000000", "#000000");
    const shadowAlpha = colorAlpha(shadowRaw || "rgba(0,0,0,0.85)", 0.85);
    const glowRaw = String(effectiveStyle.glowColor || "").trim();
    const glowEnabled = !!glowRaw;
    const glowHex = colorToHex(glowRaw || "#00FFFF", "#00FFFF");

    const cardStyle: React.CSSProperties = {
        border: `1px solid ${C.gray200}`,
        background: C.surfaceElev,
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
    };

    const segmentedStyle: React.CSSProperties = {
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 6,
    };

    return (
        <aside style={{ width: 320, flexShrink: 0, background: C.surfaceSec, borderLeft: `1px solid ${C.gray200}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.gray200}`, background: C.surfaceElev }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 99, background: saveTone }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: saveTone }}>{saveLabel}</span>
                    </div>
                    <button
                        onClick={onResetStyles}
                        style={{ ...btnBase, fontSize: 10, fontWeight: 700, color: C.gray600, border: `1px solid ${C.gray300}`, borderRadius: 6, padding: "4px 8px", background: "#fff" }}
                        title="Clear custom overrides and return to template defaults"
                    >
                        Reset
                    </button>
                </div>
                <div style={{ fontSize: 10, color: C.gray500, display: "flex", justifyContent: "space-between" }}>
                    Template: <span style={{ color: C.gray700, fontWeight: 700 }}>{selectedTpl || "None"}</span>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: `1px solid ${C.gray200}`, background: C.surfaceElev, flexShrink: 0 }}>
                {TABS.map(t => {
                    const Icon = t.icon;
                    return (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key as RightTab)}
                        title={t.label}
                        style={{
                            ...btnBase,
                            padding: "8px 0 7px",
                            fontSize: 10,
                            fontWeight: 700,
                            background: activeTab === t.key ? C.accent : "transparent",
                            color: activeTab === t.key ? "#fff" : C.gray500,
                            borderBottom: `2px solid ${activeTab === t.key ? C.accent : "transparent"}`,
                            transition: "all 0.15s",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 4,
                        }}
                    >
                        <Icon size={14} />
                        {t.label}
                    </button>
                );})}
            </div>

            {activeTab === "type" && (
                <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
                    <div style={cardStyle}>
                        <RS label="Font Family">
                            <select
                                value={effectiveStyle.fontFamily || ""}
                                onChange={(e) => { loadGoogleFont(e.target.value); handleStyle({ fontFamily: e.target.value || undefined }); }}
                                style={{ width: "100%", padding: "8px 9px", borderRadius: 7, border: `1px solid ${C.gray200}`, fontSize: 12, color: C.gray800, background: "#fff", marginBottom: 2 }}
                            >
                                <option value="">Template Default</option>
                                {fontsList.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </RS>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                            <button onClick={() => handleStyle({ italic: !effectiveStyle.italic })} style={{ ...btnBase, border: `1px solid ${effectiveStyle.italic ? C.primary : C.gray200}`, background: effectiveStyle.italic ? C.primarySubtle : "#fff", borderRadius: 7, padding: "7px 0", fontSize: 10, fontWeight: 700, color: effectiveStyle.italic ? C.primary : C.gray600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}><ItalicIcon size={12} /> Italic</button>
                            <button onClick={() => handleStyle({ uppercase: !effectiveStyle.uppercase })} style={{ ...btnBase, border: `1px solid ${effectiveStyle.uppercase ? C.primary : C.gray200}`, background: effectiveStyle.uppercase ? C.primarySubtle : "#fff", borderRadius: 7, padding: "7px 0", fontSize: 10, fontWeight: 700, color: effectiveStyle.uppercase ? C.primary : C.gray600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}><CaseSensitive size={12} /> Upper</button>
                            <button onClick={() => handleStyle({ highlightWord: !effectiveStyle.highlightWord })} style={{ ...btnBase, border: `1px solid ${effectiveStyle.highlightWord ? C.primary : C.gray200}`, background: effectiveStyle.highlightWord ? C.primarySubtle : "#fff", borderRadius: 7, padding: "7px 0", fontSize: 10, fontWeight: 700, color: effectiveStyle.highlightWord ? C.primary : C.gray600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Highlighter size={12} /> Focus</button>
                        </div>
                    </div>

                    <div style={cardStyle}>
                        <RS label="Typography">
                            <RSlider label="Font Size" min={10} max={80} value={effectiveStyle.fontSize} onChange={(v: number) => handleStyle({ fontSize: v })} unit="px" />
                            <RSlider label="Weight" min={100} max={900} step={100} value={effectiveStyle.fontWeight} onChange={(v: number) => handleStyle({ fontWeight: v })} />
                            <RSlider label="Letter Spacing" min={0} max={10} step={0.5} value={effectiveStyle.letterSpacing ?? 0} onChange={(v: number) => handleStyle({ letterSpacing: Number(v.toFixed(1)) })} unit="px" />
                            <RSlider label="Line Height" min={1} max={2} step={0.05} value={effectiveStyle.lineHeight ?? 1.16} onChange={(v: number) => handleStyle({ lineHeight: Number(v.toFixed(2)) })} />
                        </RS>
                    </div>

                    <div style={cardStyle}>
                        <RS label="Text Color">
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                <input
                                    type="color"
                                    value={colorToHex(effectiveStyle.color || "#FFFFFF", "#FFFFFF")}
                                    onChange={(e) => handleStyle({ color: e.target.value.toUpperCase() })}
                                    style={{ width: 34, height: 24, border: `1px solid ${C.gray200}`, borderRadius: 5, background: "#fff", padding: 2, cursor: "pointer" }}
                                />
                                <input
                                    type="text"
                                    value={colorToHex(effectiveStyle.color || "#FFFFFF", "#FFFFFF")}
                                    onChange={(e) => handleStyle({ color: e.target.value })}
                                    style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: `1px solid ${C.gray200}`, fontSize: 11, fontFamily: C.fontMono }}
                                />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                                {PANEL_TEXT_SWATCHES.map((col) => (
                                    <button key={col} onClick={() => handleStyle({ color: col })} style={{ ...btnBase, height: 22, borderRadius: 5, background: col, border: colorToHex(effectiveStyle.color || "#FFFFFF", "#FFFFFF") === col ? `2px solid ${C.primary}` : `1px solid ${C.gray200}` }} />
                                ))}
                            </div>
                        </RS>
                        {effectiveStyle.highlightWord && (
                            <>
                                <RDiv />
                                <RS label="Highlight Color">
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                        <input type="color" value={colorToHex(effectiveStyle.highlightColor || "#FEF08A", "#FEF08A")} onChange={(e) => handleStyle({ highlightColor: e.target.value.toUpperCase() })} style={{ width: "100%", height: 28, border: `1px solid ${C.gray200}`, borderRadius: 6, background: "#fff", cursor: "pointer" }} />
                                        <input type="color" value={colorToHex(effectiveStyle.highlightTextColor || "#000000", "#000000")} onChange={(e) => handleStyle({ highlightTextColor: e.target.value.toUpperCase() })} style={{ width: "100%", height: 28, border: `1px solid ${C.gray200}`, borderRadius: 6, background: "#fff", cursor: "pointer" }} />
                                    </div>
                                </RS>
                            </>
                        )}
                    </div>
                </div>
            )}

            {activeTab === "fx" && (
                <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
                    <div style={cardStyle}>
                        <RS label="Stroke">
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                <input type="color" value={colorToHex(effectiveStyle.strokeColor || "#000000", "#000000")} onChange={(e) => handleStyle({ strokeColor: e.target.value.toUpperCase() })} style={{ width: 34, height: 24, border: `1px solid ${C.gray200}`, borderRadius: 5, background: "#fff", padding: 2, cursor: "pointer" }} />
                                <button onClick={() => handleStyle({ strokeColor: "transparent", strokeWidth: 0 })} style={{ ...btnBase, fontSize: 10, fontWeight: 700, borderRadius: 6, border: `1px solid ${C.gray300}`, padding: "6px 8px", color: C.gray600, background: "#fff" }}>No Stroke</button>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginBottom: 8 }}>
                                {PANEL_STROKE_SWATCHES.map((col) => (
                                    <button key={col} onClick={() => handleStyle({ strokeColor: col })} style={{ ...btnBase, height: 22, borderRadius: 5, background: col === "transparent" ? "linear-gradient(135deg,#fff,#e5e7eb)" : col, border: String(effectiveStyle.strokeColor || "").toLowerCase() === col.toLowerCase() ? `2px solid ${C.primary}` : `1px solid ${C.gray200}` }} />
                                ))}
                            </div>
                            <RSlider label="Stroke Width" min={0} max={10} step={0.5} value={effectiveStyle.strokeWidth ?? 0} onChange={(v: number) => handleStyle({ strokeWidth: Number(v.toFixed(1)) })} unit="px" />
                        </RS>
                    </div>

                    <div style={cardStyle}>
                        <RS label="Shadow">
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                <button onClick={() => handleStyle({ shadowColor: shadowEnabled ? undefined : withAlpha("#000000", 0.85) })} style={{ ...btnBase, fontSize: 10, fontWeight: 700, borderRadius: 6, border: `1px solid ${shadowEnabled ? C.primary : C.gray300}`, padding: "6px 10px", color: shadowEnabled ? C.primary : C.gray600, background: shadowEnabled ? C.primarySubtle : "#fff" }}>{shadowEnabled ? "Enabled" : "Enable"}</button>
                                <input type="color" value={shadowHex} onChange={(e) => handleStyle({ shadowColor: withAlpha(e.target.value, shadowAlpha) })} style={{ width: 34, height: 24, border: `1px solid ${C.gray200}`, borderRadius: 5, background: "#fff", padding: 2, cursor: shadowEnabled ? "pointer" : "not-allowed", opacity: shadowEnabled ? 1 : 0.5 }} disabled={!shadowEnabled} />
                            </div>
                            <RSlider label="Shadow Intensity" min={0} max={1} step={0.05} value={shadowAlpha} onChange={(v: number) => handleStyle({ shadowColor: withAlpha(shadowHex, Number(v.toFixed(2))) })} />
                        </RS>
                        <RDiv />
                        <RS label="Glow">
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <button onClick={() => handleStyle({ glowColor: glowEnabled ? undefined : "#00FFFF" })} style={{ ...btnBase, fontSize: 10, fontWeight: 700, borderRadius: 6, border: `1px solid ${glowEnabled ? C.primary : C.gray300}`, padding: "6px 10px", color: glowEnabled ? C.primary : C.gray600, background: glowEnabled ? C.primarySubtle : "#fff" }}>{glowEnabled ? "Enabled" : "Enable"}</button>
                                <input type="color" value={glowHex} onChange={(e) => handleStyle({ glowColor: e.target.value.toUpperCase() })} style={{ width: 34, height: 24, border: `1px solid ${C.gray200}`, borderRadius: 5, background: "#fff", padding: 2, cursor: glowEnabled ? "pointer" : "not-allowed", opacity: glowEnabled ? 1 : 0.5 }} disabled={!glowEnabled} />
                            </div>
                        </RS>
                    </div>

                    <div style={cardStyle}>
                        <RS label="Background">
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                <button onClick={() => handleStyle({ background: backgroundEnabled ? "transparent" : withAlpha("#000000", 0.75) })} style={{ ...btnBase, fontSize: 10, fontWeight: 700, borderRadius: 6, border: `1px solid ${backgroundEnabled ? C.primary : C.gray300}`, padding: "6px 10px", color: backgroundEnabled ? C.primary : C.gray600, background: backgroundEnabled ? C.primarySubtle : "#fff" }}>{backgroundEnabled ? "Enabled" : "Enable"}</button>
                                <input type="color" value={bgHex} onChange={(e) => handleStyle({ background: withAlpha(e.target.value, bgAlpha) })} style={{ width: 34, height: 24, border: `1px solid ${C.gray200}`, borderRadius: 5, background: "#fff", padding: 2, cursor: backgroundEnabled ? "pointer" : "not-allowed", opacity: backgroundEnabled ? 1 : 0.5 }} disabled={!backgroundEnabled} />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginBottom: 8 }}>
                                {PANEL_BG_SWATCHES.map((col) => (
                                    <button key={col} onClick={() => handleStyle({ background: withAlpha(col, bgAlpha) })} style={{ ...btnBase, height: 22, borderRadius: 5, background: col, border: colorToHex(backgroundValue || "#000000", "#000000") === col ? `2px solid ${C.primary}` : `1px solid ${C.gray200}`, opacity: backgroundEnabled ? 1 : 0.4 }} disabled={!backgroundEnabled} />
                                ))}
                            </div>
                            <RSlider label="Background Opacity" min={0} max={1} step={0.05} value={bgAlpha} onChange={(v: number) => handleStyle({ background: withAlpha(bgHex, Number(v.toFixed(2))) })} />
                            <RSlider label="Corner Radius" min={0} max={24} step={1} value={effectiveStyle.borderRadius ?? 4} onChange={(v: number) => handleStyle({ borderRadius: Math.round(v) })} unit="px" />
                        </RS>
                    </div>
                </div>
            )}

            {activeTab === "anime" && (
                <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
                    <div style={cardStyle}>
                        <RS label="Enter Animation">
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, marginBottom: 8 }}>
                                {ENTER_ANIMATION_OPTIONS.map((anim) => (
                                    <button key={anim} onClick={() => handleStyle({ enterAnim: anim })} style={{ ...btnBase, border: `1px solid ${String(effectiveStyle.enterAnim || "Pop") === anim ? C.primary : C.gray200}`, borderRadius: 7, background: String(effectiveStyle.enterAnim || "Pop") === anim ? C.primarySubtle : "#fff", color: String(effectiveStyle.enterAnim || "Pop") === anim ? C.primary : C.gray600, fontSize: 10, fontWeight: 700, padding: "7px 0", textAlign: "center" }}>{anim}</button>
                                ))}
                            </div>
                        </RS>
                        <RDiv />
                        <RS label="Exit Animation">
                            <select
                                value={effectiveStyle.exitAnim || "Fade Out"}
                                onChange={(e) => handleStyle({ exitAnim: e.target.value })}
                                style={{ width: "100%", padding: "8px 9px", borderRadius: 7, border: `1px solid ${C.gray200}`, fontSize: 12, background: "#fff", marginBottom: 4 }}
                            >
                                {EXIT_ANIMATION_OPTIONS.map((anim) => <option key={anim} value={anim}>{anim}</option>)}
                            </select>
                        </RS>
                    </div>

                    <div style={cardStyle}>
                        <RS label="Timing">
                            <RSlider label="Duration" min={100} max={2000} step={50} value={effectiveStyle.animDuration ?? 300} onChange={(v: number) => handleStyle({ animDuration: Math.round(v) })} unit="ms" />
                            <RSlider label="Delay" min={0} max={1000} step={50} value={effectiveStyle.animDelay ?? 0} onChange={(v: number) => handleStyle({ animDelay: Math.round(v) })} unit="ms" />
                        </RS>
                    </div>
                </div>
            )}

            {activeTab === "layout" && (
                <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
                    <div style={cardStyle}>
                        <RS label="Anchor">
                            <div style={{ ...segmentedStyle, marginBottom: 8 }}>
                                {["top", "center", "bottom"].map(pos => (
                                    <button key={pos} onClick={() => handleStyle({ position: pos })} style={{ ...btnBase, padding: "6px 0", fontSize: 10, fontWeight: 700, border: `1px solid ${effectiveStyle.position === pos ? C.primary : C.gray200}`, borderRadius: 6, background: effectiveStyle.position === pos ? C.primarySubtle : "#fff", color: effectiveStyle.position === pos ? C.primary : C.gray500, textTransform: "capitalize" }}>{pos}</button>
                                ))}
                            </div>
                            <div style={{ ...segmentedStyle, marginBottom: 8 }}>
                                {[
                                    { key: "left", icon: AlignLeft },
                                    { key: "center", icon: AlignCenter },
                                    { key: "right", icon: AlignRight },
                                ].map(({ key, icon: Icon }) => (
                                    <button key={key} onClick={() => handleStyle({ align: key })} style={{ ...btnBase, padding: "7px 0", fontSize: 10, fontWeight: 700, border: `1px solid ${effectiveStyle.align === key ? C.primary : C.gray200}`, borderRadius: 6, background: effectiveStyle.align === key ? C.primarySubtle : "#fff", color: effectiveStyle.align === key ? C.primary : C.gray500, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon size={13} /></button>
                                ))}
                            </div>
                            <div style={{ ...segmentedStyle }}>
                                {(["word", "chunk", "sentence"] as const).map(mode => (
                                    <button key={mode} onClick={() => handleStyle({ captionMode: mode })} style={{ ...btnBase, padding: "6px 0", fontSize: 10, fontWeight: 700, border: `1px solid ${effectiveStyle.captionMode === mode ? C.primary : C.gray200}`, borderRadius: 6, background: effectiveStyle.captionMode === mode ? C.primarySubtle : "#fff", color: effectiveStyle.captionMode === mode ? C.primary : C.gray500, textTransform: "capitalize" }}>{mode}</button>
                                ))}
                            </div>
                        </RS>
                    </div>

                    <div style={cardStyle}>
                        <RS label="Position Fine-Tune">
                            <RSlider label="Horizontal Offset" min={-120} max={120} step={1} value={effectiveStyle.offsetX ?? 0} onChange={(v: number) => handleStyle({ offsetX: Math.round(v) })} unit="px" />
                            <RSlider label="Vertical Offset" min={-120} max={120} step={1} value={effectiveStyle.offsetY ?? 0} onChange={(v: number) => handleStyle({ offsetY: Math.round(v) })} unit="px" />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                                <button onClick={() => handleStyle({ offsetX: 0 })} style={{ ...btnBase, border: `1px solid ${C.gray300}`, borderRadius: 6, background: "#fff", color: C.gray600, fontSize: 10, fontWeight: 700, padding: "6px 0", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}><MoveHorizontal size={12} /> Reset X</button>
                                <button onClick={() => handleStyle({ offsetY: 0 })} style={{ ...btnBase, border: `1px solid ${C.gray300}`, borderRadius: 6, background: "#fff", color: C.gray600, fontSize: 10, fontWeight: 700, padding: "6px 0", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}><MoveVertical size={12} /> Reset Y</button>
                            </div>
                        </RS>
                    </div>

                    <div style={cardStyle}>
                        <RS label="Box">
                            <RSlider label="Max Width" min={40} max={100} step={1} value={effectiveStyle.maxWidthPct ?? 88} onChange={(v: number) => handleStyle({ maxWidthPct: Math.round(v) })} unit="%" />
                            <RSlider label="Text Opacity" min={0.2} max={1} step={0.05} value={effectiveStyle.textOpacity ?? 1} onChange={(v: number) => handleStyle({ textOpacity: Number(v.toFixed(2)) })} />
                        </RS>
                    </div>
                </div>
            )}
        </aside>
    );
}

// ── Timeline ──────────────────────────────────────────────────────────────
void RightPanelLegacy;

function SimpleRightPanel({
    activeTab,
    setActiveTab,
    selectedTpl,
    onSelectTpl,
    templates,
    customStyle,
    setCustomStyle,
    subtitleTrack,
    selectedCueId,
    saveState,
    onResetStyles,
    projectId,
    motionGraphicsTrack = [],
    motionGraphicsSuggestions = [],
    setMotionGraphicsSuggestions,
    onTimelineDragStart,
    onTimelineDragEnd,
}: {
    activeTab: RightTab;
    setActiveTab: (t: RightTab) => void;
    selectedTpl: string | null;
    onSelectTpl: (tplId: string) => void;
    templates: Array<{ id: string; label: string; bg: string; tc: string }>;
    customStyle: Record<string, any>;
    setCustomStyle: (patch: any) => void;
    subtitleTrack: any[];
    selectedCueId: string | null;
    saveState: "idle" | "saving" | "saved" | "error";
    onResetStyles: () => void;
    projectId: string | null;
    motionGraphicsTrack?: any[];
    motionGraphicsSuggestions?: MotionGraphicSuggestion[];
    setMotionGraphicsSuggestions?: (suggestions: MotionGraphicSuggestion[]) => void;
    onTimelineDragStart?: (payload: TimelineDragPayload) => void;
    onTimelineDragEnd?: () => void;
}) {
    const [panelMode, setPanelModeState] = useState<"captions" | "motion">(activeTab === "anime" ? "motion" : "captions");
    const [motionDensity, setMotionDensity] = useState(0.45);
    const [generatingMotion, setGeneratingMotion] = useState(false);
    const [motionError, setMotionError] = useState<string | null>(null);
    const addMotionGraphic = useTimeline((s) => s.addMotionGraphic);
    const removeMotionGraphic = useTimeline((s) => s.removeMotionGraphic);
    const fontsList = useGoogleFontsList();

    useEffect(() => {
        if (activeTab === "anime") setPanelModeState("motion");
        if (activeTab === "type" || activeTab === "fx" || activeTab === "layout") setPanelModeState("captions");
    }, [activeTab]);

    const setPanelMode = useCallback((mode: "captions" | "motion") => {
        setPanelModeState(mode);
        setActiveTab(mode === "motion" ? "anime" : "type");
    }, [setActiveTab]);

    const templateDefaults: Record<string, any> = useMemo(
        () => (selectedTpl && TEMPLATES_CONFIG[selectedTpl]) ? TEMPLATES_CONFIG[selectedTpl] : {},
        [selectedTpl],
    );
    const effectiveStyle: Record<string, any> = useMemo(
        () => ({ ...templateDefaults, ...customStyle }),
        [templateDefaults, customStyle],
    );
    const selectedCueText = useMemo(() => {
        const cue = subtitleTrack.find((item: any) => String(getCueId(item)) === String(selectedCueId));
        const text = String(cue?.text ?? "").replace(/\s+/g, " ").trim();
        return text || "Select a caption from the timeline";
    }, [subtitleTrack, selectedCueId]);
    const currentCase = useMemo(() => {
        const explicit = String(effectiveStyle.textCase || "").trim().toLowerCase();
        if (explicit === "upper" || explicit === "lower" || explicit === "title") return explicit;
        return effectiveStyle.uppercase ? "upper" : "original";
    }, [effectiveStyle.textCase, effectiveStyle.uppercase]);
    const simpleFonts = useMemo(() => {
        const preferred = ["", KOMIKA_AXIS_FONT_FAMILY, "Plus Jakarta Sans", "Inter", "Manrope", "Arial"];
        const current = effectiveStyle.fontFamily ? [String(effectiveStyle.fontFamily)] : [];
        return Array.from(new Set([...preferred, ...current, ...fontsList.slice(0, 8)]));
    }, [effectiveStyle.fontFamily, fontsList]);

    const saveTone = saveState === "error" ? C.danger : saveState === "saving" ? C.warning : C.success;
    const saveLabel = saveState === "saving" ? "Saving" : saveState === "error" ? "Save failed" : "Saved";
    const backgroundValue = String(effectiveStyle.background || "").trim();
    const backgroundEnabled = Boolean(backgroundValue && backgroundValue !== "transparent" && backgroundValue !== "none");
    const bgHex = colorToHex(backgroundValue || "#000000", "#000000");
    const bgAlpha = colorAlpha(backgroundValue || "rgba(0,0,0,0.75)", 0.75);
    const shadowRaw = String(effectiveStyle.shadowColor || "").trim();
    const shadowEnabled = !!shadowRaw;
    const strokeEnabled = Number(effectiveStyle.strokeWidth ?? 0) > 0;

    const handleStyle = useCallback((patch: any) => setCustomStyle(patch), [setCustomStyle]);
    const isMotionAdded = useCallback((suggestion: MotionGraphicSuggestion) =>
        motionGraphicsTrack.some((clip: any) => String(clip.clip_id) === String(suggestion.clip_id)),
        [motionGraphicsTrack],
    );
    const handleGenerateMotion = useCallback(async () => {
        if (!projectId || generatingMotion) return;
        setMotionError(null);
        setGeneratingMotion(true);
        try {
            const response = await motionGraphicsApi.suggest(projectId, motionDensity, 14);
            setMotionGraphicsSuggestions?.(response.data?.suggestions ?? []);
        } catch (err) {
            setMotionError(getApiErrorMessage(err, "Motion graphics generation failed. Please retry."));
        } finally {
            setGeneratingMotion(false);
        }
    }, [projectId, generatingMotion, motionDensity, setMotionGraphicsSuggestions]);
    const handleAddMotion = useCallback((suggestion: MotionGraphicSuggestion) => {
        if (isMotionAdded(suggestion)) return;
        addMotionGraphic({ ...suggestion, cue_text: suggestion.source_text || suggestion.text } as any);
    }, [addMotionGraphic, isMotionAdded]);
    const handleRemoveMotion = useCallback((clipId: string) => {
        removeMotionGraphic(clipId);
    }, [removeMotionGraphic]);

    const panelStyle: React.CSSProperties = {
        width: "100%",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "rgba(251,251,253,0.90)",
        backdropFilter: "blur(24px) saturate(170%)",
        border: `1px solid ${UI.borderStrong}`,
        borderRadius: 24,
        color: UI.textStrong,
        overflow: "hidden",
    };
    const sectionStyle: React.CSSProperties = {
        border: `1px solid ${UI.borderSoft}`,
        background: "rgba(255,255,255,0.78)",
        borderRadius: 18,
        padding: 14,
        marginBottom: 12,
    };
    const labelStyle: React.CSSProperties = {
        display: "block",
        marginBottom: 8,
        fontSize: 11,
        fontWeight: 850,
        color: UI.textMuted,
    };
    const fieldStyle: React.CSSProperties = {
        width: "100%",
        height: 38,
        borderRadius: 12,
        border: `1px solid ${UI.borderStrong}`,
        background: "rgba(255,255,255,0.92)",
        color: UI.textStrong,
        fontSize: 12,
        fontWeight: 650,
        padding: "0 10px",
    };
    const toggleButton = (active: boolean): React.CSSProperties => ({
        ...btnBase,
        minHeight: 34,
        borderRadius: 12,
        border: `1px solid ${active ? C.primary : UI.borderStrong}`,
        background: active ? C.primary : "rgba(255,255,255,0.76)",
        color: active ? "#fff" : UI.textBase,
        fontSize: 12,
        fontWeight: 850,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "0 10px",
    });
    const segmentButton = (active: boolean): React.CSSProperties => ({
        ...btnBase,
        height: 36,
        borderRadius: 14,
        border: `1px solid ${active ? C.primary : "transparent"}`,
        background: active ? C.primary : "transparent",
        color: active ? "#fff" : UI.textMuted,
        fontSize: 12,
        fontWeight: 900,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
    });

    return (
        <aside style={panelStyle}>
            <div style={{ padding: 16, borderBottom: `1px solid ${UI.borderSoft}`, background: "rgba(251,251,253,0.86)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.2, color: UI.textStrong }}>Editor panel</div>
                        <div style={{ marginTop: 4, display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 800, color: saveTone }}>
                            <span style={{ width: 7, height: 7, borderRadius: 99, background: saveTone }} />
                            {saveLabel}
                        </div>
                    </div>
                    <button
                        onClick={onResetStyles}
                        style={{ ...btnBase, height: 34, borderRadius: 12, padding: "0 12px", border: `1px solid ${UI.borderStrong}`, background: "rgba(255,255,255,0.76)", color: UI.textBase, fontSize: 12, fontWeight: 800 }}
                        title="Return captions to template defaults"
                    >
                        Reset
                    </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, padding: 4, borderRadius: 18, border: `1px solid ${UI.borderSoft}`, background: UI.appBgElev }}>
                    <button onClick={() => setPanelMode("captions")} style={segmentButton(panelMode === "captions")}><Type size={14} /> Captions</button>
                    <button onClick={() => setPanelMode("motion")} style={segmentButton(panelMode === "motion")}><Sparkles size={14} /> Motion</button>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
                {panelMode === "captions" ? (
                    <>
                        <div style={sectionStyle}>
                            <span style={labelStyle}>Selected caption</span>
                            <div style={{ minHeight: 58, borderRadius: 14, border: `1px solid ${UI.borderSoft}`, background: "rgba(245,245,247,0.72)", padding: "10px 12px", color: UI.textStrong, fontSize: 13, lineHeight: 1.45, fontWeight: 700 }}>
                                {selectedCueText}
                            </div>
                        </div>

                        <div style={sectionStyle}>
                            <span style={labelStyle}>Templates</span>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
                                {templates.slice(0, 6).map((tpl) => (
                                    <button
                                        key={tpl.id}
                                        onClick={() => onSelectTpl(tpl.id)}
                                        title={tpl.label}
                                        style={{
                                            ...btnBase,
                                            height: 46,
                                            borderRadius: 14,
                                            border: selectedTpl === tpl.id ? `2px solid ${C.primary}` : `1px solid ${UI.borderStrong}`,
                                            background: selectedTpl === tpl.id ? C.primarySubtle : "rgba(255,255,255,0.78)",
                                            color: selectedTpl === tpl.id ? C.primaryDark : UI.textBase,
                                            fontSize: 12,
                                            fontWeight: 850,
                                            textAlign: "left",
                                            padding: "0 11px",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {tpl.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={sectionStyle}>
                            <span style={labelStyle}>Text</span>
                            <select
                                value={effectiveStyle.fontFamily || ""}
                                onChange={(e) => { loadGoogleFont(e.target.value); handleStyle({ fontFamily: e.target.value || undefined }); }}
                                style={fieldStyle}
                            >
                                <option value="">Template font</option>
                                {simpleFonts.filter(Boolean).map((font) => <option key={font} value={font}>{font}</option>)}
                            </select>
                            <div style={{ marginTop: 12 }}>
                                <RSlider label="Size" min={14} max={72} step={1} value={Number(effectiveStyle.fontSize ?? 30)} onChange={(v: number) => handleStyle({ fontSize: Math.round(v) })} unit="px" />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }}>
                                <button onClick={() => handleStyle({ fontWeight: Number(effectiveStyle.fontWeight ?? 700) >= 750 ? 600 : 850 })} style={toggleButton(Number(effectiveStyle.fontWeight ?? 700) >= 750)}>
                                    <Bold size={13} /> Bold
                                </button>
                                <button onClick={() => handleStyle({ uppercase: currentCase !== "upper", textCase: currentCase === "upper" ? "original" : "upper" })} style={toggleButton(currentCase === "upper")}>
                                    TT
                                </button>
                                <button onClick={() => handleStyle({ highlightWord: !effectiveStyle.highlightWord })} style={toggleButton(!!effectiveStyle.highlightWord)}>
                                    <Highlighter size={13} /> Focus
                                </button>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 7, marginTop: 12 }}>
                                {PANEL_TEXT_SWATCHES.map((col) => (
                                    <button
                                        key={col}
                                        onClick={() => handleStyle({ color: col })}
                                        title={col}
                                        style={{ ...btnBase, height: 28, borderRadius: 10, border: colorToHex(effectiveStyle.color || "#FFFFFF", "#FFFFFF").toUpperCase() === col.toUpperCase() ? `2px solid ${C.primary}` : `1px solid ${UI.borderStrong}`, background: col }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div style={sectionStyle}>
                            <span style={labelStyle}>Placement</span>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
                                {["top", "center", "bottom"].map((position) => (
                                    <button key={position} onClick={() => handleStyle({ position })} style={toggleButton((effectiveStyle.position || "bottom") === position)}>
                                        {position}
                                    </button>
                                ))}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
                                {([
                                    { key: "left", icon: AlignLeft },
                                    { key: "center", icon: AlignCenter },
                                    { key: "right", icon: AlignRight },
                                ] as const).map(({ key, icon: Icon }) => (
                                    <button key={key} onClick={() => handleStyle({ align: key })} style={toggleButton((effectiveStyle.align || "center") === key)}>
                                        <Icon size={14} />
                                    </button>
                                ))}
                            </div>
                            <RSlider label="Vertical offset" min={-120} max={120} step={1} value={Number(effectiveStyle.offsetY ?? 0)} onChange={(v: number) => handleStyle({ offsetY: Math.round(v) })} unit="px" />
                            <RSlider label="Max width" min={45} max={100} step={1} value={Number(effectiveStyle.maxWidthPct ?? 88)} onChange={(v: number) => handleStyle({ maxWidthPct: Math.round(v) })} unit="%" />
                        </div>

                        <div style={sectionStyle}>
                            <span style={labelStyle}>Look</span>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                                <button
                                    onClick={() => handleStyle({
                                        strokeColor: strokeEnabled ? "transparent" : "#000000",
                                        strokeWidth: strokeEnabled ? 0 : 3,
                                    })}
                                    style={toggleButton(strokeEnabled)}
                                >
                                    Stroke
                                </button>
                                <button
                                    onClick={() => handleStyle({ shadowColor: shadowEnabled ? undefined : withAlpha("#000000", 0.65) })}
                                    style={toggleButton(shadowEnabled)}
                                >
                                    Shadow
                                </button>
                                <button
                                    onClick={() => handleStyle({ background: backgroundEnabled ? "transparent" : withAlpha("#000000", 0.55), borderRadius: backgroundEnabled ? effectiveStyle.borderRadius : 12 })}
                                    style={toggleButton(backgroundEnabled)}
                                >
                                    Bubble
                                </button>
                            </div>
                            {strokeEnabled && (
                                <div style={{ marginTop: 12 }}>
                                    <RSlider label="Stroke" min={1} max={8} step={0.5} value={Number(effectiveStyle.strokeWidth ?? 3)} onChange={(v: number) => handleStyle({ strokeWidth: Number(v.toFixed(1)), strokeColor: effectiveStyle.strokeColor || "#000000" })} unit="px" />
                                </div>
                            )}
                            {backgroundEnabled && (
                                <div style={{ marginTop: 12 }}>
                                    <RSlider label="Bubble opacity" min={0.1} max={1} step={0.05} value={bgAlpha} onChange={(v: number) => handleStyle({ background: withAlpha(bgHex, Number(v.toFixed(2))) })} />
                                </div>
                            )}
                            <div style={{ marginTop: 12 }}>
                                <RSlider label="Opacity" min={0.2} max={1} step={0.05} value={Number(effectiveStyle.textOpacity ?? 1)} onChange={(v: number) => handleStyle({ textOpacity: Number(v.toFixed(2)) })} />
                            </div>
                        </div>

                        <div style={sectionStyle}>
                            <span style={labelStyle}>Animation</span>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                                {["Pop", "Fade In", "Slide Up"].map((anim) => (
                                    <button key={anim} onClick={() => handleStyle({ enterAnim: anim })} style={toggleButton(String(effectiveStyle.enterAnim || "Pop") === anim)}>
                                        {anim.replace(" In", "")}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div style={sectionStyle}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 900, color: UI.textStrong }}>Motion graphics</div>
                                    <div style={{ marginTop: 3, fontSize: 11, fontWeight: 700, color: UI.textMuted }}>{motionGraphicsTrack.length} on timeline</div>
                                </div>
                                <button
                                    onClick={handleGenerateMotion}
                                    disabled={!projectId || generatingMotion}
                                    style={{ ...btnBase, height: 36, borderRadius: 13, padding: "0 12px", background: C.primary, color: "#fff", fontSize: 12, fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 7, opacity: !projectId || generatingMotion ? 0.55 : 1 }}
                                >
                                    {generatingMotion ? <Spinner size={13} /> : <Sparkles size={14} />} Generate
                                </button>
                            </div>
                            <RSlider label="Intensity" min={0.1} max={1} step={0.05} value={motionDensity} onChange={(v: number) => setMotionDensity(Number(v.toFixed(2)))} />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <button
                                    onClick={() => setMotionGraphicsSuggestions?.(motionGraphicsSuggestions.map((item) => ({
                                        ...item,
                                        style: "editorial_image_text",
                                        shape: "editorial-poster-object",
                                        placement: "center",
                                        animation: "word-opacity",
                                        background: "transparent",
                                        solid_background: "#FFFFFF",
                                        accent_color: "#7E22CE",
                                    })))}
                                    disabled={motionGraphicsSuggestions.length === 0}
                                    style={{ ...toggleButton(false), opacity: motionGraphicsSuggestions.length === 0 ? 0.5 : 1 }}
                                >
                                    White title
                                </button>
                                <button
                                    onClick={() => setMotionGraphicsSuggestions?.([])}
                                    disabled={motionGraphicsSuggestions.length === 0}
                                    style={{ ...toggleButton(false), opacity: motionGraphicsSuggestions.length === 0 ? 0.5 : 1 }}
                                >
                                    Clear
                                </button>
                            </div>
                            {motionError && <div style={{ marginTop: 10, color: C.danger, fontSize: 11, fontWeight: 750 }}>{motionError}</div>}
                        </div>

                        {motionGraphicsTrack.length > 0 && (
                            <div style={sectionStyle}>
                                <span style={labelStyle}>Timeline motion</span>
                                <div style={{ display: "grid", gap: 8 }}>
                                    {motionGraphicsTrack.slice(0, 6).map((clip: any) => (
                                        <div key={clip.clip_id} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 42, borderRadius: 14, border: `1px solid ${UI.borderSoft}`, background: "rgba(255,255,255,0.72)", padding: "7px 8px" }}>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{ fontSize: 12, color: UI.textStrong, fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clip.text || "Motion"}</div>
                                                <div style={{ marginTop: 2, fontSize: 10, color: UI.textMuted, fontFamily: C.fontMono }}>{formatTimelineTime(Number(clip.start_ms || 0)).slice(0, 5)} - {formatTimelineTime(Number(clip.end_ms || 0)).slice(0, 5)}</div>
                                            </div>
                                            <button onClick={() => handleRemoveMotion(String(clip.clip_id))} style={{ ...btnBase, width: 30, height: 30, borderRadius: 10, color: C.danger, background: C.dangerLight, display: "inline-flex", alignItems: "center", justifyContent: "center" }} title="Remove motion graphic">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={sectionStyle}>
                            <span style={labelStyle}>Suggested motion</span>
                            {generatingMotion && (
                                <div style={{ minHeight: 96, borderRadius: 16, border: `1px solid ${UI.borderSoft}`, background: "rgba(255,255,255,0.72)", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, color: UI.textMuted, fontSize: 12, fontWeight: 800 }}>
                                    <Spinner size={14} /> Analyzing captions
                                </div>
                            )}
                            {!generatingMotion && motionGraphicsSuggestions.length === 0 && (
                                <div style={{ minHeight: 96, borderRadius: 16, border: `1px dashed ${UI.borderStrong}`, background: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 16, color: UI.textMuted, fontSize: 12, fontWeight: 750 }}>
                                    Generate motion graphics from the strongest caption moments.
                                </div>
                            )}
                            <div style={{ display: "grid", gap: 10 }}>
                                {motionGraphicsSuggestions.map((suggestion) => {
                                    const added = isMotionAdded(suggestion);
                                    return (
                                        <div key={suggestion.clip_id} style={{ borderRadius: 18, border: `1px solid ${added ? C.primary : UI.borderSoft}`, background: added ? C.primarySubtle : "rgba(255,255,255,0.76)", padding: 9 }}>
                                            <div style={{ height: 112, borderRadius: 14, overflow: "hidden", border: `1px solid ${UI.borderSoft}`, background: "#fff", marginBottom: 8 }}>
                                                <MotionGraphicPreview clip={suggestion} compact />
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 900, color: UI.textStrong, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{suggestion.text}</div>
                                                    <div style={{ marginTop: 2, fontSize: 10, color: UI.textMuted, fontFamily: C.fontMono }}>{formatTimelineTime(suggestion.start_ms).slice(0, 5)} - {formatTimelineTime(suggestion.end_ms).slice(0, 5)}</div>
                                                </div>
                                                <button
                                                    draggable
                                                    onDragStart={() => onTimelineDragStart?.({ kind: "motion", suggestion })}
                                                    onDragEnd={() => onTimelineDragEnd?.()}
                                                    style={{ ...btnBase, width: 32, height: 32, borderRadius: 11, border: `1px solid ${UI.borderStrong}`, background: "rgba(255,255,255,0.74)", color: UI.textMuted, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "grab" }}
                                                    title="Drag to Motion track"
                                                >
                                                    <GripVertical size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleAddMotion(suggestion)}
                                                    disabled={added}
                                                    style={{ ...btnBase, height: 32, borderRadius: 11, padding: "0 11px", background: added ? C.successLight : C.primary, color: added ? C.success : "#fff", fontSize: 12, fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 6 }}
                                                >
                                                    <Plus size={13} /> {added ? "Added" : "Add"}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </aside>
    );
}

function RightPanel({
    activeTab,
    setActiveTab,
    selectedTpl,
    onSelectTpl,
    templates,
    customStyle,
    setCustomStyle,
    subtitleTrack,
    selectedCueId,
    saveState,
    onResetStyles,
}: {
    activeTab: RightTab;
    setActiveTab: (t: RightTab) => void;
    selectedTpl: string | null;
    onSelectTpl: (tplId: string) => void;
    templates: Array<{ id: string; label: string; bg: string; tc: string }>;
    customStyle: Record<string, any>;
    setCustomStyle: (patch: any) => void;
    subtitleTrack: any[];
    selectedCueId: string | null;
    saveState: "idle" | "saving" | "saved" | "error";
    onResetStyles: () => void;
}) {
    const tabs = [
        { key: "type", label: "Basic" },
        { key: "anime", label: "Templates" },
        { key: "layout", label: "Bubble" },
        { key: "fx", label: "Effects" },
    ] as const;
    const fontsList = useGoogleFontsList();
    const templateDefaults: Record<string, any> = useMemo(
        () => (selectedTpl && TEMPLATES_CONFIG[selectedTpl]) ? TEMPLATES_CONFIG[selectedTpl] : {},
        [selectedTpl],
    );
    const effectiveStyle: Record<string, any> = useMemo(
        () => ({ ...templateDefaults, ...customStyle }),
        [templateDefaults, customStyle],
    );
    const selectedCueText = useMemo(() => {
        const cue = subtitleTrack.find((item: any) => String(getCueId(item)) === String(selectedCueId));
        const text = String(cue?.text ?? "").replace(/\s+/g, " ").trim();
        return text || "Good Morning";
    }, [subtitleTrack, selectedCueId]);
    const currentCase = useMemo(() => {
        const explicit = String(effectiveStyle.textCase || "").trim().toLowerCase();
        if (explicit === "upper" || explicit === "lower" || explicit === "title") return explicit;
        return effectiveStyle.uppercase ? "upper" : "original";
    }, [effectiveStyle.textCase, effectiveStyle.uppercase]);

    const handleStyle = (patch: any) => setCustomStyle(patch);
    const saveTone = saveState === "error" ? C.danger : saveState === "saving" ? C.warning : C.success;
    const saveLabel = saveState === "saving" ? "Saving" : saveState === "error" ? "Save Failed" : "Saved";
    const backgroundValue = String(effectiveStyle.background || "").trim();
    const backgroundEnabled = Boolean(backgroundValue && backgroundValue !== "transparent" && backgroundValue !== "none");
    const bgHex = colorToHex(backgroundValue || "#000000", "#000000");
    const bgAlpha = colorAlpha(backgroundValue || "rgba(0,0,0,0.75)", 0.75);
    const shadowRaw = String(effectiveStyle.shadowColor || "").trim();
    const shadowEnabled = !!shadowRaw;
    const shadowHex = colorToHex(shadowRaw || "#000000", "#000000");
    const shadowAlpha = colorAlpha(shadowRaw || "rgba(0,0,0,0.85)", 0.85);
    const glowRaw = String(effectiveStyle.glowColor || "").trim();
    const glowEnabled = !!glowRaw;
    const glowHex = colorToHex(glowRaw || "#00FFFF", "#00FFFF");
    const lineAdjust = Math.round((Number(effectiveStyle.lineHeight ?? 1.16) - 1.16) / 0.05);

    const asideStyle: React.CSSProperties = {
        width: "100%",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "rgba(251,251,253,0.78)",
        border: `1px solid ${UI.borderStrong}`,
        borderRadius: "0 24px 0 0",
        color: UI.textStrong,
        overflow: "hidden",
    };
    const cardStyle: React.CSSProperties = {
        border: `1px solid ${UI.borderStrong}`,
        background: "rgba(255,255,255,0.78)",
        borderRadius: 18,
        padding: 14,
        marginBottom: 12,
    };
    const fieldStyle: React.CSSProperties = {
        width: "100%",
        padding: "9px 10px",
        borderRadius: 13,
        border: `1px solid ${UI.borderStrong}`,
        fontSize: 12,
        color: UI.textStrong,
        background: UI.appBg,
    };
    const valueBoxStyle: React.CSSProperties = {
        width: 48,
        height: 28,
        padding: "2px 6px",
        borderRadius: 11,
        border: `1px solid ${UI.borderStrong}`,
        background: UI.appBg,
        color: UI.textBase,
        fontSize: 11,
        textAlign: "center",
        fontFamily: C.fontMono,
    };
    const pillButton = (active: boolean): React.CSSProperties => ({
        ...btnBase,
        height: 32,
        borderRadius: 12,
        border: `1px solid ${active ? C.primary : UI.borderStrong}`,
        background: active ? C.primary : UI.appBg,
        color: active ? "#fff" : UI.textBase,
        fontSize: 12,
        fontWeight: 950,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "0 10px",
    });

    const simpleFonts = useMemo(() => {
        const preferred = [
            "",
            KOMIKA_AXIS_FONT_FAMILY,
            "Plus Jakarta Sans",
            "Inter",
            "Manrope",
            "Arial",
        ];
        const current = effectiveStyle.fontFamily ? [String(effectiveStyle.fontFamily)] : [];
        return Array.from(new Set([...preferred, ...current, ...fontsList.slice(0, 8)]));
    }, [effectiveStyle.fontFamily, fontsList]);

    const simplePanelStyle: React.CSSProperties = {
        width: "100%",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "rgba(251,251,253,0.86)",
        backdropFilter: "blur(24px) saturate(170%)",
        border: `1px solid ${UI.borderStrong}`,
        borderRadius: "0 24px 0 0",
        color: UI.textStrong,
        overflow: "hidden",
    };
    const simpleSectionStyle: React.CSSProperties = {
        border: `1px solid ${UI.borderSoft}`,
        background: "rgba(255,255,255,0.76)",
        borderRadius: 18,
        padding: 14,
        marginBottom: 12,
    };
    const simpleLabelStyle: React.CSSProperties = {
        display: "block",
        marginBottom: 8,
        fontSize: 11,
        fontWeight: 800,
        color: UI.textMuted,
    };
    const simpleFieldStyle: React.CSSProperties = {
        width: "100%",
        height: 38,
        borderRadius: 12,
        border: `1px solid ${UI.borderStrong}`,
        background: "rgba(255,255,255,0.9)",
        color: UI.textStrong,
        fontSize: 12,
        fontWeight: 650,
        padding: "0 10px",
    };
    const simpleToggleButton = (active: boolean): React.CSSProperties => ({
        ...btnBase,
        height: 34,
        borderRadius: 12,
        border: `1px solid ${active ? C.primary : UI.borderStrong}`,
        background: active ? C.primary : "rgba(255,255,255,0.74)",
        color: active ? "#fff" : UI.textBase,
        fontSize: 12,
        fontWeight: 800,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "0 10px",
    });

    return (
        <aside style={simplePanelStyle}>
            <div style={{ padding: "16px 16px 14px", borderBottom: `1px solid ${UI.borderSoft}`, background: "rgba(251,251,253,0.82)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 850, letterSpacing: -0.2, color: UI.textStrong }}>Caption Inspector</div>
                        <div style={{ marginTop: 4, display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700, color: saveTone }}>
                            <span style={{ width: 7, height: 7, borderRadius: 99, background: saveTone }} />
                            {saveLabel}
                        </div>
                    </div>
                    <button
                        onClick={onResetStyles}
                        style={{ ...btnBase, height: 34, borderRadius: 12, padding: "0 12px", border: `1px solid ${UI.borderStrong}`, background: "rgba(255,255,255,0.72)", color: UI.textBase, fontSize: 12, fontWeight: 750 }}
                        title="Return captions to template defaults"
                    >
                        Reset
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
                <div style={simpleSectionStyle}>
                    <span style={simpleLabelStyle}>Selected caption</span>
                    <div style={{ minHeight: 56, borderRadius: 14, border: `1px solid ${UI.borderSoft}`, background: "rgba(245,245,247,0.72)", padding: "10px 12px", color: UI.textStrong, fontSize: 13, lineHeight: 1.45, fontWeight: 650 }}>
                        {selectedCueText}
                    </div>
                </div>

                <div style={simpleSectionStyle}>
                    <span style={simpleLabelStyle}>Template</span>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
                        {templates.slice(0, 6).map((tpl) => (
                            <button
                                key={tpl.id}
                                onClick={() => onSelectTpl(tpl.id)}
                                title={tpl.label}
                                style={{
                                    ...btnBase,
                                    height: 46,
                                    borderRadius: 14,
                                    border: selectedTpl === tpl.id ? `2px solid ${C.primary}` : `1px solid ${UI.borderStrong}`,
                                    background: selectedTpl === tpl.id ? C.primarySubtle : "rgba(255,255,255,0.78)",
                                    color: selectedTpl === tpl.id ? C.primaryDark : UI.textBase,
                                    fontSize: 12,
                                    fontWeight: 800,
                                    textAlign: "left",
                                    padding: "0 11px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {tpl.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={simpleSectionStyle}>
                    <span style={simpleLabelStyle}>Text</span>
                    <select
                        value={effectiveStyle.fontFamily || ""}
                        onChange={(e) => { loadGoogleFont(e.target.value); handleStyle({ fontFamily: e.target.value || undefined }); }}
                        style={simpleFieldStyle}
                    >
                        <option value="">Template font</option>
                        {simpleFonts.filter(Boolean).map((font) => <option key={font} value={font}>{font}</option>)}
                    </select>
                    <div style={{ marginTop: 12 }}>
                        <RSlider label="Size" min={14} max={64} step={1} value={Number(effectiveStyle.fontSize ?? 30)} onChange={(v: number) => handleStyle({ fontSize: Math.round(v) })} unit="px" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 10 }}>
                        <button onClick={() => handleStyle({ fontWeight: Number(effectiveStyle.fontWeight ?? 700) >= 750 ? 600 : 850 })} style={simpleToggleButton(Number(effectiveStyle.fontWeight ?? 700) >= 750)}>
                            <Bold size={13} /> Bold
                        </button>
                        <button onClick={() => handleStyle({ uppercase: !effectiveStyle.uppercase, textCase: effectiveStyle.uppercase ? "original" : "upper" })} style={simpleToggleButton(currentCase === "upper")}>
                            TT
                        </button>
                        {PANEL_TEXT_SWATCHES.slice(0, 2).map((col) => (
                            <button
                                key={col}
                                onClick={() => handleStyle({ color: col })}
                                title={col}
                                style={{ ...btnBase, height: 34, borderRadius: 12, border: colorToHex(effectiveStyle.color || "#FFFFFF", "#FFFFFF").toUpperCase() === col.toUpperCase() ? `2px solid ${C.primary}` : `1px solid ${UI.borderStrong}`, background: col }}
                            />
                        ))}
                    </div>
                </div>

                <div style={simpleSectionStyle}>
                    <span style={simpleLabelStyle}>Position</span>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
                        {["top", "center", "bottom"].map((position) => (
                            <button key={position} onClick={() => handleStyle({ position })} style={simpleToggleButton((effectiveStyle.position || "bottom") === position)}>
                                {position}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                        {([
                            { key: "left", icon: AlignLeft },
                            { key: "center", icon: AlignCenter },
                            { key: "right", icon: AlignRight },
                        ] as const).map(({ key, icon: Icon }) => (
                            <button key={key} onClick={() => handleStyle({ align: key })} style={simpleToggleButton((effectiveStyle.align || "center") === key)}>
                                <Icon size={14} />
                            </button>
                        ))}
                    </div>
                </div>

                <div style={simpleSectionStyle}>
                    <span style={simpleLabelStyle}>Look</span>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                        <button
                            onClick={() => handleStyle({
                                strokeColor: Number(effectiveStyle.strokeWidth ?? 0) > 0 ? "transparent" : "#000000",
                                strokeWidth: Number(effectiveStyle.strokeWidth ?? 0) > 0 ? 0 : 3,
                            })}
                            style={simpleToggleButton(Number(effectiveStyle.strokeWidth ?? 0) > 0)}
                        >
                            Stroke
                        </button>
                        <button
                            onClick={() => handleStyle({ shadowColor: shadowEnabled ? undefined : withAlpha("#000000", 0.65) })}
                            style={simpleToggleButton(shadowEnabled)}
                        >
                            Shadow
                        </button>
                        <button
                            onClick={() => handleStyle({ background: backgroundEnabled ? "transparent" : withAlpha("#000000", 0.55), borderRadius: backgroundEnabled ? effectiveStyle.borderRadius : 12 })}
                            style={simpleToggleButton(backgroundEnabled)}
                        >
                            Bubble
                        </button>
                    </div>
                    {Number(effectiveStyle.strokeWidth ?? 0) > 0 && (
                        <div style={{ marginTop: 12 }}>
                            <RSlider label="Stroke" min={1} max={8} step={0.5} value={Number(effectiveStyle.strokeWidth ?? 3)} onChange={(v: number) => handleStyle({ strokeWidth: Number(v.toFixed(1)), strokeColor: effectiveStyle.strokeColor || "#000000" })} unit="px" />
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );

    return (
        <aside style={asideStyle}>
            <div style={{ padding: "14px 15px", borderBottom: `1px solid ${UI.borderSoft}`, background: UI.glassBg }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 850, color: saveTone }}>
                        <span style={{ width: 8, height: 8, borderRadius: 99, background: saveTone }} />
                        {saveLabel}
                    </div>
                    <button
                        onClick={onResetStyles}
                        style={{ ...btnBase, fontSize: 11, fontWeight: 950, color: UI.textBase, border: `1px solid ${UI.borderStrong}`, borderRadius: 12, padding: "6px 12px", background: UI.appBgElev }}
                        title="Clear custom overrides and return to template defaults"
                    >
                        Reset
                    </button>
                </div>
            </div>

            <div style={{ padding: "11px 12px", borderBottom: `1px solid ${UI.borderSoft}`, background: UI.glassBg }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, background: UI.appBgElev, borderRadius: 16, padding: 4, border: `1px solid ${UI.borderSoft}` }}>
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as RightTab)}
                            style={{
                                ...btnBase,
                                height: 32,
                                borderRadius: 12,
                                fontSize: 11,
                                fontWeight: 950,
                                color: activeTab === tab.key ? "#fff" : UI.textMuted,
                                background: activeTab === tab.key ? C.primary : "transparent",
                                border: activeTab === tab.key ? `1px solid ${C.primaryHover}` : "1px solid transparent",
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
                <div style={cardStyle}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: UI.textStrong, marginBottom: 10 }}>
                        <input type="checkbox" checked readOnly style={{ accentColor: C.primary }} />
                        Apply to all main captions
                    </label>
                    <textarea
                        value={selectedCueText}
                        readOnly
                        rows={2}
                        style={{
                            width: "100%",
                            resize: "none",
                            borderRadius: 6,
                            border: `1px solid ${UI.borderStrong}`,
                            padding: "8px 10px",
                            color: UI.textStrong,
                            background: UI.appBg,
                            fontSize: 13,
                            lineHeight: 1.4,
                        }}
                    />
                </div>

                {activeTab === "type" && (
                    <>
                        <div style={cardStyle}>
                            <RS label="Font">
                                <select
                                    value={effectiveStyle.fontFamily || ""}
                                    onChange={(e) => { loadGoogleFont(e.target.value); handleStyle({ fontFamily: e.target.value || undefined }); }}
                                    style={fieldStyle}
                                >
                                    <option value="">Template Default</option>
                                    {fontsList.map((f) => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </RS>
                            <RSlider label="Font Size" min={10} max={80} step={1} value={Number(effectiveStyle.fontSize ?? 30)} onChange={(v: number) => handleStyle({ fontSize: Math.round(v) })} unit="px" />
                            <RS label="Pattern">
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                                    <button onClick={() => handleStyle({ fontWeight: Number(effectiveStyle.fontWeight ?? 700) >= 700 ? 500 : 800 })} style={pillButton(Number(effectiveStyle.fontWeight ?? 700) >= 700)}><Bold size={12} /> B</button>
                                    <button onClick={() => handleStyle({ underline: !effectiveStyle.underline })} style={pillButton(Boolean(effectiveStyle.underline))}><Underline size={12} /> U</button>
                                    <button onClick={() => handleStyle({ italic: !effectiveStyle.italic })} style={pillButton(Boolean(effectiveStyle.italic))}><ItalicIcon size={12} /> I</button>
                                </div>
                            </RS>
                            <RS label="Case">
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                                    <button onClick={() => handleStyle({ uppercase: true, textCase: "upper" })} style={pillButton(currentCase === "upper")}>TT</button>
                                    <button onClick={() => handleStyle({ uppercase: false, textCase: "lower" })} style={pillButton(currentCase === "lower")}>tt</button>
                                    <button onClick={() => handleStyle({ uppercase: false, textCase: "title" })} style={pillButton(currentCase === "title" || currentCase === "original")}>Tt</button>
                                </div>
                            </RS>
                        </div>

                        <div style={cardStyle}>
                            <RS label="Color">
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                    <input type="color" value={colorToHex(effectiveStyle.color || "#FFFFFF", "#FFFFFF")} onChange={(e) => handleStyle({ color: e.target.value.toUpperCase() })} style={{ width: 66, height: 26, border: `1px solid ${UI.borderStrong}`, borderRadius: 6, background: "#fff", padding: 2, cursor: "pointer" }} />
                                    <input type="text" value={colorToHex(effectiveStyle.color || "#FFFFFF", "#FFFFFF")} onChange={(e) => handleStyle({ color: e.target.value })} style={{ ...fieldStyle, fontFamily: C.fontMono, fontSize: 11, padding: "5px 8px" }} />
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 8 }}>
                                    {PANEL_TEXT_SWATCHES.map((col) => (
                                        <button key={col} onClick={() => handleStyle({ color: col })} style={{ ...btnBase, height: 20, borderRadius: 4, background: col, border: colorToHex(effectiveStyle.color || "#FFFFFF", "#FFFFFF") === col ? `2px solid ${C.primary}` : `1px solid ${UI.borderStrong}` }} />
                                    ))}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12, color: UI.textBase }}>
                                        Character
                                        <input
                                            type="number"
                                            min={0}
                                            max={10}
                                            step={0.1}
                                            value={Number((effectiveStyle.letterSpacing ?? 0).toFixed(1))}
                                            onChange={(e) => {
                                                const next = Number(e.target.value);
                                                if (!Number.isFinite(next)) return;
                                                handleStyle({ letterSpacing: Number(Math.max(0, Math.min(10, next)).toFixed(1)) });
                                            }}
                                            style={valueBoxStyle}
                                        />
                                    </label>
                                    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12, color: UI.textBase }}>
                                        Line
                                        <input
                                            type="number"
                                            min={-6}
                                            max={10}
                                            step={1}
                                            value={lineAdjust}
                                            onChange={(e) => {
                                                const next = Number(e.target.value);
                                                if (!Number.isFinite(next)) return;
                                                const clamped = Math.max(-6, Math.min(10, Math.round(next)));
                                                const nextLineHeight = Number((1.16 + clamped * 0.05).toFixed(2));
                                                handleStyle({ lineHeight: Math.max(1, Math.min(2, nextLineHeight)) });
                                            }}
                                            style={valueBoxStyle}
                                        />
                                    </label>
                                </div>
                            </RS>
                        </div>

                        <div style={cardStyle}>
                            <RS label="Alignment">
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 8 }}>
                                    {[
                                        { key: "left", icon: AlignLeft },
                                        { key: "center", icon: AlignCenter },
                                        { key: "right", icon: AlignRight },
                                    ].map(({ key, icon: Icon }) => (
                                        <button key={key} onClick={() => handleStyle({ align: key })} style={pillButton((effectiveStyle.align || "center") === key)}><Icon size={13} /></button>
                                    ))}
                                </div>
                            </RS>
                            <RS label="Preset Style">
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                                    {templates.slice(0, 20).map((tpl) => (
                                        <button
                                            key={tpl.id}
                                            onClick={() => onSelectTpl(tpl.id)}
                                            title={tpl.label}
                                            style={{
                                                ...btnBase,
                                                height: 38,
                                                borderRadius: 7,
                                                border: selectedTpl === tpl.id ? `2px solid ${C.primary}` : `1px solid ${UI.borderStrong}`,
                                                background: tpl.bg,
                                                color: tpl.tc,
                                                fontSize: 14,
                                                fontWeight: 800,
                                            }}
                                        >
                                            Aa
                                        </button>
                                    ))}
                                </div>
                            </RS>
                        </div>
                    </>
                )}

                {activeTab === "anime" && (
                    <>
                        <div style={cardStyle}>
                            <RS label="Template Library">
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                                    {templates.map((tpl) => (
                                        <button
                                            key={tpl.id}
                                            onClick={() => onSelectTpl(tpl.id)}
                                            style={{
                                                ...btnBase,
                                                borderRadius: 6,
                                                border: selectedTpl === tpl.id ? `1px solid ${C.primary}` : `1px solid ${UI.borderStrong}`,
                                                background: selectedTpl === tpl.id ? C.primarySubtle : UI.appBg,
                                                color: selectedTpl === tpl.id ? C.primary : UI.textBase,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                padding: "7px 8px",
                                                textAlign: "left",
                                            }}
                                        >
                                            {tpl.label}
                                        </button>
                                    ))}
                                </div>
                            </RS>
                        </div>
                        <div style={cardStyle}>
                            <RS label="Enter Animation">
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, marginBottom: 8 }}>
                                    {ENTER_ANIMATION_OPTIONS.map((anim) => (
                                        <button key={anim} onClick={() => handleStyle({ enterAnim: anim })} style={pillButton(String(effectiveStyle.enterAnim || "Pop") === anim)}>{anim}</button>
                                    ))}
                                </div>
                            </RS>
                            <RDiv />
                            <RS label="Exit Animation">
                                <select
                                    value={effectiveStyle.exitAnim || "Fade Out"}
                                    onChange={(e) => handleStyle({ exitAnim: e.target.value })}
                                    style={fieldStyle}
                                >
                                    {EXIT_ANIMATION_OPTIONS.map((anim) => <option key={anim} value={anim}>{anim}</option>)}
                                </select>
                            </RS>
                            <RSlider label="Duration" min={100} max={2000} step={50} value={Number(effectiveStyle.animDuration ?? 300)} onChange={(v: number) => handleStyle({ animDuration: Math.round(v) })} unit="ms" />
                            <RSlider label="Delay" min={0} max={1000} step={50} value={Number(effectiveStyle.animDelay ?? 0)} onChange={(v: number) => handleStyle({ animDelay: Math.round(v) })} unit="ms" />
                        </div>
                    </>
                )}

                {activeTab === "layout" && (
                    <>
                        <div style={cardStyle}>
                            <RS label="Bubble">
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                    <button onClick={() => handleStyle({ background: backgroundEnabled ? "transparent" : withAlpha("#000000", 0.75) })} style={pillButton(backgroundEnabled)}>{backgroundEnabled ? "Enabled" : "Enable"}</button>
                                    <input type="color" value={bgHex} onChange={(e) => handleStyle({ background: withAlpha(e.target.value, bgAlpha) })} style={{ width: 44, height: 24, border: `1px solid ${UI.borderStrong}`, borderRadius: 6, background: "#fff", padding: 2, cursor: backgroundEnabled ? "pointer" : "not-allowed", opacity: backgroundEnabled ? 1 : 0.5 }} disabled={!backgroundEnabled} />
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginBottom: 8 }}>
                                    {PANEL_BG_SWATCHES.map((col) => (
                                        <button key={col} onClick={() => handleStyle({ background: withAlpha(col, bgAlpha) })} style={{ ...btnBase, height: 20, borderRadius: 4, background: col, border: colorToHex(backgroundValue || "#000000", "#000000") === col ? `2px solid ${C.primary}` : `1px solid ${UI.borderStrong}`, opacity: backgroundEnabled ? 1 : 0.4 }} disabled={!backgroundEnabled} />
                                    ))}
                                </div>
                                <RSlider label="Opacity" min={0} max={1} step={0.05} value={bgAlpha} onChange={(v: number) => handleStyle({ background: withAlpha(bgHex, Number(v.toFixed(2))) })} />
                                <RSlider label="Corner Radius" min={0} max={24} step={1} value={Number(effectiveStyle.borderRadius ?? 4)} onChange={(v: number) => handleStyle({ borderRadius: Math.round(v) })} unit="px" />
                            </RS>
                        </div>

                        <div style={cardStyle}>
                            <RS label="Anchor">
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 8 }}>
                                    {["top", "center", "bottom"].map((pos) => (
                                        <button key={pos} onClick={() => handleStyle({ position: pos })} style={pillButton((effectiveStyle.position || "bottom") === pos)}>{pos}</button>
                                    ))}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 8 }}>
                                    {([
                                        { key: "left", icon: AlignLeft },
                                        { key: "center", icon: AlignCenter },
                                        { key: "right", icon: AlignRight },
                                    ] as const).map(({ key, icon: Icon }) => (
                                        <button key={key} onClick={() => handleStyle({ align: key })} style={pillButton((effectiveStyle.align || "center") === key)}><Icon size={13} /></button>
                                    ))}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                                    {(["word", "chunk", "sentence"] as const).map((mode) => (
                                        <button key={mode} onClick={() => handleStyle({ captionMode: mode })} style={pillButton((effectiveStyle.captionMode || "chunk") === mode)}>{mode}</button>
                                    ))}
                                </div>
                            </RS>
                            <RSlider label="Horizontal Offset" min={-120} max={120} step={1} value={Number(effectiveStyle.offsetX ?? 0)} onChange={(v: number) => handleStyle({ offsetX: Math.round(v) })} unit="px" />
                            <RSlider label="Vertical Offset" min={-120} max={120} step={1} value={Number(effectiveStyle.offsetY ?? 0)} onChange={(v: number) => handleStyle({ offsetY: Math.round(v) })} unit="px" />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                                <button onClick={() => handleStyle({ offsetX: 0 })} style={pillButton(false)}><MoveHorizontal size={12} /> Reset X</button>
                                <button onClick={() => handleStyle({ offsetY: 0 })} style={pillButton(false)}><MoveVertical size={12} /> Reset Y</button>
                            </div>
                            <RSlider label="Max Width" min={40} max={100} step={1} value={Number(effectiveStyle.maxWidthPct ?? 88)} onChange={(v: number) => handleStyle({ maxWidthPct: Math.round(v) })} unit="%" />
                            <RSlider label="Text Opacity" min={0.2} max={1} step={0.05} value={Number(effectiveStyle.textOpacity ?? 1)} onChange={(v: number) => handleStyle({ textOpacity: Number(v.toFixed(2)) })} />
                        </div>
                    </>
                )}

                {activeTab === "fx" && (
                    <>
                        <div style={cardStyle}>
                            <RS label="Stroke">
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                    <input type="color" value={colorToHex(effectiveStyle.strokeColor || "#000000", "#000000")} onChange={(e) => handleStyle({ strokeColor: e.target.value.toUpperCase() })} style={{ width: 44, height: 24, border: `1px solid ${UI.borderStrong}`, borderRadius: 6, background: "#fff", padding: 2, cursor: "pointer" }} />
                                    <button onClick={() => handleStyle({ strokeColor: "transparent", strokeWidth: 0 })} style={pillButton(String(effectiveStyle.strokeColor || "").toLowerCase() === "transparent")}>No Stroke</button>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginBottom: 8 }}>
                                    {PANEL_STROKE_SWATCHES.map((col) => (
                                        <button key={col} onClick={() => handleStyle({ strokeColor: col })} style={{ ...btnBase, height: 20, borderRadius: 4, background: col === "transparent" ? "linear-gradient(135deg,#fff,#d1d5db)" : col, border: String(effectiveStyle.strokeColor || "").toLowerCase() === col.toLowerCase() ? `2px solid ${C.primary}` : `1px solid ${UI.borderStrong}` }} />
                                    ))}
                                </div>
                                <RSlider label="Stroke Width" min={0} max={10} step={0.5} value={Number(effectiveStyle.strokeWidth ?? 0)} onChange={(v: number) => handleStyle({ strokeWidth: Number(v.toFixed(1)) })} unit="px" />
                            </RS>
                        </div>

                        <div style={cardStyle}>
                            <RS label="Shadow">
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                    <button onClick={() => handleStyle({ shadowColor: shadowEnabled ? undefined : withAlpha("#000000", 0.85) })} style={pillButton(shadowEnabled)}>{shadowEnabled ? "Enabled" : "Enable"}</button>
                                    <input type="color" value={shadowHex} onChange={(e) => handleStyle({ shadowColor: withAlpha(e.target.value, shadowAlpha) })} style={{ width: 44, height: 24, border: `1px solid ${UI.borderStrong}`, borderRadius: 6, background: "#fff", padding: 2, cursor: shadowEnabled ? "pointer" : "not-allowed", opacity: shadowEnabled ? 1 : 0.5 }} disabled={!shadowEnabled} />
                                </div>
                                <RSlider label="Shadow Opacity" min={0} max={1} step={0.05} value={shadowAlpha} onChange={(v: number) => handleStyle({ shadowColor: withAlpha(shadowHex, Number(v.toFixed(2))) })} />
                            </RS>
                            <RDiv />
                            <RS label="Glow">
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <button onClick={() => handleStyle({ glowColor: glowEnabled ? undefined : "#00FFFF" })} style={pillButton(glowEnabled)}>{glowEnabled ? "Enabled" : "Enable"}</button>
                                    <input type="color" value={glowHex} onChange={(e) => handleStyle({ glowColor: e.target.value.toUpperCase() })} style={{ width: 44, height: 24, border: `1px solid ${UI.borderStrong}`, borderRadius: 6, background: "#fff", padding: 2, cursor: glowEnabled ? "pointer" : "not-allowed", opacity: glowEnabled ? 1 : 0.5 }} disabled={!glowEnabled} />
                                </div>
                            </RS>
                        </div>
                    </>
                )}
            </div>
        </aside>
    );
}

void RightPanel;

const TIMELINE_ROW_H = 50;
const TIMELINE_RULER_H = 34;
const TIMELINE_LABEL_W = 172;
const TIMELINE_MIN_CONTENT_W = 1200;
const FRAME_MS = 1000 / 30;
const RAW_MIN_CLIP_MS = 120;

function formatTimelineTime(ms: number) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const frames = Math.floor((ms % 1000) / FRAME_MS);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

function formatDurationLabel(ms: number) {
    const seconds = Math.max(0, ms / 1000);
    if (seconds < 10) return `${seconds.toFixed(2)}s`;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${String(sec).padStart(2, "0")}`;
}

function clampTimelineMs(value: number, durationMs: number) {
    return Math.max(0, Math.min(Math.max(0, durationMs), Math.round(value)));
}

function snapTimelineMs(value: number) {
    return Math.round(value / FRAME_MS) * FRAME_MS;
}

function getRulerStepMs(zoom: number) {
    if (zoom >= 420) return 250;
    if (zoom >= 260) return 500;
    if (zoom >= 140) return 1000;
    if (zoom >= 70) return 2000;
    return 5000;
}

function TimelineRuler({ durationMs, zoom, widthPx, onSeek }: { durationMs: number; zoom: number; widthPx: number; onSeek: (ms: number) => void }) {
    const pxPerMs = zoom / 1000;
    const stepMs = getRulerStepMs(zoom);
    const ticks = useMemo(() => {
        const count = Math.ceil(Math.max(durationMs, 1) / stepMs) + 1;
        return Array.from({ length: count }, (_, i) => i * stepMs).filter(ms => ms <= durationMs + stepMs);
    }, [durationMs, stepMs]);

    return (
        <div
            onPointerDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onSeek((e.clientX - rect.left) / pxPerMs);
            }}
            style={{ position: "relative", height: TIMELINE_RULER_H, width: widthPx, minWidth: "100%", borderBottom: `1px solid ${UI.borderSoft}`, background: UI.appBg, cursor: "pointer" }}
        >
            {ticks.map((ms) => {
                const left = ms * pxPerMs;
                const isMajor = ms % (stepMs * 2) === 0;
                return (
                    <div key={ms} style={{ position: "absolute", left, top: 0, bottom: 0, width: 1, background: isMajor ? "rgba(148,163,184,0.48)" : "rgba(148,163,184,0.22)" }}>
                        {isMajor && <span style={{ position: "absolute", top: 5, left: 6, color: C.gray400, fontSize: 10, fontFamily: C.fontMono, whiteSpace: "nowrap", userSelect: "none" }}>{formatTimelineTime(ms).slice(0, 5)}</span>}
                    </div>
                );
            })}
        </div>
    );
}

function TrackLabel({
    label,
    color,
    count,
    visible = true,
    onToggleVisibility,
}: {
    label: string;
    color: string;
    count?: number;
    visible?: boolean;
    onToggleVisibility?: () => void;
}) {
    return (
        <div
            style={{
                height: TIMELINE_ROW_H,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "0 12px",
                borderBottom: `1px solid ${UI.borderSoft}`,
                background: visible ? `linear-gradient(90deg, ${UI.appBgElev}, color-mix(in oklch, ${color} 6%, white))` : "rgba(148,163,184,0.10)",
                boxShadow: "none",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <div style={{ width: 5, height: 28, borderRadius: 999, background: visible ? color : C.gray300, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 950, color: visible ? UI.textBase : UI.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
                    <span style={{ display: "block", marginTop: 2, fontSize: 9, color: UI.textMuted, fontFamily: C.fontMono, textTransform: "uppercase", letterSpacing: 0 }}>
                        {visible ? "Visible" : "Hidden"}
                    </span>
                </div>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {typeof count === "number" && <span style={{ minWidth: 22, textAlign: "center", padding: "3px 6px", borderRadius: 999, background: UI.appBgElev, border: `1px solid ${UI.borderSoft}`, fontSize: 10, color: C.gray500, fontFamily: C.fontMono, fontWeight: 850 }}>{count}</span>}
                <button
                    onClick={onToggleVisibility}
                    title={visible ? `Hide ${label}` : `Show ${label}`}
                    style={{
                        ...btnBase,
                        width: 24,
                        height: 24,
                        borderRadius: 9,
                        border: `1px solid ${UI.borderStrong}`,
                        background: visible ? UI.appBg : UI.glassBg,
                        color: visible ? UI.textBase : UI.textMuted,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                    }}
                >
                    {visible ? <Eye size={11} /> : <EyeOff size={11} />}
                </button>
            </div>
        </div>
    );
}

function TimelineTrack({
    children,
    hidden = false,
    isDropTarget = false,
    onDragOver,
    onDragEnter,
    onDragLeave,
    onDrop,
}: {
    children: React.ReactNode;
    hidden?: boolean;
    isDropTarget?: boolean;
    onDragOver?: React.DragEventHandler<HTMLDivElement>;
    onDragEnter?: React.DragEventHandler<HTMLDivElement>;
    onDragLeave?: React.DragEventHandler<HTMLDivElement>;
    onDrop?: React.DragEventHandler<HTMLDivElement>;
}) {
    return (
        <div
            onDragOver={onDragOver}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            style={{
                height: TIMELINE_ROW_H,
                borderBottom: `1px solid ${UI.borderSoft}`,
                position: "relative",
                backgroundImage: hidden
                    ? "none"
                    : `linear-gradient(90deg, color-mix(in oklch, ${C.primary} 10%, transparent) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.80), rgba(255,255,255,0.42))`,
                backgroundSize: "80px 100%, 100% 100%",
                backgroundColor: hidden ? "rgba(148,163,184,0.10)" : isDropTarget ? "rgba(34,197,94,0.14)" : "rgba(255,255,255,0.52)",
                boxShadow: isDropTarget ? `inset 0 0 0 2px ${C.success}` : "inset 0 1px 0 rgba(255,255,255,0.65)",
                transition: "background-color 120ms ease, box-shadow 120ms ease",
                opacity: hidden ? 0.55 : 1,
            }}
        >
            {isDropTarget && (
                <div style={{ position: "absolute", left: 12, top: 9, bottom: 9, zIndex: 1, display: "flex", alignItems: "center", padding: "0 10px", borderRadius: 12, background: "rgba(255,255,255,0.88)", border: `1px dashed ${C.success}`, color: C.success, fontSize: 11, fontWeight: 950, pointerEvents: "none" }}>
                    Drop media here
                </div>
            )}
            {children}
        </div>
    );
}

function DraggableClip({ id, startMs, endMs, colorVar, pxPerMs, label, onUpdate, onDelete, onSelect, isSelected = false, movable = true, trimmable = true, durationMs = 0 }: any) {
    const [isDragging, setIsDragging] = useState(false);
    const clipDuration = Math.max(50, endMs - startMs);
    const leftPx = Math.max(0, startMs * pxPerMs);
    const widthPx = Math.max(34, clipDuration * pxPerMs);
    const commitRef = useRef<number | null>(null);
    const canShowDetail = widthPx >= 96;
    const canShowDuration = widthPx >= 64;

    const scheduleUpdate = (patch: any) => {
        if (!onUpdate) return;
        if (commitRef.current) window.cancelAnimationFrame(commitRef.current);
        commitRef.current = window.requestAnimationFrame(() => onUpdate(id, patch));
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, mode: "move" | "trim-L" | "trim-R") => {
        if (!movable && mode === "move") return;
        if (!trimmable && mode !== "move") return;
        e.stopPropagation();
        e.preventDefault();
        onSelect?.(id);
        setIsDragging(true);
        const pointerId = e.pointerId;
        e.currentTarget.setPointerCapture?.(pointerId);

        const initialClientX = e.clientX;
        const initialStartMs = startMs;
        const initialEndMs = endMs;
        const minClipMs = 120;

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const deltaMs = (moveEvent.clientX - initialClientX) / pxPerMs;
            let newStart = initialStartMs;
            let newEnd = initialEndMs;

            if (mode === "move") {
                const snappedStart = snapTimelineMs(initialStartMs + deltaMs);
                const maxStart = Math.max(0, durationMs - (initialEndMs - initialStartMs));
                newStart = Math.max(0, Math.min(maxStart, snappedStart));
                newEnd = newStart + (initialEndMs - initialStartMs);
            } else if (mode === "trim-L") {
                newStart = Math.min(initialEndMs - minClipMs, snapTimelineMs(initialStartMs + deltaMs));
                newStart = clampTimelineMs(newStart, durationMs);
            } else {
                newEnd = Math.max(initialStartMs + minClipMs, snapTimelineMs(initialEndMs + deltaMs));
                newEnd = clampTimelineMs(newEnd, durationMs);
            }

            scheduleUpdate({ start_ms: Math.round(newStart), end_ms: Math.round(newEnd) });
        };

        const handlePointerUp = () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            setIsDragging(false);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
    };

    return (
        <div
            onPointerDown={(e) => handlePointerDown(e, "move")}
            onClick={(e) => { e.stopPropagation(); onSelect?.(id); }}
            title={`${label}\n${formatTimelineTime(startMs)} - ${formatTimelineTime(endMs)}`}
            style={{
                position: "absolute",
                left: leftPx,
                width: widthPx,
                top: 7,
                bottom: 7,
                background: `linear-gradient(180deg, color-mix(in oklab, ${colorVar} 94%, white), ${colorVar})`,
                borderRadius: 12,
                cursor: movable ? (isDragging ? "grabbing" : "grab") : "default",
                display: "flex",
                alignItems: "center",
                overflow: "hidden",
                boxShadow: isSelected ? `0 0 0 3px color-mix(in oklch, ${C.primary} 45%, white)` : "none",
                border: isSelected ? `1px solid ${C.primary}` : "1px solid rgba(255,255,255,0.72)",
                opacity: isDragging ? 0.88 : 1,
                transform: isDragging ? "translateY(-1px)" : "translateY(0)",
                transition: isDragging ? "none" : "box-shadow 120ms ease, transform 120ms ease, opacity 120ms ease",
                userSelect: "none",
                zIndex: isSelected ? 20 : 5,
            }}
        >
            <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)", backgroundSize: "10px 100%", opacity: 0.7, pointerEvents: "none" }} />
            {trimmable && <div onPointerDown={(e) => handlePointerDown(e, "trim-L")} style={{ position: "absolute", left: 0, width: 11, top: 0, bottom: 0, cursor: "ew-resize", background: "rgba(255,255,255,0.36)", borderRight: "1px solid rgba(15,23,42,0.14)", zIndex: 2 }} />}
            <span style={{ fontSize: 11, color: "#fff", pointerEvents: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: canShowDuration ? "0 50px 0 18px" : "0 18px", fontWeight: 950, textShadow: "0 1px 2px rgba(0,0,0,0.34)", position: "relative", zIndex: 1 }}>{label}</span>
            {canShowDuration && (
                <span style={{ position: "absolute", right: onDelete && isSelected ? 28 : 8, top: "50%", transform: "translateY(-50%)", zIndex: 3, padding: "2px 5px", borderRadius: 999, background: "rgba(255,255,255,0.82)", color: "rgba(15,23,42,0.76)", fontSize: 9, fontWeight: 850, fontFamily: C.fontMono, pointerEvents: "none" }}>
                    {formatDurationLabel(clipDuration)}
                </span>
            )}
            {canShowDetail && (
                <span style={{ position: "absolute", left: 18, bottom: 2, zIndex: 2, color: "rgba(255,255,255,0.72)", fontSize: 8, fontFamily: C.fontMono, pointerEvents: "none" }}>
                    {formatTimelineTime(startMs).slice(0, 5)}
                </span>
            )}
            {trimmable && <div onPointerDown={(e) => handlePointerDown(e, "trim-R")} style={{ position: "absolute", right: 0, width: 11, top: 0, bottom: 0, cursor: "ew-resize", background: "rgba(255,255,255,0.36)", borderLeft: "1px solid rgba(15,23,42,0.14)", zIndex: 2 }} />}
            {onDelete && isSelected && <button onPointerDown={(e) => { e.stopPropagation(); onDelete(id); }} title="Delete clip" style={{ position: "absolute", top: 5, right: 5, background: "rgba(255,255,255,0.94)", color: C.danger, borderRadius: 6, width: 18, height: 18, border: `1px solid rgba(239,68,68,0.28)`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 6 }}><X size={11} /></button>}
        </div>
    );
}

function TimelinePanel({
    subtitleTrack = [],
    gapCuts = [],
    sfxTrack = [],
    transitions = [],
    musicTrack,
    externalDragPayload = null,
    onExternalDrop,
    isPlaying,
    onPlayPause,
    onStepBack,
    onStepFwd,
    durationMs,
    currentTimeMs,
    zoom,
    onZoom,
    progressRef,
    onProgressClick,
    brollTrack = [],
    motionGraphicsTrack = [],
    layerVisibility,
    onToggleLayerVisibility,
}: any) {
    const timelineScrollRef = useRef<HTMLDivElement>(null);
    const [selectedClip, setSelectedClip] = useState<{ id: string; kind: "raw" | "caption" | "broll" | "motion" | "music" | "sfx" | "transition" | "cut" } | null>(null);
    const [rawClipRange, setRawClipRange] = useState<{ start_ms: number; end_ms: number }>({
        start_ms: 0,
        end_ms: Math.max(0, Math.round(durationMs)),
    });
    const [scrubbing, setScrubbing] = useState(false);
    const [dropTrack, setDropTrack] = useState<TimelineDropTarget | null>(null);
    const previousDurationRef = useRef(0);
    const totalSec = Math.round(durationMs / 1000);
    const timelineZoom = durationMs > 0
        ? Math.max(zoom, (TIMELINE_MIN_CONTENT_W * 1000) / Math.max(1, durationMs))
        : zoom;
    const pxPerMs = timelineZoom / 1000;
    const timelineWidthPx = Math.max(TIMELINE_MIN_CONTENT_W, Math.ceil(Math.max(1, durationMs) * pxPerMs));
    const playheadLeft = currentTimeMs * pxPerMs;
    const isLayerVisible = useCallback(
        (layer: LayerKey) => layerVisibility?.[layer] ?? true,
        [layerVisibility],
    );
    const clampRawRange = useCallback((startCandidate: number, endCandidate: number) => {
        const projectEndMs = Math.max(0, Math.round(durationMs));
        if (projectEndMs <= 0) return { start_ms: 0, end_ms: 0 };
        const boundedStart = Math.max(0, Math.min(Math.round(startCandidate), Math.max(0, projectEndMs - RAW_MIN_CLIP_MS)));
        const boundedEnd = Math.max(
            boundedStart + RAW_MIN_CLIP_MS,
            Math.min(Math.round(endCandidate), projectEndMs),
        );
        return { start_ms: boundedStart, end_ms: boundedEnd };
    }, [durationMs]);
    const rawClipSelected = selectedClip?.kind === "raw" && selectedClip?.id === "raw-source";
    const updateRawClip = useCallback((_: string, patch: { start_ms?: number; end_ms?: number }) => {
        setRawClipRange((prev) => {
            const nextStart = Number.isFinite(Number(patch?.start_ms)) ? Number(patch.start_ms) : prev.start_ms;
            const nextEnd = Number.isFinite(Number(patch?.end_ms)) ? Number(patch.end_ms) : prev.end_ms;
            return clampRawRange(nextStart, nextEnd);
        });
    }, [clampRawRange]);

    useEffect(() => {
        const nextDuration = Math.max(0, Math.round(durationMs || 0));
        const previousDuration = previousDurationRef.current;
        previousDurationRef.current = nextDuration;
        setRawClipRange((prev) => {
            if (nextDuration <= 0) return { start_ms: 0, end_ms: 0 };
            const wasEmpty = previousDuration <= 0 || prev.end_ms <= RAW_MIN_CLIP_MS;
            const wasFullDuration = prev.start_ms <= 1 && Math.abs(prev.end_ms - previousDuration) <= 250;
            if (wasEmpty || wasFullDuration) {
                return { start_ms: 0, end_ms: nextDuration };
            }
            return clampRawRange(prev.start_ms, prev.end_ms);
        });
    }, [durationMs, clampRawRange]);

    const { updateCue, removeCue, updateBroll, removeBroll, updateMotionGraphic, removeMotionGraphic, updateSFX, removeSFX, updateMusic, setMusicTrack, selectCue, undo, redo, historyPast, historyFuture } = useTimeline();

    const seekFromClientX = (clientX: number) => {
        const rect = progressRef.current?.getBoundingClientRect();
        if (!rect) return;
        const nextMs = clampTimelineMs((clientX - rect.left) / pxPerMs, durationMs);
        onProgressClick?.({ clientX, currentTarget: progressRef.current } as any);
        const video = document.querySelector("video") as HTMLVideoElement | null;
        if (video && Number.isFinite(video.duration)) video.currentTime = nextMs / 1000;
    };

    useEffect(() => {
        const viewport = timelineScrollRef.current;
        if (!viewport || scrubbing) return;
        const left = playheadLeft;
        const visibleStart = viewport.scrollLeft;
        const visibleEnd = visibleStart + viewport.clientWidth;
        if (left < visibleStart + 80 || left > visibleEnd - 120) {
            viewport.scrollTo({ left: Math.max(0, left - viewport.clientWidth * 0.35), behavior: "smooth" });
        }
    }, [playheadLeft, scrubbing]);

    const clipCounts = {
        raw: durationMs > 0 ? 1 : 0,
        captions: subtitleTrack.length,
        broll: brollTrack.length,
        motion: motionGraphicsTrack.length,
        music: musicTrack ? 1 : 0,
        sfx: sfxTrack.length,
        transitions: transitions.length,
        cuts: gapCuts.length,
    };

    const selectedClipMeta = useMemo(() => {
        if (!selectedClip) return null;
        if (selectedClip.kind === "raw") {
            return { label: "Raw Clip", startMs: Number(rawClipRange.start_ms), endMs: Number(rawClipRange.end_ms), kind: "Raw" };
        }
        if (selectedClip.kind === "caption") {
            const cue = subtitleTrack.find((c: any) => String(getCueId(c)) === selectedClip.id);
            if (!cue) return null;
            return { label: String(cue.text ?? "Caption"), startMs: Number(cue.start_ms), endMs: Number(cue.end_ms), kind: "Caption" };
        }
        if (selectedClip.kind === "broll") {
            const clip = brollTrack.find((c: any) => String(c.pexels_id) === selectedClip.id);
            if (!clip) return null;
            return { label: String(clip.cue_text ?? "B-Roll"), startMs: Number(clip.start_ms), endMs: Number(clip.end_ms), kind: "B-Roll" };
        }
        if (selectedClip.kind === "motion") {
            const clip = motionGraphicsTrack.find((c: any) => String(c.clip_id) === selectedClip.id);
            if (!clip) return null;
            return { label: String(clip.text ?? "Motion Graphic"), startMs: Number(clip.start_ms), endMs: Number(clip.end_ms), kind: "Motion" };
        }
        if (selectedClip.kind === "music" && musicTrack) {
            return { label: String(musicTrack.name ?? "Music"), startMs: Number(musicTrack.start_ms), endMs: Number(musicTrack.start_ms + musicTrack.duration * 1000), kind: "Music" };
        }
        if (selectedClip.kind === "sfx") {
            const clip = sfxTrack.find((c: any) => String(c.id) === selectedClip.id);
            if (!clip) return null;
            return { label: String(clip.name ?? "SFX"), startMs: Number(clip.start_ms), endMs: Number(clip.start_ms + clip.duration * 1000), kind: "SFX" };
        }
        if (selectedClip.kind === "transition") {
            const clip = transitions.find((c: any) => String(c.clip_id) === selectedClip.id);
            if (!clip) return null;
            return { label: String(clip.type ?? "Transition"), startMs: Number(clip.offset_ms), endMs: Number(clip.offset_ms + (clip.duration_s || 1) * 1000), kind: "Transition" };
        }
        if (selectedClip.kind === "cut") {
            const clip = gapCuts.find((_: any, index: number) => `gap-${index}` === selectedClip.id);
            if (!clip) return null;
            return { label: "Silence Cut", startMs: Number(clip.start_ms), endMs: Number(clip.end_ms), kind: "Cut" };
        }
        return null;
    }, [selectedClip, subtitleTrack, brollTrack, motionGraphicsTrack, musicTrack, sfxTrack, transitions, gapCuts, rawClipRange.start_ms, rawClipRange.end_ms]);

    const selectTimelineClip = (id: string, kind: "raw" | "caption" | "broll" | "motion" | "music" | "sfx" | "transition" | "cut" = "caption") => {
        const nextId = String(id);
        setSelectedClip({ id: nextId, kind });
        selectCue(kind === "caption" ? nextId : null);
    };

    const deleteSelectedClip = () => {
        if (!selectedClip) return;
        if (selectedClip.kind === "caption") removeCue(selectedClip.id);
        if (selectedClip.kind === "broll") removeBroll(selectedClip.id);
        if (selectedClip.kind === "motion") removeMotionGraphic(selectedClip.id);
        if (selectedClip.kind === "music") updateMusic({ start_ms: 0 });
        if (selectedClip.kind === "sfx") removeSFX(selectedClip.id);
        setSelectedClip(null);
    };

    const nudgePlayhead = (deltaMs: number) => {
        const video = document.querySelector("video") as HTMLVideoElement | null;
        if (!video) return;
        video.currentTime = clampTimelineMs(currentTimeMs + deltaMs, durationMs) / 1000;
    };

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
            if (e.key === " " || e.code === "Space") {
                e.preventDefault();
                onPlayPause?.();
            } else if (e.key === "Delete" || e.key === "Backspace") {
                e.preventDefault();
                deleteSelectedClip();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                nudgePlayhead(e.shiftKey ? -1000 : -FRAME_MS);
            } else if (e.key === "ArrowRight") {
                e.preventDefault();
                nudgePlayhead(e.shiftKey ? 1000 : FRAME_MS);
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
                e.preventDefault();
                if (e.shiftKey) redo(); else undo();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
                e.preventDefault();
                redo();
            } else if ((e.key === "+" || e.key === "=") && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                onZoom(Math.min(500, zoom + 20));
            } else if (e.key === "-" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                onZoom(Math.max(20, zoom - 20));
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [selectedClip, currentTimeMs, durationMs, zoom, onPlayPause, onZoom, undo, redo]);

    useEffect(() => {
        if (!externalDragPayload) setDropTrack(null);
    }, [externalDragPayload]);

    const isTrackDropEnabled = (track: TimelineDropTarget) => {
        if (!externalDragPayload) return false;
        if (track === "broll" && !isLayerVisible("broll")) return false;
        if (track === "motion" && !isLayerVisible("motion")) return false;
        if (track === "music" && !isLayerVisible("music")) return false;
        if (track === "sfx" && !isLayerVisible("sfx")) return false;
        return externalDragPayload.kind === track;
    };

    const handleTrackDragOver = (track: TimelineDropTarget, e: React.DragEvent<HTMLDivElement>) => {
        if (!isTrackDropEnabled(track)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (dropTrack !== track) setDropTrack(track);
    };

    const handleTrackDragLeave = (track: TimelineDropTarget, e: React.DragEvent<HTMLDivElement>) => {
        if (dropTrack !== track) return;
        const related = e.relatedTarget as Node | null;
        if (!related || !e.currentTarget.contains(related)) {
            setDropTrack(null);
        }
    };

    const handleTrackDrop = (track: TimelineDropTarget, e: React.DragEvent<HTMLDivElement>) => {
        if (!isTrackDropEnabled(track)) return;
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const startMs = clampTimelineMs(localX / pxPerMs, durationMs);
        onExternalDrop?.(track, startMs);
        setDropTrack(null);
    };

    return (
        <div style={{ height: 338, margin: "14px 18px 18px", background: "rgba(255,255,255,0.94)", border: `1px solid ${UI.borderStrong}`, borderRadius: 26, display: "flex", flexDirection: "column", flexShrink: 0, boxShadow: "none", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px", minHeight: 64, borderBottom: `1px solid ${UI.borderSoft}`, flexShrink: 0, background: "rgba(251,251,253,0.82)", backdropFilter: "blur(18px) saturate(160%)" }}>
                <div style={{ minWidth: 112 }}>
                    <div style={{ fontSize: 10, fontWeight: 950, color: C.primaryDark, letterSpacing: "0.12em", textTransform: "uppercase" }}>Timeline</div>
                    <div style={{ marginTop: 4, fontSize: 11, color: UI.textBase, fontFamily: C.fontMono, fontWeight: 800 }}>{clipCounts.captions + clipCounts.broll + clipCounts.motion + clipCounts.music + clipCounts.sfx} clips</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <TBtn onClick={onStepBack} label="Step back"><ChevronsLeft size={13} /></TBtn>
                    <button onClick={onPlayPause} title={isPlaying ? "Pause" : "Play"} style={{ ...btnBase, width: 40, height: 40, borderRadius: 14, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0, boxShadow: "none", border: `1px solid ${C.primaryHover}` }}>
                        {isPlaying ? <Pause size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" />}
                    </button>
                    <TBtn onClick={onStepFwd} label="Step forward"><ChevronsRight size={13} /></TBtn>
                </div>
                <span style={{ fontSize: 12, color: UI.textStrong, fontFamily: C.fontMono, whiteSpace: "nowrap", flexShrink: 0, minWidth: 150, padding: "8px 11px", borderRadius: 13, background: UI.appBgElev, border: `1px solid ${UI.borderSoft}`, fontWeight: 850 }}>{formatTimelineTime(currentTimeMs)} / {fmt(totalSec)}</span>
                {selectedClipMeta && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0, maxWidth: "42vw", padding: "7px 10px", borderRadius: 14, background: UI.appBgElev, border: `1px solid ${UI.borderStrong}`, boxShadow: "none" }}>
                        <span style={{ fontSize: 10, color: C.primary, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0, whiteSpace: "nowrap" }}>{selectedClipMeta.kind}</span>
                        <span style={{ fontSize: 11, color: UI.textStrong, maxWidth: 210, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 750 }}>{selectedClipMeta.label}</span>
                        <span style={{ fontSize: 10, color: C.gray400, fontFamily: C.fontMono, whiteSpace: "nowrap" }}>
                            {formatTimelineTime(selectedClipMeta.startMs)}-{formatTimelineTime(selectedClipMeta.endMs)}
                        </span>
                        {rawClipSelected ? (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, paddingLeft: 6, borderLeft: `1px solid ${UI.borderStrong}` }}>
                                <span style={{ fontSize: 10, color: UI.textMuted, whiteSpace: "nowrap" }}>Trim</span>
                                <input
                                    type="number"
                                    step={0.01}
                                    min={0}
                                    max={Math.max(0, durationMs / 1000)}
                                    value={(rawClipRange.start_ms / 1000).toFixed(2)}
                                    onChange={(e) => {
                                        const sec = Number(e.target.value);
                                        if (!Number.isFinite(sec)) return;
                                        updateRawClip("raw-source", { start_ms: Math.round(sec * 1000) });
                                    }}
                                    title="Raw clip start time (seconds)"
                                    style={{ width: 62, height: 22, borderRadius: 5, border: `1px solid ${UI.borderStrong}`, background: UI.appBg, color: UI.textBase, fontSize: 10, fontFamily: C.fontMono, padding: "0 6px" }}
                                />
                                <span style={{ fontSize: 10, color: UI.textMuted }}>to</span>
                                <input
                                    type="number"
                                    step={0.01}
                                    min={0}
                                    max={Math.max(0, durationMs / 1000)}
                                    value={(rawClipRange.end_ms / 1000).toFixed(2)}
                                    onChange={(e) => {
                                        const sec = Number(e.target.value);
                                        if (!Number.isFinite(sec)) return;
                                        updateRawClip("raw-source", { end_ms: Math.round(sec * 1000) });
                                    }}
                                    title="Raw clip end time (seconds)"
                                    style={{ width: 62, height: 22, borderRadius: 5, border: `1px solid ${UI.borderStrong}`, background: UI.appBg, color: UI.textBase, fontSize: 10, fontFamily: C.fontMono, padding: "0 6px" }}
                                />
                            </div>
                        ) : (
                            <button
                                onClick={deleteSelectedClip}
                                style={{ ...btnBase, width: 24, height: 24, borderRadius: 7, background: C.dangerLight, color: C.danger, border: `1px solid ${C.danger}`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                title="Delete selected clip"
                            >
                                <Trash2 size={12} />
                            </button>
                        )}
                    </div>
                )}
                <div style={{ flex: 1 }} />
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: 4, borderRadius: 13, background: UI.appBgElev, border: `1px solid ${UI.borderSoft}` }}>
                    <button onClick={undo} disabled={historyPast.length === 0} title="Undo" style={{ ...btnBase, color: historyPast.length === 0 ? UI.textSubtle : UI.textStrong, width: 28, height: 26, borderRadius: 6, cursor: historyPast.length ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Undo2 size={14} /></button>
                    <button onClick={redo} disabled={historyFuture.length === 0} title="Redo" style={{ ...btnBase, color: historyFuture.length === 0 ? UI.textSubtle : UI.textStrong, width: 28, height: 26, borderRadius: 6, cursor: historyFuture.length ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Redo2 size={14} /></button>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 8px", borderRadius: 13, background: UI.appBgElev, border: `1px solid ${UI.borderSoft}` }}>
                    <button onClick={() => onZoom(Math.max(20, zoom - 20))} title="Zoom out" style={{ ...btnBase, color: UI.textBase, width: 24, height: 24, borderRadius: 6, background: UI.appBg, border: `1px solid ${UI.borderSoft}` }}>-</button>
                    <input type="range" min={20} max={500} value={zoom} onChange={e => onZoom(parseInt(e.target.value))} style={{ width: 124, accentColor: C.primary }} />
                    <button onClick={() => onZoom(Math.min(500, zoom + 20))} title="Zoom in" style={{ ...btnBase, color: UI.textBase, width: 24, height: 24, borderRadius: 6, background: UI.appBg, border: `1px solid ${UI.borderSoft}` }}>+</button>
                    <span style={{ fontSize: 10, color: C.gray500, fontFamily: C.fontMono, minWidth: 50, textAlign: "right" }}>{zoom}px/s</span>
                </div>
            </div>

            <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
                <div style={{ width: TIMELINE_LABEL_W, flexShrink: 0, borderRight: `1px solid ${UI.borderSoft}`, background: UI.appBgElev, zIndex: 10, boxShadow: "none" }}>
                    <div style={{ height: TIMELINE_RULER_H, borderBottom: `1px solid ${UI.borderSoft}`, background: `linear-gradient(90deg, ${UI.appBgElev}, ${C.primarySubtle})`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", color: C.gray500, fontSize: 10, fontWeight: 950, letterSpacing: 0 }}>
                        <span>LAYERS</span>
                        <span style={{ fontFamily: C.fontMono, fontWeight: 700, letterSpacing: 0 }}>{formatDurationLabel(durationMs)}</span>
                    </div>
                    <TrackLabel label="Captions" color={C.primaryDark} count={clipCounts.captions} visible={isLayerVisible("captions")} onToggleVisibility={() => onToggleLayerVisibility?.("captions")} />
                    <TrackLabel label="B-Roll" color={C.accent} count={clipCounts.broll} visible={isLayerVisible("broll")} onToggleVisibility={() => onToggleLayerVisibility?.("broll")} />
                    <TrackLabel label="Motion" color={C.primary} count={clipCounts.motion} visible={isLayerVisible("motion")} onToggleVisibility={() => onToggleLayerVisibility?.("motion")} />
                    <TrackLabel label="Raw Clip" color={C.gray700} count={clipCounts.raw} visible={isLayerVisible("raw")} onToggleVisibility={() => onToggleLayerVisibility?.("raw")} />
                    <TrackLabel label="Music" color={C.success} count={clipCounts.music} visible={isLayerVisible("music")} onToggleVisibility={() => onToggleLayerVisibility?.("music")} />
                    <TrackLabel label="SFX" color={C.warning} count={clipCounts.sfx} visible={isLayerVisible("sfx")} onToggleVisibility={() => onToggleLayerVisibility?.("sfx")} />
                    <TrackLabel label="Transitions" color={C.accent} count={clipCounts.transitions} visible={isLayerVisible("transitions")} onToggleVisibility={() => onToggleLayerVisibility?.("transitions")} />
                    <TrackLabel label="Cuts" color={C.danger} count={clipCounts.cuts} visible={isLayerVisible("cuts")} onToggleVisibility={() => onToggleLayerVisibility?.("cuts")} />
                </div>

                <div
                    ref={timelineScrollRef}
                    onWheel={(e) => {
                        const viewport = timelineScrollRef.current;
                        if (!viewport) return;
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            const rect = viewport.getBoundingClientRect();
                            const cursorX = e.clientX - rect.left + viewport.scrollLeft;
                            const timeAtCursor = cursorX / pxPerMs;
                            const nextZoom = Math.max(20, Math.min(500, zoom + (e.deltaY < 0 ? 24 : -24)));
                            onZoom(nextZoom);
                            requestAnimationFrame(() => {
                                const nextPxPerMs = nextZoom / 1000;
                                viewport.scrollLeft = Math.max(0, timeAtCursor * nextPxPerMs - (e.clientX - rect.left));
                            });
                        } else if (e.shiftKey) {
                            e.preventDefault();
                            viewport.scrollLeft += e.deltaY;
                        }
                    }}
                    style={{ flex: 1, overflow: "auto", position: "relative", background: `linear-gradient(180deg, ${UI.appBgElev}, ${UI.appBgSoft})`, scrollbarColor: `${C.primary} ${C.gray100}` }}
                >
                    <div
                        ref={progressRef}
                        onClick={onProgressClick}
                        onPointerDown={(e) => {
                            if ((e.target as HTMLElement).closest("[data-clip='true']")) return;
                            setScrubbing(true);
                            seekFromClientX(e.clientX);
                            const move = (ev: PointerEvent) => seekFromClientX(ev.clientX);
                            const up = () => { setScrubbing(false); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
                            window.addEventListener("pointermove", move);
                            window.addEventListener("pointerup", up);
                        }}
                        style={{ width: timelineWidthPx, minWidth: "100%", minHeight: TIMELINE_RULER_H + TIMELINE_ROW_H * 8, position: "relative", backgroundImage: `linear-gradient(90deg, color-mix(in oklch, ${C.primary} 20%, transparent) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.026) 1px, transparent 1px)`, backgroundSize: `${timelineZoom}px 100%, ${Math.max(12, timelineZoom / 4)}px 100%` }}
                    >
                        <TimelineRuler durationMs={durationMs} zoom={timelineZoom} widthPx={timelineWidthPx} onSeek={(ms) => seekFromClientX((progressRef.current?.getBoundingClientRect().left ?? 0) + ms * pxPerMs)} />

                        <div style={{ position: "absolute", top: 0, left: playheadLeft, bottom: 0, width: 2, background: C.primary, zIndex: 60, pointerEvents: "none", boxShadow: `0 0 0 1px ${C.primary}, 0 0 18px color-mix(in oklch, ${C.primary} 35%, transparent)` }}>
                            <div style={{ position: "absolute", top: 0, left: -8, width: 18, height: 20, borderRadius: "0 0 9px 9px", background: C.primary }} />
                            <div style={{ position: "absolute", top: 20, left: -39, padding: "3px 7px", borderRadius: 999, background: C.primary, color: "#fff", fontSize: 9, fontFamily: C.fontMono, fontWeight: 900, whiteSpace: "nowrap" }}>{formatTimelineTime(currentTimeMs).slice(0, 5)}</div>
                        </div>

                        <TimelineTrack hidden={!isLayerVisible("captions")}>
                            {isLayerVisible("captions") && subtitleTrack.map((c: any) => <div key={getCueId(c)} data-clip="true"><DraggableClip id={getCueId(c)} startMs={c.start_ms} endMs={c.end_ms} colorVar={C.primaryDark} pxPerMs={pxPerMs} label={c.text} onUpdate={updateCue} onDelete={removeCue} onSelect={(id: string) => selectTimelineClip(id, "caption")} isSelected={selectedClip?.id === getCueId(c)} durationMs={durationMs} movable trimmable /></div>)}
                        </TimelineTrack>
                        <TimelineTrack
                            hidden={!isLayerVisible("broll")}
                            isDropTarget={dropTrack === "broll"}
                            onDragOver={(e) => handleTrackDragOver("broll", e)}
                            onDragEnter={(e) => handleTrackDragOver("broll", e)}
                            onDragLeave={(e) => handleTrackDragLeave("broll", e)}
                            onDrop={(e) => handleTrackDrop("broll", e)}
                        >
                            {isLayerVisible("broll") && brollTrack.map((c: any) => <div key={c.pexels_id} data-clip="true"><DraggableClip id={c.pexels_id} startMs={c.start_ms} endMs={c.end_ms} colorVar={C.accent} pxPerMs={pxPerMs} label={c.cue_text || "B-Roll"} onUpdate={updateBroll} onDelete={removeBroll} onSelect={(id: string) => selectTimelineClip(id, "broll")} isSelected={selectedClip?.id === String(c.pexels_id)} durationMs={durationMs} movable trimmable /></div>)}
                        </TimelineTrack>
                        <TimelineTrack
                            hidden={!isLayerVisible("motion")}
                            isDropTarget={dropTrack === "motion"}
                            onDragOver={(e) => handleTrackDragOver("motion", e)}
                            onDragEnter={(e) => handleTrackDragOver("motion", e)}
                            onDragLeave={(e) => handleTrackDragLeave("motion", e)}
                            onDrop={(e) => handleTrackDrop("motion", e)}
                        >
                            {isLayerVisible("motion") && motionGraphicsTrack.map((c: any) => <div key={c.clip_id} data-clip="true"><DraggableClip id={c.clip_id} startMs={c.start_ms} endMs={c.end_ms} colorVar={C.primary} pxPerMs={pxPerMs} label={c.text || "Motion"} onUpdate={updateMotionGraphic} onDelete={removeMotionGraphic} onSelect={(id: string) => selectTimelineClip(id, "motion")} isSelected={selectedClip?.id === String(c.clip_id)} durationMs={durationMs} movable trimmable /></div>)}
                        </TimelineTrack>
                        <TimelineTrack hidden={!isLayerVisible("raw")}>
                            {isLayerVisible("raw") && durationMs > 0 && (
                                <div data-clip="true">
                                    <DraggableClip
                                        id="raw-source"
                                        startMs={rawClipRange.start_ms}
                                        endMs={rawClipRange.end_ms}
                                        colorVar={C.gray700}
                                        pxPerMs={pxPerMs}
                                        label="Raw Clip"
                                        onUpdate={updateRawClip}
                                        onSelect={(id: string) => selectTimelineClip(id, "raw")}
                                        isSelected={rawClipSelected}
                                        durationMs={durationMs}
                                        movable={false}
                                        trimmable={rawClipSelected}
                                    />
                                </div>
                            )}
                        </TimelineTrack>
                        <TimelineTrack
                            hidden={!isLayerVisible("music")}
                            isDropTarget={dropTrack === "music"}
                            onDragOver={(e) => handleTrackDragOver("music", e)}
                            onDragEnter={(e) => handleTrackDragOver("music", e)}
                            onDragLeave={(e) => handleTrackDragLeave("music", e)}
                            onDrop={(e) => handleTrackDrop("music", e)}
                        >
                            {isLayerVisible("music") && musicTrack && <div data-clip="true"><DraggableClip id={musicTrack.id || "music"} startMs={musicTrack.start_ms} endMs={musicTrack.start_ms + musicTrack.duration * 1000} colorVar={C.success} pxPerMs={pxPerMs} label={musicTrack.name || "Music"} onUpdate={(_: any, patch: any) => updateMusic({ start_ms: patch.start_ms })} onDelete={() => setMusicTrack(null)} onSelect={(id: string) => selectTimelineClip(id, "music")} isSelected={selectedClip?.id === (musicTrack.id || "music")} durationMs={durationMs} movable trimmable={false} /></div>}
                        </TimelineTrack>
                        <TimelineTrack
                            hidden={!isLayerVisible("sfx")}
                            isDropTarget={dropTrack === "sfx"}
                            onDragOver={(e) => handleTrackDragOver("sfx", e)}
                            onDragEnter={(e) => handleTrackDragOver("sfx", e)}
                            onDragLeave={(e) => handleTrackDragLeave("sfx", e)}
                            onDrop={(e) => handleTrackDrop("sfx", e)}
                        >
                            {isLayerVisible("sfx") && sfxTrack.map((c: any) => <div key={c.id} data-clip="true"><DraggableClip id={c.id} startMs={c.start_ms} endMs={c.start_ms + c.duration * 1000} colorVar={C.warning} pxPerMs={pxPerMs} label={c.name || "SFX"} onUpdate={(id: any, patch: any) => updateSFX(id, { start_ms: patch.start_ms })} onDelete={removeSFX} onSelect={(id: string) => selectTimelineClip(id, "sfx")} isSelected={selectedClip?.id === c.id} durationMs={durationMs} movable trimmable={false} /></div>)}
                        </TimelineTrack>
                        <TimelineTrack hidden={!isLayerVisible("transitions")}>
                            {isLayerVisible("transitions") && transitions.map((c: any) => <div key={c.clip_id} data-clip="true"><DraggableClip id={c.clip_id} startMs={c.offset_ms} endMs={c.offset_ms + (c.duration_s || 1) * 1000} colorVar={C.accent} pxPerMs={pxPerMs} label={c.type || "Transition"} onSelect={(id: string) => selectTimelineClip(id, "transition")} isSelected={selectedClip?.id === c.clip_id} durationMs={durationMs} movable={false} trimmable={false} /></div>)}
                        </TimelineTrack>
                        <TimelineTrack hidden={!isLayerVisible("cuts")}>
                            {isLayerVisible("cuts") && gapCuts.map((g: any, i: number) => <div key={i} data-clip="true"><DraggableClip id={`gap-${i}`} startMs={g.start_ms} endMs={g.end_ms} colorVar={C.danger} pxPerMs={pxPerMs} label="Silence" onSelect={(id: string) => selectTimelineClip(id, "cut")} isSelected={selectedClip?.id === `gap-${i}`} durationMs={durationMs} movable={false} trimmable={false} /></div>)}
                        </TimelineTrack>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Small shared components ───────────────────────────────────────────────
function RS({ label, children }: { label: string; children: React.ReactNode }) { return <div style={{ marginBottom: 10 }}><p style={{ fontSize: 10, fontWeight: 700, color: UI.textMuted, letterSpacing: "0.08em", marginBottom: 7, textTransform: "uppercase" }}>{label}</p>{children}</div>; }
function RDiv() { return <div style={{ height: 1, background: UI.borderStrong, margin: "8px 0" }} />; }
type RSliderProps = {
    label: string;
    min: number;
    max: number;
    step?: number;
    value: number;
    onChange: (value: number) => void;
    unit?: string;
};

function RSlider({ label, min, max, step = 1, value, onChange, unit = "" }: RSliderProps) {
    const resolved = Number.isFinite(value) ? Number(value) : min;
    const val = Math.max(min, Math.min(max, resolved));
    const decimals = step < 1 ? String(step).split(".")[1]?.length ?? 1 : 0;
    const displayValue = decimals > 0 ? Number(val).toFixed(decimals) : String(Math.round(val));

    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 8 }}>
                <span style={{ fontSize: 11, color: UI.textBase, fontWeight: 850 }}>{label}</span>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <input
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        value={displayValue}
                        onChange={(e) => {
                            const next = Number(e.target.value);
                            if (!Number.isFinite(next)) return;
                            onChange(Math.max(min, Math.min(max, next)));
                        }}
                        style={{ width: 60, padding: "4px 6px", borderRadius: 9, border: `1px solid ${UI.borderStrong}`, background: UI.appBg, color: UI.textStrong, fontSize: 10, fontFamily: C.fontMono, textAlign: "right", fontWeight: 850 }}
                    />
                    <span style={{ fontSize: 10, fontWeight: 700, color: UI.textMuted, minWidth: 16 }}>{unit}</span>
                </div>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={val}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: C.primary, cursor: "pointer" }}
            />
        </div>
    );
}
function TBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
    return <button onClick={onClick} aria-label={label} style={{ ...btnBase, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: UI.textBase, background: UI.appBgElev, border: `1px solid ${UI.borderSoft}`, borderRadius: 11, cursor: "pointer" }}>{children}</button>;
}
function Spinner({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite" }}><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>; }
function Diamond({ color, size = 12 }: { color: string; size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M12 2L2 12l10 10L22 12z" /></svg>; }
function ChevronRight() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>; }
function VideoIcon({ color }: { color: string }) { return <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="3" /><polygon points="10 8 16 12 10 16" /></svg>; }
function TrashIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>; }
function SplitIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v18" /><path d="M16 3v18" /><path d="M3 12h5" /><path d="M16 12h5" /></svg>; }

// ── CaptionCard Component ─────────────────────────────────────────────────
function CaptionCard({ cue, isSelected, onSelect, onUpdate, onSplit, onDelete, durationMs }: any) {
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [startMsStr, setStartMsStr] = useState(Math.round(cue.start_ms).toString());
    const [endMsStr, setEndMsStr] = useState(Math.round(cue.end_ms).toString());
    const cueId = getCueId(cue);

    // Keep local inputs synced if the cue changes from outside
    useEffect(() => {
        setStartMsStr(Math.round(cue.start_ms).toString());
        setEndMsStr(Math.round(cue.end_ms).toString());
    }, [cueId, cue.start_ms, cue.end_ms]);

    // Save text when blurring or pressing enter
    const handleSaveText = () => {
        if (!inputRef.current) return;
        const newText = inputRef.current.value.trim();
        if (newText !== cue.text) onUpdate(cueId, { text: newText });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            // Automatically split at the cursor on Enter
            if (inputRef.current) {
                const pos = inputRef.current.selectionStart;
                if (pos > 0 && pos < (cue.text?.length ?? 0)) {
                    onSplit(cueId, pos);
                    return;
                }
            }
            inputRef.current?.blur();
        }
    };

    // Splitting via button (same logic as Enter)
    const handleSplit = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!inputRef.current) return;
        const pos = inputRef.current.selectionStart;
        if (pos > 0 && pos < (cue.text?.length ?? 0)) {
            onSplit(cueId, pos);
        } else {
            alert("Please place the cursor in the middle of the text to split.");
        }
    };

    const handleTrimBlur = () => {
        const s = Number(startMsStr);
        const e = Number(endMsStr);
        if (!isNaN(s) && !isNaN(e)) {
            if (s !== Math.round(cue.start_ms) || e !== Math.round(cue.end_ms)) {
                onUpdate(cueId, { start_ms: s, end_ms: e });
            }
        }
    };

    const handleTrimKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleTrimBlur();
    };

    // Converting ms to percentage ranges
    const startPct = durationMs ? (cue.start_ms / durationMs) * 100 : 0;
    const endPct = durationMs ? (cue.end_ms / durationMs) * 100 : 0;
    const widthPct = Math.max(0.5, endPct - startPct);

    return (
        <div
            onClick={onSelect}
            style={{
                padding: "10px 14px",
                cursor: "pointer",
                background: isSelected ? C.surfaceElev : "transparent",
                borderBottom: `1px solid ${C.gray100}`,
                transition: "background 0.1s",
                position: "relative"
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: isSelected ? C.primary : C.gray400, fontFamily: C.fontMono }}>
                    {fmt(Math.floor(cue.start_ms / 1000))} → {fmt(Math.floor(cue.end_ms / 1000))}
                </span>

                {/* Tools: Split and Delete (Visible only when selected) */}
                {isSelected && (
                    <div style={{ display: "flex", gap: 6 }}>
                        <button
                            onClick={handleSplit}
                            title="Split at cursor"
                            style={{ ...btnBase, color: C.gray600, background: C.surfaceSec, borderRadius: 4, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                            <SplitIcon />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(cueId); }}
                            title="Delete cue"
                            style={{ ...btnBase, color: C.danger, background: C.dangerLight, borderRadius: 4, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                            <TrashIcon />
                        </button>
                    </div>
                )}
            </div>

            {isSelected ? (
                <textarea
                    ref={inputRef}
                    defaultValue={cue.text}
                    onBlur={handleSaveText}
                    onKeyDown={handleKeyDown}
                    onClick={e => e.stopPropagation()}
                    style={{
                        width: "100%", padding: "6px 8px", fontSize: 11, lineHeight: 1.5,
                        color: C.gray900, background: C.surface, borderRadius: 6, border: `1px solid ${C.primary}`,
                        resize: "none", outline: "none", display: "block"
                    }}
                    rows={Math.max(1, Math.ceil((cue.text?.length ?? 0) / 30))}
                />
            ) : (
                <p style={{ fontSize: 11, lineHeight: 1.5, color: C.gray700, margin: 0 }}>
                    {cue.text}
                </p>
            )}

            {/* Time Editor Slider Block */}
            {isSelected && (
                <div style={{ marginTop: 10, background: C.gray100, borderRadius: 6, padding: "8px 10px" }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 9, color: C.gray500, fontWeight: 600 }}>
                        <span>Trim Timing</span>
                        <span>{((cue.end_ms - cue.start_ms) / 1000).toFixed(1)}s</span>
                    </div>
                    {/* Visual mini-track */}
                    <div style={{ height: 16, background: C.gray300, borderRadius: 4, position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", left: `${startPct}%`, width: `${widthPct}%`, height: "100%", background: C.primaryLight, borderLeft: `2px solid ${C.primary}`, borderRight: `2px solid ${C.primary}` }} />
                    </div>
                    {/* Raw MS Inputs for precision */}
                    <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                        <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 9, color: C.gray500, display: "block", marginBottom: 2 }}>Start MS</span>
                            <input
                                type="number"
                                value={startMsStr}
                                onChange={(e) => setStartMsStr(e.target.value)}
                                onBlur={handleTrimBlur}
                                onKeyDown={handleTrimKeyDown}
                                style={{ width: "100%", padding: "4px 6px", fontSize: 10, borderRadius: 4, border: `1px solid ${C.gray300}` }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 9, color: C.gray500, display: "block", marginBottom: 2 }}>End MS</span>
                            <input
                                type="number"
                                value={endMsStr}
                                onChange={(e) => setEndMsStr(e.target.value)}
                                onBlur={handleTrimBlur}
                                onKeyDown={handleTrimKeyDown}
                                style={{ width: "100%", padding: "4px 6px", fontSize: 10, borderRadius: 4, border: `1px solid ${C.gray300}` }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

void CaptionCard;
