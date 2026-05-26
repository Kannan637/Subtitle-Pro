import { useEffect, useState } from 'react';
import { AlertCircle, AlignLeft, CheckCircle, ChevronDown, Download, FilePlay, Loader2, Save } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage, projectsApi, subtitlesApi } from '@/lib/api';
import type { Project, SubtitleCue, SubtitleTrack } from '@/lib/api';

function formatTime(ms: number): string {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const milli = ms % 1000;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
}

function SelectShell(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <div className="relative">
            <select
                {...props}
                className={`h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${props.className ?? ''}`}
            />
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
    );
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
        projectsApi.listAll()
            .then((res) => {
                setProjects((res.data as Project[]).filter((project) => project.status === 'ready'));
            })
            .catch(() => {
                setProjects([]);
            });
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
        } catch (err: unknown) {
            setError(getApiErrorMessage(err, 'Failed to load subtitles'));
        } finally {
            setLoading(false);
        }
    };

    const handleSelectProject = (id: string) => {
        setSelectedProject(id);
        if (id) {
            void loadSubtitles(id);
        }
    };

    const handleSelectTrack = (trackId: string) => {
        setSelectedTrack(trackId);
        const track = tracks.find((item) => item.track_id === trackId);
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
            setCues((prev) => prev.map((cue) => (cue._id === cueId ? { ...cue, text: editText } : cue)));
            setEditingCue(null);
            setMessage('Cue saved');
            setTimeout(() => setMessage(''), 2000);
        } catch (err: unknown) {
            setError(getApiErrorMessage(err, 'Failed to save cue'));
        } finally {
            setSaving(false);
        }
    };

    const handleExport = async () => {
        if (!selectedProject) return;
        setExporting(true);
        try {
            const track = tracks.find((item) => item.track_id === selectedTrack);
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
        } catch (err: unknown) {
            setError(getApiErrorMessage(err, 'Export failed'));
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                <div>
                    <Badge variant="secondary" className="mb-3">
                        <FilePlay className="h-3.5 w-3.5" />
                        Subtitle workspace
                    </Badge>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">Subtitle Editor</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        Review generated subtitle tracks, correct individual cues, and export production files.
                    </p>
                </div>
                <Badge variant={selectedProject ? 'success' : 'outline'}>
                    {selectedProject ? `${cues.length} cues loaded` : 'Select a project'}
                </Badge>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Track controls</CardTitle>
                    <CardDescription>Choose the ready project, active subtitle track, and export format.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(180px,0.45fr)_220px]">
                        <div className="space-y-2">
                            <Label htmlFor="subtitle-project">Project</Label>
                            <SelectShell
                                id="subtitle-project"
                                value={selectedProject}
                                onChange={(event) => handleSelectProject(event.target.value)}
                            >
                                <option value="">Select project...</option>
                                {projects.map((project) => (
                                    <option key={project.id} value={project.id}>
                                        {project.name}
                                    </option>
                                ))}
                            </SelectShell>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="subtitle-track">Track</Label>
                            <SelectShell
                                id="subtitle-track"
                                value={selectedTrack}
                                onChange={(event) => handleSelectTrack(event.target.value)}
                                disabled={tracks.length === 0}
                            >
                                {tracks.length === 0 && <option value="">No tracks</option>}
                                {tracks.map((track) => (
                                    <option key={track.track_id} value={track.track_id}>
                                        {track.language_code.toUpperCase()} {track.is_original ? '(Original)' : '(Translated)'}
                                    </option>
                                ))}
                            </SelectShell>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="subtitle-export">Export</Label>
                            <div className="flex gap-2">
                                <SelectShell
                                    id="subtitle-export"
                                    value={exportFormat}
                                    onChange={(event) => setExportFormat(event.target.value)}
                                >
                                    <option value="srt">SRT</option>
                                    <option value="vtt">VTT</option>
                                    <option value="txt">TXT</option>
                                    <option value="json">JSON</option>
                                </SelectShell>
                                <Button
                                    onClick={handleExport}
                                    disabled={!selectedProject || cues.length === 0 || exporting}
                                    className="shrink-0"
                                >
                                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                    Export
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {message && (
                <Alert variant="success">
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Saved</AlertTitle>
                    <AlertDescription>{message}</AlertDescription>
                </Alert>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Subtitle editor error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {loading && (
                <Card>
                    <CardContent className="space-y-3 p-5">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <Skeleton key={index} className="h-14 w-full" />
                        ))}
                    </CardContent>
                </Card>
            )}

            {!loading && cues.length > 0 && (
                <Card className="overflow-hidden">
                    <CardHeader className="border-b bg-muted/30">
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <AlignLeft className="h-4 w-4" />
                                    {cues.length} subtitle cues
                                </CardTitle>
                                <CardDescription>Click any cue row to edit the text in place.</CardDescription>
                            </div>
                            <Badge variant="outline" className="font-mono">
                                {exportFormat.toUpperCase()}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="max-h-[560px] overflow-y-auto p-0">
                        {cues.map((cue, index) => (
                            <div
                                key={cue._id || index}
                                className={`grid cursor-pointer grid-cols-[44px_142px_minmax(0,1fr)] gap-3 border-b px-5 py-3 transition-colors hover:bg-muted/40 ${
                                    editingCue === cue._id ? 'bg-accent/60' : ''
                                }`}
                                onClick={() => editingCue !== cue._id && handleEditCue(cue)}
                            >
                                <div className="pt-1 text-center font-mono text-xs text-muted-foreground">
                                    {cue.sequence || index + 1}
                                </div>
                                <div className="space-y-1 font-mono text-xs">
                                    <div className="text-primary">{formatTime(cue.start_ms)}</div>
                                    <div className="text-muted-foreground">{formatTime(cue.end_ms)}</div>
                                </div>
                                <div className="min-w-0">
                                    {editingCue === cue._id ? (
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                                            <Textarea
                                                value={editText}
                                                onChange={(event) => setEditText(event.target.value)}
                                                className="min-h-20 flex-1 resize-none text-sm"
                                                autoFocus
                                                onClick={(event) => event.stopPropagation()}
                                            />
                                            <Button
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    void handleSaveCue(cue._id);
                                                }}
                                                disabled={saving}
                                                size="sm"
                                                className="shrink-0"
                                            >
                                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                Save
                                            </Button>
                                        </div>
                                    ) : (
                                        <p className="text-sm leading-6 text-foreground">{cue.text}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {!loading && selectedProject && cues.length === 0 && (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center px-5 py-16 text-center">
                        <AlignLeft className="mb-4 h-12 w-12 text-muted-foreground/50" />
                        <h2 className="text-lg font-semibold">No subtitles found</h2>
                        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                            Transcribe this project first, then return here to edit and export the generated tracks.
                        </p>
                    </CardContent>
                </Card>
            )}

            {!selectedProject && !loading && (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center px-5 py-16 text-center">
                        <FilePlay className="mb-4 h-12 w-12 text-muted-foreground/50" />
                        <h2 className="text-lg font-semibold">Select a project to start editing</h2>
                        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                            Ready projects with subtitle tracks appear in the project selector above.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
