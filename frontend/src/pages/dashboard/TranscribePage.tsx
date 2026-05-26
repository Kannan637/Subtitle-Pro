import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertCircle,
    FilePlay,
    FileVideo2,
    MoreHorizontal,
    Sparkles,
    UploadCloud,
    X,
} from 'lucide-react';
import { projectsApi, type Project } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'recently';
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'today';
    const diffDays = Math.ceil(Math.abs(now.getTime() - d.getTime()) / 86_400_000);
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function statusVariant(status?: string): 'success' | 'warning' | 'destructive' | 'secondary' {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'ready' || normalized === 'complete') return 'success';
    if (normalized === 'processing' || normalized === 'queued') return 'warning';
    if (normalized === 'error' || normalized === 'failed') return 'destructive';
    return 'secondary';
}

export default function TranscribePage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        let mounted = true;
        projectsApi.listAll()
            .then((res) => {
                if (!mounted) return;
                setProjects(res.data.filter((p: Project) => !p.type || p.type === 'subtitle'));
            })
            .catch(() => {
                if (!mounted) return;
                setError('Failed to load projects. Please refresh to try again.');
            })
            .finally(() => {
                if (mounted) setIsLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, []);

    const handleDeleteConfirmed = async () => {
        if (!pendingDelete) return;
        const id = pendingDelete.id;
        setPendingDelete(null);
        try {
            await projectsApi.delete(id);
            setProjects((prev) => prev.filter((p) => p.id !== id));
        } catch {
            setError('Failed to delete project. Please try again.');
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
            <Card>
                <CardContent className="p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <Badge variant="secondary" className="mb-3 gap-2">
                                <Sparkles className="h-3.5 w-3.5" />
                                AI Video Subtitle
                            </Badge>
                            <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Subtitle projects</h1>
                            <p className="mt-2 max-w-xl text-sm font-medium text-muted-foreground">
                                Generate, review, and export subtitle tracks.
                            </p>
                        </div>
                        <Button size="lg" onClick={() => navigate('/dashboard')}>
                            <UploadCloud className="h-4 w-4" />
                            Start project
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {error && (
                <Alert variant="destructive" className="grid-cols-[20px_1fr_auto]">
                    <AlertCircle className="h-4 w-4" />
                    <div>
                        <AlertTitle>Unable to continue</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => setError('')}>
                        <X className="h-4 w-4" />
                    </Button>
                </Alert>
            )}

            <Card>
                <CardHeader className="border-b border-border">
                    <CardTitle>Projects</CardTitle>
                    <CardDescription>Open a subtitle workspace.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-5">
                    {isLoading ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-44 rounded-xl" />)}
                        </div>
                    ) : projects.length === 0 && !error ? (
                        <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
                            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted">
                                <FileVideo2 className="h-7 w-7 text-primary" />
                            </div>
                            <CardTitle>No subtitle projects yet</CardTitle>
                            <CardDescription className="mt-2 max-w-md">
                                Upload a video or audio file to get started. Subtitle projects will appear here.
                            </CardDescription>
                            <Button className="mt-6" onClick={() => navigate('/dashboard')}>
                                <UploadCloud className="h-4 w-4" />
                                Start Subtitle Project
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {projects.map((project) => (
                                <Card
                                    key={project.id}
                                    className="group cursor-pointer transition-colors hover:border-primary/35"
                                    onClick={() => navigate(`/dashboard/video-editor/${project.id}`)}
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
                                                        navigate(`/dashboard/video-editor/${project.id}`);
                                                    }}>
                                                        Open Project
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem variant="destructive" onClick={(event) => {
                                                        event.stopPropagation();
                                                        setPendingDelete(project);
                                                    }}>
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <CardTitle className="truncate text-base">{project.name}</CardTitle>
                                        <CardDescription>
                                            {project.duration_sec ? `${Math.round(project.duration_sec / 60)}m` : '0m'} · {formatDate(project.created_at)}
                                        </CardDescription>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete project?</DialogTitle>
                        <DialogDescription>
                            {pendingDelete?.name} will be permanently deleted and cannot be recovered.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPendingDelete(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => void handleDeleteConfirmed()}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
