import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize,
    Download, Edit3, X, Search, Clock, ChevronDown,
    Loader2, AlertCircle, SkipBack, SkipForward, Check,
    Sparkles, Globe
} from 'lucide-react';
import { projectsApi, subtitlesApi, mediaApi, transcriptionApi } from '@/lib/api';
import type { Project, SubtitleCue, SubtitleTrack } from '@/lib/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimecode(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const frames = Math.floor((ms % 1000) / 10);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(frames).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(frames).padStart(2, '0')}`;
}

function formatTimeShort(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Language Options ────────────────────────────────────────────────────────

const LANGUAGES = [
    { code: 'auto', name: 'Auto-detect' },
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' },
    { code: 'hi', name: 'Hindi' },
    { code: 'ar', name: 'Arabic' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ta', name: 'Tamil' },
    { code: 'te', name: 'Telugu' },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export default function VideoEditorPage() {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();

    // Data
    const [project, setProject] = useState<Project | null>(null);
    const [tracks, setTracks] = useState<SubtitleTrack[]>([]);
    const [selectedTrack, setSelectedTrack] = useState('');
    const [cues, setCues] = useState<SubtitleCue[]>([]);
    const [videoUrl, setVideoUrl] = useState('');

    // Playback
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0); // ms
    const [duration, setDuration] = useState(0); // ms
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

    // AI Transcription
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcriptionLang, setTranscriptionLang] = useState('auto');
    const [transcriptionModel, setTranscriptionModel] = useState('whisper-large-v3-turbo');

    // UI state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingCueId, setEditingCueId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [saving, setSaving] = useState(false);
    const [exportFormat, setExportFormat] = useState('srt');
    const [exporting, setExporting] = useState(false);
    const [activeCueId, setActiveCueId] = useState<string | null>(null);
    const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const cueListRef = useRef<HTMLDivElement>(null);
    const timelineRef = useRef<HTMLDivElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const animFrameRef = useRef<number>(0);

    // ─── Load Data ───────────────────────────────────────────────────────────

    useEffect(() => {
        if (!projectId) return;

        const loadData = async () => {
            setLoading(true);
            setError('');
            try {
                const projRes = await projectsApi.get(projectId);
                setProject(projRes.data);

                const blobUrl = await mediaApi.getAuthenticatedStreamUrl(projectId);
                setVideoUrl(blobUrl);

                // Try loading subtitles
                await loadSubtitles();
            } catch (err: any) {
                setError(err.response?.data?.detail || 'Failed to load project');
            } finally {
                setLoading(false);
            }
        };

        loadData();

        return () => {
            if (videoUrl) URL.revokeObjectURL(videoUrl);
        };
    }, [projectId]);

    const loadSubtitles = async () => {
        if (!projectId) return;
        try {
            const subRes = await subtitlesApi.get(projectId);
            const allTracks = subRes.data.tracks || [];
            setTracks(allTracks);
            if (allTracks.length > 0) {
                const first = allTracks[0];
                setSelectedTrack(first.track_id);
                setCues(first.cues || []);
            }
        } catch {
            // No subtitles yet
            setTracks([]);
            setCues([]);
        }
    };

    // ─── Video Time Sync ─────────────────────────────────────────────────────

    const syncTime = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        const timeMs = video.currentTime * 1000;
        setCurrentTime(timeMs);
        setIsPlaying(!video.paused);

        const active = cues.find(c => timeMs >= c.start_ms && timeMs <= c.end_ms);
        setActiveCueId(active?._id || null);

        animFrameRef.current = requestAnimationFrame(syncTime);
    }, [cues]);

    useEffect(() => {
        animFrameRef.current = requestAnimationFrame(syncTime);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [syncTime]);

    // Auto-scroll to active cue
    useEffect(() => {
        if (!activeCueId || !cueListRef.current) return;
        const el = cueListRef.current.querySelector(`[data-cue-id="${activeCueId}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [activeCueId]);

    // ─── Playback Controls ──────────────────────────────────────────────────

    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;
        video.paused ? video.play() : video.pause();
    };

    const seekTo = (ms: number) => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = ms / 1000;
        setCurrentTime(ms);
    };

    const skipForward = () => seekTo(Math.min(currentTime + 5000, duration));
    const skipBackward = () => seekTo(Math.max(currentTime - 5000, 0));

    const toggleMute = () => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
        setIsMuted(video.muted);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = parseFloat(e.target.value);
        setVolume(v);
        if (videoRef.current) {
            videoRef.current.volume = v;
            videoRef.current.muted = v === 0;
            setIsMuted(v === 0);
        }
    };

    const toggleFullscreen = () => {
        const video = videoRef.current;
        if (!video) return;
        document.fullscreenElement ? document.exitFullscreen() : video.requestFullscreen();
    };

    // ─── Progress Bar Seek (click + drag) ────────────────────────────────────

    const seekFromProgressBar = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
        if (!progressBarRef.current || duration <= 0) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percent = x / rect.width;
        seekTo(percent * duration);
    };

    const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        setIsDraggingTimeline(true);
        seekFromProgressBar(e);

        const handleMouseMove = (ev: MouseEvent) => seekFromProgressBar(ev);
        const handleMouseUp = () => {
            setIsDraggingTimeline(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // ─── AI Transcription ────────────────────────────────────────────────────

    const handleTranscribe = async () => {
        if (!projectId) return;
        setIsTranscribing(true);
        setError('');
        try {
            await transcriptionApi.start(projectId, transcriptionLang, transcriptionModel);
            setSuccessMsg('Transcription complete! Subtitles generated.');
            setTimeout(() => setSuccessMsg(''), 4000);
            // Reload subtitles
            await loadSubtitles();
        } catch (err: any) {
            const detail = err.response?.data?.detail || err.message || 'Transcription failed';
            setError(detail);
        } finally {
            setIsTranscribing(false);
        }
    };

    // ─── Track Selection ─────────────────────────────────────────────────────

    const handleSelectTrack = (trackId: string) => {
        setSelectedTrack(trackId);
        const track = tracks.find(t => t.track_id === trackId);
        if (track) setCues(track.cues || []);
    };

    // ─── Cue Editing ─────────────────────────────────────────────────────────

    const startEdit = (cue: SubtitleCue) => {
        setEditingCueId(cue._id);
        setEditText(cue.text);
    };

    const cancelEdit = () => {
        setEditingCueId(null);
        setEditText('');
    };

    const saveEdit = async (cueId: string) => {
        setSaving(true);
        try {
            await subtitlesApi.updateCue(cueId, { text: editText });
            setCues(prev => prev.map(c => c._id === cueId ? { ...c, text: editText } : c));
            setEditingCueId(null);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    // ─── Export ──────────────────────────────────────────────────────────────

    const handleExport = async () => {
        if (!projectId) return;
        setExporting(true);
        try {
            const track = tracks.find(t => t.track_id === selectedTrack);
            const lang = track?.language_code;
            const res = await subtitlesApi.export(projectId, exportFormat, lang);

            if (exportFormat === 'json') {
                const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `${project?.name || 'subtitles'}_${lang}.json`;
                a.click(); URL.revokeObjectURL(url);
            } else {
                const blob = res.data as Blob;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `${project?.name || 'subtitles'}_${lang}.${exportFormat}`;
                a.click(); URL.revokeObjectURL(url);
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Export failed');
        } finally {
            setExporting(false);
        }
    };

    // ─── Derived State ──────────────────────────────────────────────────────

    const filteredCues = searchQuery
        ? cues.filter(c => c.text.toLowerCase().includes(searchQuery.toLowerCase()))
        : cues;

    const currentSubtitle = cues.find(c => currentTime >= c.start_ms && currentTime <= c.end_ms)?.text || '';
    const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    const hasSubtitles = cues.length > 0;

    // ─── Timeline click handler ─────────────────────────────────────────────

    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!timelineRef.current || duration <= 0) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        seekTo((x / rect.width) * duration);
    };

    // ─── Time ruler ticks ───────────────────────────────────────────────────

    const getTimeRulerTicks = () => {
        if (duration <= 0) return [];
        // Aim for ~10-15 ticks
        const targetTicks = 12;
        let interval = Math.ceil(duration / targetTicks / 5000) * 5000; // round up to 5s
        if (interval < 5000) interval = 5000;
        if (interval > 60000) interval = 60000;

        const ticks: { ms: number; percent: number }[] = [];
        for (let ms = 0; ms <= duration; ms += interval) {
            ticks.push({ ms, percent: (ms / duration) * 100 });
        }
        return ticks;
    };

    // ─── Loading / Error States ─────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#0f0f0f]">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-[var(--color-primary)] mx-auto mb-4" />
                    <p className="text-sm text-gray-500">Loading video editor...</p>
                </div>
            </div>
        );
    }

    if (error && !project) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#0f0f0f]">
                <div className="text-center max-w-sm">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-white mb-2">Failed to load</p>
                    <p className="text-sm text-gray-400 mb-4">{error}</p>
                    <button onClick={() => navigate('/dashboard')} className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-xl text-sm font-medium">
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // ─── Render ─────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-screen bg-[#0f0f0f] text-white overflow-hidden">

            {/* ═══ Top Bar ═══ */}
            <div className="h-12 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center justify-between px-4 shrink-0 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/dashboard')} className="p-1.5 hover:bg-[#2a2a2a] rounded-lg transition-colors">
                        <ArrowLeft className="w-4 h-4 text-gray-400" />
                    </button>
                    <div className="h-5 w-px bg-[#2a2a2a]" />
                    <h1 className="text-sm font-medium text-gray-200 truncate max-w-[200px]">
                        {project?.name || 'Untitled'}
                    </h1>
                    {project?.status && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${project.status === 'ready' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {project.status.toUpperCase()}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Track selector */}
                    {tracks.length > 1 && (
                        <div className="relative">
                            <select
                                value={selectedTrack}
                                onChange={(e) => handleSelectTrack(e.target.value)}
                                className="bg-[#2a2a2a] text-gray-300 text-xs px-2 py-1.5 pr-7 rounded-lg border border-[#3a3a3a] appearance-none cursor-pointer"
                            >
                                {tracks.map(t => (
                                    <option key={t.track_id} value={t.track_id}>
                                        {t.language_code.toUpperCase()} {t.is_original ? '(Original)' : '(Translated)'}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                        </div>
                    )}

                    {/* Export */}
                    <div className="flex items-center gap-1">
                        <div className="relative">
                            <select
                                value={exportFormat}
                                onChange={(e) => setExportFormat(e.target.value)}
                                className="bg-[#2a2a2a] text-gray-300 text-xs px-2 py-1.5 pr-6 rounded-lg border border-[#3a3a3a] appearance-none cursor-pointer"
                            >
                                <option value="srt">SRT</option>
                                <option value="vtt">VTT</option>
                                <option value="txt">TXT</option>
                                <option value="json">JSON</option>
                            </select>
                            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                        </div>
                        <button
                            onClick={handleExport}
                            disabled={!hasSubtitles || exporting}
                            className="flex items-center gap-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                        >
                            {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                            Export
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══ Main Content ═══ */}
            <div className="flex-1 flex min-h-0">

                {/* ─── Left Panel: Subtitle List ─── */}
                <div className="w-80 xl:w-96 bg-[#141414] border-r border-[#2a2a2a] flex flex-col shrink-0">
                    {/* Panel Header */}
                    <div className="px-3 py-2.5 border-b border-[#2a2a2a]">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Subtitles</h2>
                            <span className="text-[10px] text-gray-500 bg-[#2a2a2a] px-1.5 py-0.5 rounded">
                                {cues.length} cues
                            </span>
                        </div>
                        {hasSubtitles && (
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search subtitles..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-[#1e1e1e] text-gray-300 text-xs pl-8 pr-3 py-2 rounded-lg border border-[#2a2a2a] focus:border-[var(--color-primary)] focus:outline-none placeholder:text-gray-600 transition-colors"
                                />
                            </div>
                        )}
                    </div>

                    {/* Cue List or AI Generate Section */}
                    <div ref={cueListRef} className="flex-1 overflow-y-auto">
                        {!hasSubtitles ? (
                            /* ─── AI Generate Subtitles Panel ─── */
                            <div className="flex flex-col items-center justify-center p-6 h-full">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center mb-4">
                                    <Sparkles className="w-7 h-7 text-violet-400" />
                                </div>
                                <h3 className="text-sm font-medium text-gray-200 mb-1">Generate AI Subtitles</h3>
                                <p className="text-xs text-gray-500 text-center mb-5 max-w-[200px]">
                                    Use Groq Whisper to auto-transcribe your video into subtitles
                                </p>

                                {/* Language Select */}
                                <div className="w-full mb-3">
                                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                                        <Globe className="w-3 h-3 inline mr-1" />
                                        Language
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={transcriptionLang}
                                            onChange={(e) => setTranscriptionLang(e.target.value)}
                                            className="w-full bg-[#1e1e1e] text-gray-300 text-xs px-3 py-2 pr-7 rounded-lg border border-[#2a2a2a] appearance-none cursor-pointer focus:border-[var(--color-primary)] focus:outline-none"
                                        >
                                            {LANGUAGES.map(l => (
                                                <option key={l.code} value={l.code}>{l.name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Model Select */}
                                <div className="w-full mb-5">
                                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                                        Model
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={transcriptionModel}
                                            onChange={(e) => setTranscriptionModel(e.target.value)}
                                            className="w-full bg-[#1e1e1e] text-gray-300 text-xs px-3 py-2 pr-7 rounded-lg border border-[#2a2a2a] appearance-none cursor-pointer focus:border-[var(--color-primary)] focus:outline-none"
                                        >
                                            <option value="whisper-large-v3-turbo">Whisper V3 Turbo (fast)</option>
                                            <option value="whisper-large-v3">Whisper V3 (accurate)</option>
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Generate Button */}
                                <button
                                    onClick={handleTranscribe}
                                    disabled={isTranscribing}
                                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-purple-500/20"
                                >
                                    {isTranscribing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Transcribing...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            Generate Subtitles
                                        </>
                                    )}
                                </button>

                                {isTranscribing && (
                                    <p className="text-[10px] text-gray-500 mt-3 text-center animate-pulse">
                                        Processing with Groq Whisper — this may take a moment...
                                    </p>
                                )}
                            </div>
                        ) : (
                            /* ─── Cue List ─── */
                            filteredCues.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                                    <Search className="w-6 h-6 text-gray-600 mb-2" />
                                    <p className="text-xs text-gray-500">No matching cues</p>
                                </div>
                            ) : (
                                filteredCues.map((cue, idx) => {
                                    const isActive = activeCueId === cue._id;
                                    const isEditing = editingCueId === cue._id;

                                    return (
                                        <div
                                            key={cue._id || idx}
                                            data-cue-id={cue._id}
                                            className={`group px-3 py-2.5 border-b border-[#1e1e1e] cursor-pointer transition-all duration-150 ${isActive
                                                    ? 'bg-[var(--color-primary)]/10 border-l-2 border-l-[var(--color-primary)]'
                                                    : 'hover:bg-[#1a1a1a] border-l-2 border-l-transparent'
                                                }`}
                                            onClick={() => !isEditing && seekTo(cue.start_ms)}
                                        >
                                            {/* Timestamp Row */}
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-mono text-gray-500 w-5 text-center">
                                                        {cue.sequence || idx + 1}
                                                    </span>
                                                    <span className={`text-[11px] font-mono ${isActive ? 'text-[var(--color-primary)]' : 'text-gray-500'}`}>
                                                        {formatTimecode(cue.start_ms)}
                                                    </span>
                                                    <span className="text-[10px] text-gray-600">→</span>
                                                    <span className={`text-[11px] font-mono ${isActive ? 'text-[var(--color-primary)]' : 'text-gray-500'}`}>
                                                        {formatTimecode(cue.end_ms)}
                                                    </span>
                                                </div>
                                                {!isEditing && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); startEdit(cue); }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#2a2a2a] rounded transition-all"
                                                    >
                                                        <Edit3 className="w-3 h-3 text-gray-500" />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Text */}
                                            {isEditing ? (
                                                <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                                    <textarea
                                                        value={editText}
                                                        onChange={(e) => setEditText(e.target.value)}
                                                        className="w-full bg-[#1e1e1e] text-gray-200 text-xs p-2 rounded-lg border border-[#3a3a3a] focus:border-[var(--color-primary)] focus:outline-none resize-none min-h-[50px]"
                                                        autoFocus
                                                    />
                                                    <div className="flex items-center gap-1.5 mt-1.5">
                                                        <button
                                                            onClick={() => saveEdit(cue._id)}
                                                            disabled={saving}
                                                            className="flex items-center gap-1 bg-[var(--color-primary)] text-white text-[10px] font-medium px-2 py-1 rounded-md hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50"
                                                        >
                                                            {saving ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Check className="w-2.5 h-2.5" />}
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={cancelEdit}
                                                            className="flex items-center gap-1 bg-[#2a2a2a] text-gray-400 text-[10px] font-medium px-2 py-1 rounded-md hover:bg-[#3a3a3a] transition-colors"
                                                        >
                                                            <X className="w-2.5 h-2.5" />
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className={`text-xs leading-relaxed ml-6 ${isActive ? 'text-gray-200' : 'text-gray-400'}`}>
                                                    {cue.text}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })
                            )
                        )}
                    </div>
                </div>

                {/* ─── Center Panel: Video Preview ─── */}
                <div className="flex-1 flex flex-col bg-[#0a0a0a] min-w-0">
                    {/* Video Container */}
                    <div className="flex-1 flex items-center justify-center relative min-h-0 p-4">
                        <div className="relative w-full max-w-4xl aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
                            {videoUrl ? (
                                <video
                                    ref={videoRef}
                                    src={videoUrl}
                                    className="w-full h-full object-contain"
                                    onLoadedMetadata={(e) => setDuration((e.target as HTMLVideoElement).duration * 1000)}
                                    onClick={togglePlay}
                                    playsInline
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-600">
                                    <p className="text-sm">No media available</p>
                                </div>
                            )}

                            {/* Subtitle Overlay */}
                            {currentSubtitle && (
                                <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none px-8">
                                    <div className="bg-black/80 backdrop-blur-sm text-white text-base md:text-lg font-medium px-5 py-2.5 rounded-lg max-w-[80%] text-center leading-snug shadow-lg">
                                        {currentSubtitle}
                                    </div>
                                </div>
                            )}

                            {/* Play overlay on pause */}
                            {!isPlaying && videoUrl && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer" onClick={togglePlay}>
                                    <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors">
                                        <Play className="w-7 h-7 text-white ml-1" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── Playback Controls ─── */}
                    <div className="bg-[#141414] border-t border-[#2a2a2a] shrink-0">
                        {/* Progress bar (seekable) */}
                        <div
                            ref={progressBarRef}
                            className="h-2 bg-[#2a2a2a] cursor-pointer group relative mx-4 mt-1 rounded-full"
                            onMouseDown={handleProgressMouseDown}
                        >
                            {/* Buffered / progress */}
                            <div
                                className="absolute top-0 left-0 h-full bg-[var(--color-primary)] rounded-full transition-[width] duration-75"
                                style={{ width: `${playheadPercent}%` }}
                            />
                            {/* Thumb */}
                            <div
                                className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[var(--color-primary)] rounded-full shadow-md transition-opacity ${isDraggingTimeline ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                style={{ left: `calc(${playheadPercent}% - 6px)` }}
                            />
                        </div>

                        {/* Controls row */}
                        <div className="h-11 flex items-center justify-between px-4">
                            <div className="flex items-center gap-2">
                                <button onClick={skipBackward} className="p-1.5 hover:bg-[#2a2a2a] rounded-lg transition-colors">
                                    <SkipBack className="w-4 h-4 text-gray-400" />
                                </button>
                                <button onClick={togglePlay} className="p-1.5 hover:bg-[#2a2a2a] rounded-lg transition-colors">
                                    {isPlaying
                                        ? <Pause className="w-5 h-5 text-white" />
                                        : <Play className="w-5 h-5 text-white ml-0.5" />
                                    }
                                </button>
                                <button onClick={skipForward} className="p-1.5 hover:bg-[#2a2a2a] rounded-lg transition-colors">
                                    <SkipForward className="w-4 h-4 text-gray-400" />
                                </button>
                                <span className="text-xs font-mono text-gray-400 ml-2">
                                    {formatTimecode(currentTime)} / {formatTimecode(duration)}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button onClick={toggleMute} className="p-1.5 hover:bg-[#2a2a2a] rounded-lg transition-colors">
                                    {isMuted ? <VolumeX className="w-4 h-4 text-gray-400" /> : <Volume2 className="w-4 h-4 text-gray-400" />}
                                </button>
                                <input
                                    type="range" min="0" max="1" step="0.05"
                                    value={isMuted ? 0 : volume}
                                    onChange={handleVolumeChange}
                                    className="w-16 h-1 accent-[var(--color-primary)] cursor-pointer"
                                />
                                <button onClick={toggleFullscreen} className="p-1.5 hover:bg-[#2a2a2a] rounded-lg transition-colors">
                                    <Maximize className="w-4 h-4 text-gray-400" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ Timeline ═══ */}
            <div className="h-28 bg-[#141414] border-t border-[#2a2a2a] flex flex-col shrink-0">
                {/* Time ruler */}
                <div className="h-6 relative mx-4 select-none">
                    {getTimeRulerTicks().map((tick, i) => (
                        <div key={i} className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: `${tick.percent}%` }}>
                            <div className="h-2 w-px bg-[#3a3a3a]" />
                            <span className="text-[9px] font-mono text-gray-600 mt-0.5 whitespace-nowrap">
                                {formatTimeShort(tick.ms)}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Track area */}
                <div
                    ref={timelineRef}
                    className="flex-1 mx-4 mb-2 bg-[#1a1a1a] rounded-lg relative cursor-crosshair overflow-hidden"
                    onClick={handleTimelineClick}
                >
                    {/* Cue blocks */}
                    {cues.map((cue, idx) => {
                        if (duration <= 0) return null;
                        const left = (cue.start_ms / duration) * 100;
                        const width = Math.max(((cue.end_ms - cue.start_ms) / duration) * 100, 0.3);
                        const isActive = activeCueId === cue._id;
                        return (
                            <div
                                key={cue._id || idx}
                                className={`absolute top-1.5 bottom-1.5 rounded-sm transition-colors cursor-pointer ${isActive
                                        ? 'bg-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/30'
                                        : 'bg-[#3a3a5a] hover:bg-[#4a4a6a]'
                                    }`}
                                style={{ left: `${left}%`, width: `${width}%` }}
                                title={cue.text}
                                onClick={(e) => { e.stopPropagation(); seekTo(cue.start_ms); }}
                            >
                                {width > 3 && (
                                    <span className="block text-[8px] text-white/70 truncate px-1 py-0.5 leading-tight">
                                        {cue.text}
                                    </span>
                                )}
                            </div>
                        );
                    })}

                    {/* Playhead */}
                    {duration > 0 && (
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                            style={{ left: `${playheadPercent}%` }}
                        >
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-red-500 rounded-full shadow" />
                        </div>
                    )}

                    {/* Empty state for timeline */}
                    {!hasSubtitles && (
                        <div className="flex items-center justify-center h-full text-gray-600 text-xs">
                            Generate subtitles to see cue blocks here
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ Toast Notifications ═══ */}
            {error && (
                <div className="fixed bottom-4 right-4 z-50 bg-red-500/90 backdrop-blur-sm text-white text-sm px-4 py-3 rounded-xl shadow-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="max-w-xs truncate">{error}</span>
                    <button onClick={() => setError('')} className="ml-2 hover:bg-white/20 p-0.5 rounded">
                        <X className="w-3 h-3" />
                    </button>
                </div>
            )}
            {successMsg && (
                <div className="fixed bottom-4 right-4 z-50 bg-emerald-500/90 backdrop-blur-sm text-white text-sm px-4 py-3 rounded-xl shadow-xl flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{successMsg}</span>
                </div>
            )}
        </div>
    );
}
