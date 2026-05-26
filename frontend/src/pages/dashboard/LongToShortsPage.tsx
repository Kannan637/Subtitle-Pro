import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Clock3,
    Download,
    Edit3,
    Film,
    FolderOpen,
    Link2,
    Loader2,
    Pause,
    Play,
    Plus,
    Scissors,
    Send,
    Share2,
    Sparkles,
    Trash2,
    TrendingUp,
    UploadCloud,
    Volume2,
    VolumeX,
    X,
} from 'lucide-react';
import {
    getApiErrorMessage,
    longToShortsApi,
    mediaApi,
    projectsApi,
    transcriptionApi,
    type LongToShortPreflightResponse,
    type LongToShortItem,
    type Project,
} from '@/lib/api';
import { useTranscriptionStream } from '@/hooks/useTranscriptionStream';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type SourceMode = 'upload' | 'youtube';
type WorkflowStage =
    | 'idle'
    | 'uploading'
    | 'importing'
    | 'queued'
    | 'processing'
    | 'analyzing'
    | 'complete'
    | 'error';
type ReframeMode = 'person_center' | 'fit_blur' | 'none';
type CaptionStylePreset = 'comic_story' | 'clean_modern' | 'subtitle_minimal';

const KOMIKA_AXIS_FONT_STACK = '"Komika Axis", "Bangers", "Anton", Impact, sans-serif';
const CAPTION_HIGHLIGHT_COLOR = '#FFD400';
const CAPTION_IMPORTANT_WORDS = new Set([
    'attention',
    'amazon',
    'audience',
    'best',
    'business',
    'customers',
    'engagement',
    'growth',
    'hook',
    'money',
    'physical',
    'product',
    'products',
    'profit',
    'results',
    'revenue',
    'sales',
    'secret',
    'strategy',
    'viral',
]);
const CAPTION_EMOJI_RULES: Array<[string[], string]> = [
    [['money', 'revenue', 'profit', 'sales', 'income', 'cash', 'price'], '💰'],
    [['growth', 'scale', 'boost', 'viral', 'results', 'win', 'wins'], '🚀'],
    [['mistake', 'problem', 'warning', 'wrong', 'fail', 'avoid'], '⚠️'],
    [['secret', 'hack', 'strategy', 'tip', 'trick', 'system'], '💡'],
    [['amazon', 'product', 'products', 'brand', 'business', 'customer', 'customers'], '📦'],
    [['attention', 'hook', 'retention', 'engagement', 'audience', 'watch'], '🔥'],
    [['video', 'clip', 'camera', 'content', 'creator', 'shorts'], '🎬'],
    [['fitness', 'exercise', 'gym', 'workout', 'health', 'body'], '💪'],
    [['ai', 'automation', 'software', 'tool', 'data', 'tech'], '🤖'],
    [['home', 'house', 'remote', 'family'], '🏠'],
];
const CAPTION_EMOJI_RULES_SAFE: Array<[string[], string]> = [
    [['money', 'revenue', 'profit', 'sales', 'income', 'cash', 'price'], '\u{1F4B0}'],
    [['growth', 'scale', 'boost', 'viral', 'results', 'win', 'wins'], '\u{1F680}'],
    [['mistake', 'problem', 'warning', 'wrong', 'fail', 'avoid'], '\u{26A0}\u{FE0F}'],
    [['secret', 'hack', 'strategy', 'tip', 'trick', 'system'], '\u{1F4A1}'],
    [['amazon', 'product', 'products', 'brand', 'business', 'customer', 'customers'], '\u{1F4E6}'],
    [['attention', 'hook', 'retention', 'engagement', 'audience', 'watch'], '\u{1F525}'],
    [['video', 'clip', 'camera', 'content', 'creator', 'shorts'], '\u{1F3AC}'],
    [['fitness', 'exercise', 'gym', 'workout', 'health', 'body'], '\u{1F4AA}'],
    [['ai', 'automation', 'software', 'tool', 'data', 'tech'], '\u{1F916}'],
    [['home', 'house', 'remote', 'family'], '\u{1F3E0}'],
];
void CAPTION_EMOJI_RULES;

const CAPTION_STOP_WORDS = new Set([
    'a',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'but',
    'by',
    'for',
    'from',
    'have',
    'i',
    "i'm",
    "i've",
    'in',
    'is',
    'it',
    'my',
    'of',
    'on',
    'or',
    'so',
    'that',
    'the',
    'this',
    'to',
    'was',
    'with',
    'you',
    'your',
]);

type PreviewCaptionCue = {
    text: string;
    highlightWords: string[];
    emoji?: string;
    emojiStartMs?: number;
    emojiEndMs?: number;
};

const CAPTION_STYLE_LABELS: Record<CaptionStylePreset, string> = {
    comic_story: 'Komika Axis',
    clean_modern: 'Clean Modern',
    subtitle_minimal: 'Subtitle Minimal',
};

function getCaptionPreviewStyle(style: CaptionStylePreset): CSSProperties {
    if (style === 'comic_story') {
        return {
            background: 'transparent',
            color: '#FFFFFF',
            border: 'none',
            boxShadow: 'none',
            fontFamily: KOMIKA_AXIS_FONT_STACK,
            WebkitTextStroke: '1.1px #000000',
            paintOrder: 'stroke fill',
            textShadow: '0 3px 0 #000000, 0 6px 12px rgba(0,0,0,0.72)',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            fontWeight: 900,
        };
    }
    if (style === 'subtitle_minimal') {
        return {
            background: 'color-mix(in oklch, var(--color-gray-900) 55%, transparent)',
            color: 'var(--color-gray-50)',
            border: '1px solid color-mix(in oklch, var(--color-gray-50) 18%, transparent)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
            letterSpacing: 0,
            fontWeight: 600,
        };
    }
    return {
        background: 'color-mix(in oklch, var(--color-gray-900) 80%, transparent)',
        color: 'var(--color-gray-50)',
        border: '1px solid color-mix(in oklch, var(--color-gray-50) 24%, transparent)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        letterSpacing: '0.01em',
        fontWeight: 700,
    };
}

