import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    CalendarClock,
    CheckCircle2,
    CircleDot,
    Clock,
    FileVideo,
    GripVertical,
    Hash,
    Loader2,
    Megaphone,
    Plus,
    Send,
    Sparkles,
    Trash2,
    UploadCloud,
    Video,
    WandSparkles,
    X,
} from 'lucide-react';
import {
    AUTH_SESSION_REAUTH_MESSAGE,
    getApiErrorMessage,
    getCurrentAuthToken,
    mediaApi,
    projectsApi,
    socialSchedulerApi,
    type SocialPlatformConnection,
    type SocialSchedulerPost,
    type SocialSchedulerStatus,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

const BOARD_COLUMNS: Array<{
    id: SocialSchedulerStatus;
    title: string;
    shortLabel: string;
    description: string;
}> = [
    { id: 'draft', title: 'Draft', shortLabel: 'Idea', description: 'Clip ideas and unfinished copy.' },
    { id: 'ready', title: 'Ready', shortLabel: 'Approved', description: 'Captioned posts ready for timing.' },
    { id: 'scheduled', title: 'Scheduled', shortLabel: 'Timed', description: 'Posts with a release slot.' },
    { id: 'published', title: 'Published', shortLabel: 'Live', description: 'Completed publishing history.' },
];

const PLATFORM_LABELS: Record<string, string> = {
    youtube_shorts: 'YouTube Shorts',
    instagram_reels: 'Instagram Reels',
    tiktok: 'TikTok',
    facebook_reels: 'Facebook Reels',
    linkedin: 'LinkedIn',
    x: 'X',
    threads: 'Threads',
};

const STATUS_ACCENTS: Record<SocialSchedulerStatus, string> = {
    draft: 'bg-muted-foreground/30',
    ready: 'bg-primary',
    scheduled: 'bg-blue-500',
    published: 'bg-emerald-500',
};

type SchedulerForm = {
    title: string;
    caption: string;
    platforms: string[];
    scheduled_at: string;
    timezone: string;
    campaign: string;
    tags: string;
};

type SchedulerUploadResponse = {
    file_path?: string;
    media_id?: string;
};

const fallbackPlatforms: SocialPlatformConnection[] = Object.keys(PLATFORM_LABELS).map((id) => ({
    id,
    name: PLATFORM_LABELS[id],
    connected: false,
    status: 'not_connected',
    channel_type: 'short_video',
    character_limit: id === 'x' ? 280 : 2200,
    supports_video: true,
    recommended_ratio: id === 'linkedin' || id === 'x' ? '16:9' : '9:16',
    oauth_configured: false,
}));

const defaultForm: SchedulerForm = {
    title: '',
    caption: '',
    platforms: ['youtube_shorts'],
    scheduled_at: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Calcutta',
    campaign: '',
    tags: '',
};

function formatDateTime(value?: string | null): string {
    if (!value) return 'No slot';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function platformLabel(platformId: string): string {
    return PLATFORM_LABELS[platformId] || platformId;
}

function emptyStateCopy(status: SocialSchedulerStatus): string {
    if (status === 'draft') return 'Add a clip idea or import from Long to Viral.';
    if (status === 'ready') return 'Approved posts wait here before scheduling.';
    if (status === 'scheduled') return 'Timed posts appear here after assigning a slot.';
    return 'Published posts appear here after launch.';
}

function PlatformIcon({ platformId }: { platformId: string }) {
    if (platformId === 'youtube_shorts') {
        return (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                <rect x="2" y="5.5" width="20" height="13" rx="3.5" fill="#FF0033" />
                <path d="M10 9.1v5.8l5.2-2.9L10 9.1z" fill="#fff" />
            </svg>
        );
    }
    if (platformId === 'instagram_reels') {
        return (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                <defs>
                    <linearGradient id="instagramSchedulerGradient" x1="3" x2="21" y1="21" y2="3">
                        <stop stopColor="#FEDA75" />
                        <stop offset="0.28" stopColor="#FA7E1E" />
                        <stop offset="0.55" stopColor="#D62976" />
                        <stop offset="0.78" stopColor="#962FBF" />
                        <stop offset="1" stopColor="#4F5BD5" />
                    </linearGradient>
                </defs>
                <rect x="3" y="3" width="18" height="18" rx="5" fill="url(#instagramSchedulerGradient)" />
                <circle cx="12" cy="12" r="3.6" fill="none" stroke="#fff" strokeWidth="1.8" />
                <circle cx="16.8" cy="7.2" r="1.2" fill="#fff" />
            </svg>
        );
    }
    if (platformId === 'tiktok') {
        return (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                <rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="#050505" />
                <path d="M14.5 6.2c.5 2.1 1.8 3.4 3.7 3.8v2.5a6.6 6.6 0 0 1-3.5-1.1v4.1a4.2 4.2 0 1 1-4.2-4.2c.3 0 .6 0 .9.1V14a1.7 1.7 0 1 0 .8 1.5V6.2h2.3z" fill="#fff" />
                <path d="M14.5 6.2c.5 2.1 1.8 3.4 3.7 3.8" fill="none" stroke="#25F4EE" strokeWidth="1.2" />
                <path d="M11.4 11.4A4.2 4.2 0 0 0 6.3 15" fill="none" stroke="#FE2C55" strokeWidth="1.2" />
            </svg>
        );
    }
    if (platformId === 'facebook_reels') {
        return (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                <circle cx="12" cy="12" r="10" fill="#1877F2" />
                <path d="M13.3 18v-5.3h1.8l.3-2.1h-2.1V9.2c0-.6.2-1 1.1-1h1.1V6.3c-.2 0-.9-.1-1.7-.1-1.7 0-2.9 1-2.9 2.9v1.6H9v2.1h1.9V18h2.4z" fill="#fff" />
            </svg>
        );
    }
    if (platformId === 'linkedin') {
        return (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                <rect x="3" y="3" width="18" height="18" rx="3" fill="#0A66C2" />
                <path d="M7.1 10h2.3v7H7.1v-7zm1.2-3.4a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6zM10.9 10h2.2v1c.3-.6 1.1-1.2 2.3-1.2 2.4 0 2.8 1.6 2.8 3.6V17H16v-3.3c0-.8 0-1.9-1.2-1.9s-1.4.9-1.4 1.8V17h-2.3v-7z" fill="#fff" />
            </svg>
        );
    }
    if (platformId === 'x') {
        return (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                <rect x="3" y="3" width="18" height="18" rx="4" fill="#050505" />
                <path d="M7 7h3.1l2.5 3.3L15.5 7H17l-3.7 4.3L17.5 17h-3.1l-2.7-3.6L8.6 17H7.1l3.9-4.6L7 7zm2.2 1.1 6 7.8h1.1l-6-7.8H9.2z" fill="#fff" />
            </svg>
        );
    }
    if (platformId === 'threads') {
        return (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                <rect x="3" y="3" width="18" height="18" rx="5" fill="#050505" />
                <path d="M12.1 18.2c-3.5 0-5.7-2.3-5.7-6.1 0-3.7 2.2-6.3 5.5-6.3 2.8 0 4.7 1.6 5.2 4.4l-2.1.5c-.3-1.8-1.3-2.8-3-2.8-2 0-3.3 1.6-3.3 4.2 0 2.5 1.2 4 3.4 4 1.5 0 2.6-.7 2.6-1.8 0-.9-.7-1.4-2-1.5l-.9-.1v-2l1 .1c.8.1 1.5.2 2.1.5-.2-1.2-.9-1.9-2.2-1.9-1 0-1.8.4-2.3 1.2l-1.8-1c.8-1.4 2.2-2.2 4.1-2.2 2.8 0 4.5 1.8 4.7 4.7 1 .7 1.5 1.7 1.5 2.9 0 2.3-2 3.8-4.8 3.8z" fill="#fff" />
            </svg>
        );
    }
    return <Megaphone className="h-4 w-4" />;
}

function PlatformMark({ platformId, muted = false }: { platformId: string; muted?: boolean }) {
    return (
        <span
            title={platformLabel(platformId)}
            className={cn(
                'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-opacity',
                muted
                    ? 'border-border bg-background opacity-55 grayscale'
                    : 'border-foreground/10 bg-background',
            )}
        >
            <PlatformIcon platformId={platformId} />
        </span>
    );
}

function StatusDot({ status }: { status: SocialSchedulerStatus }) {
    return <span className={cn('h-2.5 w-2.5 rounded-full', STATUS_ACCENTS[status])} />;
}

function schedulerErrorMessage(error: unknown, fallback: string): string {
    return getApiErrorMessage(error, fallback);
}

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export default function SocialSchedulerPage() {
    const navigate = useNavigate();
    const { signOut, user } = useAuth();
    const [posts, setPosts] = useState<SocialSchedulerPost[]>([]);
    const [platforms, setPlatforms] = useState<SocialPlatformConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishingPostId, setPublishingPostId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [draggingPostId, setDraggingPostId] = useState<string | null>(null);
    const [form, setForm] = useState<SchedulerForm>(defaultForm);
    const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const displayPlatforms = platforms.length ? platforms : fallbackPlatforms;
    const connectedCount = useMemo(
        () => displayPlatforms.filter((platform) => platform.connected).length,
        [displayPlatforms],
    );

    const postsByStatus = useMemo(() => {
        const groups: Record<SocialSchedulerStatus, SocialSchedulerPost[]> = {
            draft: [],
            ready: [],
            scheduled: [],
            published: [],
        };
        for (const post of posts) {
            groups[post.status]?.push(post);
        }
        return groups;
    }, [posts]);

    const scheduledCount = postsByStatus.scheduled.length;
    const readyCount = postsByStatus.ready.length;
    const activePlatforms = form.platforms;
    const nextScheduledPost = postsByStatus.scheduled
        .filter((post) => post.scheduled_at)
        .sort((a, b) => new Date(a.scheduled_at || '').getTime() - new Date(b.scheduled_at || '').getTime())[0];

    const loadScheduler = useCallback(async (options?: { clearError?: boolean }) => {
        setLoading(true);
        if (options?.clearError !== false) {
            setError('');
        }
        try {
            if (user) {
                await getCurrentAuthToken({ forceRefresh: true, timeoutMs: 5_000 });
            }
            const [platformRes, postRes] = await Promise.all([
                socialSchedulerApi.platforms(),
                socialSchedulerApi.posts(),
            ]);
            setPlatforms(platformRes.data.platforms || []);
            setPosts(postRes.data.items || []);
        } catch (err) {
            setError(schedulerErrorMessage(err, 'Unable to load social scheduler right now.'));
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const oauthResult = params.get('oauth');
        const platformId = params.get('platform') || '';
        const message = params.get('message') || '';
        if (oauthResult === 'success') {
            setNotice(`${platformLabel(platformId)} connected.`);
            window.history.replaceState(null, '', window.location.pathname);
        } else if (oauthResult === 'error') {
            setError(message || `${platformLabel(platformId)} connection failed.`);
            window.history.replaceState(null, '', window.location.pathname);
        }
        void loadScheduler({ clearError: oauthResult !== 'error' });
    }, [loadScheduler]);

    const resetForm = useCallback(() => {
        setForm(defaultForm);
        setSelectedVideo(null);
        setUploadProgress(0);
    }, []);

    const selectScheduleVideo = useCallback((file: File | null) => {
        if (!file) return;
        if (!file.type.startsWith('video/')) {
            setError('Upload a video file for scheduled social posts.');
            return;
        }
        setError('');
        setSelectedVideo(file);
        setUploadProgress(0);
    }, []);

    const togglePlatform = useCallback((platformId: string) => {
        setForm((current) => {
            const exists = current.platforms.includes(platformId);
            const nextPlatforms = exists
                ? current.platforms.filter((item) => item !== platformId)
                : [...current.platforms, platformId];
            return { ...current, platforms: nextPlatforms };
        });
    }, []);

    const createPost = useCallback(async () => {
        const title = form.title.trim();
        if (!title) {
            setError('Add a post title before creating a scheduler item.');
            return;
        }
        if (form.platforms.length === 0) {
            setError('Select at least one social platform.');
            return;
        }

        setSaving(true);
        setError('');
        try {
            await getCurrentAuthToken({ forceRefresh: true, timeoutMs: 5_000 });
            let projectId: string | null = null;
            let assetUrl: string | null = null;

            if (selectedVideo) {
                const projectRes = await projectsApi.create(title, 'social-scheduler');
                projectId = projectRes.data.id;
                const uploadRes = await mediaApi.upload(projectId, selectedVideo, (progressEvent) => {
                    const total = progressEvent.total || selectedVideo.size || 1;
                    setUploadProgress(Math.round((progressEvent.loaded * 100) / total));
                });
                const uploadData = uploadRes.data as SchedulerUploadResponse;
                assetUrl = uploadData.file_path || null;
            }

            const tags = form.tags
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean);
            const status: SocialSchedulerStatus = form.scheduled_at ? 'scheduled' : 'ready';
            const res = await socialSchedulerApi.createPost({
                title,
                caption: form.caption.trim(),
                platforms: form.platforms,
                status,
                scheduled_at: form.scheduled_at || null,
                timezone: form.timezone,
                project_id: projectId,
                asset_url: assetUrl,
                campaign: form.campaign.trim() || null,
                tags,
            });
            setPosts((items) => [res.data, ...items]);
            setNotice(selectedVideo ? 'Video uploaded and scheduler item created.' : 'Scheduler item created.');
            setIsCreateOpen(false);
            resetForm();
        } catch (err) {
            setError(schedulerErrorMessage(err, 'Unable to create scheduler item.'));
        } finally {
            setSaving(false);
        }
    }, [form, resetForm, selectedVideo]);

    const updatePostStatus = useCallback(async (post: SocialSchedulerPost, status: SocialSchedulerStatus) => {
        if (post.status === status) return;
        const previous = posts;
        setPosts((items) => items.map((item) => item.id === post.id ? { ...item, status } : item));
        try {
            await getCurrentAuthToken({ forceRefresh: true, timeoutMs: 5_000 });
            const res = await socialSchedulerApi.updatePost(post.id, { status });
            setPosts((items) => items.map((item) => item.id === post.id ? res.data : item));
            setNotice(`Moved "${post.title}" to ${BOARD_COLUMNS.find((column) => column.id === status)?.title || status}.`);
        } catch (err) {
            setPosts(previous);
            setError(schedulerErrorMessage(err, 'Unable to update scheduler item.'));
        }
    }, [posts]);

    const deletePost = useCallback(async (post: SocialSchedulerPost) => {
        const previous = posts;
        setPosts((items) => items.filter((item) => item.id !== post.id));
        try {
            await getCurrentAuthToken({ forceRefresh: true, timeoutMs: 5_000 });
            await socialSchedulerApi.deletePost(post.id);
            setNotice('Scheduler item removed.');
        } catch (err) {
            setPosts(previous);
            setError(schedulerErrorMessage(err, 'Unable to delete scheduler item.'));
        }
    }, [posts]);

    const publishPostNow = useCallback(async (post: SocialSchedulerPost) => {
        if (!post.asset_url && !post.project_id) {
            setError('Attach a video before publishing this post.');
            return;
        }
        setPublishingPostId(post.id);
        setError('');
        try {
            await getCurrentAuthToken({ forceRefresh: true, timeoutMs: 5_000 });
            await socialSchedulerApi.publishPost(post.id);
            setNotice(`Publishing started for "${post.title}".`);
            await loadScheduler({ clearError: false });
        } catch (err) {
            setError(schedulerErrorMessage(err, 'Unable to publish this scheduler item right now.'));
        } finally {
            setPublishingPostId(null);
        }
    }, [loadScheduler]);

    const prepareConnection = useCallback(async (platformId: string) => {
        setError('');
        const platform = displayPlatforms.find((item) => item.id === platformId);
        if (platform?.oauth_configured === false) {
            setNotice(`${platformLabel(platformId)} is not enabled for this workspace yet.`);
            return;
        }
        try {
            await getCurrentAuthToken({ forceRefresh: true, timeoutMs: 5_000 });
            const res = await socialSchedulerApi.startOAuth(platformId);
            window.location.assign(res.data.authorization_url);
        } catch (err) {
            setError(schedulerErrorMessage(err, 'Unable to start social connection.'));
        }
    }, [displayPlatforms]);

    const handleReauth = useCallback(async () => {
        await signOut();
        navigate('/login');
    }, [navigate, signOut]);

    return (
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-5 py-6">
            <header className="rounded-[1.75rem] border border-border bg-card">
                <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">
                                <CalendarClock className="h-3.5 w-3.5" />
                                Scheduler
                            </Badge>
                            <Badge variant="outline">{posts.length} posts</Badge>
                            <Badge variant="outline">{connectedCount}/{displayPlatforms.length} channels connected</Badge>
                        </div>
                        <h1 className="mt-4 text-3xl font-semibold tracking-normal text-foreground md:text-4xl">
                            Social publishing board
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                            Prepare Long to Viral clips, captions, campaigns, and publish slots in one clean workspace.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="rounded-2xl border border-border bg-muted/25 px-4 py-3">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">Next launch</p>
                            <p className="mt-1 text-sm font-semibold">{nextScheduledPost ? formatDateTime(nextScheduledPost.scheduled_at) : 'No scheduled post'}</p>
                        </div>
                        <Button size="lg" onClick={() => {
                            resetForm();
                            setIsCreateOpen(true);
                        }}>
                            <Plus className="h-4 w-4" />
                            New post
                        </Button>
                    </div>
                </div>
                <div className="border-t border-border px-5 py-4">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {displayPlatforms.map((platform) => {
                            const connectable = platform.oauth_configured !== false;
                            return (
                                <button
                                    key={platform.id}
                                    type="button"
                                    disabled={!connectable}
                                    onClick={() => void prepareConnection(platform.id)}
                                    className={cn(
                                        'flex min-w-[190px] items-center gap-3 rounded-2xl border border-border bg-background px-3 py-3 text-left transition-colors hover:bg-muted/45',
                                        !connectable && 'cursor-not-allowed opacity-55 hover:bg-background',
                                    )}
                                >
                                    <PlatformMark platformId={platform.id} muted={!platform.connected} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold">{platform.name}</span>
                                        <span className="mt-0.5 block text-xs text-muted-foreground">
                                            {platform.connected ? (platform.account_name || 'Connected') : 'Not connected'}
                                        </span>
                                    </span>
                                    <StatusDot status={platform.connected ? 'published' : 'draft'} />
                                </button>
                            );
                        })}
                    </div>
                </div>
            </header>

            {error && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Scheduler action failed</AlertTitle>
                    <AlertDescription className="flex flex-col gap-3">
                        <span>{error}</span>
                        {error === AUTH_SESSION_REAUTH_MESSAGE && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-max border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => void handleReauth()}
                            >
                                Sign in again
                            </Button>
                        )}
                    </AlertDescription>
                </Alert>
            )}
            {notice && !error && (
                <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Scheduler updated</AlertTitle>
                    <AlertDescription>{notice}</AlertDescription>
                </Alert>
            )}

            <Tabs defaultValue="board" className="gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <TabsList className="w-max rounded-full">
                        <TabsTrigger value="board" className="rounded-full">Board</TabsTrigger>
                        <TabsTrigger value="integrations" className="rounded-full">Channels</TabsTrigger>
                    </TabsList>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5"><StatusDot status="ready" /> {readyCount} ready</span>
                        <span className="inline-flex items-center gap-1.5"><StatusDot status="scheduled" /> {scheduledCount} scheduled</span>
                    </div>
                </div>

                <TabsContent value="board" className="m-0">
                    {loading ? (
                        <div className="flex min-h-[440px] items-center justify-center rounded-[1.5rem] border border-border bg-card">
                            <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Loading scheduler
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto pb-2">
                            <div className="grid min-w-[1180px] grid-cols-4 gap-4">
                                {BOARD_COLUMNS.map((column) => {
                                    const columnPosts = postsByStatus[column.id];
                                    return (
                                        <section
                                            key={column.id}
                                            className={cn(
                                                'min-h-[620px] rounded-[1.4rem] border border-border bg-muted/20 p-3 transition-colors',
                                                draggingPostId ? 'bg-primary/5' : '',
                                            )}
                                            onDragOver={(event) => event.preventDefault()}
                                            onDrop={(event) => {
                                                event.preventDefault();
                                                const post = posts.find((item) => item.id === draggingPostId);
                                                setDraggingPostId(null);
                                                if (post) void updatePostStatus(post, column.id);
                                            }}
                                        >
                                            <div className="mb-3 rounded-[1.05rem] border border-border bg-background p-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <StatusDot status={column.id} />
                                                        <h2 className="text-sm font-semibold">{column.title}</h2>
                                                    </div>
                                                    <Badge variant="outline">{columnPosts.length}</Badge>
                                                </div>
                                                <p className="mt-2 text-xs leading-5 text-muted-foreground">{column.description}</p>
                                            </div>
                                            <div className="space-y-3">
                                                {columnPosts.length === 0 && (
                                                    <div className="rounded-[1rem] border border-dashed border-border bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
                                                        <CircleDot className="mb-3 h-4 w-4 text-primary" />
                                                        {emptyStateCopy(column.id)}
                                                    </div>
                                                )}
                                                {columnPosts.map((post) => (
                                                    <Card
                                                        key={post.id}
                                                        draggable
                                                        onDragStart={() => setDraggingPostId(post.id)}
                                                        onDragEnd={() => setDraggingPostId(null)}
                                                        className="group cursor-grab overflow-hidden border-border bg-background active:cursor-grabbing"
                                                    >
                                                        <div className={cn('h-1.5', STATUS_ACCENTS[post.status])} />
                                                        <CardHeader className="space-y-3 p-4">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex min-w-0 gap-3">
                                                                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
                                                                        <GripVertical className="h-4 w-4" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <CardTitle className="line-clamp-2 text-base leading-5">{post.title}</CardTitle>
                                                                        <CardDescription className="mt-1 flex items-center gap-1.5">
                                                                            <Clock className="h-3.5 w-3.5" />
                                                                            {formatDateTime(post.scheduled_at)}
                                                                        </CardDescription>
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 shrink-0 text-muted-foreground opacity-100 hover:text-destructive lg:opacity-0 lg:group-hover:opacity-100"
                                                                    onClick={() => void deletePost(post)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                            <div className="flex aspect-video items-center justify-center rounded-[1rem] border border-border bg-muted/40">
                                                                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                                    {post.asset_url ? <FileVideo className="h-5 w-5 text-primary" /> : <Video className="h-5 w-5" />}
                                                                    <span className="text-xs font-semibold">
                                                                        {post.asset_url ? 'Video attached' : column.shortLabel}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {post.caption && (
                                                                <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{post.caption}</p>
                                                            )}
                                                            {post.last_error && (
                                                                <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">
                                                                    {post.last_error}
                                                                </p>
                                                            )}
                                                        </CardHeader>
                                                        <CardContent className="space-y-3 p-4 pt-0">
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {post.platforms.map((platformId) => (
                                                                    <PlatformMark key={platformId} platformId={platformId} />
                                                                ))}
                                                            </div>
                                                            <Separator />
                                                            {post.status !== 'published' && (
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    className="w-full"
                                                                    disabled={publishingPostId === post.id || (!post.asset_url && !post.project_id)}
                                                                    onClick={() => void publishPostNow(post)}
                                                                >
                                                                    {publishingPostId === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                                                    Publish now
                                                                </Button>
                                                            )}
                                                            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                                                <span className="truncate font-medium">{post.campaign || 'No campaign'}</span>
                                                                <span className="inline-flex items-center gap-1 truncate">
                                                                    <Hash className="h-3.5 w-3.5" />
                                                                    {post.tags?.length ? post.tags.slice(0, 2).join(', ') : 'No tags'}
                                                                </span>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="integrations" className="m-0">
                    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                        {displayPlatforms.map((platform) => {
                            const statusLabel = platform.connected ? 'Connected' : 'Not connected';
                            const connectable = platform.oauth_configured !== false;
                            return (
                                <Card key={platform.id} className="border-border bg-card">
                                    <CardHeader>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3">
                                                <PlatformMark platformId={platform.id} muted={!platform.connected} />
                                                <div>
                                                    <CardTitle className="text-lg">{platform.name}</CardTitle>
                                                    <CardDescription className="mt-1">
                                                        {platform.recommended_ratio} video, {platform.character_limit.toLocaleString()} character caption limit.
                                                    </CardDescription>
                                                </div>
                                            </div>
                                            <Badge variant={platform.connected ? 'default' : 'outline'}>{statusLabel}</Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="rounded-xl border border-border bg-muted/25 p-3">
                                                <Video className="h-4 w-4 text-primary" />
                                                <p className="mt-2 text-xs font-semibold text-muted-foreground">Format</p>
                                                <p className="text-sm font-semibold capitalize">{platform.channel_type.replace(/_/g, ' ')}</p>
                                            </div>
                                            <div className="rounded-xl border border-border bg-muted/25 p-3">
                                                <WandSparkles className="h-4 w-4 text-primary" />
                                                <p className="mt-2 text-xs font-semibold text-muted-foreground">Caption fit</p>
                                                <p className="text-sm font-semibold">{platform.character_limit.toLocaleString()} chars</p>
                                            </div>
                                        </div>
                                        <Button
                                            variant={platform.connected ? 'outline' : 'default'}
                                            className="w-full"
                                            disabled={!connectable}
                                            onClick={() => void prepareConnection(platform.id)}
                                        >
                                            <Sparkles className="h-4 w-4" />
                                            {platform.connected ? 'Reconnect account' : 'Connect account'}
                                        </Button>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </TabsContent>
            </Tabs>

            <Dialog open={isCreateOpen} onOpenChange={(open) => {
                if (!saving) setIsCreateOpen(open);
            }}>
                <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
                    <div className="grid lg:grid-cols-[1fr_340px]">
                        <div className="max-h-[90vh] overflow-y-auto p-6">
                            <DialogHeader className="text-left">
                                <Badge variant="secondary" className="mb-2 w-max">
                                    <Send className="h-3.5 w-3.5" />
                                    Schedule content
                                </Badge>
                                <DialogTitle className="text-2xl">Create social post</DialogTitle>
                                <DialogDescription>
                                    Prepare one caption and route it to every selected channel.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="mt-6 space-y-5">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="video/*"
                                    className="hidden"
                                    onChange={(event) => {
                                        selectScheduleVideo(event.target.files?.[0] ?? null);
                                        event.currentTarget.value = '';
                                    }}
                                />
                                <div className="space-y-2">
                                    <Label>Video asset</Label>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={(event) => event.preventDefault()}
                                        onDrop={(event) => {
                                            event.preventDefault();
                                            selectScheduleVideo(event.dataTransfer.files?.[0] ?? null);
                                        }}
                                        className={cn(
                                            'flex w-full items-center gap-4 rounded-2xl border border-dashed border-border bg-muted/25 p-4 text-left transition-colors hover:bg-muted/45',
                                            selectedVideo && 'border-primary/50 bg-primary/5',
                                        )}
                                    >
                                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-primary">
                                            {selectedVideo ? <FileVideo className="h-6 w-6" /> : <UploadCloud className="h-6 w-6" />}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-semibold">
                                                {selectedVideo ? selectedVideo.name : 'Upload video for this scheduled post'}
                                            </span>
                                            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                                {selectedVideo
                                                    ? `${formatBytes(selectedVideo.size)} selected. It uploads when you create the post.`
                                                    : 'Drop an MP4, MOV, WebM, MKV, or click to choose the final clip.'}
                                            </span>
                                        </span>
                                    </button>
                                    {selectedVideo && (
                                        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2">
                                            <div className="min-w-0 text-xs text-muted-foreground">
                                                <span className="font-semibold text-foreground">Ready to upload</span>
                                                <span className="ml-2">{formatBytes(selectedVideo.size)}</span>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                disabled={saving}
                                                onClick={() => {
                                                    setSelectedVideo(null);
                                                    setUploadProgress(0);
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                                Remove
                                            </Button>
                                        </div>
                                    )}
                                    {saving && selectedVideo && uploadProgress > 0 && uploadProgress < 100 && (
                                        <div className="space-y-2 rounded-xl border border-border bg-background p-3">
                                            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                                                <span>Uploading video</span>
                                                <span>{uploadProgress}%</span>
                                            </div>
                                            <Progress value={uploadProgress} />
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="scheduler-title">Title</Label>
                                    <Input
                                        id="scheduler-title"
                                        value={form.title}
                                        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                                        placeholder="Clip title or campaign hook"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="scheduler-caption">Caption</Label>
                                    <Textarea
                                        id="scheduler-caption"
                                        value={form.caption}
                                        onChange={(event) => setForm((current) => ({ ...current, caption: event.target.value }))}
                                        placeholder="Write the caption, CTA, and hashtags..."
                                        className="min-h-44"
                                    />
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="scheduler-date">Publish time</Label>
                                        <Input
                                            id="scheduler-date"
                                            type="datetime-local"
                                            value={form.scheduled_at}
                                            onChange={(event) => setForm((current) => ({ ...current, scheduled_at: event.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="scheduler-campaign">Campaign</Label>
                                        <Input
                                            id="scheduler-campaign"
                                            value={form.campaign}
                                            onChange={(event) => setForm((current) => ({ ...current, campaign: event.target.value }))}
                                            placeholder="Launch, podcast, product..."
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="scheduler-tags">Tags</Label>
                                    <Input
                                        id="scheduler-tags"
                                        value={form.tags}
                                        onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                                        placeholder="ai, reels, launch"
                                    />
                                </div>
                            </div>
                        </div>

                        <aside className="flex max-h-[90vh] flex-col border-t border-border bg-muted/25 lg:border-l lg:border-t-0">
                            <div className="border-b border-border p-5">
                                <div className="flex items-center gap-2">
                                    <Megaphone className="h-4 w-4 text-primary" />
                                    <h3 className="text-sm font-semibold">Publishing channels</h3>
                                </div>
                                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                    Select each platform this post should be prepared for.
                                </p>
                            </div>
                            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                                {displayPlatforms.map((platform) => {
                                    const active = activePlatforms.includes(platform.id);
                                    const connectable = platform.oauth_configured !== false;
                                    return (
                                        <button
                                            key={platform.id}
                                            type="button"
                                            disabled={!connectable}
                                            onClick={() => togglePlatform(platform.id)}
                                            className={cn(
                                                'flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm transition-colors',
                                                active ? 'border-primary bg-background text-foreground' : 'border-border bg-background/60 text-muted-foreground hover:bg-background',
                                                !connectable && 'cursor-not-allowed opacity-50 hover:bg-background/60',
                                            )}
                                        >
                                            <PlatformMark platformId={platform.id} muted={!active} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-semibold">{platform.name}</span>
                                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                                    {connectable ? `${platform.recommended_ratio} output` : 'Not connected'}
                                                </span>
                                            </span>
                                            {active ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <span className="h-4 w-4 rounded-full border border-border" />}
                                        </button>
                                    );
                                })}
                            </div>
                            <DialogFooter className="border-t border-border p-4">
                                <Button variant="outline" disabled={saving} onClick={() => setIsCreateOpen(false)}>
                                    Cancel
                                </Button>
                                <Button disabled={saving} onClick={() => void createPost()}>
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    {saving && selectedVideo ? `Uploading ${uploadProgress || 1}%` : 'Create'}
                                </Button>
                            </DialogFooter>
                        </aside>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
