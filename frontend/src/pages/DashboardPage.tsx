import { useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    BarChart3,
    BookOpen,
    CalendarClock,
    Captions,
    CheckCircle2,
    Command,
    CreditCard,
    Crown,
    FileVideo2,
    Gauge,
    Gift,
    HelpCircle,
    LayoutDashboard,
    Loader2,
    LogOut,
    Menu,
    MessageCircle,
    Monitor,
    Moon,
    MoreHorizontal,
    Palette,
    Plus,
    RotateCcw,
    Scissors,
    Search,
    Settings,
    ShieldCheck,
    Sparkles,
    Sun,
    UploadCloud,
    UserPlus,
    Users,
    WandSparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettings, type ThemeMode } from '@/contexts/AppSettingsContext';
import {
    AUTH_SESSION_REAUTH_MESSAGE,
    getApiErrorMessage,
    getCurrentAuthToken,
    isAuthSessionError,
    mediaApi,
    projectsApi,
    type Project,
} from '@/lib/api';
import { getProjectOpenPath, getProjectTypeLabel } from '@/lib/projectRoutes';
import BrandLogo from '@/components/shared/BrandLogo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type NavItemConfig = {
    icon: ElementType;
    label: string;
    to: string;
    active: boolean;
    badge?: string;
};

const aiToolCards = [
    {
        title: 'AI Video Subtitle',
        description: 'Transcribe media, manage subtitle tracks, translate, and export subtitle files.',
        to: '/dashboard/transcribe',
        action: 'Start subtitles',
        icon: Captions,
        meta: 'SRT, VTT, TXT, JSON',
    },
    {
        title: 'AI Video Caption',
        description: 'Generate styled caption videos with templates, b-roll, music, SFX, transitions, and MP4 export.',
        to: '/dashboard/translate',
        action: 'Open caption studio',
        icon: WandSparkles,
        meta: 'Timeline + templates',
    },
    {
        title: 'Long to Viral',
        description: 'Create hook-led shorts from long videos or YouTube imports with reframing and captions.',
        to: '/dashboard/long-to-shorts',
        action: 'Create shorts',
        icon: Scissors,
        meta: '9:16 + downloads',
    },
];

function initials(name?: string | null, email?: string | null): string {
    const source = name || email || 'Subtitlepro User';
    return source
        .split(/\s|@/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || 'SU';
}

function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return 'recently';
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 86_400_000) return 'today';
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFileSize(size: number) {
    if (!size) return '0 MB';
    const mb = size / (1024 * 1024);
    if (mb < 1) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

function projectStatusVariant(status?: string): 'default' | 'secondary' | 'success' | 'warning' | 'destructive' {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'ready' || normalized === 'complete') return 'success';
    if (normalized === 'processing' || normalized === 'queued') return 'warning';
    if (normalized === 'error' || normalized === 'failed') return 'destructive';
    return 'secondary';
}

function NavButton({ item, onClick }: { item: NavItemConfig; onClick?: () => void }) {
    const Icon = item.icon;
    return (
        <Link
            to={item.to}
            onClick={onClick}
            className={cn(
                'apple-sidebar-nav group flex w-full items-center gap-3 border px-3 py-2 text-sm font-semibold transition-colors',
                item.active
                    ? 'border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'border-transparent text-sidebar-foreground hover:border-sidebar-border hover:bg-sidebar-accent'
            )}
        >
            <span
                className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors',
                    item.active
                        ? 'border-white/24 bg-white/18 text-sidebar-primary-foreground'
                        : 'border-sidebar-border bg-background text-muted-foreground group-hover:text-sidebar-foreground'
                )}
            >
                <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
            {item.badge && (
                <Badge variant={item.active ? 'secondary' : 'outline'} className="ml-auto text-[10px]">
                    {item.badge}
                </Badge>
            )}
        </Link>
    );
}

function SidebarSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-2">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
            <div className="space-y-1">{children}</div>
        </section>
    );
}