function normalizeCaptionWord(value: string): string {
    return value.match(/[A-Za-z0-9']+/)?.[0]?.toLowerCase() ?? '';
}

function getImportantCaptionWords(text: string, limit = 1): string[] {
    const tokens = text.match(/[A-Za-z0-9']+/g) ?? [];
    const scored = tokens
        .map((token, index) => {
            const normalized = token.toLowerCase();
            if (!normalized || normalized.length < 3 || CAPTION_STOP_WORDS.has(normalized)) return null;
            let score = Math.min(normalized.length, 14);
            if (CAPTION_IMPORTANT_WORDS.has(normalized)) score += 100;
            if (/\d/.test(token)) score += 90;
            if (token.length > 1 && token === token.toUpperCase()) score += 32;
            if (/(ing|ion|ity|ive|ment|ness)$/.test(normalized)) score += 8;
            return { token, normalized, score, index };
        })
        .filter((item): item is { token: string; normalized: string; score: number; index: number } => Boolean(item))
        .sort((a, b) => b.score - a.score || a.index - b.index);

    const picked: string[] = [];
    const seen = new Set<string>();
    for (const item of scored) {
        if (seen.has(item.normalized)) continue;
        seen.add(item.normalized);
        picked.push(item.token);
        if (picked.length >= Math.max(1, limit)) break;
    }
    return picked;
}

function getCaptionEmoji(text: string, importantWords: string[] = []): string {
    const importantText = importantWords.map((word) => word.trim()).filter(Boolean).join(' ');
    const sourceText = importantText || text;
    const words = new Set((sourceText.match(/[A-Za-z0-9']+/g) ?? []).map((word) => word.toLowerCase()));
    for (const [triggers, emoji] of CAPTION_EMOJI_RULES_SAFE) {
        if (triggers.some((trigger) => words.has(trigger))) return emoji;
    }
    return '';
}

function renderHighlightedCaption(text: string, highlightWords: string[]): ReactNode[] {
    const normalized = new Set(highlightWords.map(normalizeCaptionWord).filter(Boolean));
    if (normalized.size === 0) return [text];
    return text.split(/(\s+)/).map((part, index) => {
        if (!part || /^\s+$/.test(part)) return part;
        if (!normalized.has(normalizeCaptionWord(part))) return part;
        return (
            <span key={`${part}-${index}`} style={{ color: CAPTION_HIGHLIGHT_COLOR }}>
                {part}
            </span>
        );
    });
}

function formatMs(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function safeDownloadName(value: string): string {
    return (value || 'short')
        .split('')
        .filter((char) => char.charCodeAt(0) >= 32)
        .join('')
        .replace(/[<>:"/\\|?*]+/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 90) || 'short';
}

function getDownloadFileName(item: LongToShortItem): string {
    return `${safeDownloadName(item.title || item.short_id)}.mp4`;
}

function sortShortsByScore(items: LongToShortItem[] | undefined | null): LongToShortItem[] {
    return [...(items ?? [])].sort((a, b) => {
        const scoreDelta = (Number(b.engagement_rate) || 0) - (Number(a.engagement_rate) || 0);
        if (scoreDelta !== 0) return scoreDelta;
        const hookDelta = (Number(b.score_breakdown?.hook_quality) || 0) - (Number(a.score_breakdown?.hook_quality) || 0);
        if (hookDelta !== 0) return hookDelta;
        const coherenceDelta = (Number(b.score_breakdown?.standalone_coherence) || 0) - (Number(a.score_breakdown?.standalone_coherence) || 0);
        if (coherenceDelta !== 0) return coherenceDelta;
        return (Number(a.start_ms) || 0) - (Number(b.start_ms) || 0);
    });
}

async function getDownloadErrorMessage(error: unknown, fallback: string): Promise<string> {
    const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
    if (data instanceof Blob) {
        const text = await data.text();
        if (text.trim()) {
            try {
                const parsed = JSON.parse(text) as { detail?: unknown; message?: unknown; error?: unknown };
                const detail = parsed.detail || parsed.message || parsed.error;
                if (typeof detail === 'string' && detail.trim()) return detail.trim();
            } catch {
                return text.trim();
            }
        }
    }
    return getApiErrorMessage(error, fallback);
}

function toBaseName(fileName: string): string {
    const trimmed = fileName.trim();
    if (!trimmed) return 'Long to Viral Project';
    const idx = trimmed.lastIndexOf('.');
    return idx > 0 ? trimmed.slice(0, idx) : trimmed;
}

function formatProjectDate(iso: string | undefined): string {
    if (!iso) return 'Unknown';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
}

function getStatusTone(status: string): string {
    const normalized = status.trim().toLowerCase();
    if (normalized === 'ready' || normalized === 'complete') return 'text-[var(--color-success)]';
    if (normalized === 'processing' || normalized === 'queued' || normalized === 'running' || normalized === 'analyzing') return 'text-[var(--color-warning)]';
    if (normalized === 'error' || normalized === 'failed') return 'text-[var(--color-danger)]';
    return 'text-[var(--color-gray-500)]';
}

type LongToShortsPageProps = {
    mode?: 'home' | 'studio';
};

export default function LongToShortsPage({ mode = 'home' }: LongToShortsPageProps) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isStudioPage = mode === 'studio';
    const routeProjectId = searchParams.get('project')?.trim() || null;
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const loadedRouteProjectIdRef = useRef<string | null>(null);

    const [sourceMode, setSourceMode] = useState<SourceMode>('upload');
    const [projectName, setProjectName] = useState('');
    const [youtubeUrl, setYouTubeUrl] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [targetCount, setTargetCount] = useState(0);
    const [minDurationSec, setMinDurationSec] = useState(15);
    const [maxDurationSec, setMaxDurationSec] = useState(45);
    const [targetAspectRatio, setTargetAspectRatio] = useState<'9:16' | '16:9'>('9:16');
    const [reframeMode, setReframeMode] = useState<ReframeMode>('person_center');
    const [captionStyle, setCaptionStyle] = useState<CaptionStylePreset>('comic_story');

    const [stage, setStage] = useState<WorkflowStage>('idle');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [uploadPct, setUploadPct] = useState(0);

    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const [streamProjectId, setStreamProjectId] = useState<string | null>(null);
    const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
    const [analysisTriggeredForProjectId, setAnalysisTriggeredForProjectId] = useState<string | null>(null);
    const [shorts, setShorts] = useState<LongToShortItem[]>([]);
    const [analysisWarnings, setAnalysisWarnings] = useState<string[]>([]);
    const [analysisReframeMethod, setAnalysisReframeMethod] = useState<'subject_crop' | 'smart_fit' | null>(null);
    const [resolvedErrorJobId, setResolvedErrorJobId] = useState<string | null>(null);
    const [showCreateWorkspace, setShowCreateWorkspace] = useState(isStudioPage);
    const [recentProjects, setRecentProjects] = useState<Project[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [projectsError, setProjectsError] = useState<string | null>(null);
    const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
    const [preflight, setPreflight] = useState<LongToShortPreflightResponse | null>(null);
    const [preflightLoading, setPreflightLoading] = useState(true);
    const [previewShortId, setPreviewShortId] = useState<string | null>(null);
    const [previewSourceUrl, setPreviewSourceUrl] = useState<string | null>(null);
    const [previewSourceProjectId, setPreviewSourceProjectId] = useState<string | null>(null);
    const [previewSourceAspectRatio, setPreviewSourceAspectRatio] = useState<'16:9' | '9:16' | null>(null);
    const [previewSourceReframeMode, setPreviewSourceReframeMode] = useState<ReframeMode | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [previewMuted, setPreviewMuted] = useState(true);
    const [previewPlaying, setPreviewPlaying] = useState(false);
    const [previewCurrentMs, setPreviewCurrentMs] = useState(0);
    const [downloadingShortId, setDownloadingShortId] = useState<string | null>(null);

    const transcription = useTranscriptionStream(streamProjectId);
    const previewVideoRef = useRef<HTMLVideoElement | null>(null);
    const previewBackgroundVideoRef = useRef<HTMLVideoElement | null>(null);
    const previewBlobRef = useRef<string | null>(null);

    const busy = useMemo(
        () => ['uploading', 'importing', 'queued', 'processing', 'analyzing'].includes(stage),
        [stage],
    );
    const targetCountLabel = targetCount === 0 ? 'Auto max' : `${targetCount}`;

    const transcriptionProgress = useMemo(() => {
        if (transcription.status === 'processing' || transcription.status === 'queued') {
            return Math.max(0, Math.min(100, transcription.progress ?? 0));
        }
        if (stage === 'uploading') return uploadPct;
        return 0;
    }, [stage, transcription.progress, transcription.status, uploadPct]);

    const progressStageLabel = useMemo(() => {
        if (stage === 'uploading') return 'Uploading';
        if (stage === 'importing') return 'Importing';
        if (stage === 'analyzing') return 'Analyzing';
        return 'Transcribing';
    }, [stage]);

    const pipelineStatusLabel = useMemo(() => {
        if (stage === 'idle') return 'Ready to create';
        if (stage === 'complete') return 'Analysis complete';
        if (stage === 'error') return 'Needs attention';
        return progressStageLabel;
    }, [progressStageLabel, stage]);

    const preflightSummary = useMemo(() => {
        if (preflightLoading) return { label: 'Checking', tone: 'text-[var(--color-warning)]', bg: 'bg-[var(--color-warning-light)]' };
        if (!preflight) return { label: 'Unavailable', tone: 'text-[var(--color-gray-500)]', bg: 'bg-[var(--color-gray-100)]' };
        if (preflight.status === 'ok') return { label: 'Ready', tone: 'text-[var(--color-success)]', bg: 'bg-[var(--color-success-light)]' };
        return { label: 'Action needed', tone: 'text-[var(--color-warning)]', bg: 'bg-[var(--color-warning-light)]' };
    }, [preflight, preflightLoading]);

    const resetOutput = useCallback(() => {
        setError(null);
        setSuccess(null);
        setShorts([]);
        setAnalysisWarnings([]);
        setAnalysisReframeMethod(null);
        setAnalysisJobId(null);
        setAnalysisTriggeredForProjectId(null);
        setResolvedErrorJobId(null);
    }, []);

    const selectedPreviewShort = useMemo(
        () => shorts.find((item) => item.short_id === previewShortId) ?? null,
        [previewShortId, shorts],
    );

    const selectedPreviewCaptionCue = useMemo<PreviewCaptionCue | null>(() => {
        if (!selectedPreviewShort) return null;
        const timedCues = (selectedPreviewShort.caption_cues || [])
            .filter((cue) => cue.text.trim().length > 0)
            .map((cue) => {
                const absoluteStart = Number.isFinite(cue.start_ms)
                    ? cue.start_ms
                    : selectedPreviewShort.start_ms + (cue.relative_start_ms ?? 0);
                const absoluteEnd = Number.isFinite(cue.end_ms)
                    ? cue.end_ms
                    : selectedPreviewShort.start_ms + (cue.relative_end_ms ?? 0);
                const emojiStart = Number.isFinite(cue.emoji_start_ms)
                    ? cue.emoji_start_ms
                    : cue.emoji_relative_start_ms != null
                        ? selectedPreviewShort.start_ms + cue.emoji_relative_start_ms
                        : undefined;
                const emojiEnd = Number.isFinite(cue.emoji_end_ms)
                    ? cue.emoji_end_ms
                    : cue.emoji_relative_end_ms != null
                        ? selectedPreviewShort.start_ms + cue.emoji_relative_end_ms
                        : undefined;
                return {
                    text: cue.text.trim(),
                    startMs: Math.max(selectedPreviewShort.start_ms, absoluteStart),
                    endMs: Math.min(selectedPreviewShort.end_ms, absoluteEnd),
                    highlightWords: (cue.highlight_words || cue.important_words || [])
                        .map((word) => String(word).trim())
                        .filter(Boolean),
                    emoji: String(cue.emoji || '').trim(),
                    emojiStartMs: typeof emojiStart === 'number'
                        ? Math.max(selectedPreviewShort.start_ms, emojiStart)
                        : undefined,
                    emojiEndMs: typeof emojiEnd === 'number'
                        ? Math.min(selectedPreviewShort.end_ms, emojiEnd)
                        : undefined,
                };
            })
            .filter((cue) => cue.endMs > cue.startMs)
            .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

        if (timedCues.length > 0) {
            const activeCue = timedCues.find(
                (cue) => previewCurrentMs >= cue.startMs - 80 && previewCurrentMs < cue.endMs + 120,
            );
            if (!activeCue) return null;
            const highlightWords = activeCue.highlightWords.length > 0
                ? activeCue.highlightWords
                : getImportantCaptionWords(activeCue.text);
            const emoji = activeCue.emoji || getCaptionEmoji(activeCue.text, highlightWords);
            const emojiActive = Boolean(
                emoji
                && typeof activeCue.emojiStartMs === 'number'
                && typeof activeCue.emojiEndMs === 'number'
                && previewCurrentMs >= activeCue.emojiStartMs
                && previewCurrentMs < activeCue.emojiEndMs,
            );
            return {
                text: activeCue.text,
                highlightWords,
                emoji: emojiActive ? emoji : undefined,
                emojiStartMs: activeCue.emojiStartMs,
                emojiEndMs: activeCue.emojiEndMs,
            };
        }

        const lines = selectedPreviewShort.captions.filter((line) => line.trim().length > 0);
        if (lines.length === 0) {
            const text = selectedPreviewShort.primary_caption;
            const highlightWords = getImportantCaptionWords(text);
            return text ? { text, highlightWords, emoji: getCaptionEmoji(text, highlightWords) } : null;
        }
        const total = Math.max(1, selectedPreviewShort.end_ms - selectedPreviewShort.start_ms);
        const rel = Math.max(0, Math.min(total, previewCurrentMs - selectedPreviewShort.start_ms));
        const index = Math.min(lines.length - 1, Math.floor((rel / total) * lines.length));
        const text = lines[index] || selectedPreviewShort.primary_caption;
        const highlightWords = getImportantCaptionWords(text);
        return text ? { text, highlightWords, emoji: getCaptionEmoji(text, highlightWords) } : null;
    }, [previewCurrentMs, selectedPreviewShort]);

    const selectedPreviewCaption = selectedPreviewCaptionCue?.text ?? '';
    const selectedPreviewCaptionEmoji = selectedPreviewCaptionCue?.emoji ?? '';
    const selectedPreviewCaptionNodes = useMemo(
        () => renderHighlightedCaption(selectedPreviewCaption, selectedPreviewCaptionCue?.highlightWords ?? []),
        [selectedPreviewCaption, selectedPreviewCaptionCue?.highlightWords],
    );

    const selectedPreviewCaptionStyle = useMemo<CaptionStylePreset>(() => {
        const raw = String(selectedPreviewShort?.caption_style || captionStyle).trim().toLowerCase();
        if (raw === 'clean_modern') return 'clean_modern';
        if (raw === 'subtitle_minimal') return 'subtitle_minimal';
        return 'comic_story';
    }, [captionStyle, selectedPreviewShort?.caption_style]);

    const selectedPreviewCaptionCss = useMemo(
        () => getCaptionPreviewStyle(selectedPreviewCaptionStyle),
        [selectedPreviewCaptionStyle],
    );

    const loadProjects = useCallback(async () => {
        setProjectsLoading(true);
        setProjectsError(null);
        try {
            const res = await projectsApi.listAll();
            const rows = (res.data || [])
                .filter((item) => {
                    const type = (item.type || '').trim().toLowerCase();
                    return type === 'long_to_shorts' || type === 'long-to-shorts';
                })
                .sort((a, b) => {
                    const ta = new Date(a.created_at).getTime();
                    const tb = new Date(b.created_at).getTime();
                    return tb - ta;
                });
            setRecentProjects(rows.slice(0, 12));
        } catch (err: unknown) {
            setProjectsError(getApiErrorMessage(err, 'Unable to load Long to Viral projects.'));
        } finally {
            setProjectsLoading(false);
        }
    }, []);

    const handleDeleteProject = useCallback(async (project: Project) => {
        const confirmed = window.confirm(`Delete project "${project.name}"?`);
        if (!confirmed) return;

        setDeletingProjectId(project.id);
        try {
            await projectsApi.delete(project.id);
            if (activeProjectId === project.id) {
                setActiveProjectId(null);
                setStreamProjectId(null);
                setStage('idle');
                resetOutput();
            }
            await loadProjects();
        } catch (err: unknown) {
            const detail = getApiErrorMessage(err, 'Unable to delete project.');
            setError(detail);
        } finally {
            setDeletingProjectId(null);
        }
    }, [activeProjectId, loadProjects, resetOutput]);

    const useBlurFitCaptionBelow = useMemo(() => {
        if (!selectedPreviewShort) return false;
        const selectedMode = (selectedPreviewShort.reframe_mode as ReframeMode | undefined) || reframeMode;
        return selectedPreviewShort.aspect_ratio === '9:16'
            && (analysisReframeMethod === 'smart_fit' || selectedMode === 'fit_blur');
    }, [analysisReframeMethod, reframeMode, selectedPreviewShort]);

    const openCaptionCss = useMemo<CSSProperties>(() => ({
        color: 'var(--color-gray-50)',
        textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 14px rgba(0,0,0,0.45)',
        fontFamily: selectedPreviewCaptionStyle === 'comic_story' ? KOMIKA_AXIS_FONT_STACK : undefined,
        WebkitTextStroke: selectedPreviewCaptionStyle === 'comic_story' ? '1.1px #000000' : undefined,
        paintOrder: selectedPreviewCaptionStyle === 'comic_story' ? 'stroke fill' : undefined,
        letterSpacing: selectedPreviewCaptionStyle === 'comic_story' ? '0.01em' : 0,
        textTransform: selectedPreviewCaptionStyle === 'comic_story' ? 'uppercase' : 'none',
        fontWeight: selectedPreviewCaptionStyle === 'subtitle_minimal' ? 600 : 900,
        background: 'transparent',
    }), [selectedPreviewCaptionStyle]);

    const primaryActionLabel = useMemo(
        () => (sourceMode === 'upload' ? 'Upload and Analyze' : 'Import and Analyze'),
        [sourceMode],
    );

    const durationInvalid = useMemo(
        () => maxDurationSec <= minDurationSec,
        [maxDurationSec, minDurationSec],
    );

    const workflowSteps = useMemo(() => {
        const activeIndex = stage === 'idle'
            ? 0
            : stage === 'uploading' || stage === 'importing'
                ? 0
                : stage === 'queued' || stage === 'processing'
                    ? 1
                    : stage === 'analyzing'
                        ? 2
                        : 3;
        const errored = stage === 'error';
        return ['Source', 'Transcribe', 'Analyze', 'Review'].map((label, index) => ({
            label,
            state: errored && index === activeIndex
                ? 'error'
                : index < activeIndex || stage === 'complete'
                    ? 'done'
                    : index === activeIndex && stage !== 'idle'
                        ? 'active'
                        : 'idle',
        }));
    }, [stage]);

    const chooseSourceFile = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleSourceFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        setSourceMode('upload');
        setSelectedFile(file);
        if (file && !projectName.trim()) {
            setProjectName(toBaseName(file.name));
        }
    }, [projectName]);

    const handleSourceFileDrop = useCallback((event: DragEvent<HTMLButtonElement>) => {
        event.preventDefault();
        if (busy) return;
        const file = event.dataTransfer.files?.[0] ?? null;
        if (!file) return;
        setSourceMode('upload');
        setSelectedFile(file);
        if (!projectName.trim()) {
            setProjectName(toBaseName(file.name));
        }
    }, [busy, projectName]);

    const selectUploadMode = useCallback(() => {
        setSourceMode('upload');
    }, []);

    const selectYouTubeMode = useCallback(() => {
        setSourceMode('youtube');
    }, []);

    const openEditor = useCallback((projectId: string) => {
        navigate(`/dashboard/video-editor/${projectId}`);
    }, [navigate]);

    const openProjectStudio = useCallback((projectId: string) => {
        navigate(`/dashboard/long-to-shorts/studio?project=${encodeURIComponent(projectId)}`);
    }, [navigate]);

    const openActiveEditor = useCallback(() => {
        if (activeProjectId) {
            openEditor(activeProjectId);
        }
    }, [activeProjectId, openEditor]);

    const togglePreviewMuted = useCallback(() => {
        setPreviewMuted((prev) => !prev);
    }, []);

    const syncPreviewBackgroundVideo = useCallback((shouldPlay?: boolean) => {
        const foreground = previewVideoRef.current;
        const background = previewBackgroundVideoRef.current;
        if (!foreground || !background) return;

        background.muted = true;
        try {
            if (Number.isFinite(foreground.currentTime) && Math.abs(background.currentTime - foreground.currentTime) > 0.08) {
                background.currentTime = foreground.currentTime;
            }
        } catch {
            // Metadata may not be ready yet; the next metadata/timeupdate event will resync it.
        }

        const play = shouldPlay ?? !foreground.paused;
        if (play) {
            void background.play().catch(() => undefined);
        } else {
            background.pause();
        }
    }, []);

    const markPreviewPlaying = useCallback(() => {
        setPreviewPlaying(true);
        syncPreviewBackgroundVideo(true);
    }, [syncPreviewBackgroundVideo]);

    const markPreviewPaused = useCallback(() => {
        setPreviewPlaying(false);
        syncPreviewBackgroundVideo(false);
    }, [syncPreviewBackgroundVideo]);

    const openCreateWorkspace = useCallback(() => {
        if (!isStudioPage) {
            navigate('/dashboard/long-to-shorts/studio');
            return;
        }
        setShowCreateWorkspace(true);
    }, [isStudioPage, navigate]);

    const hideCreateWorkspace = useCallback(() => {
        if (isStudioPage) {
            navigate('/dashboard/long-to-shorts');
            return;
        }
        setShowCreateWorkspace(false);
    }, [isStudioPage, navigate]);

    const loadPreflight = useCallback(async () => {
        setPreflightLoading(true);
        try {
            const res = await longToShortsApi.preflight();
            setPreflight(res.data);
        } catch {
            setPreflight(null);
        } finally {
            setPreflightLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadPreflight();
    }, [loadPreflight]);

    useEffect(() => {
        void loadProjects();
    }, [loadProjects]);

    useEffect(() => {
        if (!isStudioPage && routeProjectId) {
            navigate(`/dashboard/long-to-shorts/studio?project=${encodeURIComponent(routeProjectId)}`, { replace: true });
        }
    }, [isStudioPage, navigate, routeProjectId]);

    useEffect(() => {
        if (isStudioPage) {
            setShowCreateWorkspace(true);
        }
    }, [isStudioPage]);

    useEffect(() => {
        if (!isStudioPage || !routeProjectId) return;
        if (loadedRouteProjectIdRef.current === routeProjectId) return;

        loadedRouteProjectIdRef.current = routeProjectId;
        setActiveProjectId(routeProjectId);
        setShowCreateWorkspace(true);
        setError(null);
        setSuccess(null);

        let cancelled = false;
        longToShortsApi.getLatest(routeProjectId)
            .then((res) => {
                if (cancelled) return;
                const data = res.data;
                setAnalysisJobId(data.job_id ?? null);
                setShorts(sortShortsByScore(data.shorts));
                setAnalysisWarnings(data.warnings ?? []);
                const method = String(data.reframe?.method || '').trim();
                setAnalysisReframeMethod(method === 'smart_fit' ? 'smart_fit' : method === 'subject_crop' ? 'subject_crop' : null);
                if (data.auto_clip_count) {
                    setTargetCount(0);
                } else if (typeof data.requested_target_count === 'number') {
                    setTargetCount(data.requested_target_count);
                } else if (typeof data.target_count === 'number') {
                    setTargetCount(data.target_count);
                }
                if (data.min_duration_sec) setMinDurationSec(data.min_duration_sec);
                if (data.max_duration_sec) setMaxDurationSec(data.max_duration_sec);
                if (data.target_aspect_ratio) setTargetAspectRatio(data.target_aspect_ratio);
                if (data.reframe_mode) setReframeMode(data.reframe_mode);
                if (data.caption_style && data.caption_style in CAPTION_STYLE_LABELS) {
                    setCaptionStyle(data.caption_style as CaptionStylePreset);
                }
                setStage(data.status === 'complete' ? 'complete' : data.status === 'error' ? 'error' : 'idle');
            })
            .catch(() => {
                if (!cancelled) {
                    setStage('idle');
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isStudioPage, routeProjectId]);

    useEffect(() => {
        if (stage !== 'idle' || shorts.length > 0 || !!analysisJobId) {
            setShowCreateWorkspace(true);
        }
    }, [analysisJobId, shorts.length, stage]);

    const revokePreviewBlob = useCallback(() => {
        if (!previewBlobRef.current) return;
        URL.revokeObjectURL(previewBlobRef.current);
        previewBlobRef.current = null;
    }, []);

    useEffect(() => () => {
        revokePreviewBlob();
    }, [revokePreviewBlob]);

    useEffect(() => {
        setPreviewShortId(null);
        setPreviewCurrentMs(0);
        setPreviewError(null);
        setPreviewPlaying(false);
        setPreviewSourceUrl(null);
        setPreviewSourceProjectId(null);
        setPreviewSourceAspectRatio(null);
        setPreviewSourceReframeMode(null);
        const video = previewVideoRef.current;
        if (video) {
            video.pause();
            video.removeAttribute('src');
            video.load();
        }
        const backgroundVideo = previewBackgroundVideoRef.current;
        if (backgroundVideo) {
            backgroundVideo.pause();
            backgroundVideo.removeAttribute('src');
            backgroundVideo.load();
        }
        revokePreviewBlob();
    }, [activeProjectId, revokePreviewBlob]);

    useEffect(() => {
        const video = previewVideoRef.current;
        if (!video) return;
        video.muted = previewMuted;
    }, [previewMuted]);

    useEffect(() => {
        if (!previewShortId) return;
        const exists = shorts.some((item) => item.short_id === previewShortId);
        if (!exists) {
            setPreviewShortId(null);
            setPreviewCurrentMs(0);
            setPreviewPlaying(false);
        }
    }, [previewShortId, shorts]);

    const loadPreviewSource = useCallback(async (
        projectId: string,
        aspectRatio: '16:9' | '9:16',
        mode: ReframeMode,
    ): Promise<string | null> => {
        if (
            previewSourceUrl
            && previewSourceProjectId === projectId
            && previewSourceAspectRatio === aspectRatio
            && previewSourceReframeMode === mode
        ) {
            return previewSourceUrl;
        }

        setPreviewLoading(true);
        setPreviewError(null);
        try {
            const useClientBlurFit = aspectRatio === '9:16' && (mode === 'fit_blur' || analysisReframeMethod === 'smart_fit');
            const blobUrl = useClientBlurFit
                ? await mediaApi.getAuthenticatedStreamUrl(projectId)
                : await mediaApi.getAuthenticatedStreamUrl(projectId, aspectRatio, mode);
            revokePreviewBlob();
            previewBlobRef.current = blobUrl;
            setPreviewSourceUrl(blobUrl);
            setPreviewSourceProjectId(projectId);
            setPreviewSourceAspectRatio(aspectRatio);
            setPreviewSourceReframeMode(mode);
            return blobUrl;
        } catch (err: unknown) {
            const detail = getApiErrorMessage(err, 'Unable to load preview video.');
            setPreviewError(detail);
            return null;
        } finally {
            setPreviewLoading(false);
        }
    }, [
        previewSourceAspectRatio,
        previewSourceProjectId,
        previewSourceReframeMode,
        previewSourceUrl,
        analysisReframeMethod,
        revokePreviewBlob,
    ]);

    const handlePreviewShort = useCallback(async (item: LongToShortItem) => {
        if (!activeProjectId) {
            setPreviewError('Project media is not available yet.');
            return;
        }

        const mode: ReframeMode = (item.reframe_mode as ReframeMode | undefined) || reframeMode;
        const blobUrl = await loadPreviewSource(activeProjectId, item.aspect_ratio, mode);
        if (!blobUrl) return;

        setPreviewShortId(item.short_id);
        setPreviewCurrentMs(item.start_ms);
        setPreviewPlaying(true);

        const video = previewVideoRef.current;
        if (!video) return;

        const seekSec = item.start_ms / 1000;
        if (video.src !== blobUrl) {
            video.src = blobUrl;
            video.load();
            const backgroundVideo = previewBackgroundVideoRef.current;
            if (backgroundVideo) {
                backgroundVideo.src = blobUrl;
                backgroundVideo.load();
            }
            return;
        }

        video.currentTime = seekSec;
        const backgroundVideo = previewBackgroundVideoRef.current;
        if (backgroundVideo) {
            try {
                backgroundVideo.currentTime = seekSec;
            } catch {
                // Metadata may not be ready yet.
            }
        }
        void video.play()
            .then(() => {
                setPreviewPlaying(true);
                syncPreviewBackgroundVideo(true);
            })
            .catch(() => setPreviewPlaying(false));
    }, [activeProjectId, loadPreviewSource, reframeMode, syncPreviewBackgroundVideo]);

    const handleDownloadShort = useCallback(async (item: LongToShortItem) => {
        if (!activeProjectId) {
            setError('Project media is not available yet.');
            return;
        }

        setDownloadingShortId(item.short_id);
        setError(null);
        try {
            const res = await longToShortsApi.downloadShort(activeProjectId, item.short_id);
            const url = URL.createObjectURL(res.data);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = getDownloadFileName(item);
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1500);
        } catch (err: unknown) {
            setError(await getDownloadErrorMessage(err, 'Unable to download this short.'));
        } finally {
            setDownloadingShortId(null);
        }
    }, [activeProjectId]);

    const handlePreviewLoadedMetadata = useCallback(() => {
        if (!selectedPreviewShort) return;
        const video = previewVideoRef.current;
        if (!video) return;
        video.currentTime = selectedPreviewShort.start_ms / 1000;
        syncPreviewBackgroundVideo(previewPlaying);
        if (!previewPlaying) return;
        void video.play()
            .then(() => {
                setPreviewPlaying(true);
                syncPreviewBackgroundVideo(true);
            })
            .catch(() => setPreviewPlaying(false));
    }, [previewPlaying, selectedPreviewShort, syncPreviewBackgroundVideo]);

    const handlePreviewTimeUpdate = useCallback(() => {
        const video = previewVideoRef.current;
        if (!video || !selectedPreviewShort) return;

        const nowMs = Math.floor(video.currentTime * 1000);
        if (nowMs < selectedPreviewShort.start_ms) {
            video.currentTime = selectedPreviewShort.start_ms / 1000;
            setPreviewCurrentMs(selectedPreviewShort.start_ms);
            syncPreviewBackgroundVideo(previewPlaying);
            return;
        }
        if (nowMs >= selectedPreviewShort.end_ms) {
            video.currentTime = selectedPreviewShort.start_ms / 1000;
            setPreviewCurrentMs(selectedPreviewShort.start_ms);
            syncPreviewBackgroundVideo(previewPlaying);
            if (previewPlaying) {
                void video.play()
                    .then(() => {
                        setPreviewPlaying(true);
                        syncPreviewBackgroundVideo(true);
                    })
                    .catch(() => setPreviewPlaying(false));
            }
            return;
        }

        syncPreviewBackgroundVideo(previewPlaying);
        setPreviewCurrentMs(nowMs);
    }, [previewPlaying, selectedPreviewShort, syncPreviewBackgroundVideo]);

    const togglePreviewPlayback = useCallback(() => {
        const video = previewVideoRef.current;
        if (!video || !selectedPreviewShort) return;

        if (previewPlaying) {
            video.pause();
            syncPreviewBackgroundVideo(false);
            setPreviewPlaying(false);
            return;
        }

        const nowMs = Math.floor(video.currentTime * 1000);
        if (nowMs < selectedPreviewShort.start_ms || nowMs >= selectedPreviewShort.end_ms) {
            video.currentTime = selectedPreviewShort.start_ms / 1000;
            setPreviewCurrentMs(selectedPreviewShort.start_ms);
        }

        void video.play()
            .then(() => {
                setPreviewPlaying(true);
                syncPreviewBackgroundVideo(true);
            })
            .catch(() => setPreviewPlaying(false));
    }, [previewPlaying, selectedPreviewShort, syncPreviewBackgroundVideo]);

    const closePreview = useCallback(() => {
        const video = previewVideoRef.current;
        if (video) {
            video.pause();
        }
        const backgroundVideo = previewBackgroundVideoRef.current;
        if (backgroundVideo) {
            backgroundVideo.pause();
        }
        setPreviewPlaying(false);
        setPreviewShortId(null);
        setPreviewCurrentMs(0);
        setPreviewError(null);
    }, []);

    const runAnalysis = useCallback(async (projectId: string) => {
        setStage('analyzing');
        setError(null);
        setAnalysisWarnings([]);
        try {
            const res = await longToShortsApi.analyze(projectId, {
                target_count: targetCount,
                min_duration_sec: minDurationSec,
                max_duration_sec: maxDurationSec,
                target_aspect_ratio: targetAspectRatio,
                reframe_mode: reframeMode,
                caption_style: captionStyle,
            });
            setAnalysisJobId(res.data.job_id);
            setShorts(sortShortsByScore(res.data.shorts));
            setAnalysisWarnings(res.data.warnings || []);
            const method = String(res.data.reframe?.method || '').trim();
            setAnalysisReframeMethod(method === 'smart_fit' ? 'smart_fit' : method === 'subject_crop' ? 'subject_crop' : null);
            setStage('complete');
            setSuccess(
                `Generated ${res.data.shorts_count} short segment${res.data.shorts_count === 1 ? '' : 's'} `
                + `(${targetAspectRatio}, ${CAPTION_STYLE_LABELS[captionStyle]}).`,
            );
        } catch (err: unknown) {
            const detail = getApiErrorMessage(err, 'Shorts analysis failed.');
            setStage('error');
            setError(detail);
        }
    }, [captionStyle, maxDurationSec, minDurationSec, reframeMode, targetAspectRatio, targetCount]);

    useEffect(() => {
        if (!activeProjectId) return;
        if (transcription.status === 'queued') setStage('queued');
        if (transcription.status === 'processing') setStage('processing');

        if (transcription.status === 'error') {
            setStage('error');
            const sseMsg = transcription.errorMessage?.trim();
            if (sseMsg) {
                setError(sseMsg);
            } else {
                setError('Transcription failed for this project.');
            }

            if (transcription.jobId && resolvedErrorJobId !== transcription.jobId) {
                setResolvedErrorJobId(transcription.jobId);
                transcriptionApi.get(activeProjectId)
                    .then((res) => {
                        const detail = res.data?.error_message;
                        if (detail && detail.trim()) {
                            setError(detail.trim());
                        }
                    })
                    .catch(() => {
                        // Keep existing error message if lookup fails.
                    });
            }
            return;
        }

        if (transcription.status === 'complete' && analysisTriggeredForProjectId !== activeProjectId) {
            setAnalysisTriggeredForProjectId(activeProjectId);
            void runAnalysis(activeProjectId);
        }
    }, [
        activeProjectId,
        analysisTriggeredForProjectId,
        resolvedErrorJobId,
        runAnalysis,
        transcription.errorMessage,
        transcription.jobId,
        transcription.status,
    ]);

    const startFromUpload = useCallback(async () => {
        if (!selectedFile) {
            setError('Select a video file first.');
            return;
        }
        if (maxDurationSec <= minDurationSec) {
            setError('Max duration must be greater than min duration.');
            return;
        }

        resetOutput();
        setStage('uploading');
        setUploadPct(0);
        setStreamProjectId(null);

        try {
            const name = projectName.trim() || toBaseName(selectedFile.name);
            const projectRes = await projectsApi.create(name, 'long_to_shorts');
            const projectId = projectRes.data.id;
            loadedRouteProjectIdRef.current = projectId;
            setActiveProjectId(projectId);
            navigate(`/dashboard/long-to-shorts/studio?project=${encodeURIComponent(projectId)}`, { replace: true });

            await mediaApi.upload(projectId, selectedFile, (progressEvent) => {
                const total = progressEvent.total ?? 0;
                const loaded = progressEvent.loaded ?? 0;
                const pct = total > 0 ? Math.round((loaded * 100) / total) : 0;
                setUploadPct(pct);
            });

            await transcriptionApi.start(projectId);
            setStreamProjectId(projectId);
            setStage('queued');
            setSuccess('Upload completed. Transcription started.');
            void loadProjects();
        } catch (err: unknown) {
            const detail = getApiErrorMessage(err, 'Upload/transcription start failed.');
            setStage('error');
            setError(detail);
        }
    }, [
        loadProjects,
        maxDurationSec,
        minDurationSec,
        navigate,
        projectName,
        resetOutput,
        selectedFile,
    ]);

    const startFromYouTube = useCallback(async () => {
        if (!youtubeUrl.trim()) {
            setError('Enter a YouTube URL first.');
            return;
        }
        if (maxDurationSec <= minDurationSec) {
            setError('Max duration must be greater than min duration.');
            return;
        }

        resetOutput();
        setStage('importing');
        setStreamProjectId(null);

        try {
            const importRes = await longToShortsApi.importYouTube(youtubeUrl.trim(), projectName.trim() || undefined);
            const projectId = importRes.data.project_id;
            loadedRouteProjectIdRef.current = projectId;
            setActiveProjectId(projectId);
            navigate(`/dashboard/long-to-shorts/studio?project=${encodeURIComponent(projectId)}`, { replace: true });

            await transcriptionApi.start(projectId);
            setStreamProjectId(projectId);
            setStage('queued');
            setSuccess('YouTube import completed. Transcription started.');
            void loadProjects();
        } catch (err: unknown) {
            const detail = getApiErrorMessage(err, 'YouTube import failed.');
            setStage('error');
            setError(detail);
        }
    }, [
        loadProjects,
        maxDurationSec,
        minDurationSec,
        navigate,
        projectName,
        resetOutput,
        youtubeUrl,
    ]);

    const rerunAnalysis = useCallback(async () => {
        if (!activeProjectId) {
            setError('No project available for analysis yet.');
            return;
        }
        if (maxDurationSec <= minDurationSec) {
            setError('Max duration must be greater than min duration.');
            return;
        }
        setError(null);
        setSuccess(null);
        await runAnalysis(activeProjectId);
    }, [activeProjectId, maxDurationSec, minDurationSec, runAnalysis]);

    const startPipeline = useCallback(() => {
        if (sourceMode === 'upload') {
            void startFromUpload();
            return;
        }
        void startFromYouTube();
    }, [sourceMode, startFromUpload, startFromYouTube]);

    const sourceReady = sourceMode === 'upload' ? Boolean(selectedFile) : Boolean(youtubeUrl.trim());
    const sourceTitle = sourceMode === 'upload'
        ? selectedFile?.name || 'Paste link or drag your video here'
        : youtubeUrl.trim() || 'Paste link or drag your video here';
    const selectedActionShort = selectedPreviewShort ?? shorts[0] ?? null;
    const processingPercent = Math.round(stage === 'uploading' || stage === 'importing' ? uploadPct : transcriptionProgress);
    const setupTemplates = [
        { id: 'comic_story' as CaptionStylePreset, name: 'Viral Pop', bg: 'from-fuchsia-300 to-violet-500' },
        { id: 'clean_modern' as CaptionStylePreset, name: 'Modern', bg: 'from-sky-200 to-emerald-200' },
        { id: 'subtitle_minimal' as CaptionStylePreset, name: 'Clean', bg: 'from-zinc-200 to-zinc-500' },
        { id: 'comic_story' as CaptionStylePreset, name: 'Creator', bg: 'from-amber-200 to-pink-300' },
        { id: 'clean_modern' as CaptionStylePreset, name: 'Business', bg: 'from-blue-100 to-slate-300' },
    ];
    const processingChecks = [
        { label: 'Upload', done: stage !== 'uploading' || uploadPct >= 100 },
        { label: 'Create project', done: Boolean(activeProjectId) },
        { label: 'Process video', done: ['processing', 'analyzing', 'complete'].includes(stage) || shorts.length > 0 },
        { label: `Finding best parts${busy ? `...${processingPercent}%` : ''}`, done: shorts.length > 0 || stage === 'complete', active: busy },
        { label: 'Edit clips', done: shorts.length > 0, muted: shorts.length === 0 },
        { label: 'Finalize', done: stage === 'complete' && shorts.length > 0, muted: shorts.length === 0 },
    ];

    const handleHomePrimary = useCallback(() => {
        if (youtubeUrl.trim()) {
            setSourceMode('youtube');
            void startFromYouTube();
            return;
        }
        if (selectedFile) {
            setSourceMode('upload');
            void startFromUpload();
            return;
        }
        chooseSourceFile();
    }, [chooseSourceFile, selectedFile, startFromUpload, startFromYouTube, youtubeUrl]);

    const shareShort = useCallback(async (item?: LongToShortItem | null) => {
        const short = item ?? selectedActionShort;
        const url = `${window.location.origin}/dashboard/long-to-shorts/studio${activeProjectId ? `?project=${encodeURIComponent(activeProjectId)}` : ''}`;
        const title = short?.title || 'Long to Viral clip';
        try {
            if (navigator.share) {
                await navigator.share({ title, url });
                return;
            }
            await navigator.clipboard.writeText(url);
            setSuccess('Share link copied.');
        } catch {
            setSuccess('Share link copied.');
        }
    }, [activeProjectId, selectedActionShort]);

    if (!isStudioPage) {
        return (
            <div className="min-h-[calc(100vh-4rem)] w-full bg-background p-4 sm:p-6 lg:p-8">
                <input ref={fileInputRef} type="file" className="hidden" accept="video/*" onChange={handleSourceFileChange} />
                <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-8">
                    <section className="rounded-[2rem] border border-border bg-[linear-gradient(110deg,rgba(144,118,255,0.18),rgba(255,255,255,0.92),rgba(255,215,239,0.55))] px-5 py-14 sm:px-8 lg:px-12">
                        <div className="mx-auto max-w-4xl text-center">
                            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                                Turn your long video into <span className="text-primary">Viral Clips</span>
                            </h1>
                            <div className="mx-auto mt-7 flex max-w-2xl overflow-hidden rounded-full border border-border bg-card">
                                <div className="flex min-w-0 flex-1 items-center gap-3 px-5">
                                    <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <input
                                        aria-label="Video link"
                                        value={youtubeUrl}
                                        onChange={(event) => {
                                            setSourceMode('youtube');
                                            setYouTubeUrl(event.target.value);
                                        }}
                                        placeholder={selectedFile ? selectedFile.name : 'Paste link or drag your video here'}
                                        className="h-14 min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleHomePrimary}
                                    disabled={busy}
                                    className="min-w-32 bg-primary px-6 text-sm font-black uppercase text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-60"
                                >
                                    {busy ? 'Working' : 'Get clips'}
                                </button>
                            </div>
                            <div className="mt-5 flex flex-wrap justify-center gap-3">
                                <Button variant="outline" onClick={chooseSourceFile}>
                                    <UploadCloud className="h-4 w-4" />
                                    Upload local file
                                </Button>
                                <Button variant="outline" onClick={selectYouTubeMode}>
                                    <Link2 className="h-4 w-4" />
                                    Import from YouTube
                                </Button>
                                <Button variant="outline" onClick={openCreateWorkspace}>
                                    <Film className="h-4 w-4" />
                                    Open workspace
                                </Button>
                            </div>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4 flex items-center justify-between gap-4">
                            <h2 className="text-lg font-semibold">Recent projects</h2>
                            <Button variant="outline" size="sm" onClick={openCreateWorkspace}>
                                <Plus className="h-4 w-4" />
                                New project
                            </Button>
                        </div>
                        {projectsLoading ? (
                            <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading projects...</div>
                        ) : projectsError ? (
                            <div className="rounded-2xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive">{projectsError}</div>
                        ) : recentProjects.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                                No Long to Viral projects yet.
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                {recentProjects.slice(0, 8).map((project, index) => (
                                    <Card key={project.id} className="overflow-hidden p-0">
                                        <button type="button" onClick={() => openProjectStudio(project.id)} className="block w-full text-left">
                                            <div className="relative aspect-video bg-black">
                                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(120,80,255,0.35),transparent_38%),radial-gradient(circle_at_70%_70%,rgba(255,200,90,0.25),transparent_36%)]" />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/14 text-white backdrop-blur">
                                                        <Play className="h-5 w-5" />
                                                    </span>
                                                </div>
                                                <span className="absolute bottom-2 right-2 rounded bg-black/72 px-2 py-1 text-xs font-semibold text-white">
                                                    {typeof project.duration_sec === 'number' ? formatMs(project.duration_sec * 1000) : `#${index + 1}`}
                                                </span>
                                            </div>
                                            <CardContent className="space-y-1 p-4">
                                                <p className="truncate text-sm font-semibold">{project.name}</p>
                                                <p className="text-xs text-muted-foreground">{formatProjectDate(project.created_at)}</p>
                                                <p className={getStatusTone(project.status)}>{project.status || 'unknown'}</p>
                                            </CardContent>
                                        </button>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        );
    }

    if (busy && shorts.length === 0) {
        return (
            <div className="min-h-[calc(100vh-4rem)] w-full bg-background p-4 sm:p-6 lg:p-8">
                <div className="mx-auto grid w-full max-w-[1320px] gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <section className="flex min-h-[680px] flex-col">
                        <button type="button" onClick={hideCreateWorkspace} className="mb-8 inline-flex w-fit items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="h-4 w-4" />
                            Back to home
                        </button>
                        <div className="mx-auto mt-24 w-full max-w-xl">
                            <div className="rounded-2xl border border-border bg-card p-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-xl border border-border bg-muted" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold">{sourceTitle}</p>
                                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                                            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.max(8, processingPercent)}%` }} />
                                        </div>
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            {stage === 'uploading' ? `Uploading...${processingPercent}%` : stage === 'importing' ? 'Importing source...' : 'Upload successful'}
                                        </p>
                                    </div>
                                    {stage === 'uploading' ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                                </div>
                            </div>

                            <div className="mt-10">
                                <Sparkles className="mb-5 h-6 w-6 text-primary" />
                                <h1 className="text-2xl font-semibold">Analyzing content and finding clips</h1>
                                <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                                    You can safely leave this page. We keep the job running and update this workspace when clips are ready.
                                </p>
                                <div className="mt-6 space-y-3">
                                    {processingChecks.map((item) => (
                                        <div key={item.label} className={`flex items-center gap-3 text-sm font-semibold ${item.muted ? 'text-muted-foreground/55' : 'text-foreground'}`}>
                                            {item.done ? (
                                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                            ) : item.active ? (
                                                <Loader2 className="h-4 w-4 animate-spin text-foreground" />
                                            ) : (
                                                <span className="h-4 w-4 rounded-full border border-muted-foreground/45" />
                                            )}
                                            {item.label}
                                        </div>
                                    ))}
                                </div>
                                {error && (
                                    <div className="mt-6 rounded-2xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                                        {error}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    <aside className="hidden rounded-[2rem] border border-border bg-card p-6 xl:block">
                        <div className="mb-8 h-1 rounded-full bg-primary" />
                        <Badge variant="secondary">Tutorial</Badge>
                        <h2 className="mt-3 text-xl font-semibold">Turn long videos into shorts in a click</h2>
                        <div className="mt-5 aspect-video rounded-2xl border-4 border-primary/70 bg-muted" />
                        <p className="mt-5 text-sm leading-6 text-muted-foreground">
                            The AI transcribes, scores hooks, finds complete thoughts, reframes the speaker, and prepares captioned clips ready to preview.
                        </p>
                        <div className="mt-auto pt-20 text-center text-xs text-muted-foreground">1/6</div>
                    </aside>
                </div>
            </div>
        );
    }

    if (shorts.length > 0) {
        return (
            <div className="min-h-[calc(100vh-4rem)] w-full bg-background">
                <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[260px_minmax(0,1fr)]">
                    <aside className="hidden border-r border-border bg-card/70 p-4 lg:block">
                        <button type="button" onClick={hideCreateWorkspace} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </button>
                        <div className="space-y-3">
                            {shorts.map((item, index) => (
                                <button
                                    key={item.short_id}
                                    type="button"
                                    onClick={() => void handlePreviewShort(item)}
                                    className={`grid w-full grid-cols-[56px_1fr] gap-3 rounded-xl p-2 text-left transition-colors ${previewShortId === item.short_id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                                >
                                    <div className="relative aspect-[9/16] overflow-hidden rounded-lg bg-black">
                                        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{index + 1}</span>
                                    </div>
                                    <div className="min-w-0 self-center">
                                        <p className="line-clamp-2 text-xs font-semibold">{item.title}</p>
                                        <p className="mt-1 text-[11px] text-muted-foreground">{formatMs(item.start_ms)}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </aside>

                    <main className="min-w-0 p-4 sm:p-6">
                        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase text-muted-foreground">AI clips</p>
                                <h1 className="text-2xl font-semibold">Review Long to Viral clips</h1>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">{selectedActionShort ? '1 selected' : `${shorts.length} clips`}</Badge>
                                <Button onClick={() => void shareShort(selectedActionShort)} disabled={!selectedActionShort}>
                                    <Send className="h-4 w-4" />
                                    Publish
                                </Button>
                                <Button variant="outline" onClick={() => selectedActionShort && void handleDownloadShort(selectedActionShort)} disabled={!selectedActionShort || downloadingShortId === selectedActionShort?.short_id}>
                                    {downloadingShortId === selectedActionShort?.short_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                    Download
                                </Button>
                                <Button variant="outline" onClick={openActiveEditor} disabled={!activeProjectId}>
                                    <Edit3 className="h-4 w-4" />
                                    Edit clips
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => void rerunAnalysis()} disabled={!activeProjectId || busy}>
                                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                    Re-analyze
                                </Button>
                            </div>
                        </div>

                        {error && (
                            <div className="mb-4 rounded-2xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
                        )}
                        {success && !error && (
                            <div className="mb-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div>
                        )}

                        <div className="space-y-4">
                            {shorts.map((item, index) => {
                                const isSelected = previewShortId === item.short_id || (!previewShortId && index === 0);
                                const score = Math.max(0, Math.min(10, item.engagement_rate / 10));
                                const breakdown = item.score_breakdown || {};
                                const signalChips = [
                                    ['Hook', breakdown.hook_quality],
                                    ['Emotion', breakdown.emotional_intensity],
                                    ['Pace', breakdown.audio_engagement],
                                    ['Coherence', breakdown.standalone_coherence],
                                ].filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]));
                                return (
                                    <article
                                        key={item.short_id}
                                        className={`grid gap-5 rounded-2xl border bg-card p-4 transition-colors xl:grid-cols-[230px_minmax(0,1fr)] ${isSelected ? 'border-primary ring-2 ring-primary/25' : 'border-border'}`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => void handlePreviewShort(item)}
                                            className="relative mx-auto aspect-[9/16] w-full max-w-[230px] overflow-hidden rounded-xl bg-black text-white"
                                        >
                                            {previewSourceUrl && previewShortId === item.short_id ? (
                                                <>
                                                    {useBlurFitCaptionBelow && (
                                                        <video
                                                            ref={previewBackgroundVideoRef}
                                                            src={previewSourceUrl}
                                                            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-75 blur-2xl"
                                                            muted
                                                            playsInline
                                                            aria-hidden="true"
                                                            tabIndex={-1}
                                                        />
                                                    )}
                                                    <video
                                                        ref={previewVideoRef}
                                                        src={previewSourceUrl}
                                                        className={useBlurFitCaptionBelow ? 'relative z-10 h-full w-full object-contain object-center' : 'h-full w-full object-cover'}
                                                        muted={previewMuted}
                                                        playsInline
                                                        onLoadedMetadata={handlePreviewLoadedMetadata}
                                                        onTimeUpdate={handlePreviewTimeUpdate}
                                                        onPlay={markPreviewPlaying}
                                                        onPause={markPreviewPaused}
                                                    />
                                                </>
                                            ) : (
                                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_25%,rgba(120,90,255,0.34),transparent_38%),linear-gradient(180deg,#111,#050505)]" />
                                            )}
                                            <span className="absolute left-3 top-3 rounded-lg bg-black/60 px-2 py-1 text-xs font-semibold">720p</span>
                                            <span className="absolute inset-0 flex items-center justify-center">
                                                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/18 backdrop-blur">
                                                    {previewPlaying && previewShortId === item.short_id ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                                                </span>
                                            </span>
                                            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-black/70 px-2 py-1 text-xs font-semibold">
                                                {item.duration_sec.toFixed(0)}s
                                            </span>
                                            {previewShortId === item.short_id && selectedPreviewCaption && (
                                                <span
                                                    className={`absolute inset-x-3 rounded px-2 py-1 text-center text-sm font-black uppercase ${
                                                        useBlurFitCaptionBelow ? 'top-[69%]' : 'bottom-12'
                                                    }`}
                                                    style={useBlurFitCaptionBelow ? openCaptionCss : selectedPreviewCaptionCss}
                                                >
                                                    <span className="block">{selectedPreviewCaptionNodes}</span>
                                                    {!!selectedPreviewCaptionEmoji && (
                                                        <span className="mt-0.5 block text-lg leading-none">{selectedPreviewCaptionEmoji}</span>
                                                    )}
                                                </span>
                                            )}
                                        </button>

                                        <div className="min-w-0 py-2">
                                            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                                <div className="min-w-0">
                                                    <h2 className="text-xl font-semibold">{item.title}</h2>
                                                    <p className="mt-2 text-sm font-medium text-muted-foreground">
                                                        {formatMs(item.start_ms)} - {formatMs(item.end_ms)} / {item.duration_sec.toFixed(1)}s
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => void handlePreviewShort(item)} disabled={previewLoading}>
                                                        {previewLoading && previewShortId === item.short_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                                        Preview
                                                    </Button>
                                                    <Button onClick={() => void shareShort(item)} size="sm">
                                                        <Send className="h-4 w-4" />
                                                        Publish
                                                    </Button>
                                                    <Button variant="outline" size="sm" onClick={() => void handleDownloadShort(item)} disabled={downloadingShortId === item.short_id}>
                                                        {downloadingShortId === item.short_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                                        Download
                                                    </Button>
                                                    <Button variant="outline" size="icon-sm" onClick={() => void shareShort(item)} aria-label="Share clip">
                                                        <Share2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="outline" size="icon-sm" onClick={openActiveEditor} aria-label="Open editor">
                                                        <Film className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                             <div className="mt-5 flex items-end gap-1">
                                                 <span className="text-4xl font-semibold">{score.toFixed(1)}</span>
                                                 <span className="pb-1 text-sm font-semibold text-muted-foreground">/10</span>
                                             </div>
                                            {signalChips.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {signalChips.map(([label, value]) => (
                                                        <span
                                                            key={`${item.short_id}-${label}`}
                                                            className="rounded-full border border-border bg-muted/35 px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                                                        >
                                                            {label} {Math.round(value)}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {item.viral_reason && (
                                                <p className="mt-3 max-w-3xl rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm leading-6 text-muted-foreground">
                                                    <span className="font-semibold text-foreground">AI pick: </span>
                                                    {item.viral_reason}
                                                </p>
                                            )}

                                            <div className="mt-4 max-w-3xl space-y-1 text-sm leading-6 text-muted-foreground">
                                                <p className="font-semibold text-foreground">[{formatMs(item.start_ms)}]</p>
                                                {(item.captions.length > 0 ? item.captions : [item.primary_caption]).slice(0, 5).map((line, lineIndex) => (
                                                    <p key={`${item.short_id}-${lineIndex}`}>
                                                        {lineIndex > 0 && <span className="font-semibold text-foreground">[{formatMs(item.start_ms + lineIndex * 3500)}] </span>}
                                                        {line}
                                                    </p>
                                                ))}
                                            </div>

                                            <div className="mt-5 flex flex-wrap gap-2">
                                                <Badge variant="outline">#{index + 1}</Badge>
                                                <Badge variant="outline">{item.aspect_ratio}</Badge>
                                                <Badge variant="outline">{item.duration_sec.toFixed(1)}s</Badge>
                                                <Badge variant="outline">{CAPTION_STYLE_LABELS[(item.caption_style as CaptionStylePreset) || captionStyle]}</Badge>
                                                {(item.selection_engine === 'ai_viral_editor' || item.selection_engine === 'groq_viral_curation') && <Badge variant="outline">AI curation</Badge>}
                                                {item.assembly_mode === 'continuous' && <Badge variant="outline">Continuous cut</Badge>}
                                                {item.cut_quality?.mode === 'word_safe' && <Badge variant="outline">Word-safe cut</Badge>}
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] w-full bg-background p-4 sm:p-6 lg:p-8">
            <input ref={fileInputRef} type="file" className="hidden" accept="video/*" onChange={handleSourceFileChange} />
            <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
                <button type="button" onClick={hideCreateWorkspace} className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    Back to home
                </button>

                <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="space-y-5">
                        <div className="rounded-[1.5rem] border border-border bg-card p-5">
                            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase text-muted-foreground">Workspace</p>
                                    <h1 className="mt-1 text-2xl font-semibold tracking-tight">Create Long to Viral clips</h1>
                                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                                        Upload or import a source, then generate hook-led shorts with clean speech boundaries, captions, reframing, preview, and download.
                                    </p>
                                </div>
                                <Badge variant="secondary" className={`${preflightSummary.bg} ${preflightSummary.tone}`}>
                                    {preflightSummary.label}
                                </Badge>
                            </div>

                            <div className="mb-4 inline-flex rounded-xl border border-border bg-muted p-1">
                                <button
                                    type="button"
                                    onClick={selectUploadMode}
                                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${sourceMode === 'upload' ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    Upload
                                </button>
                                <button
                                    type="button"
                                    onClick={selectYouTubeMode}
                                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${sourceMode === 'youtube' ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    YouTube
                                </button>
                            </div>

                            {sourceMode === 'upload' ? (
                                <button
                                    type="button"
                                    onClick={chooseSourceFile}
                                    onDrop={handleSourceFileDrop}
                                    onDragOver={(event) => event.preventDefault()}
                                    className={`flex min-h-40 w-full flex-col items-center justify-center rounded-[1.25rem] border border-dashed px-5 py-8 text-center transition-colors ${selectedFile ? 'border-primary bg-primary/5' : 'border-border bg-muted/40 hover:border-primary/70 hover:bg-primary/5'}`}
                                >
                                    <UploadCloud className="mb-3 h-7 w-7 text-primary" />
                                    <span className="text-base font-semibold">{selectedFile ? selectedFile.name : 'Click or drag a video file'}</span>
                                    <span className="mt-2 max-w-md text-sm text-muted-foreground">MP4, MOV, MKV, AVI, WebM. The source remains full quality for render.</span>
                                </button>
                            ) : (
                                <label className="block">
                                    <span className="mb-2 block text-sm font-semibold">YouTube URL</span>
                                    <div className="flex h-14 items-center gap-3 rounded-xl border border-border bg-muted/40 px-4">
                                        <Link2 className="h-4 w-4 text-muted-foreground" />
                                        <input
                                            value={youtubeUrl}
                                            onChange={(event) => setYouTubeUrl(event.target.value)}
                                            placeholder="https://www.youtube.com/watch?v=..."
                                            className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
                                        />
                                    </div>
                                </label>
                            )}

                            <label className="mt-4 block">
                                <span className="mb-2 block text-sm font-semibold">Workspace name</span>
                                <input
                                    value={projectName}
                                    onChange={(event) => setProjectName(event.target.value)}
                                    placeholder="Optional project name"
                                    className="h-12 w-full rounded-xl border border-border bg-muted/40 px-4 text-sm outline-none focus:border-primary"
                                />
                            </label>
                        </div>

                        <div className="rounded-[1.5rem] border border-border bg-card p-5">
                            <div className="mb-5 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase text-muted-foreground">Output</p>
                                    <h2 className="text-lg font-semibold">Clip plan</h2>
                                </div>
                                <Badge variant="outline">{targetCountLabel}</Badge>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <p className="mb-2 text-sm font-semibold">Aspect ratio</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['9:16', '16:9'] as const).map((ratio) => (
                                            <button
                                                key={ratio}
                                                type="button"
                                                onClick={() => setTargetAspectRatio(ratio)}
                                                className={`h-11 rounded-xl border text-sm font-semibold transition-colors ${targetAspectRatio === ratio ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/40 hover:border-primary/70'}`}
                                            >
                                                {ratio}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p className="mb-2 text-sm font-semibold">Framing</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {([
                                            ['person_center', 'Auto-center'],
                                            ['fit_blur', 'Blur fit'],
                                        ] as const).map(([modeValue, label]) => (
                                            <button
                                                key={modeValue}
                                                type="button"
                                                onClick={() => setReframeMode(modeValue)}
                                                className={`h-11 rounded-xl border text-sm font-semibold transition-colors ${reframeMode === modeValue ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/40 hover:border-primary/70'}`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p className="mb-2 text-sm font-semibold">Output volume</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {([
                                            [0, 'Auto'],
                                            [8, '8'],
                                            [16, '16'],
                                            [24, '24'],
                                        ] as const).map(([count, label]) => (
                                            <button
                                                key={count}
                                                type="button"
                                                onClick={() => setTargetCount(Number(count))}
                                                className={`h-11 rounded-xl border text-sm font-semibold transition-colors ${targetCount === count ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/40 hover:border-primary/70'}`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="mt-2 text-xs text-muted-foreground">Auto ranks the full video and keeps every strong viral moment.</p>
                                </div>

                                <div>
                                    <p className="mb-2 text-sm font-semibold">Clip length</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className="rounded-xl border border-border bg-muted/40 px-3 py-2">
                                            <span className="block text-[11px] font-semibold uppercase text-muted-foreground">Min</span>
                                            <input
                                                type="number"
                                                min={5}
                                                max={59}
                                                value={minDurationSec}
                                                onChange={(event) => setMinDurationSec(Number(event.target.value))}
                                                className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"
                                            />
                                        </label>
                                        <label className="rounded-xl border border-border bg-muted/40 px-3 py-2">
                                            <span className="block text-[11px] font-semibold uppercase text-muted-foreground">Max</span>
                                            <input
                                                type="number"
                                                min={8}
                                                max={60}
                                                value={maxDurationSec}
                                                onChange={(event) => setMaxDurationSec(Number(event.target.value))}
                                                className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"
                                            />
                                        </label>
                                    </div>
                                    {durationInvalid && <p className="mt-2 text-xs font-semibold text-destructive">Max length must be greater than min length.</p>}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[1.5rem] border border-border bg-card p-5">
                            <div className="mb-4">
                                <p className="text-xs font-semibold uppercase text-muted-foreground">Captions</p>
                                <h2 className="text-lg font-semibold">Template style</h2>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-1">
                                {setupTemplates.map((template, index) => (
                                    <button
                                        key={`${template.name}-${index}`}
                                        type="button"
                                        onClick={() => setCaptionStyle(template.id)}
                                        className={`w-28 shrink-0 text-center ${captionStyle === template.id ? 'text-primary' : 'text-muted-foreground'}`}
                                    >
                                        <div className={`relative aspect-[9/16] overflow-hidden rounded-xl border bg-gradient-to-b ${template.bg} ${captionStyle === template.id ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}>
                                            <span className="absolute inset-x-2 top-4 rounded bg-white/80 px-1 py-0.5 text-[9px] font-black text-black">Hook title</span>
                                            <span className="absolute inset-x-2 bottom-16 rounded bg-white px-1 py-0.5 text-[9px] font-black text-black">caption text</span>
                                            {captionStyle === template.id && <CheckCircle2 className="absolute right-2 top-2 h-5 w-5 text-primary" />}
                                        </div>
                                        <span className="mt-2 block text-sm font-semibold">{template.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <aside className="space-y-5">
                        <div className="rounded-[1.5rem] border border-border bg-card p-5">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">Run summary</p>
                            <div className="mt-4 space-y-3 text-sm">
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-muted-foreground">Source</span>
                                    <span className="max-w-[190px] truncate font-semibold">{sourceReady ? sourceTitle : 'Not selected'}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-muted-foreground">Format</span>
                                    <span className="font-semibold">{targetAspectRatio} / {reframeMode === 'fit_blur' ? 'Blur fit' : 'Auto-center'}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-muted-foreground">Length</span>
                                    <span className="font-semibold">{minDurationSec}-{maxDurationSec}s</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-muted-foreground">Captions</span>
                                    <span className="font-semibold">{CAPTION_STYLE_LABELS[captionStyle]}</span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[1.5rem] border border-border bg-card p-5">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">Production checks</p>
                            <div className="mt-4 space-y-3 text-sm font-semibold">
                                {[
                                    'AI hook selection',
                                    'Word-safe cut padding',
                                    'Caption keyword highlights',
                                    targetAspectRatio === '9:16' ? 'Portrait-ready framing' : 'Landscape output',
                                    'Preview and MP4 download',
                                ].map((label) => (
                                    <div key={label} className="flex items-center gap-3">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        <span>{label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {preflight?.issues?.length ? (
                            <div className="rounded-[1.5rem] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                                {preflight.issues[0]}
                            </div>
                        ) : null}

                        {error && <div className="rounded-[1.25rem] border border-destructive bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

                        <Button
                            type="button"
                            onClick={startPipeline}
                            disabled={busy || durationInvalid || !sourceReady}
                            size="lg"
                            className="h-14 w-full"
                        >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            {busy ? 'Working' : primaryActionLabel}
                        </Button>

                        <p className="text-center text-xs font-semibold text-muted-foreground">Uses transcription and analysis credits</p>
                    </aside>
                </section>
            </div>
        </div>
    );

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 font-sans">
            {!isStudioPage && (
            <>
            <Card>
                <CardContent className="p-5 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <Badge variant="secondary" className="mb-3 gap-2">
                                <Scissors className="h-3.5 w-3.5" />
                                Long to Viral
                            </Badge>
                            <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Shorts projects</h1>
                            <p className="mt-2 max-w-xl text-sm font-medium text-muted-foreground">
                                Create hook-led shorts from an upload or YouTube link.
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Button onClick={openCreateWorkspace} size="lg" className="justify-center">
                                <Plus className="h-4 w-4" />
                                Create shorts
                            </Button>
                            {activeProjectId && (
                                <Button onClick={openActiveEditor} variant="outline" size="lg" className="justify-center">
                                    <FolderOpen className="h-4 w-4" />
                                    Open editor
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="overflow-hidden p-0">
                <div className="flex flex-col gap-2 border-b border-[var(--color-gray-200)] p-4 sm:p-5">
                    <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Projects</h2>
                    <p className="text-sm text-muted-foreground">Open a shorts workspace.</p>
                </div>

                {projectsLoading ? (
                    <div className="m-4 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-surface-secondary)] px-4 py-6 text-sm text-[var(--color-gray-500)]">
                        Loading projects...
                    </div>
                ) : projectsError ? (
                    <div className="m-4 rounded-xl border border-[var(--color-danger)] bg-[var(--color-danger-light)] px-4 py-3 text-sm text-[var(--color-danger)]">{projectsError}</div>
                ) : recentProjects.length === 0 ? (
                    <div className="px-5 py-14 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-gray-200)] bg-[var(--color-surface-secondary)] text-[var(--color-primary)]">
                            <Film className="h-7 w-7" />
                        </div>
                        <div className="mt-5 font-serif text-2xl text-[var(--color-gray-900)]">No Long to Viral projects yet</div>
                        <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--color-gray-500)]">Create a workspace to generate your first set of hook-led shorts.</div>
                        <button
                            onClick={openCreateWorkspace}
                            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
                        >
                            <Plus className="h-4 w-4" />
                            Create Shorts
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
                        {recentProjects.map((project) => (
                            <article key={project.id} className="rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/35">
                                <div className="flex gap-3">
                                    <div className="flex aspect-video w-28 shrink-0 items-center justify-center rounded-md bg-[var(--color-gray-100)] text-[var(--color-gray-500)]">
                                        <Play className="h-6 w-6" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h3 className="truncate text-sm font-semibold text-[var(--color-gray-900)]">{project.name}</h3>
                                                <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--color-gray-500)]">
                                                    <span>{formatProjectDate(project.created_at)}</span>
                                                    {typeof project.duration_sec === 'number' && <span>{Math.round(project.duration_sec)}s</span>}
                                                    <span>{project.type || 'long_to_shorts'}</span>
                                                </div>
                                            </div>
                                            <span className={`shrink-0 rounded-full bg-[var(--color-gray-50)] px-2 py-1 text-xs font-semibold uppercase ${getStatusTone(project.status)}`}>
                                                {project.status || 'unknown'}
                                            </span>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <button
                            onClick={() => openProjectStudio(project.id)}
                                                className="inline-flex items-center justify-center gap-1 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary-hover)]"
                                            >
                                                <FolderOpen className="h-3.5 w-3.5" />
                                                Open
                                            </button>
                                            <button
                                                onClick={() => void handleDeleteProject(project)}
                                                disabled={deletingProjectId === project.id}
                                                className="inline-flex items-center justify-center gap-1 rounded-md border border-[var(--color-danger)] bg-card px-3 py-1.5 text-xs font-semibold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-light)] disabled:opacity-70"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                {deletingProjectId === project.id ? 'Deleting' : 'Delete'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </Card>
            </>
            )}

            {showCreateWorkspace && (
                <div className={isStudioPage ? 'contents' : 'fixed inset-0 z-50 overflow-hidden bg-black/40 p-3 backdrop-blur-sm sm:p-5'}>
                    <div className={isStudioPage ? 'space-y-6' : 'mx-auto h-full max-w-7xl overflow-y-auto rounded-2xl border border-[var(--color-gray-200)] bg-[var(--color-surface)] p-4 shadow-2xl sm:p-5'}>
            <section className="overflow-hidden rounded-lg border border-[var(--color-gray-200)] bg-card shadow-sm">
                <div className="border-b border-[var(--color-gray-200)] bg-[var(--color-gray-50)] p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-semibold text-[var(--color-gray-900)]">Shorts Studio</h2>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${preflightSummary.bg} ${preflightSummary.tone}`}>
                                {preflightSummary.label}
                                {preflight?.checks?.credits_remaining !== undefined ? ` - ${preflight?.checks?.credits_remaining} credits` : ''}
                            </span>
                        </div>
                        <p className="mt-1 text-sm text-[var(--color-gray-500)]">Import one long video, let the AI director find hooks, then preview each captioned short.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {activeProjectId && (
                            <button
                                onClick={openActiveEditor}
                                className="rounded-lg border border-[var(--color-gray-200)] bg-card px-3 py-2 text-sm font-semibold text-[var(--color-gray-700)] transition-colors hover:bg-[var(--color-gray-50)]"
                            >
                                Open Editor
                            </button>
                        )}
                        <button
                            onClick={() => void loadPreflight()}
                            className="rounded-lg border border-[var(--color-gray-200)] bg-card px-3 py-2 text-sm font-semibold text-[var(--color-gray-700)] transition-colors hover:bg-[var(--color-gray-50)]"
                        >
                            Refresh
                        </button>
                        <button
                            onClick={hideCreateWorkspace}
                            className="rounded-lg border border-[var(--color-gray-200)] bg-card px-3 py-2 text-sm font-semibold text-[var(--color-gray-700)] transition-colors hover:bg-[var(--color-gray-50)]"
                        >
                            Hide
                        </button>
                    </div>
                </div>
                </div>

                <div className="grid grid-cols-2 gap-2 p-4 md:grid-cols-4">
                    {workflowSteps.map((step) => (
                        <div
                            key={step.label}
                            className={`rounded-lg border px-3 py-2 text-sm ${
                                step.state === 'done'
                                    ? 'border-[var(--color-success)] bg-[var(--color-success-light)] text-[var(--color-success)]'
                                    : step.state === 'active'
                                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                                        : step.state === 'error'
                                            ? 'border-[var(--color-danger)] bg-[var(--color-danger-light)] text-[var(--color-danger)]'
                                            : 'border-[var(--color-gray-200)] bg-[var(--color-gray-50)] text-[var(--color-gray-500)]'
                            }`}
                        >
                            <div className="flex items-center gap-2 font-semibold">
                                {step.state === 'done' ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
                                {step.label}
                            </div>
                        </div>
                    ))}
                </div>

                {preflight?.status !== 'ok' && Boolean(preflight?.issues?.length) && (
                    <div className="mx-4 mb-4 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-3 py-2 text-xs text-[var(--color-warning)]">
                        <div className="mb-1 flex items-center gap-2 font-semibold">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            Attention required before stable runs
                        </div>
                        <ul className="list-disc pl-5">
                            {preflight?.issues?.map((issue) => (
                                <li key={issue}>{issue}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </section>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,520px)_1fr]">
                <section className="overflow-hidden rounded-lg border border-[var(--color-gray-200)] bg-card shadow-sm">
                    <div className="border-b border-[var(--color-gray-200)] bg-[var(--color-gray-50)] p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-light)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                                    <Scissors className="h-3.5 w-3.5" />
                                    AI Director
                                </div>
                                <h3 className="mt-3 text-lg font-semibold text-[var(--color-gray-900)]">Build a shorts batch</h3>
                                <p className="mt-1 text-xs text-[var(--color-gray-500)]">Choose a source, lock the creative rules, then run the agent.</p>
                            </div>
                            <span className="rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-[var(--color-gray-500)]">
                                {targetCountLabel}
                            </span>
                        </div>

                        <div className="mt-4 rounded-lg border border-[var(--color-gray-200)] bg-card p-3">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-gray-500)]">Workspace title</div>
                            <input
                                aria-label="Workspace title"
                                type="text"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                placeholder="Name this shorts drop"
                                className="mt-1 w-full bg-transparent text-base font-semibold text-[var(--color-gray-900)] outline-none placeholder:text-[var(--color-gray-400)]"
                                disabled={busy}
                            />
                        </div>
                    </div>

                    <div className="space-y-5 p-4">
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-gray-500)]">Source deck</div>
                                <div className="text-xs text-[var(--color-gray-500)]">{sourceMode === 'upload' ? 'Local video' : 'YouTube import'}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={selectUploadMode}
                                    disabled={busy}
                                    className={`rounded-lg border p-3 text-left transition ${
                                        sourceMode === 'upload'
                                            ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)] shadow-sm'
                                            : 'border-[var(--color-gray-200)] bg-card text-[var(--color-gray-700)] hover:bg-[var(--color-gray-50)]'
                                    } disabled:cursor-not-allowed disabled:opacity-60`}
                                >
                                    <UploadCloud className="mb-3 h-5 w-5" />
                                    <div className="text-sm font-semibold">Upload video</div>
                                    <div className="mt-1 text-xs text-[var(--color-gray-500)]">Best for raw podcast, webinar, and talking head footage.</div>
                                </button>
                                <button
                                    type="button"
                                    onClick={selectYouTubeMode}
                                    disabled={busy}
                                    className={`rounded-lg border p-3 text-left transition ${
                                        sourceMode === 'youtube'
                                            ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)] shadow-sm'
                                            : 'border-[var(--color-gray-200)] bg-card text-[var(--color-gray-700)] hover:bg-[var(--color-gray-50)]'
                                    } disabled:cursor-not-allowed disabled:opacity-60`}
                                >
                                    <Link2 className="mb-3 h-5 w-5" />
                                    <div className="text-sm font-semibold">Paste link</div>
                                    <div className="mt-1 text-xs text-[var(--color-gray-500)]">Import from YouTube and create shorts from the transcript.</div>
                                </button>
                            </div>
                        </div>

                        {sourceMode === 'upload' ? (
                            <div className="rounded-lg border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] p-3">
                                <button
                                    type="button"
                                    onClick={chooseSourceFile}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={handleSourceFileDrop}
                                    className="flex min-h-40 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--color-gray-300)] bg-card px-4 py-6 text-center transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:cursor-not-allowed disabled:opacity-60"
                                    disabled={busy}
                                >
                                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                                        <UploadCloud className="h-6 w-6" />
                                    </span>
                                    <span className="max-w-full truncate text-sm font-semibold text-[var(--color-gray-900)]">
                                        {selectedFile?.name || 'Drop a long video or browse'}
                                    </span>
                                    <span className="text-xs text-[var(--color-gray-500)]">MP4, MOV, or WebM. H.264 MP4 exports fastest.</span>
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept="video/*"
                                    onChange={handleSourceFileChange}
                                />
                            </div>
                        ) : (
                            <div className="rounded-lg border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] p-3">
                                <div className="flex items-center gap-3 rounded-lg border border-[var(--color-gray-200)] bg-card px-3 py-3">
                                    <Link2 className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                                    <input
                                        aria-label="YouTube URL"
                                        type="url"
                                        value={youtubeUrl}
                                        onChange={(e) => setYouTubeUrl(e.target.value)}
                                        placeholder="Paste YouTube URL"
                                        className="w-full bg-transparent text-sm text-[var(--color-gray-900)] outline-none placeholder:text-[var(--color-gray-400)]"
                                        disabled={busy}
                                    />
                                </div>
                                <div className="mt-2 text-xs text-[var(--color-gray-500)]">The agent imports the video, transcribes it, then ranks the most shareable segments.</div>
                            </div>
                        )}

                        <div className="rounded-lg border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] p-3">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-gray-900)]">
                                    <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
                                    Creative rules
                                </div>
                                <div className="text-xs text-[var(--color-gray-500)]">{minDurationSec}-{maxDurationSec}s clips</div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-gray-500)]">Output volume</div>
                                    <div className="grid grid-cols-5 gap-2">
                                        {([
                                            [0, 'Auto'],
                                            [8, '8'],
                                            [16, '16'],
                                            [24, '24'],
                                            [30, '30'],
                                        ] as const).map(([count, label]) => (
                                            <button
                                                key={count}
                                                type="button"
                                                onClick={() => setTargetCount(count)}
                                                disabled={busy}
                                                className={`rounded-md border px-2 py-2 text-xs font-semibold transition ${
                                                    targetCount === count
                                                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                                                        : 'border-[var(--color-gray-200)] bg-card text-[var(--color-gray-700)] hover:bg-[var(--color-gray-100)]'
                                                } disabled:cursor-not-allowed disabled:opacity-60`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-2 text-xs text-[var(--color-gray-500)]">Auto finds the maximum strong clips and ranks them by hook and content.</div>
                                </div>

                                <div className="rounded-lg border border-[var(--color-gray-200)] bg-card p-3">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-gray-500)]">Clip rhythm</div>
                                            <div className="mt-1 text-xs text-[var(--color-gray-500)]">Tight enough for shorts, long enough for full meaning.</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                aria-label="Minimum clip seconds"
                                                type="number"
                                                min={5}
                                                max={60}
                                                value={minDurationSec}
                                                onChange={(e) => setMinDurationSec(Math.max(5, Math.min(60, Number(e.target.value) || 5)))}
                                                className={`w-14 rounded-md border bg-card px-2 py-1.5 text-center text-xs font-semibold ${durationInvalid ? 'border-[var(--color-danger)]' : 'border-[var(--color-gray-200)]'}`}
                                                disabled={busy}
                                            />
                                            <span className="text-xs text-[var(--color-gray-400)]">to</span>
                                            <input
                                                aria-label="Maximum clip seconds"
                                                type="number"
                                                min={8}
                                                max={60}
                                                value={maxDurationSec}
                                                onChange={(e) => setMaxDurationSec(Math.max(8, Math.min(60, Number(e.target.value) || 8)))}
                                                className={`w-14 rounded-md border bg-card px-2 py-1.5 text-center text-xs font-semibold ${durationInvalid ? 'border-[var(--color-danger)]' : 'border-[var(--color-gray-200)]'}`}
                                                disabled={busy}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <input
                                            aria-label="Minimum clip duration"
                                            type="range"
                                            min={5}
                                            max={60}
                                            value={minDurationSec}
                                            onChange={(e) => setMinDurationSec(Math.min(maxDurationSec - 1, Math.max(5, Number(e.target.value) || 5)))}
                                            className="w-full accent-[var(--color-primary)]"
                                            disabled={busy}
                                        />
                                        <input
                                            aria-label="Maximum clip duration"
                                            type="range"
                                            min={8}
                                            max={60}
                                            value={maxDurationSec}
                                            onChange={(e) => setMaxDurationSec(Math.max(minDurationSec + 1, Math.min(60, Number(e.target.value) || 8)))}
                                            className="w-full accent-[var(--color-primary)]"
                                            disabled={busy}
                                        />
                                    </div>
                                    {durationInvalid && (
                                        <div className="mt-2 rounded-md bg-[var(--color-danger-light)] px-2 py-1.5 text-xs text-[var(--color-danger)]">
                                            Max duration must be greater than min duration.
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-gray-500)]">Format</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['9:16', '16:9'] as const).map((ratio) => (
                                            <button
                                                key={ratio}
                                                type="button"
                                                onClick={() => setTargetAspectRatio(ratio)}
                                                disabled={busy}
                                                className={`rounded-lg border p-3 text-left transition ${
                                                    targetAspectRatio === ratio
                                                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                                                        : 'border-[var(--color-gray-200)] bg-card text-[var(--color-gray-700)] hover:bg-[var(--color-gray-100)]'
                                                } disabled:cursor-not-allowed disabled:opacity-60`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-sm font-semibold">{ratio}</span>
                                                    <span className={`rounded-sm border ${ratio === '9:16' ? 'h-8 w-5' : 'h-5 w-8'} ${targetAspectRatio === ratio ? 'border-[var(--color-primary)] bg-card' : 'border-[var(--color-gray-300)] bg-[var(--color-gray-100)]'}`} />
                                                </div>
                                                <div className="mt-2 text-xs text-[var(--color-gray-500)]">{ratio === '9:16' ? 'Shorts, Reels, TikTok' : 'Landscape highlight exports'}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-gray-500)]">Reframe behavior</div>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                        <button
                                            type="button"
                                            onClick={() => setReframeMode('person_center')}
                                            disabled={busy}
                                            className={`rounded-lg border p-3 text-left transition ${
                                                reframeMode === 'person_center'
                                                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                                                    : 'border-[var(--color-gray-200)] bg-card text-[var(--color-gray-700)] hover:bg-[var(--color-gray-100)]'
                                            } disabled:cursor-not-allowed disabled:opacity-60`}
                                        >
                                            <div className="text-sm font-semibold">Full 9:16 crop</div>
                                            <div className="mt-1 text-xs text-[var(--color-gray-500)]">Fill the vertical frame with a subject-aware crop.</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setReframeMode('fit_blur')}
                                            disabled={busy}
                                            className={`rounded-lg border p-3 text-left transition ${
                                                reframeMode === 'fit_blur'
                                                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                                                    : 'border-[var(--color-gray-200)] bg-card text-[var(--color-gray-700)] hover:bg-[var(--color-gray-100)]'
                                            } disabled:cursor-not-allowed disabled:opacity-60`}
                                        >
                                            <div className="text-sm font-semibold">16:9 blur fit</div>
                                            <div className="mt-1 text-xs text-[var(--color-gray-500)]">Keep the full landscape video inside a blurred 9:16 canvas.</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setReframeMode('none')}
                                            disabled={busy}
                                            className={`rounded-lg border p-3 text-left transition ${
                                                reframeMode === 'none'
                                                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                                                    : 'border-[var(--color-gray-200)] bg-card text-[var(--color-gray-700)] hover:bg-[var(--color-gray-100)]'
                                            } disabled:cursor-not-allowed disabled:opacity-60`}
                                        >
                                            <div className="text-sm font-semibold">Original frame</div>
                                            <div className="mt-1 text-xs text-[var(--color-gray-500)]">Use source composition without AI subject reframing.</div>
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-gray-500)]">Caption treatment</div>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                        {(['comic_story', 'clean_modern', 'subtitle_minimal'] as CaptionStylePreset[]).map((preset) => (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => setCaptionStyle(preset)}
                                                disabled={busy}
                                                className={`rounded-lg border bg-card p-2 transition ${
                                                    captionStyle === preset
                                                        ? 'border-[var(--color-primary)] shadow-sm'
                                                        : 'border-[var(--color-gray-200)] hover:bg-[var(--color-gray-100)]'
                                                } disabled:cursor-not-allowed disabled:opacity-60`}
                                            >
                                                <div className="rounded-md px-2 py-2 text-center text-xs leading-tight" style={getCaptionPreviewStyle(preset)}>
                                                    Aa
                                                </div>
                                                <div className="mt-2 truncate text-xs font-semibold text-[var(--color-gray-700)]">{CAPTION_STYLE_LABELS[preset]}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg border border-[var(--color-gray-200)] bg-card p-3 shadow-sm">
                            <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
                                <div className="rounded-md bg-[var(--color-gray-50)] px-2 py-2">
                                    <div className="text-[var(--color-gray-500)]">Source</div>
                                    <div className="truncate font-semibold text-[var(--color-gray-900)]">{sourceMode === 'upload' ? selectedFile?.name || 'No file' : youtubeUrl || 'No link'}</div>
                                </div>
                                <div className="rounded-md bg-[var(--color-gray-50)] px-2 py-2">
                                    <div className="text-[var(--color-gray-500)]">Frame</div>
                                    <div className="font-semibold text-[var(--color-gray-900)]">{targetAspectRatio}</div>
                                </div>
                                <div className="rounded-md bg-[var(--color-gray-50)] px-2 py-2">
                                    <div className="text-[var(--color-gray-500)]">Captions</div>
                                    <div className="truncate font-semibold text-[var(--color-gray-900)]">{CAPTION_STYLE_LABELS[captionStyle]}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                <button
                                    type="button"
                                    onClick={startPipeline}
                                    disabled={busy || durationInvalid}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {primaryActionLabel}
                                </button>
                                <button
                                    type="button"
                                    onClick={rerunAnalysis}
                                    disabled={busy || !activeProjectId || durationInvalid}
                                    className="w-full rounded-lg border border-[var(--color-gray-200)] bg-card px-4 py-2.5 text-sm font-semibold text-[var(--color-gray-700)] transition-colors hover:bg-[var(--color-gray-50)] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Re-analyze active project
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <div className="rounded-lg border border-[var(--color-gray-200)] bg-card p-4 shadow-sm">
                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="text-sm font-semibold text-[var(--color-gray-900)]">Pipeline Status</div>
                                <div className="mt-1 text-xs text-[var(--color-gray-500)]">
                                    {activeProjectId ? `Project ${activeProjectId?.slice(-8)}` : 'No active project'}
                                </div>
                            </div>
                            <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                                stage === 'error'
                                    ? 'bg-[var(--color-danger-light)] text-[var(--color-danger)]'
                                    : stage === 'complete'
                                        ? 'bg-[var(--color-success-light)] text-[var(--color-success)]'
                                        : busy
                                            ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                                            : 'bg-[var(--color-gray-100)] text-[var(--color-gray-600)]'
                            }`}>
                                <span className="h-2 w-2 rounded-full bg-current" />
                                {pipelineStatusLabel}
                            </span>
                        </div>

                        <div className="mb-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                            <div className="rounded-md bg-[var(--color-gray-50)] px-2 py-2">
                                <div className="text-[var(--color-gray-500)]">Format</div>
                                <div className="font-semibold text-[var(--color-gray-800)]">{targetAspectRatio}</div>
                            </div>
                            <div className="rounded-md bg-[var(--color-gray-50)] px-2 py-2">
                                <div className="text-[var(--color-gray-500)]">Clips</div>
                                <div className="font-semibold text-[var(--color-gray-800)]">{targetCountLabel}</div>
                            </div>
                            <div className="rounded-md bg-[var(--color-gray-50)] px-2 py-2">
                                <div className="text-[var(--color-gray-500)]">Duration</div>
                                <div className="font-semibold text-[var(--color-gray-800)]">{minDurationSec}-{maxDurationSec}s</div>
                            </div>
                            <div className="rounded-md bg-[var(--color-gray-50)] px-2 py-2">
                                <div className="text-[var(--color-gray-500)]">Caption</div>
                                <div className="truncate font-semibold text-[var(--color-gray-800)]">{CAPTION_STYLE_LABELS[captionStyle]}</div>
                            </div>
                        </div>

                        {busy && (
                            <div className="mb-3">
                                <div className="mb-1 flex items-center justify-between text-xs text-[var(--color-gray-500)]">
                                    <span>{progressStageLabel}</span>
                                    <span>{Math.round(transcriptionProgress)}%</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-gray-200)]">
                                    <div
                                        className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                                        style={{ width: `${transcriptionProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-start gap-2 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-light)] px-3 py-2 text-sm text-[var(--color-danger)]">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {success && !error && (
                            <div className="flex items-start gap-2 rounded-lg border border-[var(--color-success)] bg-[var(--color-success-light)] px-3 py-2 text-sm text-[var(--color-success)]">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>{success}</span>
                            </div>
                        )}

                        {analysisWarnings.length > 0 && (
                            <div className="mt-2 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-3 py-2 text-xs text-[var(--color-warning)]">
                                {analysisWarnings.map((warning) => (
                                    <div key={warning}>- {warning}</div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg border border-[var(--color-gray-200)] bg-card p-4 shadow-sm">
                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-[var(--color-gray-900)]">Suggested Shorts</h2>
                                <p className="text-xs text-[var(--color-gray-500)]">Preview segments, compare scores, then continue in the editor.</p>
                            </div>
                            <span className="w-fit rounded-full bg-[var(--color-primary-light)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
                                {shorts.length} generated
                            </span>
                        </div>

                        {stage === 'idle' && shorts.length === 0 && (
                            <div className="rounded-lg border border-dashed border-[var(--color-gray-300)] bg-[var(--color-gray-50)] px-4 py-8 text-center text-sm text-[var(--color-gray-500)]">
                                Start a run to generate engagement-scored short clips.
                            </div>
                        )}

                        {stage !== 'idle' && shorts.length === 0 && stage !== 'error' && (
                            <div className="rounded-lg border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] px-4 py-8 text-center text-sm text-[var(--color-gray-500)]">
                                Processing pipeline...
                            </div>
                        )}

                        {shorts.length > 0 && (
                            <div className="grid gap-4 2xl:grid-cols-[360px_1fr]">
                                <div className="rounded-lg border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] p-3 2xl:sticky 2xl:top-4 2xl:self-start">
                                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                        <div className="text-sm font-semibold text-[var(--color-gray-900)]">Preview</div>
                                        {selectedPreviewShort && (
                                            <button
                                                onClick={closePreview}
                                                className="inline-flex items-center gap-1 rounded-md border border-[var(--color-gray-200)] bg-card px-2 py-1 text-xs text-[var(--color-gray-600)] hover:bg-[var(--color-gray-50)]"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                                Clear
                                            </button>
                                        )}
                                    </div>

                                    {!selectedPreviewShort && (
                                        <div className="flex min-h-56 items-center justify-center rounded-lg border border-dashed border-[var(--color-gray-300)] bg-card px-3 py-6 text-center text-sm text-[var(--color-gray-500)]">
                                            Select a clip to preview the trimmed segment with captions.
                                        </div>
                                    )}

                                    {selectedPreviewShort && (
                                        <div className="space-y-2">
                                            <div
                                                className="relative overflow-hidden rounded-lg bg-black"
                                                style={{
                                                    aspectRatio: selectedPreviewShort?.aspect_ratio === '9:16' ? '9 / 16' : '16 / 9',
                                                }}
                                            >
                                                {previewSourceUrl && useBlurFitCaptionBelow && (
                                                    <>
                                                        <video
                                                            ref={previewBackgroundVideoRef}
                                                            src={previewSourceUrl ?? undefined}
                                                            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-75 blur-2xl"
                                                            muted
                                                            playsInline
                                                            aria-hidden="true"
                                                            tabIndex={-1}
                                                            onLoadedMetadata={() => syncPreviewBackgroundVideo(previewPlaying)}
                                                        />
                                                        <div className="absolute inset-0 bg-black/20" />
                                                    </>
                                                )}
                                                {previewSourceUrl && (
                                                    <video
                                                        ref={previewVideoRef}
                                                        src={previewSourceUrl ?? undefined}
                                                        className={useBlurFitCaptionBelow ? 'relative z-10 h-full w-full object-contain object-center' : 'h-full w-full object-cover'}
                                                        muted={previewMuted}
                                                        playsInline
                                                        onLoadedMetadata={handlePreviewLoadedMetadata}
                                                        onTimeUpdate={handlePreviewTimeUpdate}
                                                        onPlay={markPreviewPlaying}
                                                        onPause={markPreviewPaused}
                                                    />
                                                )}
                                                {previewLoading && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                                        <Loader2 className="h-5 w-5 animate-spin text-[var(--color-gray-50)]" />
                                                    </div>
                                                )}
                                                {!!selectedPreviewCaption && (
                                                    <div
                                                        className={`pointer-events-none absolute inset-x-3 rounded-md px-3 py-2 text-center text-base leading-tight ${
                                                            useBlurFitCaptionBelow ? 'top-[69%]' : 'top-1/2 -translate-y-1/2'
                                                        }`}
                                                        style={useBlurFitCaptionBelow ? openCaptionCss : selectedPreviewCaptionCss}
                                                    >
                                                        <span className="block">{selectedPreviewCaptionNodes}</span>
                                                        {!!selectedPreviewCaptionEmoji && (
                                                            <span className="mt-1 block text-xl leading-none">{selectedPreviewCaptionEmoji}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={togglePreviewPlayback}
                                                        className="inline-flex items-center gap-1 rounded-md border border-[var(--color-gray-200)] bg-card px-2.5 py-1.5 text-xs font-semibold text-[var(--color-gray-700)] hover:bg-[var(--color-gray-50)]"
                                                    >
                                                        {previewPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                                                        {previewPlaying ? 'Pause' : 'Play'}
                                                    </button>
                                                    <button
                                                        onClick={togglePreviewMuted}
                                                        className="inline-flex items-center gap-1 rounded-md border border-[var(--color-gray-200)] bg-card px-2.5 py-1.5 text-xs font-semibold text-[var(--color-gray-700)] hover:bg-[var(--color-gray-50)]"
                                                    >
                                                        {previewMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                                                        {previewMuted ? 'Muted' : 'Audio'}
                                                    </button>
                                                </div>
                                                <div className="text-xs text-[var(--color-gray-600)]">
                                                    {formatMs(selectedPreviewShort?.start_ms ?? 0)} - {formatMs(selectedPreviewShort?.end_ms ?? 0)}
                                                    {' | '}
                                                    {(selectedPreviewShort?.duration_sec ?? 0).toFixed(1)}s
                                                </div>
                                            </div>

                                            <div className="rounded-md bg-card px-2.5 py-2 text-xs text-[var(--color-gray-600)]">
                                                {CAPTION_STYLE_LABELS[selectedPreviewCaptionStyle]} - {selectedPreviewShort?.aspect_ratio}
                                            </div>
                                        </div>
                                    )}

                                    {previewError && (
                                        <div className="mt-2 flex items-start gap-2 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-light)] px-2.5 py-2 text-xs text-[var(--color-danger)]">
                                            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                            <span>{previewError}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    {shorts.map((item, idx) => {
                                        const isSelected = previewShortId === item.short_id;
                                        return (
                                            <article
                                                key={item.short_id}
                                                className={`rounded-lg border p-3 transition-colors ${
                                                    isSelected
                                                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
                                                        : 'border-[var(--color-gray-200)] bg-[var(--color-gray-50)]'
                                                }`}
                                            >
                                                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="mb-1 flex flex-wrap gap-1.5">
                                                            <span className="rounded-md bg-card px-2 py-1 text-xs font-semibold text-[var(--color-gray-700)]">#{idx + 1}</span>
                                                            <span className="rounded-md bg-card px-2 py-1 text-xs text-[var(--color-gray-600)]">{item.aspect_ratio}</span>
                                                            <span className="rounded-md bg-card px-2 py-1 text-xs text-[var(--color-gray-600)]">
                                                                {CAPTION_STYLE_LABELS[(item.caption_style as CaptionStylePreset) || captionStyle]}
                                                            </span>
                                                            {((item.reframe_mode as ReframeMode) || reframeMode) === 'person_center' && (
                                                                <span className="rounded-md bg-card px-2 py-1 text-xs text-[var(--color-gray-600)]">Full crop</span>
                                                            )}
                                                            {((item.reframe_mode as ReframeMode) || reframeMode) === 'fit_blur' && (
                                                                <span className="rounded-md bg-card px-2 py-1 text-xs text-[var(--color-gray-600)]">Blur fit</span>
                                                            )}
                                                        </div>
                                                        <h3 className="line-clamp-2 text-sm font-semibold text-[var(--color-gray-900)]">{item.title}</h3>
                                                    </div>
                                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--color-success-light)] px-2 py-1 text-xs font-semibold text-[var(--color-success)]">
                                                        <TrendingUp className="h-3.5 w-3.5" />
                                                        {item.engagement_rate.toFixed(1)}%
                                                    </span>
                                                </div>

                                                <div className="mb-2 flex flex-wrap gap-3 text-xs text-[var(--color-gray-600)]">
                                                    <span className="inline-flex items-center gap-1">
                                                        <Clock3 className="h-3.5 w-3.5" />
                                                        {formatMs(item.start_ms)} - {formatMs(item.end_ms)}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1">
                                                        <Film className="h-3.5 w-3.5" />
                                                        {item.duration_sec.toFixed(1)}s
                                                    </span>
                                                </div>

                                                <p className="mb-3 rounded-md bg-card px-2.5 py-2 text-sm text-[var(--color-gray-700)]">
                                                    {item.primary_caption}
                                                </p>

                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        onClick={() => void handlePreviewShort(item)}
                                                        disabled={previewLoading}
                                                        className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                                            isSelected
                                                                ? 'border-[var(--color-primary)] bg-card text-[var(--color-primary)]'
                                                                : 'border-[var(--color-gray-200)] bg-card text-[var(--color-gray-700)] hover:bg-[var(--color-gray-50)]'
                                                        } disabled:cursor-not-allowed disabled:opacity-70`}
                                                    >
                                                        {isSelected && previewPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                                                        {isSelected ? 'Previewing' : 'Preview'}
                                                    </button>
                                                    <button
                                                        onClick={() => void handleDownloadShort(item)}
                                                        disabled={!activeProjectId || downloadingShortId === item.short_id}
                                                        className="inline-flex items-center gap-1 rounded-md border border-[var(--color-gray-200)] bg-card px-2.5 py-1.5 text-xs font-semibold text-[var(--color-gray-700)] transition-colors hover:bg-[var(--color-gray-50)] disabled:cursor-not-allowed disabled:opacity-70"
                                                    >
                                                        {downloadingShortId === item.short_id ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <Download className="h-3.5 w-3.5" />
                                                        )}
                                                        {downloadingShortId === item.short_id ? 'Rendering' : 'Download'}
                                                    </button>
                                                    {activeProjectId && (
                                                        <button
                                                            onClick={openActiveEditor}
                                                            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-gray-200)] bg-card px-2.5 py-1.5 text-xs font-semibold text-[var(--color-gray-700)] hover:bg-[var(--color-gray-50)]"
                                                        >
                                                            <FolderOpen className="h-3.5 w-3.5" />
                                                            Open Editor
                                                        </button>
                                                    )}
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {analysisJobId && (
                        <div className="rounded-lg border border-[var(--color-gray-200)] bg-card p-4 shadow-sm">
                            <div className="text-xs text-[var(--color-gray-500)]">
                                Analysis Job ID: <span className="font-mono text-[var(--color-gray-700)]">{analysisJobId}</span>
                            </div>
                        </div>
                    )}
                </section>
            </div>
                    </div>
                </div>
            )}
        </div>
    );
}
