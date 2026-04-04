import { FilePlay, AlignLeft, Save, Download, Loader2, ChevronDown, CheckCircle, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { projectsApi, subtitlesApi } from '@/lib/api';
import type { Project, SubtitleCue, SubtitleTrack } from '@/lib/api';

function formatTime(ms: number): string {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const milli = ms % 1000;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
}

export default function SubtitleEditorPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState('');
    const [tracks, setTracks] = useState<SubtitleTrack[]>([]);
    const [selectedTrack, setSelectedTrack] = useState('');
    const [cues, setCues] = useState<SubtitleCue[]>([]);
    const [editingCue, setEditingCue] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportFormat, setExportFormat] = useState('srt');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        projectsApi.list().then(res => {
            setProjects(res.data.filter(p => p.status === 'ready'));
        }).catch(() => { });
    }, []);

    const loadSubtitles = async (projectId: string) => {
        setLoading(true);
        setError('');
        setCues([]);
        setTracks([]);
        try {
            const res = await subtitlesApi.get(projectId);
            const allTracks = res.data.tracks || [];
            setTracks(allTracks);
            if (allTracks.length > 0) {
                const first = allTracks[0];
                setSelectedTrack(first.track_id);
                setCues(first.cues || []);
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to load subtitles');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectProject = (id: string) => {
        setSelectedProject(id);
        if (id) loadSubtitles(id);
    };

    const handleSelectTrack = (trackId: string) => {
        setSelectedTrack(trackId);
        const track = tracks.find(t => t.track_id === trackId);
        if (track) setCues(track.cues || []);
    };

    const handleEditCue = (cue: SubtitleCue) => {
        setEditingCue(cue._id);
        setEditText(cue.text);
    };

    const handleSaveCue = async (cueId: string) => {
        setSaving(true);
        try {
            await subtitlesApi.updateCue(cueId, { text: editText });
            setCues(prev => prev.map(c => c._id === cueId ? { ...c, text: editText } : c));
            setEditingCue(null);
            setMessage('Cue saved');
            setTimeout(() => setMessage(''), 2000);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to save cue');
        } finally {
            setSaving(false);
        }
    };

    const handleExport = async () => {
        if (!selectedProject) return;
        setExporting(true);
        try {
            const track = tracks.find(t => t.track_id === selectedTrack);
            const lang = track?.language_code;
            const res = await subtitlesApi.export(selectedProject, exportFormat, lang);

            if (exportFormat === 'json') {
                const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `subtitles_${lang}.json`;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                const blob = res.data as Blob;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `subtitles_${lang}.${exportFormat}`;
                a.click();
                URL.revokeObjectURL(url);
            }
            setMessage(`Exported as ${exportFormat.toUpperCase()}`);
            setTimeout(() => setMessage(''), 2000);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Export failed');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-serif text-[var(--color-gray-900)] flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                        <FilePlay className="w-5 h-5 text-white" />
                    </div>
                    Subtitle Editor
                </h1>
                <p className="mt-2 text-sm text-[var(--color-gray-500)]">
                    View, edit, and export your subtitle tracks
                </p>
            </div>

            {/* Controls */}
            <div className="bg-white border border-[var(--color-gray-200)] rounded-2xl shadow-sm p-4 mb-6">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-[var(--color-gray-500)] mb-1">Project</label>
                        <div className="relative">
                            <select
                                value={selectedProject}
                                onChange={e => handleSelectProject(e.target.value)}
                                className="claude-input w-full pr-10 py-2 rounded-xl appearance-none cursor-pointer text-sm"
                            >
                                <option value="">Select project...</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-gray-400)] pointer-events-none" />
                        </div>
                    </div>

                    {tracks.length > 1 && (
                        <div className="flex-1 min-w-[180px]">
                            <label className="block text-xs font-medium text-[var(--color-gray-500)] mb-1">Track</label>
                            <div className="relative">
                                <select
                                    value={selectedTrack}
                                    onChange={e => handleSelectTrack(e.target.value)}
                                    className="claude-input w-full pr-10 py-2 rounded-xl appearance-none cursor-pointer text-sm"
                                >
                                    {tracks.map(t => (
                                        <option key={t.track_id} value={t.track_id}>
                                            {t.language_code.toUpperCase()} {t.is_original ? '(Original)' : '(Translated)'}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-gray-400)] pointer-events-none" />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <select
                                value={exportFormat}
                                onChange={e => setExportFormat(e.target.value)}
                                className="claude-input py-2 pr-8 pl-3 rounded-xl appearance-none cursor-pointer text-sm"
                            >
                                <option value="srt">SRT</option>
                                <option value="vtt">VTT</option>
                                <option value="txt">TXT</option>
                                <option value="json">JSON</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--color-gray-400)] pointer-events-none" />
                        </div>
                        <button
                            onClick={handleExport}
                            disabled={!selectedProject || cues.length === 0 || exporting}
                            className="claude-button-primary px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            Export
                        </button>
                    </div>
                </div>
            </div>

            {/* Messages */}
            {message && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <p className="text-sm text-green-700">{message}</p>
                </div>
            )}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
                </div>
            )}

            {/* Cue Editor Table */}
            {!loading && cues.length > 0 && (
                <div className="bg-white border border-[var(--color-gray-200)] rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-[var(--color-gray-200)] bg-[var(--color-surface-secondary)]/50 flex items-center justify-between">
                        <span className="text-sm font-medium text-[var(--color-gray-700)]">
                            <AlignLeft className="w-4 h-4 inline mr-1.5" />
                            {cues.length} Subtitle Cues
                        </span>
                        <span className="text-xs text-[var(--color-gray-400)]">
                            Click any cue to edit
                        </span>
                    </div>

                    <div className="max-h-[500px] overflow-y-auto divide-y divide-[var(--color-gray-100)]">
                        {cues.map((cue, idx) => (
                            <div
                                key={cue._id || idx}
                                className={`flex items-start gap-3 px-5 py-3 hover:bg-[var(--color-surface-secondary)]/30 cursor-pointer transition-colors ${editingCue === cue._id ? 'bg-blue-50/50' : ''
                                    }`}
                                onClick={() => editingCue !== cue._id && handleEditCue(cue)}
                            >
                                {/* Sequence */}
                                <div className="w-8 text-center text-xs font-mono text-[var(--color-gray-400)] pt-1 shrink-0">
                                    {cue.sequence || idx + 1}
                                </div>

                                {/* Timestamps */}
                                <div className="w-32 shrink-0">
                                    <div className="text-xs font-mono text-[var(--color-primary)]">{formatTime(cue.start_ms)}</div>
                                    <div className="text-xs font-mono text-[var(--color-gray-400)]">{formatTime(cue.end_ms)}</div>
                                </div>

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                    {editingCue === cue._id ? (
                                        <div className="flex items-start gap-2">
                                            <textarea
                                                value={editText}
                                                onChange={e => setEditText(e.target.value)}
                                                className="claude-input flex-1 py-1.5 px-2.5 text-sm rounded-lg min-h-[60px] resize-none"
                                                autoFocus
                                                onClick={e => e.stopPropagation()}
                                            />
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleSaveCue(cue._id); }}
                                                disabled={saving}
                                                className="claude-button-primary px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 shrink-0"
                                            >
                                                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                                Save
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-[var(--color-gray-800)] leading-relaxed">{cue.text}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!loading && selectedProject && cues.length === 0 && (
                <div className="text-center py-16 text-[var(--color-gray-400)]">
                    <AlignLeft className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-serif">No subtitles found</p>
                    <p className="text-sm mt-1">Transcribe this project first to generate subtitles</p>
                </div>
            )}

            {!selectedProject && (
                <div className="text-center py-16 text-[var(--color-gray-400)]">
                    <FilePlay className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-serif">Select a project to start editing</p>
                </div>
            )}
        </div>
    );
}
