import { useState, useEffect, useRef, useCallback } from 'react';
import {
    ArrowLeft, Play, Pause, Volume2, VolumeX, Download, Check, X,
    UploadCloud, Loader2, FileVideo2, Plus, Sparkles,
    AlignCenter, AlignLeft, AlignRight,
    Wand2, Move, Pencil, Scissors, Trash2, Undo2, ZoomIn,
    Maximize2, SkipBack, SkipForward, ChevronDown, Layers,
    Type, Sliders, Film, Save, RotateCcw, Eye, EyeOff,
    Bold, Italic, Underline, Lock, Unlock
} from 'lucide-react';
import { projectsApi, mediaApi, transcriptionApi, subtitlesApi, exportApi } from '@/lib/api';
import type { Project, SubtitleCue } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type View = 'listing' | 'editor';
type EditorTab = 'caption' | 'template';
type StylePanelTab = 'typography' | 'effects' | 'animation' | 'layout';
type AspectRatio = 'original' | '16:9' | '9:16' | '1:1' | '4:5';

interface ShadowConfig {
    x: number;
    y: number;
    blur: number;
    color: string;
    opacity: number;
}

interface BackgroundConfig {
    enabled: boolean;
    color: string;
    opacity: number;
    borderRadius: number;
    paddingX: number;
    paddingY: number;
}

interface CaptionConfig {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    italic: boolean;
    underline: boolean;
    letterSpacing: number;
    lineHeight: number;
    color: string;
    strokeColor: string;
    strokeWidth: number;
    position: 'top' | 'center' | 'bottom';
    positionY: number; // fine-grained 0-100%
    align: 'left' | 'center' | 'right';
    maxWidth: number; // % of canvas width
    animation: string;
    animationSpeed: 'slow' | 'normal' | 'fast';
    effect: string;
    shadow: ShadowConfig;
    background: BackgroundConfig;
    textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
    highlightColor: string; // karaoke active word
    glowColor: string;
    glowSpread: number;
}

const DEFAULT_CONFIG: CaptionConfig = {
    fontFamily: 'Outfit',
    fontSize: 28,
    fontWeight: 800,
    italic: false,
    underline: false,
    letterSpacing: 0,
    lineHeight: 1.3,
    color: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 2,
    position: 'bottom',
    positionY: 85,
    align: 'center',
    maxWidth: 85,
    animation: 'pop',
    animationSpeed: 'normal',
    effect: 'stroke',
    shadow: { x: 2, y: 2, blur: 8, color: '#000000', opacity: 0.6 },
    background: { enabled: false, color: '#000000', opacity: 0.7, borderRadius: 8, paddingX: 16, paddingY: 6 },
    textTransform: 'none',
    highlightColor: '#FACC15',
    glowColor: '#00FF88',
    glowSpread: 10,
};

const ANIMATION_OPTIONS = [
    { id: 'pop', name: 'Pop', icon: '💥' },
    { id: 'fade', name: 'Fade', icon: '🌫️' },
    { id: 'slide', name: 'Slide Up', icon: '⬆️' },
    { id: 'typewriter', name: 'Typewriter', icon: '⌨️' },
    { id: 'bounce', name: 'Bounce', icon: '🏀' },
    { id: 'elastic', name: 'Elastic', icon: '🎯' },
    { id: 'glitch', name: 'Glitch', icon: '⚡' },
    { id: 'zoom', name: 'Zoom In', icon: '🔍' },
    { id: 'flip', name: 'Flip', icon: '🔄' },
    { id: 'none', name: 'None', icon: '—' },
];

const EFFECT_OPTIONS = [
    { id: 'stroke', name: 'Stroke', icon: '✏️' },
    { id: 'shadow', name: 'Drop Shadow', icon: '🌑' },
    { id: 'bg-box', name: 'Background Box', icon: '📦' },
    { id: 'bg-pill', name: 'Pill Label', icon: '💊' },
    { id: 'neon', name: 'Neon Glow', icon: '💡' },
    { id: 'gradient', name: 'Gradient Fill', icon: '🌈' },
    { id: 'cc-light-sweep', name: 'Light Sweep', icon: '✨' },
    { id: 'emboss', name: 'Emboss', icon: '🔲' },
    { id: 'outline-only', name: 'Outline Only', icon: '⬜' },
    { id: 'none', name: 'None', icon: '∅' },
];

const COLOR_PRESETS = ['#FFFFFF', '#FACC15', '#22D3EE', '#F472B6', '#A78BFA', '#34D399', '#FB923C', '#EF4444', '#000000'];
const STROKE_PRESETS = ['#000000', '#1a1a1a', '#FFFFFF', '#FACC15', '#22D3EE', '#EF4444', '#A78BFA'];

const FONT_OPTIONS = [
    'Outfit', 'Poppins', 'Montserrat', 'Bebas Neue', 'Oswald',
    'Playfair Display', 'Righteous', 'Bangers', 'Teko',
    'Inter', 'Roboto', 'DM Sans', 'Nunito', 'Lexend',
];