function SidebarContent({
    navItems,
    plan,
    creditsRemaining,
    user,
    onSettings,
    onCloseMobile,
}: {
    navItems: NavItemConfig[];
    plan: string;
    creditsRemaining: number;
    user: ReturnType<typeof useAuth>['user'];
    onSettings: () => void;
    onCloseMobile?: () => void;
}) {
    const mainNav = navItems.slice(0, 1);
    const aiToolsNav = navItems.slice(1, 4);
    const accountNav = navItems.slice(4, 7);
    const resourceNav = navItems.slice(7);

    return (
        <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
            <div className="border-b border-sidebar-border px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                    <Link to="/" className="flex min-w-0 items-center" onClick={onCloseMobile} aria-label="Subtitlepro home">
                        <BrandLogo variant="wordmark" sizeClassName="h-8 w-[132px]" alt="Subtitlepro" />
                    </Link>
                    <Badge variant="outline" className="shrink-0 capitalize">{plan}</Badge>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
                <div className="space-y-4">
                    {mainNav.map((item) => <NavButton key={item.to} item={item} onClick={onCloseMobile} />)}

                    <SidebarSection title="AI Tools">
                        {aiToolsNav.map((item) => <NavButton key={item.to} item={item} onClick={onCloseMobile} />)}
                    </SidebarSection>

                    <SidebarSection title="Manage">
                        {accountNav.map((item) => <NavButton key={item.to} item={item} onClick={onCloseMobile} />)}
                    </SidebarSection>

                    <SidebarSection title="Resources">
                        {resourceNav.map((item) => <NavButton key={item.to} item={item} onClick={onCloseMobile} />)}
                    </SidebarSection>
                </div>
            </div>

            <div className="border-t border-sidebar-border p-3">
                {plan === 'free' && (
                    <Button variant="outline" size="sm" asChild className="mb-3 w-full justify-center">
                        <Link to="/dashboard/billing" onClick={onCloseMobile}>
                            <Crown className="h-3.5 w-3.5" />
                            Upgrade plan
                        </Link>
                    </Button>
                )}
                <button
                    type="button"
                    onClick={onSettings}
                    className="flex w-full items-center gap-3 rounded-2xl border border-sidebar-border bg-background/70 p-2.5 text-left backdrop-blur-xl transition-colors hover:bg-sidebar-accent"
                >
                    <Avatar className="h-10 w-10 rounded-xl">
                        {user?.photoURL && <AvatarImage src={user.photoURL} referrerPolicy="no-referrer" alt="" />}
                        <AvatarFallback className="rounded-xl">{initials(user?.displayName, user?.email)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{user?.displayName || 'Subtitlepro user'}</p>
                        <p className="truncate text-xs font-medium text-muted-foreground">{creditsRemaining} credits left</p>
                    </div>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-sidebar-border bg-muted">
                        <Settings className="h-4 w-4 text-muted-foreground" />
                    </span>
                </button>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const { user, signOut, refreshProfile, plan = 'free', creditsRemaining = 0 } = useAuth();
    const {
        themeMode,
        resolvedTheme,
        reduceMotion,
        setThemeMode,
        setReduceMotion,
        resetSettings,
    } = useAppSettings();
    const navigate = useNavigate();
    const location = useLocation();
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [projectError, setProjectError] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [showSignOutDialog, setShowSignOutDialog] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [projectName, setProjectName] = useState('');
    const [projectType, setProjectType] = useState<'subtitle' | 'caption'>('subtitle');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const isEditorWorkspace = location.pathname.includes('/video-editor/') || location.pathname.includes('/caption-editor/');
    const isDashboardHome = location.pathname === '/dashboard';

    const navItems: NavItemConfig[] = useMemo(() => [
        { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard', active: location.pathname === '/dashboard' },
        { icon: Captions, label: 'AI Video Subtitle', to: '/dashboard/transcribe', active: location.pathname === '/dashboard/transcribe' },
        { icon: WandSparkles, label: 'AI Video Caption', to: '/dashboard/translate', active: location.pathname === '/dashboard/translate' || location.pathname.includes('/dashboard/caption-editor') },
        { icon: Scissors, label: 'Long to Viral', to: '/dashboard/long-to-shorts', active: location.pathname.startsWith('/dashboard/long-to-shorts') },
        { icon: CalendarClock, label: 'Scheduler', to: '/dashboard/social-scheduler', active: location.pathname === '/dashboard/social-scheduler' },
        { icon: BarChart3, label: 'Usage & Analytics', to: '/dashboard/analytics', active: location.pathname === '/dashboard/analytics' },
        { icon: CreditCard, label: 'Billing & Plans', to: '/dashboard/billing', active: location.pathname === '/dashboard/billing' },
        { icon: Users, label: 'Team Members', to: '/dashboard/team', active: location.pathname === '/dashboard/team', badge: 'Pro' },
        { icon: BookOpen, label: 'Documentation', to: '/docs', active: location.pathname === '/docs' },
        { icon: HelpCircle, label: 'Help & Support', to: '/dashboard/help', active: location.pathname === '/dashboard/help' },
    ], [location.pathname]);

    const visibleProjects = useMemo(
        () => [...projects].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8),
        [projects],
    );

    const loadProjects = async () => {
        setIsLoading(true);
        setProjectError('');
        try {
            if (user) {
                await getCurrentAuthToken({ forceRefresh: true, timeoutMs: 5_000 });
            }
            const res = await projectsApi.listAll();
            setProjects(res.data || []);
        } catch (error) {
            console.error('Error loading projects:', error);
            if (isAuthSessionError(error) && user) {
                try {
                    await refreshProfile();
                    const retry = await projectsApi.listAll();
                    setProjects(retry.data || []);
                    setProjectError('');
                    return;
                } catch (retryError) {
                    console.error('Project reload after auth recovery failed:', retryError);
                    if (isAuthSessionError(retryError)) {
                        setProjectError(AUTH_SESSION_REAUTH_MESSAGE);
                        return;
                    }
                    setProjectError(getApiErrorMessage(retryError, 'Unable to load projects right now.'));
                    return;
                }
            }
            if (isAuthSessionError(error)) {
                setProjectError(AUTH_SESSION_REAUTH_MESSAGE);
                return;
            }
            setProjectError(getApiErrorMessage(error, 'Unable to load projects right now.'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user) void loadProjects();
    }, [user]);

    const resetCreateForm = () => {
        setProjectName('');
        setProjectType('subtitle');
        setSelectedFile(null);
        setUploadProgress(0);
    };

    const openCreateDialog = () => {
        resetCreateForm();
        setShowCreateDialog(true);
        setIsMobileMenuOpen(false);
    };

    const handleFileSelect = (file: File | null) => {
        setSelectedFile(file);
        if (file && !projectName.trim()) setProjectName(file.name.replace(/\.[^.]+$/, '').trim());
    };

    const handleCreateProject = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!projectName.trim() || !selectedFile) return;

        setIsSubmitting(true);
        setUploadProgress(0);
        try {
            const projectRes = await projectsApi.create(projectName.trim(), projectType);
            const projectId = projectRes.data.id;
            await mediaApi.upload(projectId, selectedFile, (progressEvent) => {
                const pct = progressEvent.total ? Math.round((progressEvent.loaded * 100) / progressEvent.total) : 0;
                setUploadProgress(pct);
            });
            setShowCreateDialog(false);
            resetCreateForm();
            void loadProjects();
            if (projectType === 'caption') {
                navigate(`/dashboard/caption-editor/${projectId}?autostart=1`);
            } else {
                navigate(getProjectOpenPath(projectRes.data));
            }
        } catch (error) {
            console.error('Error creating project:', error);
            setProjectError(getApiErrorMessage(error, 'Failed to create project. Please retry.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const deleteProject = async (project: Project) => {
        if (!window.confirm(`Delete "${project.name}"?`)) return;
        const previous = projects;
        setProjects((items) => items.filter((item) => item.id !== project.id));
        try {
            await projectsApi.delete(project.id);
        } catch (error) {
            console.error('Failed to delete project:', error);
            setProjects(previous);
            setProjectError(getApiErrorMessage(error, 'Failed to delete project. Please retry.'));
        }
    };

    const openProject = (project: Project) => navigate(getProjectOpenPath(project));

    const handleSignOut = async () => {
        setShowSignOutDialog(false);
        await signOut();
        navigate('/');
    };

    if (isEditorWorkspace) {
        return (
            <div className="h-screen w-screen overflow-hidden bg-background">
                <Outlet />
            </div>
        );
    }

    const sidebar = (
        <SidebarContent
            navItems={navItems}
            plan={plan}
            creditsRemaining={creditsRemaining}
            user={user}
            onSettings={() => {
                setIsSettingsOpen(true);
                setIsMobileMenuOpen(false);
            }}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
        />
    );

    return (
        <div className="apple-no-shadow flex h-screen min-h-screen overflow-hidden bg-background text-foreground">
            <aside className="hidden w-[288px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
                {sidebar}
            </aside>

            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetContent side="left" className="w-[288px] p-0 sm:max-w-[288px]">
                    <SheetHeader className="sr-only">
                        <SheetTitle>Dashboard menu</SheetTitle>
                        <SheetDescription>Subtitlepro dashboard navigation</SheetDescription>
                    </SheetHeader>
                    {sidebar}
                </SheetContent>
            </Sheet>

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 sm:px-5 lg:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileMenuOpen(true)}>
                            <Menu className="h-5 w-5" />
                        </Button>
                        <button
                            type="button"
                            className="hidden h-10 w-[180px] items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted sm:flex lg:w-[220px]"
                            aria-label="Search dashboard"
                        >
                            <Search className="h-4 w-4 shrink-0" />
                            <span className="truncate">Search</span>
                            <span className="ml-auto inline-flex h-6 items-center gap-1 rounded-md border border-border bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
                                <Command className="h-3 w-3" />
                                K
                            </span>
                        </button>
                        <Button variant="outline" size="icon-sm" className="sm:hidden" aria-label="Search dashboard">
                            <Search className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                        <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
                            <Link to="/dashboard/team">
                                <UserPlus className="h-4 w-4" />
                                Invite
                            </Link>
                        </Button>
                        <Button
                            variant="outline"
                            size="icon-sm"
                            asChild
                            className="hidden border-primary/45 bg-primary/5 text-foreground hover:bg-primary/10 sm:inline-flex"
                        >
                            <Link to="/dashboard/billing" aria-label="Billing rewards">
                                <Gift className="h-4 w-4" />
                            </Link>
                        </Button>
                        <Button variant="outline" size="icon-sm" asChild className="hidden sm:inline-flex">
                            <Link to="/dashboard/help" aria-label="Community">
                                <MessageCircle className="h-4 w-4" />
                            </Link>
                        </Button>
                        <Button variant="outline" size="icon-sm" asChild>
                            <Link to="/dashboard/help" aria-label="Help">
                                <HelpCircle className="h-4 w-4" />
                            </Link>
                        </Button>
                        <div className="hidden h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground sm:flex">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span>{creditsRemaining} credits</span>
                        </div>
                        <Button size="sm" asChild className="bg-amber-200 text-amber-950 hover:bg-amber-300">
                            <Link to="/dashboard/billing">
                                Upgrade
                            </Link>
                        </Button>
                    </div>
                </header>

                <main className={cn('flex-1 overflow-y-auto bg-background', isDashboardHome ? 'p-4 sm:p-6 lg:p-8' : '')}>
                    {!isDashboardHome ? (
                        <Outlet />
                    ) : (
                        <div className="mx-auto max-w-7xl space-y-6">
                            {projectError && (
                                <Alert variant="destructive" className="grid-cols-[20px_1fr]">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Dashboard action failed</AlertTitle>
                                    <AlertDescription>{projectError}</AlertDescription>
                                </Alert>
                            )}

                            <section>
                                <Card>
                                    <CardContent className="p-6 sm:p-8">
                                        <Badge variant="secondary" className="mb-4 w-max gap-2">
                                            <Sparkles className="h-3.5 w-3.5" />
                                            Dashboard
                                        </Badge>
                                        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
                                            <div>
                                                <h2 className="max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
                                                    What do you want to create?
                                                </h2>
                                                <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-muted-foreground sm:text-base">
                                                    Choose a workspace, upload media, or continue from a recent project.
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                                                <Button size="lg" onClick={openCreateDialog}>
                                                    <UploadCloud className="h-4 w-4" />
                                                    Upload
                                                </Button>
                                                <Button size="lg" variant="outline" asChild>
                                                    <Link to="/dashboard/long-to-shorts">
                                                        <Scissors className="h-4 w-4" />
                                                        Long to Viral
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </section>

                            <section>
                                <div className="mb-3 flex items-center justify-between gap-4">
                                    <h2 className="text-xl font-semibold tracking-[-0.03em]">AI tools</h2>
                                </div>
                                <div className="grid gap-3 lg:grid-cols-3">
                                    {aiToolCards.map((tool) => (
                                        <Link
                                            key={tool.title}
                                            to={tool.to}
                                            className="apple-link-card flex min-h-24 items-center gap-3 p-4"
                                        >
                                            <span className="apple-icon-cell shrink-0">
                                                <tool.icon className="h-5 w-5" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-base font-semibold tracking-[-0.02em]">{tool.title}</span>
                                                <span className="mt-1 block truncate text-sm font-medium text-muted-foreground">{tool.meta}</span>
                                            </span>
                                            <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        </Link>
                                    ))}
                                </div>
                            </section>

                            <section>
                                <div className="mb-4 flex items-end justify-between gap-4">
                                    <div>
                                        <h2 className="text-2xl font-semibold tracking-[-0.03em]">Recent projects</h2>
                                        <p className="mt-1 text-sm text-muted-foreground">Open existing subtitle, caption, and shorts workspaces.</p>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => void loadProjects()}>
                                        Refresh
                                    </Button>
                                </div>

                                {isLoading ? (
                                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-52 rounded-xl" />)}
                                    </div>
                                ) : visibleProjects.length === 0 ? (
                                    <Card>
                                        <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
                                            <FileVideo2 className="mb-4 h-10 w-10 text-primary" />
                                            <CardTitle>No projects yet</CardTitle>
                                            <CardDescription className="mt-2 max-w-md">
                                                Create your first project to start subtitle generation, caption styling, or Long to Viral analysis.
                                            </CardDescription>
                                            <Button className="mt-5" onClick={openCreateDialog}>
                                                <Plus className="h-4 w-4" />
                                                Create project
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                        {visibleProjects.map((project) => (
                                            <Card key={project.id} className="group cursor-pointer transition-colors hover:border-primary/35" onClick={() => openProject(project)}>
                                                <CardHeader className="pb-3">
                                                    <div className="mb-3 flex items-center justify-between">
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-primary">
                                                            <FileVideo2 className="h-5 w-5" />
                                                        </div>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                                                                <Button variant="ghost" size="icon-sm">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={(event) => { event.stopPropagation(); openProject(project); }}>Open Project</DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem variant="destructive" onClick={(event) => { event.stopPropagation(); void deleteProject(project); }}>Delete</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                    <CardTitle className="truncate text-base">{project.name}</CardTitle>
                                                    <CardDescription className="flex flex-wrap items-center gap-2">
                                                        <span>{getProjectTypeLabel(project)}</span>
                                                        <span>{formatDate(project.created_at)}</span>
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent>
                                                    <Badge variant={projectStatusVariant(project.status)} className="capitalize">{project.status || 'unknown'}</Badge>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>
                    )}
                </main>
            </div>

            <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <SheetContent className="flex w-full flex-col overflow-hidden border-l border-border bg-background p-0 sm:max-w-[520px]">
                    <div className="border-b border-border px-6 pb-5 pt-6">
                        <SheetHeader className="gap-1 pr-8">
                            <SheetTitle className="text-2xl font-semibold tracking-[-0.04em]">Settings</SheetTitle>
                            <SheetDescription>Personalize the workspace without leaving production flow.</SheetDescription>
                        </SheetHeader>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                        <div className="space-y-5">
                            <section className="rounded-[1.75rem] border border-border bg-card p-4">
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-14 w-14 rounded-2xl border border-border">
                                        {user?.photoURL && <AvatarImage src={user.photoURL} referrerPolicy="no-referrer" alt="" />}
                                        <AvatarFallback className="rounded-2xl text-base">{initials(user?.displayName, user?.email)}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-base font-semibold tracking-[-0.02em]">{user?.displayName || 'Subtitlepro user'}</p>
                                        <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    <div className="rounded-2xl border border-border bg-muted/35 px-3 py-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Plan</p>
                                        <p className="mt-1 truncate text-sm font-semibold capitalize">{plan}</p>
                                    </div>
                                    <div className="rounded-2xl border border-border bg-muted/35 px-3 py-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Credits</p>
                                        <p className="mt-1 text-sm font-semibold">{creditsRemaining} left</p>
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-semibold tracking-[-0.02em]">Appearance</h3>
                                        <p className="text-sm text-muted-foreground">Current theme is {resolvedTheme}.</p>
                                    </div>
                                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-muted/35 text-primary">
                                        <Palette className="h-4 w-4" />
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 rounded-[1.35rem] border border-border bg-muted/40 p-1.5">
                                    {[
                                        { id: 'light' as ThemeMode, label: 'Light', icon: Sun },
                                        { id: 'dark' as ThemeMode, label: 'Dark', icon: Moon },
                                        { id: 'system' as ThemeMode, label: 'System', icon: Monitor },
                                    ].map((option) => (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => setThemeMode(option.id)}
                                            className={cn(
                                                'flex h-20 flex-col items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition-colors',
                                                themeMode === option.id
                                                    ? 'border-primary bg-background text-foreground'
                                                    : 'border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground'
                                            )}
                                        >
                                            <option.icon className="h-4 w-4" />
                                            <span>{option.label}</span>
                                            {themeMode === option.id && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                                        </button>
                                    ))}
                                </div>
                            </section>

                            <section className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-semibold tracking-[-0.02em]">Workspace behavior</h3>
                                        <p className="text-sm text-muted-foreground">Keep the editor calm and readable.</p>
                                    </div>
                                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-muted/35 text-primary">
                                        <Gauge className="h-4 w-4" />
                                    </span>
                                </div>
                                <div className="rounded-[1.5rem] border border-border bg-card p-2">
                                    <div className="flex items-center justify-between gap-4 rounded-[1.15rem] px-3 py-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold">Reduce motion</p>
                                            <p className="mt-0.5 text-sm text-muted-foreground">Use softer transitions across the dashboard.</p>
                                        </div>
                                        <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} />
                                    </div>
                                    <Separator className="my-1" />
                                    <div className="flex items-start gap-3 rounded-[1.15rem] px-3 py-3">
                                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                        <p className="text-sm leading-6 text-muted-foreground">
                                            Caption editing, timeline work, and Long to Viral tools are tuned for desktop workspaces.
                                        </p>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>

                    <div className="border-t border-border bg-background/95 px-6 py-4">
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" className="h-11" onClick={resetSettings}>
                                <RotateCcw className="h-4 w-4" />
                                Reset
                            </Button>
                            <Button variant="destructive" className="h-11" onClick={() => {
                                setIsSettingsOpen(false);
                                setShowSignOutDialog(true);
                            }}>
                                <LogOut className="h-4 w-4" />
                                Sign out
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <Dialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Sign out?</DialogTitle>
                        <DialogDescription>Any unsaved editor changes may be lost. You can sign back in with Google.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSignOutDialog(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => void handleSignOut()}>
                            <LogOut className="h-4 w-4" />
                            Sign out
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showCreateDialog} onOpenChange={(open) => {
                if (!isSubmitting) setShowCreateDialog(open);
            }}>
                <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
                    <div className="grid lg:grid-cols-[0.92fr_1.08fr]">
                        <div className="relative hidden min-h-[620px] overflow-hidden bg-foreground lg:block">
                            <img src="/ezgif-6281616365727e32.gif" alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
                            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.45)_52%,rgba(0,0,0,0.12)_100%)]" />
                            <div className="relative z-10 flex h-full flex-col justify-between p-7 text-white">
                                <Badge className="w-max bg-white text-black hover:bg-white">
                                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                                    AI production setup
                                </Badge>
                                <div>
                                    <h2 className="text-5xl font-black uppercase leading-[0.9] tracking-normal">Upload once. Produce everywhere.</h2>
                                    <p className="mt-4 max-w-sm text-sm font-medium leading-6 text-white/74">
                                        Route the same media into subtitles, styled captions, or shorts without losing source context.
                                    </p>
                                    <div className="mt-6 grid grid-cols-3 gap-2">
                                        {['Captions', 'B-roll', 'Export'].map((label) => (
                                            <div key={label} className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur">
                                                <p className="text-xs font-black uppercase text-white/70">{label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleCreateProject} className="flex max-h-[90vh] flex-col overflow-y-auto">
                            <DialogHeader className="border-b border-border p-6 text-left">
                                <Badge variant="secondary" className="mb-2 w-max">New workspace</Badge>
                                <DialogTitle className="text-2xl">Create AI Video Project</DialogTitle>
                                <DialogDescription>Choose the source file and the first workspace to open.</DialogDescription>
                            </DialogHeader>

                            <div className="space-y-5 p-6">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className={cn(
                                        'w-full rounded-xl border-2 border-dashed p-5 text-left transition-colors',
                                        selectedFile ? 'border-primary bg-primary/5' : 'border-border bg-muted/35 hover:border-primary hover:bg-primary/5'
                                    )}
                                >
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                        <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-xl', selectedFile ? 'bg-primary text-primary-foreground' : 'bg-background text-primary')}>
                                            <UploadCloud className="h-6 w-6" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-base font-semibold">{selectedFile ? selectedFile.name : 'Drop or select your video/audio file'}</p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {selectedFile ? `${formatFileSize(selectedFile.size)} selected. Click to replace.` : 'MP4, MP3, WAV, MOV, MKV, AVI, and WebM up to 2GB.'}
                                            </p>
                                        </div>
                                        <Badge variant="outline">Browse</Badge>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        accept="video/*,audio/*"
                                        onChange={(event) => handleFileSelect(event.target.files?.[0] ?? null)}
                                    />
                                </button>

                                <div className="space-y-2">
                                    <Label htmlFor="project-name">Project name</Label>
                                    <Input
                                        id="project-name"
                                        value={projectName}
                                        onChange={(event) => setProjectName(event.target.value)}
                                        placeholder="Enter project name..."
                                        required
                                    />
                                </div>

                                <div className="space-y-3">
                                    <Label>Project type</Label>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {[
                                            { value: 'subtitle' as const, title: 'AI Video Subtitle', body: 'Transcribe and manage subtitle tracks.', icon: Captions },
                                            { value: 'caption' as const, title: 'AI Video Caption', body: 'Open templates, b-roll, music, SFX, and MP4 export.', icon: WandSparkles },
                                        ].map((option) => {
                                            const active = projectType === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => setProjectType(option.value)}
                                                    className={cn('rounded-xl border p-4 text-left transition-colors', active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted')}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-primary')}>
                                                            <option.icon className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold">{option.title}</p>
                                                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{option.body}</p>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="link"
                                        className="h-auto p-0"
                                        onClick={() => {
                                            setShowCreateDialog(false);
                                            navigate('/dashboard/long-to-shorts');
                                        }}
                                    >
                                        <Scissors className="h-3.5 w-3.5" />
                                        Need hook-led shorts or YouTube import? Open Long to Viral.
                                    </Button>
                                </div>

                                {isSubmitting && (
                                    <Card className="bg-muted/45">
                                        <CardContent className="p-4">
                                            <div className="mb-2 flex justify-between text-xs font-semibold text-muted-foreground">
                                                <span>Uploading and preparing workspace</span>
                                                <span>{uploadProgress}%</span>
                                            </div>
                                            <Progress value={uploadProgress} />
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            <DialogFooter className="mt-auto border-t border-border bg-muted/35 p-6">
                                <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => setShowCreateDialog(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isSubmitting || !selectedFile}>
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    {isSubmitting ? 'Processing' : 'Create Project'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
