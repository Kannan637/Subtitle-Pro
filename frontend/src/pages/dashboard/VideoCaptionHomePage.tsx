import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertCircle,
    FilePlay,
    Loader2,
    MoreHorizontal,
    Plus,
    Search,
    Sparkles,
    UploadCloud,
    WandSparkles,
    X,
} from 'lucide-react';
import { getApiErrorMessage, mediaApi, projectsApi, type Project } from '@/lib/api';
import { getProjectOpenPath, isVideoCaptionProject } from '@/lib/projectRoutes';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

function toBaseName(fileName: string) {
    return fileName.replace(/\.[^.]+$/, '').trim() || 'Untitled caption project';
}

function formatProjectDate(dateStr: string) {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return 'recently';
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'today';
    const diffMs = today.getTime() - date.getTime();
    const diffDays = Math.max(1, Math.floor(diffMs / 86_400_000));
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function statusVariant(status: string): 'success' | 'warning' | 'destructive' {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'processing' || normalized === 'queued') return 'warning';
    if (normalized === 'error' || normalized === 'failed') return 'destructive';
    return 'success';
}

export default function VideoCaptionHomePage() {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const loadProjects = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await projectsApi.listAll();
            const rows = (res.data || [])
                .filter(isVideoCaptionProject)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setProjects(rows);
        } catch (err) {
            setError(getApiErrorMessage(err, 'Unable to load AI caption projects.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadProjects();
    }, [loadProjects]);

    const filteredProjects = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return projects;
        return projects.filter((project) => project.name.toLowerCase().includes(needle));
    }, [projects, query]);

    const openProject = useCallback((project: Project) => {
        navigate(getProjectOpenPath(project));
    }, [navigate]);

    const handleDelete = useCallback(async (project: Project, event: MouseEvent<HTMLDivElement | HTMLButtonElement>) => {
        event.stopPropagation();
        if (!window.confirm(`Delete "${project.name}"?`)) return;
        try {
            await projectsApi.delete(project.id);
            setProjects((prev) => prev.filter((item) => item.id !== project.id));
        } catch (err) {
            setError(getApiErrorMessage(err, 'Failed to delete project.'));
        }
    }, []);

    const handleQuickUpload = useCallback(async (file: File) => {
        setUploading(true);
        setUploadProgress(0);
        setError('');
        try {
            const projectRes = await projectsApi.create(toBaseName(file.name), 'video-caption');
            const projectId = projectRes.data.id;
            await mediaApi.upload(projectId, file, (event) => {
                if (!event.total) return;
                setUploadProgress(Math.round((event.loaded / event.total) * 100));
            });
            navigate(`/dashboard/caption-editor/${projectId}?autostart=1`);
        } catch (err) {
            setError(getApiErrorMessage(err, 'Upload failed. Please retry.'));
        } finally {
            setUploading(false);
        }
    }, [navigate]);

    const onFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) void handleQuickUpload(file);
    }, [handleQuickUpload]);

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
            <Card>
                <CardContent className="p-5 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <Badge variant="secondary" className="mb-3 gap-2">
                                <WandSparkles className="h-3.5 w-3.5" />
                                AI Video Caption
                            </Badge>
                            <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Caption projects</h1>
                            <p className="mt-2 max-w-xl text-sm font-medium text-muted-foreground">
                                Upload a clip or open the caption studio.
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Button type="button" size="lg" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                                {uploading ? `Uploading ${uploadProgress}%` : 'Upload'}
                            </Button>
                            <Button type="button" size="lg" variant="outline" onClick={() => navigate('/dashboard/caption-editor/new')}>
                                <Plus className="h-4 w-4" />
                                Open studio
                            </Button>
                        </div>
                    </div>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={onFileChange} accept="video/*,audio/*" />
                    {uploading && (
                        <div className="mt-5 max-w-md">
                            <div className="mb-2 flex justify-between text-xs font-semibold text-muted-foreground">
                                <span>Preparing caption workspace</span>
                                <span>{uploadProgress}%</span>
                            </div>
                            <Progress value={uploadProgress} />
                        </div>
                    )}
                </CardContent>
            </Card>

            {error && (
                <Alert variant="destructive" className="grid-cols-[20px_1fr_auto]">
                    <AlertCircle className="h-4 w-4" />
                    <div>
                        <AlertTitle>Caption workspace issue</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </div>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setError('')}>
                        <X className="h-4 w-4" />
                    </Button>
                </Alert>
            )}

            <Card>
                <CardHeader className="border-b border-border">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle>Projects</CardTitle>
                            <CardDescription>Open a caption workspace.</CardDescription>
                        </div>
                        <div className="relative w-full sm:w-80">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search caption projects"
                                className="pl-9"
                            />
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5">
                    {loading ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-44 rounded-xl" />)}
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
                            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted">
                                <Sparkles className="h-7 w-7 text-primary" />
                            </div>
                            <CardTitle>{query ? 'No matching projects' : 'No AI caption projects yet'}</CardTitle>
                            <CardDescription className="mt-2 max-w-md">
                                {query
                                    ? 'Try another search term or upload a new caption project.'
                                    : 'Upload a clip and Subtitlepro will open the caption studio with templates, timeline controls, and export settings.'}
                            </CardDescription>
                            <Button className="mt-6" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                <UploadCloud className="h-4 w-4" />
                                Upload Video
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {filteredProjects.map((project) => (
                                <Card
                                    key={project.id}
                                    className="group cursor-pointer transition-colors hover:border-primary/35"
                                    onClick={() => openProject(project)}
                                >
                                    <CardHeader className="pb-3">
                                        <div className="mb-3 flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-primary">
                                                    <FilePlay className="h-5 w-5" />
                                                </div>
                                                <Badge variant={statusVariant(project.status)} className="capitalize">
                                                    {project.status || 'ready'}
                                                </Badge>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                                                    <Button variant="ghost" size="icon-sm">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={(event) => {
                                                        event.stopPropagation();
                                                        openProject(project);
                                                    }}>
                                                        Open Project
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem variant="destructive" onClick={(event) => handleDelete(project, event)}>
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <CardTitle className="truncate text-base">{project.name}</CardTitle>
                                        <CardDescription>{formatProjectDate(project.created_at)}</CardDescription>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