const TEMPLATES = [
    {
        id: 'bold-pop', name: 'Bold Pop', emoji: '🔥', preview: 'WHITE + BLACK STROKE',
        config: { ...DEFAULT_CONFIG, fontSize: 32, fontWeight: 900, effect: 'stroke', animation: 'pop', strokeWidth: 3 }
    },
    {
        id: 'neon-glow', name: 'Neon Glow', emoji: '💚', preview: '#00FF88 GLOW',
        config: { ...DEFAULT_CONFIG, fontSize: 28, fontWeight: 800, color: '#00FF88', strokeColor: '#003300', strokeWidth: 0, effect: 'neon', animation: 'fade', glowColor: '#00FF88', glowSpread: 15 }
    },
    {
        id: 'gradient', name: 'Gradient', emoji: '💜', preview: 'PURPLE GRADIENT',
        config: { ...DEFAULT_CONFIG, fontSize: 30, fontWeight: 900, effect: 'gradient', animation: 'slide', strokeWidth: 0 }
    },
    {
        id: 'tiktok', name: 'TikTok', emoji: '🎵', preview: 'YELLOW ON BLACK',
        config: { ...DEFAULT_CONFIG, fontSize: 28, fontWeight: 800, color: '#FACC15', strokeColor: '#000000', strokeWidth: 2, effect: 'stroke', animation: 'pop', textTransform: 'uppercase' }
    },
    {
        id: 'minimal', name: 'Minimal', emoji: '✨', preview: 'LIGHT + SHADOW',
        config: { ...DEFAULT_CONFIG, fontSize: 22, fontWeight: 500, effect: 'shadow', animation: 'fade', strokeWidth: 0 }
    },
    {
        id: 'pill-dark', name: 'Dark Pill', emoji: '🌑', preview: 'WHITE ON DARK BG',
        config: {
            ...DEFAULT_CONFIG, fontSize: 20, fontWeight: 600, color: '#FFFFFF', effect: 'bg-pill', strokeWidth: 0, animation: 'fade',
            background: { enabled: true, color: '#000000', opacity: 0.8, borderRadius: 99, paddingX: 20, paddingY: 8 }
        }
    },
    {
        id: 'karaoke', name: 'Karaoke', emoji: '🎤', preview: 'WORD HIGHLIGHT',
        config: { ...DEFAULT_CONFIG, fontSize: 28, fontWeight: 800, color: '#FFFFFF', highlightColor: '#FACC15', effect: 'stroke', animation: 'pop' }
    },
    {
        id: 'cinema', name: 'Cinema', emoji: '🎬', preview: 'CLASSIC SUBTITLE',
        config: { ...DEFAULT_CONFIG, fontSize: 20, fontWeight: 400, color: '#FFFFFF', strokeWidth: 1, strokeColor: '#000000', effect: 'shadow', animation: 'fade', position: 'bottom', positionY: 90 }
    },
    {
        id: 'retro', name: 'Retro', emoji: '📺', preview: 'BOLD + GLOW',
        config: { ...DEFAULT_CONFIG, fontFamily: 'Bebas Neue', fontSize: 40, fontWeight: 400, color: '#FFD700', effect: 'neon', animation: 'bounce', strokeWidth: 0, glowColor: '#FFD700', glowSpread: 20, textTransform: 'uppercase' }
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
    if (!ms || isNaN(ms)) return '0:00';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

function formatTimeFull(ms: number): string {
    if (!ms || isNaN(ms)) return '00:00:00';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
        ? `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
        : `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

function formatTimecode(ms: number): string {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const msR = ms % 1000;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')},${msR.toString().padStart(3, '0')}`;
}

// ─── Caption Style Engine ─────────────────────────────────────────────────────

function getStrokeStyle(config: CaptionConfig): React.CSSProperties {
    const base: React.CSSProperties = {
        fontFamily: `'${config.fontFamily}', sans-serif`,
        fontSize: `${config.fontSize}px`,
        fontWeight: config.fontWeight,
        fontStyle: config.italic ? 'italic' : 'normal',
        textAlign: config.align,
        lineHeight: config.lineHeight,
        letterSpacing: `${config.letterSpacing}px`,
        textTransform: config.textTransform,
        WebkitTextStroke: `${config.strokeWidth}px ${config.strokeColor}`,
        color: 'transparent',
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        zIndex: 0,
    };

    switch (config.effect) {
        case 'shadow':
            base.WebkitTextStroke = '0px transparent';
            base.filter = `drop-shadow(${config.shadow.x}px ${config.shadow.y}px ${config.shadow.blur}px ${config.shadow.color}${Math.round(config.shadow.opacity * 255).toString(16).padStart(2, '0')})`;
            break;
        case 'neon':
            base.WebkitTextStroke = '0px transparent';
            base.filter = `drop-shadow(0 0 ${config.glowSpread * 0.5}px ${config.glowColor}) drop-shadow(0 0 ${config.glowSpread}px ${config.glowColor}) drop-shadow(0 0 ${config.glowSpread * 2}px ${config.glowColor})`;
            break;
        case 'gradient':
            base.WebkitTextStroke = '0px transparent';
            base.filter = `drop-shadow(0 2px 12px rgba(102,126,234,0.4))`;
            break;
        case 'emboss':
            base.WebkitTextStroke = '0px transparent';
            base.filter = `drop-shadow(1px 1px 0px rgba(255,255,255,0.5)) drop-shadow(-1px -1px 0px rgba(0,0,0,0.5))`;
            break;
        case 'outline-only':
            base.color = 'transparent';
            break;
    }
    return base;
}

function getFillStyle(config: CaptionConfig): React.CSSProperties {
    const base: React.CSSProperties = {
        fontFamily: `'${config.fontFamily}', sans-serif`,
        fontSize: `${config.fontSize}px`,
        fontWeight: config.fontWeight,
        fontStyle: config.italic ? 'italic' : 'normal',
        textDecoration: config.underline ? 'underline' : 'none',
        textAlign: config.align,
        lineHeight: config.lineHeight,
        letterSpacing: `${config.letterSpacing}px`,
        textTransform: config.textTransform,
        color: config.color,
        position: 'relative',
        zIndex: 10,
    };

    switch (config.effect) {
        case 'bg-box':
            base.backgroundColor = `${config.background.color}${Math.round(config.background.opacity * 255).toString(16).padStart(2, '0')}`;
            base.padding = `${config.background.paddingY}px ${config.background.paddingX}px`;
            base.borderRadius = `${config.background.borderRadius}px`;
            break;
        case 'bg-pill':
            base.backgroundColor = `${config.background.color}${Math.round(config.background.opacity * 255).toString(16).padStart(2, '0')}`;
            base.padding = `${config.background.paddingY}px ${config.background.paddingX}px`;
            base.borderRadius = '9999px';
            break;
        case 'gradient':
            base.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 40%, #f093fb 100%)';
            base.WebkitBackgroundClip = 'text';
            base.WebkitTextFillColor = 'transparent';
            break;
        case 'cc-light-sweep':
            base.background = `linear-gradient(90deg, ${config.strokeColor} 30%, rgba(255,255,255,0.9) 50%, ${config.strokeColor} 70%)`;
            base.backgroundSize = '200% 100%';
            base.WebkitBackgroundClip = 'text';
            base.WebkitTextFillColor = 'transparent';
            base.animation = 'vcLightSweep 2s linear infinite';
            break;
        case 'neon':
            base.color = config.glowColor;
            break;
    }
    return base;
}

function getAnimationClass(animation: string, speed: string): string {
    const speedSuffix = speed === 'slow' ? '-slow' : speed === 'fast' ? '-fast' : '';
    const base: Record<string, string> = {
        pop: 'vc-anim-pop',
        fade: 'vc-anim-fade',
        slide: 'vc-anim-slide',
        bounce: 'vc-anim-bounce',
        elastic: 'vc-anim-elastic',
        typewriter: 'vc-anim-fade',
        glitch: 'vc-anim-glitch',
        zoom: 'vc-anim-zoom',
        flip: 'vc-anim-flip',
    };
    const cls = base[animation];
    return cls ? `${cls}${speedSuffix}` : '';
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SliderRow({
    label, min, max, step = 1, value, onChange, unit = 'px', suffix
}: {
    label: string; min: number; max: number; step?: number;
    value: number; onChange: (v: number) => void; unit?: string; suffix?: string;
}) {
    return (
        <div>
            <div className="flex justify-between items-center mb-1.5">
                <label className="text-[11px] font-medium text-[var(--color-gray-600)]">{label}</label>
                <span className="text-[10px] text-[var(--color-gray-400)] font-mono tabular-nums">
                    {value}{suffix ?? unit}
                </span>
            </div>
            <div className="flex items-center gap-2.5">
                <input type="range" min={min} max={max} step={step} value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className="flex-1 h-[3px] rounded-full appearance-none cursor-pointer accent-[var(--color-primary)]"
                    style={{ background: `linear-gradient(to right, var(--color-primary) ${((value - min) / (max - min)) * 100}%, var(--color-gray-200) 0%)` }}
                />
                <input type="number" min={min} max={max} step={step} value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                    className="w-11 bg-[var(--color-gray-50)] border border-[var(--color-gray-200)] rounded-md px-1.5 py-1 text-[11px] text-center text-[var(--color-gray-900)] focus:outline-none focus:border-[var(--color-primary)] font-mono"
                />
            </div>
        </div>
    );
}

function ColorRow({ label, value, presets, onChange }: {
    label: string; value: string; presets: string[]; onChange: (v: string) => void;
}) {
    return (
        <div>
            <label className="text-[11px] font-medium text-[var(--color-gray-600)] mb-1.5 block">{label}</label>
            <div className="flex items-center gap-2.5">
                <label className="w-8 h-8 rounded-lg border border-[var(--color-gray-300)] cursor-pointer shrink-0 overflow-hidden shadow-inner relative"
                    style={{ backgroundColor: value }}>
                    <input type="color" value={value.slice(0, 7)} onChange={(e) => onChange(e.target.value)}
                        className="absolute -top-4 -left-4 w-16 h-16 cursor-pointer opacity-0" />
                </label>
                <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
                    className="w-20 bg-[var(--color-gray-50)] border border-[var(--color-gray-200)] rounded-md px-2 py-1.5 text-[11px] font-mono text-[var(--color-gray-900)] focus:outline-none focus:border-[var(--color-primary)] uppercase" />
                <div className="flex gap-1.5 flex-wrap">
                    {presets.map(c => (
                        <button key={c} onClick={() => onChange(c)} title={c}
                            className={`w-5 h-5 rounded-full transition-all hover:scale-110 shrink-0 ${value === c ? 'ring-2 ring-offset-1 ring-[var(--color-primary)] scale-110' : 'ring-1 ring-black/10'}`}
                            style={{ backgroundColor: c }} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function SectionHeader({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-2 py-1">
            <span className="text-[10px] font-bold text-[var(--color-gray-400)] uppercase tracking-[0.12em]">{label}</span>
            <div className="flex-1 h-px bg-[var(--color-gray-100)]" />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function VideoCaptionPage() {
    useAuth();

    const [view, setView] = useState<View>('listing');

    // ── Listing ────────────────────────────────────────────────────────
    const [projects, setProjects] = useState<Project[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [showUpload, setShowUpload] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [processingStatus, setProcessingStatus] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Editor ─────────────────────────────────────────────────────────
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [editorTab, setEditorTab] = useState<EditorTab>('caption');
    const [stylePanelTab, setStylePanelTab] = useState<StylePanelTab>('typography');
    const [cues, setCues] = useState<SubtitleCue[]>([]);
    const [captionConfig, setCaptionConfig] = useState<CaptionConfig>({ ...DEFAULT_CONFIG });
    const [editingCueId, setEditingCueId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
    const [previewCaptionOnly, setPreviewCaptionOnly] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);

    // ── Aspect Ratio ───────────────────────────────────────────────────
    const [canvasRatio, setCanvasRatio] = useState<AspectRatio>('original');

    // ── Video ──────────────────────────────────────────────────────────
    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoUrl, setVideoUrl] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);
    const [hoveredCueId, setHoveredCueId] = useState<string | null>(null);

    // ── Timeline ───────────────────────────────────────────────────────
    const timelineRef = useRef<HTMLDivElement>(null);  // the scrollable track area
    const trackContentRef = useRef<HTMLDivElement>(null); // the zoomed inner content
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [selectedCueId, setSelectedCueId] = useState<string | null>(null);
    // Drag / resize state (stored in refs to avoid stale closures in pointer handlers)
    const dragRef = useRef<{ cueId: string; type: 'move' | 'resize-left' | 'resize-right'; startX: number; origStart: number; origEnd: number } | null>(null);

    // ─── Load Projects ─────────────────────────────────────────────────
    useEffect(() => { loadProjects(); }, []);

    const loadProjects = async () => {
        setLoadingProjects(true);
        try {
            const res = await projectsApi.list();
            setProjects(res.data.filter((p: Project) => p.type === 'caption'));
        } catch { /* ignore */ }
        setLoadingProjects(false);
    };

    // ─── Open Project ──────────────────────────────────────────────────
    const openProject = async (project: Project) => {
        setActiveProject(project);
        setView('editor');
        setCues([]); setCurrentTime(0); setDuration(0);
        setActiveCue(null); setIsPlaying(false);

        try {
            const blobUrl = await mediaApi.getAuthenticatedStreamUrl(project.id);
            setVideoUrl(blobUrl);
        } catch { setVideoUrl(''); }

        try {
            const subsRes = await subtitlesApi.get(project.id);
            const tracks = subsRes.data.tracks || [];
            const original = tracks.find((t: any) => t.is_original) || tracks[0];
            if (original?.cues?.length) setCues(original.cues);
        } catch { /* no subs yet */ }
    };

    // ─── Upload ────────────────────────────────────────────────────────
    const handleUpload = async () => {
        if (!selectedFile) return;
        setIsUploading(true); setUploadProgress(0);
        try {
            setProcessingStatus('Creating project...');
            const name = selectedFile.name.split('.')[0];
            const projRes = await projectsApi.create(name, 'caption');
            const pid = projRes.data.id;

            setProcessingStatus('Uploading video...');
            await mediaApi.upload(pid, selectedFile, (e) => {
                setUploadProgress(e.total ? Math.round((e.loaded * 100) / e.total) : 0);
            });

            setProcessingStatus('AI transcribing...');
            await transcriptionApi.start(pid);

            setProcessingStatus(''); setShowUpload(false);
            setSelectedFile(null); setUploadProgress(0);
            await loadProjects();
            const refreshed = await projectsApi.get(pid);
            openProject(refreshed.data);
        } catch (err: any) {
            setProcessingStatus(`Error: ${err.response?.data?.detail || err.message}`);
        } finally { setIsUploading(false); }
    };

    // ─── Transcribe ────────────────────────────────────────────────────
    const handleTranscribe = async () => {
        if (!activeProject) return;
        setIsTranscribing(true);
        try {
            await transcriptionApi.start(activeProject.id);
            const subsRes = await subtitlesApi.get(activeProject.id);
            const tracks = subsRes.data.tracks || [];
            const original = tracks.find((t: any) => t.is_original) || tracks[0];
            if (original?.cues?.length) setCues(original.cues);
        } catch { /* ignore */ }
        setIsTranscribing(false);
    };

    // ─── Video Player ──────────────────────────────────────────────────
    const togglePlay = useCallback(() => {
        if (!videoRef.current) return;
        isPlaying ? videoRef.current.pause() : videoRef.current.play();
        setIsPlaying(p => !p);
    }, [isPlaying]);

    const skipBy = (seconds: number) => {
        if (!videoRef.current) return;
        const newTime = Math.max(0, Math.min(duration / 1000, videoRef.current.currentTime + seconds));
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime * 1000);
    };

    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        const onTime = () => {
            const ms = v.currentTime * 1000;
            setCurrentTime(ms);
            setActiveCue(cues.find(c => ms >= c.start_ms && ms <= c.end_ms) || null);
        };
        const onMeta = () => setDuration(v.duration * 1000);
        const onEnd = () => setIsPlaying(false);
        v.addEventListener('timeupdate', onTime);
        v.addEventListener('loadedmetadata', onMeta);
        v.addEventListener('ended', onEnd);
        return () => {
            v.removeEventListener('timeupdate', onTime);
            v.removeEventListener('loadedmetadata', onMeta);
            v.removeEventListener('ended', onEnd);
        };
    }, [cues]);

    const seekTo = useCallback((ms: number) => {
        const clamped = Math.max(0, Math.min(duration, ms));
        if (videoRef.current) videoRef.current.currentTime = clamped / 1000;
        setCurrentTime(clamped);
    }, [duration]);

    // Volume sync
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    // ─── Timeline Scrubbing ────────────────────────────────────────────
    // Uses the scrollable track viewport + its scroll offset so math stays
    // correct under zoom and horizontal scrolling.
    const computeScrubPosition = useCallback((clientX: number) => {
        if (!duration || !timelineRef.current || !trackContentRef.current) return;
        const scrollEl = timelineRef.current;
        const contentEl = trackContentRef.current;
        const containerRect = scrollEl.getBoundingClientRect();
        const contentWidth = contentEl.offsetWidth;
        const relativeX = clientX - containerRect.left + scrollEl.scrollLeft;
        const pct = Math.max(0, Math.min(1, relativeX / contentWidth));
        seekTo(pct * duration);
    }, [duration, seekTo]);

    // ─── Cue Drag / Resize ────────────────────────────────────────────
    const onCuePointerDown = useCallback((
        e: React.PointerEvent<HTMLDivElement>,
        cue: SubtitleCue,
        type: 'move' | 'resize-left' | 'resize-right'
    ) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = {
            cueId: cue._id || '',
            type,
            startX: e.clientX,
            origStart: cue.start_ms,
            origEnd: cue.end_ms,
        };
    }, []);

    const onTimelinePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (isScrubbing) { computeScrubPosition(e.clientX); return; }
        if (!dragRef.current || !duration || !trackContentRef.current) return;
        const { cueId, type, startX, origStart, origEnd } = dragRef.current;
        const contentWidth = trackContentRef.current.offsetWidth;
        const deltaPct = (e.clientX - startX) / contentWidth;
        const deltaMs = deltaPct * duration;
        setCues(prev => prev.map(c => {
            if (c._id !== cueId) return c;
            if (type === 'move') {
                const dur = origEnd - origStart;
                const newStart = Math.max(0, Math.min(duration - dur, origStart + deltaMs));
                return { ...c, start_ms: Math.round(newStart), end_ms: Math.round(newStart + dur) };
            }
            if (type === 'resize-left') {
                const newStart = Math.max(0, Math.min(origEnd - 100, origStart + deltaMs));
                return { ...c, start_ms: Math.round(newStart) };
            }
            // resize-right
            const newEnd = Math.max(origStart + 100, Math.min(duration, origEnd + deltaMs));
            return { ...c, end_ms: Math.round(newEnd) };
        }));
    }, [isScrubbing, computeScrubPosition, duration]);

    const onTimelinePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        setIsScrubbing(false);
        dragRef.current = null;
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }, []);

    // ─── Keyboard Shortcuts ────────────────────────────────────────────
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (editingCueId !== null) return; // Don't intercept when editing
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            switch (e.code) {
                case 'Space': e.preventDefault(); togglePlay(); break;
                case 'ArrowLeft': e.preventDefault(); skipBy(-2); break;
                case 'ArrowRight': e.preventDefault(); skipBy(2); break;
                case 'KeyM': setIsMuted(m => !m); break;
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [togglePlay, editingCueId]);

    // ─── Cue Editing ───────────────────────────────────────────────────
    const startEdit = (cue: SubtitleCue) => { setEditingCueId(cue._id || null); setEditText(cue.text); };
    const cancelEdit = () => { setEditingCueId(null); setEditText(''); };
    const saveEdit = async (cue: SubtitleCue) => {
        try {
            if (cue._id && !cue._id.startsWith('split_'))
                await subtitlesApi.updateCue(cue._id, { text: editText });
            setCues(prev => prev.map(c => c._id === cue._id ? { ...c, text: editText } : c));
        } catch { /* ignore */ }
        cancelEdit();
    };

    const splitCueAtCursor = (cue: SubtitleCue) => {
        if (!textareaRef.current) return;
        const cursor = textareaRef.current.selectionStart;
        if (cursor === 0 || cursor === editText.length) return;
        const firstHalf = editText.substring(0, cursor).trim();
        const secondHalf = editText.substring(cursor).trim();
        if (!firstHalf || !secondHalf) return;
        const ratio = firstHalf.length / (firstHalf.length + secondHalf.length);
        const dur = cue.end_ms - cue.start_ms;
        const midTime = Math.round(cue.start_ms + dur * ratio);
        const newCue1: SubtitleCue = { ...cue, text: firstHalf, end_ms: midTime };
        const newCue2: SubtitleCue = { ...cue, _id: `split_${Date.now()}`, text: secondHalf, start_ms: midTime, sequence: cue.sequence + 0.5 };
        setCues(prev => [...prev.map(c => c._id === cue._id ? newCue1 : c), newCue2].sort((a, b) => a.start_ms - b.start_ms));
        cancelEdit();
    };

    const deleteCue = (cue: SubtitleCue) => {
        setCues(prev => prev.filter(c => c._id !== cue._id));
    };

    // ─── Auto-Save ─────────────────────────────────────────────────────
    useEffect(() => {
        if (!activeProject || cues.length === 0 || editingCueId !== null) return;
        setAutoSaveStatus('saving');
        const timer = setTimeout(async () => {
            try {
                await subtitlesApi.updateAllCues(activeProject.id, cues);
                setAutoSaveStatus('saved');
                setTimeout(() => setAutoSaveStatus('idle'), 2000);
            } catch {
                setAutoSaveStatus('idle');
            }
        }, 2500);
        return () => clearTimeout(timer);
    }, [cues, activeProject, editingCueId]);

    // ─── Exports ───────────────────────────────────────────────────────
    const handleExportSRT = () => {
        if (!cues.length) return;
        const sorted = [...cues].sort((a, b) => a.start_ms - b.start_ms);
        let srt = '';
        sorted.forEach((c, i) => {
            srt += `${i + 1}\n${formatTimecode(c.start_ms)} --> ${formatTimecode(c.end_ms)}\n${c.text}\n\n`;
        });
        const blob = new Blob([srt], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${activeProject?.name || 'captions'}.srt`;
        a.click();
    };

    const handleExportMP4 = async () => {
        if (!activeProject || !cues.length) return;
        setIsExporting(true);
        try {
            const cueData = cues.map(c => ({ text: c.text, start_ms: c.start_ms, end_ms: c.end_ms }));
            const styleData = {
                fontFamily: captionConfig.fontFamily,
                fontSize: captionConfig.fontSize,
                fontWeight: captionConfig.fontWeight,
                color: captionConfig.color,
                strokeColor: captionConfig.strokeColor,
                strokeWidth: captionConfig.strokeWidth,
                position: captionConfig.position,
                align: captionConfig.align,
            };
            const res = await exportApi.mp4(activeProject.id, cueData, styleData);
            const blob = new Blob([res.data], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${activeProject.name}_720p.mp4`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            alert(`Export failed: ${err.response?.data?.detail || err.message}`);
        } finally { setIsExporting(false); }
    };

    // ─── Fullscreen ────────────────────────────────────────────────────
    const toggleFullscreen = () => {
        if (!previewRef.current) return;
        if (!document.fullscreenElement) {
            previewRef.current.requestFullscreen().catch(() => { });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // ─── Config helper ─────────────────────────────────────────────────
    const updateConfig = <K extends keyof CaptionConfig>(key: K, value: CaptionConfig[K]) => {
        setCaptionConfig(c => ({ ...c, [key]: value }));
    };
    const updateShadow = <K extends keyof ShadowConfig>(key: K, value: ShadowConfig[K]) => {
        setCaptionConfig(c => ({ ...c, shadow: { ...c.shadow, [key]: value } }));
    };
    const updateBg = <K extends keyof BackgroundConfig>(key: K, value: BackgroundConfig[K]) => {
        setCaptionConfig(c => ({ ...c, background: { ...c.background, [key]: value } }));
    };

    // ─── Status Badge ──────────────────────────────────────────────────
    const StatusBadge = ({ status }: { status: string }) => {
        const map: Record<string, { bg: string; label: string }> = {
            ready: { bg: 'bg-emerald-500 text-white', label: 'Complete' },
            processing: { bg: 'bg-amber-400 text-amber-900', label: 'Processing' },
            error: { bg: 'bg-red-500 text-white', label: 'Failed' },
            created: { bg: 'bg-[var(--color-gray-400)] text-white', label: 'Pending' },
        };
        const s = map[status] || map.created;
        return (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${s.bg}`}>
                {s.label}
            </span>
        );
    };

    const sortedCues = [...cues].sort((a, b) => a.start_ms - b.start_ms);
    const progressPct = duration ? (currentTime / duration) * 100 : 0;

    const getCanvasClasses = () => {
        switch (canvasRatio) {
            case '16:9': return 'aspect-[16/9] w-full max-h-full';
            case '9:16': return 'aspect-[9/16] h-full max-w-full';
            case '1:1': return 'aspect-square max-h-full';
            case '4:5': return 'aspect-[4/5] max-h-full';
            default: return 'max-w-full max-h-full';
        }
    };

    const captionPositionStyle: React.CSSProperties = captionConfig.position === 'top'
        ? { top: '5%' }
        : captionConfig.position === 'center'
            ? { top: '50%', transform: 'translateY(-50%)' }
            : { bottom: '5%' };

    // ════════════════════════════════════════════════════════════════════
    // CSS Animations
    // ════════════════════════════════════════════════════════════════════
    const animStyles = (
        <style>{`
            /* ── Base animations ── */
            .vc-anim-pop       { animation: vcPop 0.3s cubic-bezier(0.175,0.885,0.32,1.275) both; }
            .vc-anim-fade      { animation: vcFade 0.4s ease-out both; }
            .vc-anim-slide     { animation: vcSlide 0.35s ease-out both; }
            .vc-anim-bounce    { animation: vcBounce 0.5s ease both; }
            .vc-anim-elastic   { animation: vcElastic 0.8s cubic-bezier(0.25,1,0.5,1) both; }
            .vc-anim-glitch    { animation: vcGlitch 0.4s steps(2) both; }
            .vc-anim-zoom      { animation: vcZoom 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }
            .vc-anim-flip      { animation: vcFlip 0.4s ease-out both; }

            /* ── Speed variants ── */
            .vc-anim-pop-slow      { animation: vcPop 0.6s cubic-bezier(0.175,0.885,0.32,1.275) both; }
            .vc-anim-pop-fast      { animation: vcPop 0.15s cubic-bezier(0.175,0.885,0.32,1.275) both; }
            .vc-anim-fade-slow     { animation: vcFade 0.8s ease-out both; }
            .vc-anim-fade-fast     { animation: vcFade 0.15s ease-out both; }
            .vc-anim-slide-slow    { animation: vcSlide 0.7s ease-out both; }
            .vc-anim-slide-fast    { animation: vcSlide 0.15s ease-out both; }
            .vc-anim-bounce-slow   { animation: vcBounce 1s ease both; }
            .vc-anim-bounce-fast   { animation: vcBounce 0.25s ease both; }
            .vc-anim-elastic-slow  { animation: vcElastic 1.2s cubic-bezier(0.25,1,0.5,1) both; }
            .vc-anim-elastic-fast  { animation: vcElastic 0.4s cubic-bezier(0.25,1,0.5,1) both; }
            .vc-anim-glitch-slow   { animation: vcGlitch 0.7s steps(2) both; }
            .vc-anim-glitch-fast   { animation: vcGlitch 0.15s steps(2) both; }
            .vc-anim-zoom-slow     { animation: vcZoom 0.7s cubic-bezier(0.34,1.56,0.64,1) both; }
            .vc-anim-zoom-fast     { animation: vcZoom 0.15s cubic-bezier(0.34,1.56,0.64,1) both; }
            .vc-anim-flip-slow     { animation: vcFlip 0.7s ease-out both; }
            .vc-anim-flip-fast     { animation: vcFlip 0.15s ease-out both; }

            @keyframes vcPop    { 0%{transform:scale(0.5);opacity:0} 100%{transform:scale(1);opacity:1} }
            @keyframes vcFade   { 0%{opacity:0;transform:translateY(6px)} 100%{opacity:1;transform:translateY(0)} }
            @keyframes vcSlide  { 0%{transform:translateY(24px);opacity:0} 100%{transform:translateY(0);opacity:1} }
            @keyframes vcBounce { 0%{transform:scale(0.3);opacity:0} 55%{transform:scale(1.08)} 75%{transform:scale(0.95)} 100%{transform:scale(1);opacity:1} }
            @keyframes vcElastic{
                0%   { transform: scale(0); opacity:0; }
                40%  { transform: scale(1.15); opacity:1; }
                60%  { transform: scale(0.9); }
                80%  { transform: scale(1.04); }
                100% { transform: scale(1); opacity:1; }
            }
            @keyframes vcGlitch {
                0%   { transform: translate(-4px,2px) skewX(-5deg); opacity:0.5; }
                25%  { transform: translate(4px,-2px) skewX(5deg); opacity:1; }
                50%  { transform: translate(-2px,0) skewX(0deg); opacity:0.8; }
                100% { transform: translate(0,0) skewX(0deg); opacity:1; }
            }
            @keyframes vcZoom   { 0%{transform:scale(1.8);opacity:0} 100%{transform:scale(1);opacity:1} }
            @keyframes vcFlip   { 0%{transform:rotateX(90deg) translateY(-20px);opacity:0} 100%{transform:rotateX(0) translateY(0);opacity:1} }
            @keyframes vcLightSweep { 0%{background-position:200% center} 100%{background-position:-200% center} }

            /* ── Scrollbar ── */
            .vc-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
            .vc-scroll::-webkit-scrollbar-track { background: transparent; }
            .vc-scroll::-webkit-scrollbar-thumb { background: var(--color-gray-300); border-radius: 9999px; }
            .vc-scroll::-webkit-scrollbar-thumb:hover { background: var(--color-gray-400); }

            /* ── Range thumb ── */
            input[type=range]::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 14px; height: 14px;
                border-radius: 50%;
                background: white;
                border: 2px solid var(--color-primary);
                cursor: pointer;
                box-shadow: 0 1px 4px rgba(0,0,0,0.2);
            }
        `}</style>
    );

    // ════════════════════════════════════════════════════════════════════
    // VIEW: LISTING
    // ════════════════════════════════════════════════════════════════════
    if (view === 'listing') {
        return (
            <div className="w-full h-full p-4 sm:p-6 lg:p-10">
                {animStyles}
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-semibold text-[var(--color-gray-900)] flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
                                    <Wand2 className="w-5 h-5 text-white" />
                                </div>
                                AI Video Caption
                            </h1>
                            <p className="mt-1 text-sm text-[var(--color-gray-500)]">Professional caption editor with After Effects–level styling</p>
                        </div>
                        <button onClick={() => setShowUpload(true)}
                            className="claude-button-primary px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 shadow-sm">
                            <Plus className="w-4 h-4" /> New Video
                        </button>
                    </div>

                    {/* Upload Modal */}
                    {showUpload && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                                <div className="px-6 py-4 border-b border-[var(--color-gray-200)] flex items-center justify-between">
                                    <h3 className="font-semibold text-[var(--color-gray-900)]">Upload Video</h3>
                                    <button onClick={() => { setShowUpload(false); setSelectedFile(null); setProcessingStatus(''); }}
                                        className="text-[var(--color-gray-400)] hover:text-[var(--color-gray-900)] transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div onClick={() => fileInputRef.current?.click()}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('video/')) setSelectedFile(f); }}
                                        className="border-2 border-dashed border-[var(--color-gray-200)] rounded-xl p-8 text-center cursor-pointer hover:bg-[var(--color-gray-50)] hover:border-[var(--color-primary)] transition-all">
                                        {selectedFile ? (
                                            <>
                                                <FileVideo2 className="w-8 h-8 text-[var(--color-primary)] mx-auto mb-2" />
                                                <p className="text-sm font-medium text-[var(--color-gray-900)]">{selectedFile.name}</p>
                                                <p className="text-xs text-[var(--color-gray-500)]">{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                                            </>
                                        ) : (
                                            <>
                                                <UploadCloud className="w-8 h-8 text-[var(--color-gray-400)] mx-auto mb-2" />
                                                <p className="text-sm font-medium text-[var(--color-gray-900)]">Drop your video here</p>
                                                <p className="text-xs text-[var(--color-gray-500)] mt-1">MP4, MOV, WebM · up to 2 GB</p>
                                            </>
                                        )}
                                        <input ref={fileInputRef} type="file" className="hidden" accept="video/*"
                                            onChange={(e) => { if (e.target.files?.[0]) setSelectedFile(e.target.files[0]); }} />
                                    </div>

                                    {isUploading && (
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs text-[var(--color-gray-600)]">
                                                <span>{processingStatus}</span>
                                                {uploadProgress > 0 && uploadProgress < 100 && <span>{uploadProgress}%</span>}
                                            </div>
                                            <div className="h-1.5 bg-[var(--color-gray-100)] rounded-full overflow-hidden">
                                                <div className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                                            </div>
                                        </div>
                                    )}
                                    {processingStatus.startsWith('Error') && (
                                        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{processingStatus}</p>
                                    )}

                                    <div className="flex justify-end gap-3 pt-2 border-t border-[var(--color-gray-200)]">
                                        <button onClick={() => { setShowUpload(false); setSelectedFile(null); setProcessingStatus(''); }}
                                            className="px-4 py-2 text-sm text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)] transition-colors"
                                            disabled={isUploading}>Cancel</button>
                                        <button onClick={handleUpload} disabled={!selectedFile || isUploading}
                                            className="claude-button-primary px-5 py-2 text-sm rounded-xl flex items-center gap-2 disabled:opacity-50">
                                            {isUploading
                                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                                                : <><Sparkles className="w-4 h-4" /> Upload &amp; Caption</>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Project Grid */}
                    {loadingProjects ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin" />
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="text-center py-20 border-2 border-dashed border-[var(--color-gray-200)] rounded-2xl">
                            <FileVideo2 className="w-12 h-12 text-[var(--color-gray-300)] mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-[var(--color-gray-900)] mb-2">No projects yet</h3>
                            <p className="text-sm text-[var(--color-gray-500)] mb-4">Upload a video to get started with AI captions</p>
                            <button onClick={() => setShowUpload(true)}
                                className="claude-button-primary px-5 py-2.5 rounded-xl font-medium">
                                <Plus className="w-4 h-4 inline mr-1" /> Upload Video
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {projects.map(p => (
                                <button key={p.id} onClick={() => openProject(p)}
                                    className="relative bg-white border border-[var(--color-gray-200)] rounded-2xl p-6 text-left hover:border-[var(--color-primary)] hover:shadow-lg active:shadow-sm transition-all group">
                                    <div className="absolute top-3 right-3"><StatusBadge status={p.status} /></div>
                                    <div className="w-10 h-10 bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-100 rounded-xl flex items-center justify-center mb-4">
                                        <Film className="w-5 h-5 text-violet-500" />
                                    </div>
                                    <h3 className="text-base font-semibold text-[var(--color-gray-900)] mb-1 group-hover:text-[var(--color-primary)] transition-colors truncate pr-16">{p.name}</h3>
                                    <p className="text-xs text-[var(--color-gray-500)]">
                                        {p.duration_sec ? `${Math.round(p.duration_sec / 60)} min` : '—'}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════════════════
    // VIEW: EDITOR
    // ════════════════════════════════════════════════════════════════════

    return (
        <div className="h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-[var(--color-surface)]">
            {animStyles}

            {/* ── TOP BAR ────────────────────────────────────────────────────── */}
            <div className="h-12 bg-[var(--color-surface-elevated)] border-b border-[var(--color-gray-200)] flex items-center justify-between px-4 shrink-0 gap-4">
                {/* Left */}
                <div className="flex items-center gap-3 min-w-0">
                    <button onClick={() => { setView('listing'); setVideoUrl(''); }}
                        className="p-1.5 rounded-lg hover:bg-[var(--color-gray-100)] transition-colors shrink-0">
                        <ArrowLeft className="w-4 h-4 text-[var(--color-gray-600)]" />
                    </button>
                    <span className="font-medium text-sm text-[var(--color-gray-900)] truncate max-w-[160px]">{activeProject?.name}</span>
                    <StatusBadge status={activeProject?.status || 'created'} />
                </div>

                {/* Center — auto save indicator */}
                <div className="flex items-center gap-1.5 text-xs text-[var(--color-gray-400)]">
                    {autoSaveStatus === 'saving' && <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>}
                    {autoSaveStatus === 'saved' && <><Save className="w-3 h-3 text-emerald-500" /> <span className="text-emerald-500">Saved</span></>}
                </div>

                {/* Right */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* Keyboard hint */}
                    <span className="hidden lg:flex items-center gap-1 text-[10px] text-[var(--color-gray-400)] mr-2">
                        <kbd className="px-1 py-0.5 bg-[var(--color-gray-100)] rounded border border-[var(--color-gray-300)] font-mono">Space</kbd> Play
                        <kbd className="px-1 py-0.5 bg-[var(--color-gray-100)] rounded border border-[var(--color-gray-300)] font-mono ml-2">← →</kbd> Seek
                    </span>
                    <button onClick={handleExportSRT} disabled={cues.length === 0}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 border border-[var(--color-gray-200)] text-[var(--color-gray-700)] hover:bg-[var(--color-gray-100)] transition-colors">
                        <Download className="w-3.5 h-3.5" /> SRT
                    </button>
                    <button onClick={handleExportMP4} disabled={cues.length === 0 || isExporting}
                        className="claude-button-primary px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50">
                        {isExporting
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Rendering...</>
                            : <><Download className="w-3.5 h-3.5" /> Export MP4</>}
                    </button>
                </div>
            </div>

            {/* ── MAIN 3-PANEL ───────────────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden min-h-0">

                {/* ════ LEFT PANEL — Cue List / Templates ════════════════════════ */}
                <div className="w-[300px] border-r border-[var(--color-gray-200)] bg-[var(--color-surface-secondary)] flex flex-col shrink-0">
                    {/* Tabs */}
                    <div className="flex border-b border-[var(--color-gray-200)] shrink-0 bg-white">
                        {(['caption', 'template'] as EditorTab[]).map(tab => (
                            <button key={tab} onClick={() => setEditorTab(tab)}
                                className={`flex-1 px-3 py-2.5 text-xs font-semibold capitalize transition-colors ${editorTab === tab
                                    ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] bg-white'
                                    : 'text-[var(--color-gray-500)] hover:text-[var(--color-gray-900)] hover:bg-[var(--color-gray-50)]'
                                    }`}>
                                {tab === 'caption' ? 'AI Caption' : 'Templates'}
                            </button>
                        ))}
                    </div>

                    {editorTab === 'caption' ? (
                        /* ── Cue List ── */
                        <div className="flex-1 overflow-y-auto vc-scroll">
                            {cues.length === 0 ? (
                                <div className="p-8 text-center">
                                    <div className="w-14 h-14 bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <Sparkles className="w-6 h-6 text-violet-400" />
                                    </div>
                                    <p className="text-sm font-medium text-[var(--color-gray-700)] mb-1">No captions yet</p>
                                    <p className="text-xs text-[var(--color-gray-400)] mb-4">Generate AI captions from your video audio</p>
                                    <button onClick={handleTranscribe} disabled={isTranscribing}
                                        className="claude-button-primary px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 mx-auto disabled:opacity-50">
                                        {isTranscribing
                                            ? <><Loader2 className="w-3 h-3 animate-spin" /> Transcribing...</>
                                            : <><Wand2 className="w-3 h-3" /> Generate Captions</>}
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    {/* Cue Count Header */}
                                    <div className="px-4 py-2 border-b border-[var(--color-gray-100)] flex items-center justify-between">
                                        <span className="text-[11px] text-[var(--color-gray-500)] font-medium">{sortedCues.length} captions</span>
                                        <button onClick={handleTranscribe} disabled={isTranscribing}
                                            className="text-[11px] text-[var(--color-primary)] hover:underline flex items-center gap-1 disabled:opacity-50">
                                            <RotateCcw className="w-3 h-3" /> Regenerate
                                        </button>
                                    </div>

                                    {sortedCues.map((cue, index) => {
                                        const isActive = activeCue?._id === cue._id;
                                        const isSelected = selectedCueId === cue._id;
                                        const isEditing = editingCueId === cue._id;
                                        const isHovered = hoveredCueId === cue._id;

                                        return (
                                            <div key={cue._id || `cue-${index}`}
                                                className={`relative border-b border-[var(--color-gray-100)] px-4 py-3 cursor-pointer transition-colors
                                                    ${isActive ? 'bg-[var(--color-primary-subtle)]' : isSelected ? 'bg-[var(--color-gray-50)]' : 'hover:bg-[var(--color-gray-50)]'}
                                                `}
                                                onClick={() => { seekTo(cue.start_ms); setSelectedCueId(cue._id || null); }}
                                                onMouseEnter={() => setHoveredCueId(cue._id || null)}
                                                onMouseLeave={() => setHoveredCueId(null)}
                                            >
                                                {/* Active accent bar */}
                                                {isActive && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--color-primary)] rounded-r" />}

                                                {/* Top row: timecode + actions */}
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-[10px] font-mono text-[var(--color-gray-400)] tabular-nums">
                                                        {formatTimeFull(cue.start_ms)} → {formatTimeFull(cue.end_ms)}
                                                    </span>
                                                    <div className="flex gap-0.5">
                                                        {isEditing ? (
                                                            <>
                                                                <button onClick={(e) => { e.stopPropagation(); splitCueAtCursor(cue); }}
                                                                    className="p-1 text-[var(--color-gray-400)] hover:text-orange-500 hover:bg-orange-50 rounded transition-colors" title="Split at cursor">
                                                                    <Scissors className="w-3 h-3" />
                                                                </button>
                                                                <button onClick={(e) => { e.stopPropagation(); saveEdit(cue); }}
                                                                    className="p-1 text-emerald-500 hover:bg-emerald-50 rounded transition-colors" title="Save">
                                                                    <Check className="w-3 h-3" />
                                                                </button>
                                                                <button onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                                                                    className="p-1 text-red-400 hover:bg-red-50 rounded transition-colors" title="Cancel">
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button onClick={(e) => { e.stopPropagation(); startEdit(cue); }}
                                                                    className="p-1 text-[var(--color-gray-400)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] rounded transition-colors" title="Edit">
                                                                    <Pencil className="w-3 h-3" />
                                                                </button>
                                                                <button onClick={(e) => { e.stopPropagation(); deleteCue(cue); }}
                                                                    className="p-1 text-[var(--color-gray-400)] hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Delete">
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Text content */}
                                                {isEditing ? (
                                                    <textarea ref={textareaRef} value={editText}
                                                        onChange={(e) => setEditText(e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); splitCueAtCursor(cue); }
                                                            if (e.key === 'Escape') cancelEdit();
                                                        }}
                                                        className="w-full text-xs p-2 rounded-lg border border-[var(--color-gray-300)] focus:border-[var(--color-primary)] focus:outline-none resize-none bg-white leading-relaxed"
                                                        rows={3} autoFocus
                                                    />
                                                ) : (
                                                    <p className={`text-xs leading-relaxed ${isActive ? 'text-[var(--color-primary)] font-semibold' : 'text-[var(--color-gray-700)]'}`}>
                                                        {cue.text}
                                                    </p>
                                                )}

                                                {/* Duration pill */}
                                                {!isEditing && (
                                                    <div className="mt-1.5">
                                                        <span className="text-[9px] text-[var(--color-gray-400)] bg-[var(--color-gray-100)] px-1.5 py-0.5 rounded font-mono">
                                                            {((cue.end_ms - cue.start_ms) / 1000).toFixed(1)}s
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* ── Template Grid ── */
                        <div className="flex-1 overflow-y-auto vc-scroll p-3">
                            <p className="text-[10px] text-[var(--color-gray-400)] uppercase tracking-widest font-semibold px-1 mb-3">Style Presets</p>
                            <div className="grid grid-cols-2 gap-2">
                                {TEMPLATES.map(t => {
                                    const isActive = captionConfig.effect === t.config.effect && captionConfig.animation === t.config.animation && captionConfig.fontFamily === t.config.fontFamily;
                                    return (
                                        <button key={t.id} onClick={() => setCaptionConfig({ ...t.config })}
                                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-all border-2 ${isActive
                                                ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
                                                : 'border-transparent bg-white hover:border-[var(--color-gray-200)] hover:shadow-sm'
                                                }`}>
                                            <span className="text-2xl">{t.emoji}</span>
                                            <span className="text-[11px] font-semibold text-[var(--color-gray-800)]">{t.name}</span>
                                            <span className="text-[9px] text-[var(--color-gray-400)] font-mono leading-tight">{t.preview}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* ════ CENTER PANEL — Video Preview ════════════════════════════ */}
                <div className="flex-1 flex flex-col bg-[var(--color-gray-100)] min-w-0 relative overflow-hidden"
                    style={{ backgroundImage: 'radial-gradient(var(--color-gray-300) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>

                    {/* Aspect Ratio Switcher */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white/90 backdrop-blur-md border border-[var(--color-gray-200)] shadow-lg rounded-xl p-1">
                        {(['original', '16:9', '9:16', '1:1', '4:5'] as AspectRatio[]).map(ratio => (
                            <button key={ratio} onClick={() => setCanvasRatio(ratio)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${canvasRatio === ratio
                                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                                    : 'text-[var(--color-gray-500)] hover:text-[var(--color-gray-900)] hover:bg-[var(--color-gray-100)]'
                                    }`}>
                                {ratio === 'original' ? 'AUTO' : ratio}
                            </button>
                        ))}
                    </div>

                    {/* Preview Options */}
                    <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
                        <button onClick={() => setPreviewCaptionOnly(p => !p)}
                            className={`p-2 rounded-lg border shadow-sm transition-all ${previewCaptionOnly ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white' : 'bg-white/90 backdrop-blur-sm border-[var(--color-gray-200)] text-[var(--color-gray-600)] hover:bg-white'}`}
                            title={previewCaptionOnly ? 'Show Video' : 'Preview Caption Only'}>
                            {previewCaptionOnly ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button onClick={toggleFullscreen}
                            className="p-2 rounded-lg border bg-white/90 backdrop-blur-sm border-[var(--color-gray-200)] text-[var(--color-gray-600)] hover:bg-white shadow-sm transition-all"
                            title="Fullscreen">
                            <Maximize2 className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Video Canvas */}
                    <div ref={previewRef} className="flex-1 flex items-center justify-center p-12 overflow-hidden">
                        {videoUrl ? (
                            <div className={`relative shadow-[0_24px_64px_-12px_rgba(0,0,0,0.3)] ring-1 ring-black/10 rounded-xl bg-black overflow-hidden ${getCanvasClasses()}`}
                                style={{ maxHeight: 'calc(100vh - 420px)' }}>

                                {/* Video */}
                                <video ref={videoRef} src={videoUrl} playsInline
                                    style={{ opacity: previewCaptionOnly ? 0 : 1 }}
                                    className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300" />

                                {/* Preview-only background */}
                                {previewCaptionOnly && (
                                    <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800" />
                                )}

                                {/* ── Caption Overlay ── */}
                                <div className="absolute left-0 right-0 flex justify-center pointer-events-none px-4"
                                    style={{ ...captionPositionStyle, width: `${captionConfig.maxWidth}%`, left: '50%', transform: captionPositionStyle.transform ? `${captionPositionStyle.transform} translateX(-50%)` : 'translateX(-50%)' }}>
                                    {activeCue && (
                                        <div key={`${activeCue._id}-${activeCue.text}`}
                                            className={`relative inline-flex flex-col items-center whitespace-pre-wrap text-center w-full ${getAnimationClass(captionConfig.animation, captionConfig.animationSpeed)}`}>
                                            {/* Stroke/Shadow under-layer */}
                                            <span style={getStrokeStyle(captionConfig)} aria-hidden="true">{activeCue.text}</span>
                                            {/* Fill top-layer */}
                                            <span style={getFillStyle(captionConfig)}>{activeCue.text}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Play overlay */}
                                {!isPlaying && (
                                    <button onClick={togglePlay}
                                        className="absolute inset-0 flex items-center justify-center bg-black/15 hover:bg-black/25 transition-colors z-20">
                                        <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-xl transition-transform hover:scale-105">
                                            <Play className="w-6 h-6 text-white ml-0.5" />
                                        </div>
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="text-center">
                                <FileVideo2 className="w-10 h-10 text-[var(--color-gray-400)] mx-auto mb-3" />
                                <p className="text-sm text-[var(--color-gray-500)]">Loading video...</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ════ RIGHT PANEL — Style Inspector ════════════════════════════ */}
                <div className="w-[296px] border-l border-[var(--color-gray-200)] bg-white flex flex-col shrink-0">
                    {/* Panel Tab Bar */}
                    <div className="flex border-b border-[var(--color-gray-200)] bg-white shrink-0">
                        {([
                            { id: 'typography', icon: Type, label: 'Type' },
                            { id: 'effects', icon: Layers, label: 'FX' },
                            { id: 'animation', icon: Sparkles, label: 'Anim' },
                            { id: 'layout', icon: Move, label: 'Layout' },
                        ] as { id: StylePanelTab; icon: any; label: string }[]).map(({ id, icon: Icon, label }) => (
                            <button key={id} onClick={() => setStylePanelTab(id)}
                                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors ${stylePanelTab === id
                                    ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                                    : 'text-[var(--color-gray-400)] hover:text-[var(--color-gray-700)]'
                                    }`}>
                                <Icon className="w-3.5 h-3.5" />
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto vc-scroll p-4 space-y-5">

                        {/* ── TYPOGRAPHY TAB ────────────────────────────────── */}
                        {stylePanelTab === 'typography' && (
                            <>
                                <SectionHeader label="Font" />
                                <div>
                                    <label className="text-[11px] font-medium text-[var(--color-gray-600)] mb-1.5 block">Family</label>
                                    <select value={captionConfig.fontFamily}
                                        onChange={(e) => updateConfig('fontFamily', e.target.value)}
                                        className="w-full bg-[var(--color-gray-50)] border border-[var(--color-gray-200)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-gray-900)] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer">
                                        {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>

                                <SliderRow label="Size" min={10} max={80} value={captionConfig.fontSize} onChange={v => updateConfig('fontSize', v)} />
                                <SliderRow label="Weight" min={100} max={900} step={100} value={captionConfig.fontWeight} onChange={v => updateConfig('fontWeight', v)} suffix="" unit="" />
                                <SliderRow label="Letter Spacing" min={-5} max={20} value={captionConfig.letterSpacing} onChange={v => updateConfig('letterSpacing', v)} />
                                <SliderRow label="Line Height" min={0.8} max={3} step={0.05} value={captionConfig.lineHeight} onChange={v => updateConfig('lineHeight', v)} unit="×" suffix="×" />

                                {/* Style toggles */}
                                <div>
                                    <label className="text-[11px] font-medium text-[var(--color-gray-600)] mb-2 block">Style</label>
                                    <div className="flex gap-2">
                                        {[
                                            { key: 'italic' as const, icon: Italic, label: 'I' },
                                            { key: 'underline' as const, icon: Underline, label: 'U' },
                                        ].map(({ key, icon: Icon, label }) => (
                                            <button key={key} onClick={() => updateConfig(key, !captionConfig[key])}
                                                className={`w-9 h-9 rounded-lg border text-sm font-bold transition-all ${captionConfig[key]
                                                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                                                    : 'border-[var(--color-gray-200)] text-[var(--color-gray-600)] hover:border-[var(--color-gray-400)]'
                                                    }`}>
                                                <Icon className="w-3.5 h-3.5 mx-auto" />
                                            </button>
                                        ))}
                                        <select value={captionConfig.textTransform}
                                            onChange={(e) => updateConfig('textTransform', e.target.value as any)}
                                            className="flex-1 bg-[var(--color-gray-50)] border border-[var(--color-gray-200)] rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[var(--color-primary)] cursor-pointer">
                                            <option value="none">None</option>
                                            <option value="uppercase">UPPER</option>
                                            <option value="lowercase">lower</option>
                                            <option value="capitalize">Title</option>
                                        </select>
                                    </div>
                                </div>

                                <SectionHeader label="Color" />
                                <ColorRow label="Fill Color" value={captionConfig.color} presets={COLOR_PRESETS} onChange={v => updateConfig('color', v)} />
                            </>
                        )}

                        {/* ── EFFECTS TAB ───────────────────────────────────── */}
                        {stylePanelTab === 'effects' && (
                            <>
                                <SectionHeader label="Style Effect" />
                                <div className="grid grid-cols-2 gap-2">
                                    {EFFECT_OPTIONS.map(opt => (
                                        <button key={opt.id} onClick={() => updateConfig('effect', opt.id)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${captionConfig.effect === opt.id
                                                ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)] text-[var(--color-primary)]'
                                                : 'border-[var(--color-gray-200)] text-[var(--color-gray-600)] hover:border-[var(--color-gray-400)] hover:bg-[var(--color-gray-50)]'
                                                }`}>
                                            <span className="text-sm">{opt.icon}</span>
                                            <span className="truncate">{opt.name}</span>
                                        </button>
                                    ))}
                                </div>

                                <SectionHeader label="Stroke / Outline" />
                                <ColorRow label="Outline Color" value={captionConfig.strokeColor} presets={STROKE_PRESETS} onChange={v => updateConfig('strokeColor', v)} />
                                <SliderRow label="Thickness" min={0} max={30} value={captionConfig.strokeWidth} onChange={v => updateConfig('strokeWidth', v)} />

                                <SectionHeader label="Drop Shadow" />
                                <SliderRow label="X Offset" min={-20} max={20} value={captionConfig.shadow.x} onChange={v => updateShadow('x', v)} />
                                <SliderRow label="Y Offset" min={-20} max={20} value={captionConfig.shadow.y} onChange={v => updateShadow('y', v)} />
                                <SliderRow label="Blur" min={0} max={40} value={captionConfig.shadow.blur} onChange={v => updateShadow('blur', v)} />
                                <SliderRow label="Opacity" min={0} max={1} step={0.05} value={captionConfig.shadow.opacity} onChange={v => updateShadow('opacity', v)} unit="%" suffix={`${Math.round(captionConfig.shadow.opacity * 100)}%`} />
                                <ColorRow label="Shadow Color" value={captionConfig.shadow.color} presets={['#000000', '#1a1a1a', '#6B21A8', '#1E3A8A', '#7F1D1D']} onChange={v => updateShadow('color', v)} />

                                {/* Neon Glow controls (show when effect = neon) */}
                                {captionConfig.effect === 'neon' && (
                                    <>
                                        <SectionHeader label="Neon Glow" />
                                        <ColorRow label="Glow Color" value={captionConfig.glowColor} presets={['#00FF88', '#22D3EE', '#A78BFA', '#F472B6', '#FACC15']} onChange={v => updateConfig('glowColor', v)} />
                                        <SliderRow label="Spread" min={2} max={40} value={captionConfig.glowSpread} onChange={v => updateConfig('glowSpread', v)} />
                                    </>
                                )}

                                {/* Background Box controls */}
                                {(captionConfig.effect === 'bg-box' || captionConfig.effect === 'bg-pill') && (
                                    <>
                                        <SectionHeader label="Background Box" />
                                        <ColorRow label="Box Color" value={captionConfig.background.color} presets={['#000000', '#1F2937', '#7C3AED', '#1D4ED8', '#FFFFFF']} onChange={v => updateBg('color', v)} />
                                        <SliderRow label="Opacity" min={0} max={1} step={0.05} value={captionConfig.background.opacity} onChange={v => updateBg('opacity', v)} unit="%" suffix={`${Math.round(captionConfig.background.opacity * 100)}%`} />
                                        <SliderRow label="Padding X" min={0} max={60} value={captionConfig.background.paddingX} onChange={v => updateBg('paddingX', v)} />
                                        <SliderRow label="Padding Y" min={0} max={40} value={captionConfig.background.paddingY} onChange={v => updateBg('paddingY', v)} />
                                        <SliderRow label="Corner Radius" min={0} max={40} value={captionConfig.background.borderRadius} onChange={v => updateBg('borderRadius', v)} />
                                    </>
                                )}
                            </>
                        )}

                        {/* ── ANIMATION TAB ─────────────────────────────────── */}
                        {stylePanelTab === 'animation' && (
                            <>
                                <SectionHeader label="Entrance Animation" />
                                <div className="grid grid-cols-2 gap-2">
                                    {ANIMATION_OPTIONS.map(a => (
                                        <button key={a.id} onClick={() => updateConfig('animation', a.id)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${captionConfig.animation === a.id
                                                ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)] text-[var(--color-primary)]'
                                                : 'border-[var(--color-gray-200)] text-[var(--color-gray-600)] hover:border-[var(--color-gray-400)] hover:bg-[var(--color-gray-50)]'
                                                }`}>
                                            <span className="text-sm">{a.icon}</span>
                                            <span>{a.name}</span>
                                        </button>
                                    ))}
                                </div>

                                <SectionHeader label="Speed" />
                                <div className="flex gap-2">
                                    {(['slow', 'normal', 'fast'] as const).map(speed => (
                                        <button key={speed} onClick={() => updateConfig('animationSpeed', speed)}
                                            className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all border ${captionConfig.animationSpeed === speed
                                                ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                                                : 'border-[var(--color-gray-200)] text-[var(--color-gray-600)] hover:bg-[var(--color-gray-50)]'
                                                }`}>
                                            {speed}
                                        </button>
                                    ))}
                                </div>

                                {/* Live Preview */}
                                <SectionHeader label="Preview" />
                                <div className="bg-[var(--color-gray-900)] rounded-xl p-4 flex items-center justify-center min-h-[80px] overflow-hidden">
                                    {activeCue ? (
                                        <div key={`${activeCue._id}-preview`} className={`relative inline-block text-center ${getAnimationClass(captionConfig.animation, captionConfig.animationSpeed)}`}>
                                            <span style={{ ...getStrokeStyle(captionConfig), position: 'absolute', inset: 0, display: 'block', fontSize: `${Math.min(captionConfig.fontSize * 0.5, 18)}px` }} aria-hidden="true">{activeCue.text}</span>
                                            <span style={{ ...getFillStyle(captionConfig), fontSize: `${Math.min(captionConfig.fontSize * 0.5, 18)}px` }}>{activeCue.text}</span>
                                        </div>
                                    ) : (
                                        <p className="text-[var(--color-gray-500)] text-xs">Play video to preview</p>
                                    )}
                                </div>
                            </>
                        )}

                        {/* ── LAYOUT TAB ────────────────────────────────────── */}
                        {stylePanelTab === 'layout' && (
                            <>
                                <SectionHeader label="Position" />
                                <div>
                                    <label className="text-[11px] font-medium text-[var(--color-gray-600)] mb-1.5 block">Vertical Anchor</label>
                                    <div className="flex gap-1.5 bg-[var(--color-gray-100)] p-1 rounded-xl border border-[var(--color-gray-200)]">
                                        {(['top', 'center', 'bottom'] as const).map(pos => (
                                            <button key={pos} onClick={() => updateConfig('position', pos)}
                                                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold capitalize transition-all ${captionConfig.position === pos
                                                    ? 'bg-white text-[var(--color-primary)] shadow-sm border border-[var(--color-gray-200)]'
                                                    : 'text-[var(--color-gray-500)] hover:text-[var(--color-gray-900)]'
                                                    }`}>
                                                {pos}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <SectionHeader label="Text Alignment" />
                                <div className="flex gap-1.5 bg-[var(--color-gray-100)] p-1 rounded-xl border border-[var(--color-gray-200)]">
                                    {[
                                        { val: 'left' as const, icon: AlignLeft },
                                        { val: 'center' as const, icon: AlignCenter },
                                        { val: 'right' as const, icon: AlignRight },
                                    ].map(({ val, icon: Icon }) => (
                                        <button key={val} onClick={() => updateConfig('align', val)}
                                            className={`flex-1 py-2 rounded-lg flex items-center justify-center transition-all ${captionConfig.align === val
                                                ? 'bg-white text-[var(--color-primary)] shadow-sm border border-[var(--color-gray-200)]'
                                                : 'text-[var(--color-gray-500)] hover:text-[var(--color-gray-900)]'
                                                }`}>
                                            <Icon className="w-3.5 h-3.5" />
                                        </button>
                                    ))}
                                </div>

                                <SectionHeader label="Dimensions" />
                                <SliderRow label="Max Width" min={20} max={100} value={captionConfig.maxWidth} onChange={v => updateConfig('maxWidth', v)} unit="%" suffix="%" />

                                <SectionHeader label="Reset" />
                                <button onClick={() => setCaptionConfig({ ...DEFAULT_CONFIG })}
                                    className="w-full py-2 text-xs font-medium text-[var(--color-gray-600)] border border-[var(--color-gray-200)] rounded-xl hover:bg-[var(--color-gray-50)] hover:text-[var(--color-gray-900)] transition-colors flex items-center justify-center gap-2">
                                    <RotateCcw className="w-3.5 h-3.5" /> Reset to Default
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ════ BOTTOM TIMELINE PANEL ════════════════════════════════════ */}
            <div className="h-[200px] bg-[var(--color-surface-elevated)] border-t border-[var(--color-gray-200)] flex flex-col shrink-0">

                {/* ── Video Controls Bar ── */}
                <div className="h-12 border-b border-[var(--color-gray-200)] flex items-center gap-3 px-4 shrink-0">
                    {/* Transport */}
                    <div className="flex items-center gap-1">
                        <button onClick={() => skipBy(-5)} className="p-1.5 text-[var(--color-gray-500)] hover:text-[var(--color-gray-900)] hover:bg-[var(--color-gray-100)] rounded-lg transition-colors" title="Back 5s">
                            <SkipBack className="w-4 h-4" />
                        </button>
                        <button onClick={togglePlay}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-primary)] text-white hover:brightness-95 transition-all shadow-sm">
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                        </button>
                        <button onClick={() => skipBy(5)} className="p-1.5 text-[var(--color-gray-500)] hover:text-[var(--color-gray-900)] hover:bg-[var(--color-gray-100)] rounded-lg transition-colors" title="Forward 5s">
                            <SkipForward className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Volume */}
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsMuted(m => !m)} className="p-1 text-[var(--color-gray-500)] hover:text-[var(--color-gray-900)] transition-colors">
                            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                        <input type="range" min={0} max={1} step={0.01} value={isMuted ? 0 : volume}
                            onChange={(e) => { setVolume(parseFloat(e.target.value)); setIsMuted(false); }}
                            className="w-16 h-[3px] rounded-full appearance-none cursor-pointer"
                            style={{ background: `linear-gradient(to right, var(--color-primary) ${(isMuted ? 0 : volume) * 100}%, var(--color-gray-200) 0%)` }} />
                    </div>

                    {/* Timecode */}
                    <span className="text-xs font-mono text-[var(--color-gray-600)] tabular-nums shrink-0">
                        {formatTimeFull(currentTime)} <span className="text-[var(--color-gray-400)]">/</span> {formatTimeFull(duration)}
                    </span>

                    {/* Progress bar scrubber */}
                    <div className="flex-1 mx-2 h-5 flex items-center group cursor-pointer"
                        onClick={(e) => { if (!duration) return; const r = e.currentTarget.getBoundingClientRect(); seekTo(((e.clientX - r.left) / r.width) * duration); }}>
                        <div className="relative w-full h-[3px] group-hover:h-[5px] bg-[var(--color-gray-200)] rounded-full transition-all">
                            {/* Cue markers */}
                            {sortedCues.map((cue, i) => (
                                <div key={i} className="absolute top-0 bottom-0 bg-teal-400/40 rounded"
                                    style={{ left: `${duration ? (cue.start_ms / duration) * 100 : 0}%`, width: `${duration ? ((cue.end_ms - cue.start_ms) / duration) * 100 : 0}%` }} />
                            ))}
                            {/* Progress */}
                            <div className="absolute top-0 left-0 h-full bg-[var(--color-primary)] rounded-full" style={{ width: `${progressPct}%` }} />
                            {/* Scrub handle */}
                            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-[var(--color-primary)] rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                style={{ left: `${progressPct}%` }} />
                        </div>
                    </div>

                    {/* Zoom */}
                    <div className="flex items-center gap-2 shrink-0">
                        <ZoomIn className="w-3.5 h-3.5 text-[var(--color-gray-400)]" />
                        <input type="range" min={1} max={8} step={0.5} value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="w-20 h-[3px] rounded-full appearance-none cursor-pointer"
                            style={{ background: `linear-gradient(to right, var(--color-primary) ${((zoom - 1) / 7) * 100}%, var(--color-gray-200) 0%)` }} />
                        <span className="text-[10px] font-mono text-[var(--color-gray-400)] w-6">{zoom.toFixed(1)}×</span>
                    </div>
                </div>

                {/* ── Track Area ── */}
                <div className="flex-1 flex overflow-hidden min-h-0">
                    {/* Side toolbar */}
                    <div className="w-10 border-r border-[var(--color-gray-200)] bg-white flex flex-col items-center py-2 gap-1.5 shrink-0">
                        {[
                            { icon: Scissors, label: 'Split', color: 'hover:text-orange-500 hover:bg-orange-50' },
                            { icon: Sparkles, label: 'AI Cut', color: 'hover:text-violet-500 hover:bg-violet-50' },
                            { icon: Trash2, label: 'Delete', color: 'hover:text-red-500 hover:bg-red-50' },
                            { icon: Undo2, label: 'Undo', color: 'hover:text-blue-500 hover:bg-blue-50' },
                        ].map(({ icon: Icon, label, color }) => (
                            <button key={label} title={label}
                                className={`p-1.5 text-[var(--color-gray-400)] rounded-lg transition-colors ${color}`}>
                                <Icon className="w-3.5 h-3.5" />
                            </button>
                        ))}
                    </div>

                    {/* Scrollable tracks */}
                    <div ref={timelineRef}
                        className="flex-1 overflow-x-auto overflow-y-hidden vc-scroll relative bg-[#f6f7f9]"
                        onPointerMove={onTimelinePointerMove}
                        onPointerUp={onTimelinePointerUp}
                        onPointerCancel={onTimelinePointerUp}>
                        <div ref={trackContentRef} className="relative min-h-full p-2" style={{ width: `${Math.max(100, zoom * 100)}%` }}>

                            {/* Track rows */}
                            <div className="relative ml-[72px]">

                                {/* ── Scrubber hit area - z-0, NO pointer capture so moves bubble to outer container ── */}
                                <div
                                    className="absolute inset-0 z-0 cursor-crosshair"
                                    style={{ bottom: '-8px' }}
                                    onPointerDown={(e) => { setIsScrubbing(true); computeScrubPosition(e.clientX); }}>
                                </div>

                                {/* ── Playhead - z-30 so it renders ABOVE all tracks ── */}
                                <div className="absolute top-0 bottom-0 pointer-events-none z-30" style={{ left: `${progressPct}%` }}>
                                    <div className="absolute -top-1 -translate-x-1/2 flex flex-col items-center">
                                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow" />
                                        <div className="w-px bg-red-500/80" style={{ height: '148px' }} />
                                    </div>
                                </div>

                                {/* Time Ruler */}
                                <div className="h-5 mb-1 relative overflow-hidden">
                                    {duration > 0 && Array.from({ length: Math.ceil(duration / 1000) + 1 }, (_, i) => i).map(sec => {
                                        const pct = (sec * 1000 / duration) * 100;
                                        const isMajor = sec % 5 === 0;
                                        return pct <= 100 ? (
                                            <div key={sec} className="absolute top-0 flex flex-col items-center pointer-events-none" style={{ left: `${pct}%` }}>
                                                <div className={`w-px bg-[var(--color-gray-300)] ${isMajor ? 'h-3' : 'h-1.5'}`} />
                                                {isMajor && <span className="text-[8px] font-mono text-[var(--color-gray-400)] mt-0.5">{formatTimeFull(sec * 1000)}</span>}
                                            </div>
                                        ) : null;
                                    })}
                                </div>

                                {/* Caption Track */}
                                <div className="h-10 bg-white border border-[var(--color-gray-200)] rounded-lg relative overflow-visible shadow-sm z-10 mb-2">
                                    {sortedCues.map((cue, i) => {
                                        const left = duration ? (cue.start_ms / duration) * 100 : 0;
                                        const width = duration ? ((cue.end_ms - cue.start_ms) / duration) * 100 : 0;
                                        const isActiveCueTL = activeCue?._id === cue._id;
                                        const isSelectedCueTL = selectedCueId === cue._id;
                                        return (
                                            <div key={cue._id || i}
                                                className={`absolute top-1 bottom-1 rounded-md border flex items-center overflow-hidden group/block select-none
                                                    ${isActiveCueTL ? 'bg-[var(--color-primary)] border-[var(--color-primary-dark)] shadow-md z-20' : isSelectedCueTL ? 'bg-teal-100 border-teal-400 z-20' : 'bg-teal-50 border-teal-200 hover:bg-teal-100 hover:border-teal-300 z-10'}`}
                                                style={{ left: `${left}%`, width: `${Math.max(width, 0.4)}%`, minWidth: '6px', cursor: dragRef.current?.cueId === cue._id ? 'grabbing' : 'grab' }}
                                                onPointerDown={(e) => onCuePointerDown(e, cue, 'move')}
                                                onClick={(e) => { e.stopPropagation(); seekTo(cue.start_ms); setSelectedCueId(cue._id || null); }}
                                                title={cue.text}>
                                                {/* Left resize handle */}
                                                <div
                                                    className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-30 flex items-center justify-center group/lh"
                                                    onPointerDown={(e) => onCuePointerDown(e, cue, 'resize-left')}>
                                                    <div className="w-0.5 h-4 bg-teal-500/50 rounded-full opacity-0 group-hover/block:opacity-100 transition-opacity" />
                                                </div>
                                                <span className={`text-[9px] font-medium truncate mx-2 pointer-events-none ${isActiveCueTL ? 'text-white' : 'text-teal-800'}`}>
                                                    {cue.text}
                                                </span>
                                                {/* Right resize handle */}
                                                <div
                                                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-30 flex items-center justify-center group/rh"
                                                    onPointerDown={(e) => onCuePointerDown(e, cue, 'resize-right')}>
                                                    <div className="w-0.5 h-4 bg-teal-500/50 rounded-full opacity-0 group-hover/block:opacity-100 transition-opacity" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Video Track */}
                                <div className="h-10 bg-white border border-[var(--color-gray-200)] rounded-lg relative overflow-hidden shadow-sm z-10">
                                    <div className="absolute inset-y-1 inset-x-1 bg-indigo-50 border border-indigo-100 rounded-md flex items-center px-3 overflow-hidden">
                                        {/* Film-strip pattern */}
                                        <div className="absolute inset-0 opacity-[0.04]"
                                            style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 14px, #000 14px, #000 28px)' }} />
                                        <Film className="w-3 h-3 text-indigo-300 shrink-0 mr-2" />
                                        <span className="text-[10px] font-semibold text-indigo-600 relative z-10 select-none truncate">{activeProject?.name || 'Video'}</span>
                                        {duration > 0 && (
                                            <span className="ml-auto text-[9px] font-mono text-indigo-400 shrink-0">{formatTimeFull(duration)}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Sticky Track Labels */}
                            <div className="absolute left-2 top-2 w-16 flex flex-col z-30 pointer-events-none">
                                <div className="h-5 mb-1" /> {/* ruler gap */}
                                <div className="h-10 flex items-center mb-2">
                                    <span className="text-[9px] font-bold text-teal-600 uppercase tracking-wider border-l-2 border-teal-400 pl-1.5">CAP</span>
                                </div>
                                <div className="h-10 flex items-center">
                                    <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider border-l-2 border-indigo-300 pl-1.5">VID</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}