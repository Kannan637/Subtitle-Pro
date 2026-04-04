import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { projectsApi, mediaApi } from '@/lib/api';
import type { Project } from '@/lib/api';
import {
    LogOut, Plus, Search, Sparkles, FilePlay, MessageSquare, Menu, X, FileVideo2,
    UploadCloud, Loader2, LayoutDashboard, FolderOpen, Globe, CreditCard,
    HelpCircle, BookOpen, Zap, BarChart3, Users, Crown, AlertTriangle, ChevronRight, MoreHorizontal
} from 'lucide-react';
import { useNavigate, Link, useLocation, Outlet } from 'react-router-dom';

// ─── Sign-Out Confirmation Modal ─────────────────────────────────────────────
function SignOutModal({ isOpen, onConfirm, onCancel }: { isOpen: boolean; onConfirm: () => void; onCancel: () => void }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                    </div>
                    <h3 className="font-serif text-lg text-[var(--color-gray-900)] mb-2">Sign out?</h3>
                    <p className="text-sm text-[var(--color-gray-500)] mb-6">
                        Are you sure you want to sign out? Any unsaved changes will be lost.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-[var(--color-gray-700)] bg-[var(--color-surface-secondary)] hover:bg-[var(--color-gray-200)] rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-sm"
                        >
                            Sign out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Sidebar Nav Item ────────────────────────────────────────────────────────
function NavItem({ icon: Icon, label, to, active, badge, onClick }: {
    icon: React.ElementType;
    label: string;
    to?: string;
    active?: boolean;
    badge?: string | number;
    onClick?: () => void;
}) {
    const content = (
        <>
            <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[var(--color-primary)]' : 'text-[var(--color-gray-400)] group-hover:text-[var(--color-gray-600)]'}`} />
            <span className="flex-1 truncate">{label}</span>
            {badge !== undefined && (
                <span className="text-[10px] font-bold bg-[var(--color-primary-light)] text-[var(--color-primary)] px-1.5 py-0.5 rounded-md">{badge}</span>
            )}
        </>
    );

    const className = `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors group ${active
        ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] font-medium'
        : 'text-[var(--color-gray-700)] hover:bg-[var(--color-gray-100)] active:bg-[var(--color-gray-200)]'
        }`;

    if (to) {
        return <Link to={to} className={className}>{content}</Link>;
    }
    return <button onClick={onClick} className={className}>{content}</button>;
}

// ─── Section Label ───────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="text-[10px] font-semibold text-[var(--color-gray-400)] tracking-[0.12em] uppercase px-3 mt-5 mb-1.5">{children}</div>
    );
}


export default function DashboardPage() {
    const { user, signOut, plan, creditsRemaining } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showSignOutModal, setShowSignOutModal] = useState(false);

    // Detect if video editor is active — render full-screen without sidebar
    const isVideoEditor = location.pathname.includes('/video-editor/');

    // Dynamic state
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = () => setOpenDropdownId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to delete this project?")) return;
        setOpenDropdownId(null);
        try {
            setProjects(prev => prev.filter(p => p.id !== id));
            await projectsApi.delete(id);
        } catch (error) {
            console.error("Failed to delete project:", error);
            // Optionally revert UI if needed, but optimistic delete is okay here
        }
    };

    // Upload modal state
    const [showModal, setShowModal] = useState(false);
    const [projectName, setProjectName] = useState('');
    const [projectType, setProjectType] = useState<'subtitle' | 'caption'>('subtitle');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSignOut = async () => {
        setShowSignOutModal(false);
        await signOut();
        navigate('/');
    };

    useEffect(() => {
        if (user) {
            loadProjects();
        }
    }, [user]);

    const loadProjects = async () => {
        setIsLoading(true);
        try {
            const res = await projectsApi.list();
            setProjects(res.data);
        } catch (error) {
            console.error('Error loading projects:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
            if (!projectName) {
                setProjectName(e.target.files[0].name.split('.')[0]);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectName.trim()) return;
        if (!selectedFile) return;

        setIsSubmitting(true);
        setUploadProgress(0);

        try {
            const projectRes = await projectsApi.create(projectName, projectType);
            const projectId = projectRes.data.id;

            await mediaApi.upload(projectId, selectedFile, (progressEvent) => {
                const percentCompleted = progressEvent.total ? Math.round((progressEvent.loaded * 100) / progressEvent.total) : 0;
                setUploadProgress(percentCompleted);
            });

            setShowModal(false);
            setProjectName('');
            setSelectedFile(null);
            setUploadProgress(0);

            // Navigate directly to video editor after upload
            navigate(`/dashboard/video-editor/${projectId}`);
        } catch (error) {
            console.error('Error creating project:', error);
            alert('Failed to create project. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const diffDays = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'today';
        return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(diffDays, 'day');
    };

    // ─── Full-screen mode for Video Editor (no sidebar/topbar) ────────────
    if (isVideoEditor) {
        return (
            <div className="h-screen w-screen overflow-hidden">
                <Outlet />
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[var(--color-surface)] text-[var(--color-gray-900)] font-sans overflow-hidden">

            {/* Mobile Backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-20 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-[var(--color-surface-elevated)] border-b border-[var(--color-gray-200)] flex items-center justify-between px-4 z-10">
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 -ml-2 text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)] active:bg-[var(--color-gray-100)] rounded-lg transition-colors"
                    aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}
                >
                    {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
                <Link to="/" className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[var(--color-primary)] text-white flex items-center justify-center font-serif italic text-sm shadow-sm">S</div>
                    <span className="font-serif font-medium text-[var(--color-gray-900)]">SubtitleAI Pro</span>
                </Link>
                {user?.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full border border-[var(--color-gray-200)]" referrerPolicy="no-referrer" />
                ) : (
                    <div className="w-7 h-7 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center font-bold text-xs uppercase">
                        {user?.displayName?.charAt(0) || 'U'}
                    </div>
                )}
            </div>

            {/* ═══════════════ SIDEBAR ═══════════════ */}
            <div
                className={`fixed inset-y-0 left-0 z-30 w-72 lg:w-[268px] bg-[var(--color-surface-secondary)] border-r border-[var(--color-gray-200)] flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                {/* Brand */}
                <div className="h-16 items-center px-5 hidden lg:flex mt-1">
                    <Link to="/" className="flex items-center gap-2.5 group">
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] text-white flex items-center justify-center font-serif italic text-lg shadow-sm">S</div>
                        <span className="font-serif font-medium text-lg tracking-tight text-[var(--color-gray-900)]">SubtitleAI Pro</span>
                    </Link>
                </div>

                {/* Mobile sidebar close */}
                <div className="h-14 flex items-center justify-between px-4 lg:hidden border-b border-[var(--color-gray-200)]">
                    <span className="font-serif font-medium text-[var(--color-gray-900)]">Menu</span>
                    <button onClick={() => setIsSidebarOpen(false)} className="p-2 -mr-2 text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)] active:bg-[var(--color-gray-100)] rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* New Project Button */}
                <div className="px-4 mt-3 mb-1">
                    <button
                        onClick={() => setShowModal(true)}
                        className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm font-medium text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        New Project
                    </button>
                </div>

                {/* ── Scrollable Nav ── */}
                <div className="flex-1 overflow-y-auto px-3 py-1">

                    {/* Main Navigation */}
                    <SectionLabel>Main</SectionLabel>
                    <nav className="space-y-0.5">
                        <NavItem icon={LayoutDashboard} label="Dashboard" to="/dashboard" active={location.pathname === '/dashboard'} />
                        <NavItem icon={FolderOpen} label="All Projects" to="/dashboard" active={false} badge={projects.length || undefined} />
                        <NavItem icon={UploadCloud} label="Upload Media" onClick={() => setShowModal(true)} />
                    </nav>

                    {/* AI Tools */}
                    <SectionLabel>AI Tools</SectionLabel>
                    <nav className="space-y-0.5">
                        <NavItem icon={FilePlay} label="AI Video Subtitle" to="/dashboard/transcribe" active={location.pathname === '/dashboard/transcribe'} />
                        <NavItem icon={MessageSquare} label="AI Video Caption" to="/dashboard/translate" active={location.pathname === '/dashboard/translate'} />
                    </nav>

                    {/* Analytics & Billing */}
                    <SectionLabel>Account</SectionLabel>
                    <nav className="space-y-0.5">
                        <NavItem icon={BarChart3} label="Usage & Analytics" to="/dashboard/analytics" active={location.pathname === '/dashboard/analytics'} />
                        <NavItem icon={CreditCard} label="Billing & Plans" to="/dashboard/billing" active={location.pathname === '/dashboard/billing'} />
                        <NavItem icon={Users} label="Team Members" to="/dashboard/team" active={location.pathname === '/dashboard/team'} badge="Pro" />
                    </nav>

                    {/* Recent Projects */}
                    {projects.length > 0 && (
                        <>
                            <SectionLabel>Recent Projects</SectionLabel>
                            <nav className="space-y-0.5">
                                {isLoading ? (
                                    <div className="px-3 py-2 text-sm text-[var(--color-gray-400)]">Loading...</div>
                                ) : projects.slice(0, 5).map((p) => (
                                    <div key={p.id} className="relative group flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--color-gray-600)] hover:bg-[var(--color-gray-100)] transition-colors">
                                        <MessageSquare className="w-3.5 h-3.5 text-[var(--color-gray-400)] shrink-0" />
                                        <button className="truncate flex-1 text-left" onClick={() => { setIsSidebarOpen(false); navigate(`/dashboard/video-editor/${p.id}`); }}>{p.name}</button>
                                        {p.status === 'processing' && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)] animate-pulse shrink-0"></span>
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === p.id ? null : p.id) }} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-gray-200)] transition-opacity">
                                            <MoreHorizontal className="w-3.5 h-3.5" />
                                        </button>
                                        {openDropdownId === p.id && (
                                            <div className="absolute right-2 top-8 w-36 bg-white border border-[var(--color-gray-200)] rounded-xl shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                                <button onClick={(e) => { e.stopPropagation(); setOpenDropdownId(null); setIsSidebarOpen(false); navigate(`/dashboard/video-editor/${p.id}`); }} className="w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-gray-50)] text-[var(--color-gray-700)]">Open Project</button>
                                                <div className="h-px bg-[var(--color-gray-100)] my-1"></div>
                                                <button onClick={(e) => handleDeleteProject(p.id, e)} className="w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-red-50 text-red-600 transition-colors">Delete</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </nav>
                        </>
                    )}

                    {/* Resources */}
                    <SectionLabel>Resources</SectionLabel>
                    <nav className="space-y-0.5">
                        <NavItem icon={BookOpen} label="Documentation" to="/docs" />
                        <NavItem icon={HelpCircle} label="Help & Support" to="/dashboard/help" active={location.pathname === '/dashboard/help'} />
                        <NavItem icon={BookOpen} label="API Reference" to="/api-reference" />
                    </nav>
                </div>

                {/* ── Sidebar Footer ── */}
                <div className="p-3 border-t border-[var(--color-gray-200)] space-y-2">

                    {/* Plan Card */}
                    <div className="bg-white rounded-xl p-3 border border-[var(--color-gray-200)] shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-semibold text-[var(--color-gray-400)] uppercase tracking-wider">Plan</span>
                            <span className="text-[10px] font-bold text-[var(--color-primary)] bg-[var(--color-primary-light)] px-1.5 py-0.5 rounded capitalize">{plan}</span>
                        </div>
                        <div className="flex items-end gap-1 mb-1.5">
                            <span className="text-xl font-serif font-medium text-[var(--color-gray-900)]">{Math.round(creditsRemaining / 60)}</span>
                            <span className="text-xs text-[var(--color-gray-500)] mb-0.5">min remaining</span>
                        </div>
                        <div className="h-1.5 w-full bg-[var(--color-gray-100)] rounded-full overflow-hidden mb-2.5">
                            <div className="h-full bg-[var(--color-primary)] rounded-full" style={{ width: `${plan === 'free' ? Math.min(100, (creditsRemaining / 3600) * 100) : plan === 'creator' ? Math.min(100, (creditsRemaining / 18000) * 100) : Math.min(100, (creditsRemaining / 90000) * 100)}%` }}></div>
                        </div>
                        {plan === 'free' && (
                            <Link to="/dashboard/billing" className="w-full text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] flex items-center justify-center gap-1 py-1 rounded-lg hover:bg-[var(--color-primary-light)] transition-colors">
                                <Crown className="w-3 h-3" />
                                Upgrade Plan
                            </Link>
                        )}
                    </div>

                    {/* User Button */}
                    <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--color-gray-700)] hover:bg-[var(--color-gray-100)] transition-colors">
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full shrink-0 ring-2 ring-[var(--color-gray-100)]" referrerPolicy="no-referrer" />
                        ) : (
                            <div className="w-7 h-7 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                            </div>
                        )}
                        <div className="flex-1 min-w-0 text-left">
                            <div className="text-sm font-medium text-[var(--color-gray-900)] truncate">{user?.displayName || 'User'}</div>
                            <div className="text-[11px] text-[var(--color-gray-500)] truncate">{user?.email}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[var(--color-gray-400)]" />
                    </button>

                    {/* Sign Out */}
                    <button
                        onClick={() => setShowSignOutModal(true)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
                    >
                        <LogOut className="w-4 h-4 shrink-0 ml-0.5" />
                        <span className="font-medium">Sign out</span>
                    </button>
                </div>
            </div>

            {/* ═══════════════ MAIN CONTENT ═══════════════ */}
            <div className="flex-1 flex flex-col pt-14 lg:pt-0 max-h-screen min-w-0">
                {/* Top Bar - Hide in Video Editor and Video Caption (translate) page */}
                {!isVideoEditor && location.pathname !== '/dashboard/translate' && (
                    <div className="h-14 lg:h-16 border-b border-[var(--color-gray-200)] flex items-center justify-between px-4 lg:px-8 bg-[var(--color-surface)] shrink-0">
                        <h1 className="font-serif text-lg lg:text-xl text-[var(--color-gray-900)]">Projects</h1>
                        <div className="relative w-40 sm:w-56 lg:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-[var(--color-gray-400)]" />
                            </div>
                            <input
                                type="text"
                                className="claude-input w-full pl-9 pr-3 py-2 text-sm text-[var(--color-gray-900)] bg-[var(--color-surface)] placeholder-[var(--color-gray-400)]"
                                placeholder="Search projects..."
                            />
                        </div>
                    </div>
                )}

                {/* Dashboard Canvas */}
                <div className={`flex-1 overflow-y-auto bg-[var(--color-surface)] ${isVideoEditor || location.pathname === '/dashboard/translate' ? '' : 'p-4 sm:p-6 lg:p-10'}`}>
                    {location.pathname !== '/dashboard' ? (
                        <Outlet />
                    ) : (
                        <div className="max-w-6xl mx-auto">
                            {/* Carousel Banner Area For Updates */}
                            <div className="mb-10 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-primary)] via-[#8352FD] to-[#5926ec] p-8 md:p-12 text-white shadow-lg relative flex flex-col md:flex-row items-center justify-between gap-8 group">
                                <div className="z-10 relative max-w-xl">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-[11px] font-bold tracking-wider uppercase mb-4 backdrop-blur-md border border-white/20">
                                        <Sparkles className="w-3.5 h-3.5" />
                                        New Feature
                                    </div>
                                    <h2 className="text-3xl md:text-4xl font-serif font-medium mb-4 leading-tight">Generate Subtitles in 100+ Languages instantly</h2>
                                    <p className="text-white/80 mb-8 text-sm md:text-base leading-relaxed">Meet our newest AI model. Automate your full video editing workflow with cinematic captions, automatic gap cuts, and highly accurate translations.</p>
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => setShowModal(true)} className="px-6 py-3 bg-white text-[var(--color-primary)] rounded-xl font-bold shadow-sm hover:scale-105 transition-transform active:scale-95 flex items-center gap-2">
                                            <UploadCloud className="w-4 h-4" />
                                            Upload Media
                                        </button>
                                        <div className="flex gap-1.5">
                                            <div className="w-6 h-1.5 rounded-full bg-white"></div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-white/40 group-hover:bg-white/60 transition-colors"></div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-white/40 group-hover:bg-white/60 transition-colors"></div>
                                        </div>
                                    </div>
                                </div>
                                {/* Illustrative Decoration */}
                                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 blur-[80px] transform rotate-12 -translate-y-20 translate-x-20 rounded-full pointer-events-none"></div>
                                <div className="hidden md:flex relative z-10 w-72 h-56 bg-white/10 border border-white/20 rounded-2xl backdrop-blur-md shadow-2xl p-5 flex-col justify-between transform transition-transform group-hover:rotate-2 group-hover:scale-105 duration-500">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shadow-inner"><FileVideo2 className="w-6 h-6 text-white" /></div>
                                        <div className="flex-1 space-y-2">
                                            <div className="w-3/4 h-2.5 bg-white/30 rounded-full"></div>
                                            <div className="w-1/2 h-2.5 bg-white/20 rounded-full"></div>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="h-8 rounded-lg bg-white/10 flex items-center px-3 border border-white/10">
                                            <div className="w-2 h-2 rounded-full bg-[var(--color-success)] mr-2 animate-pulse"></div>
                                            <div className="w-1/3 h-1.5 bg-white/30 rounded-full"></div>
                                        </div>
                                        <div className="h-8 rounded-lg bg-white/10 flex items-center px-3 border border-white/10">
                                            <div className="w-2 h-2 rounded-full bg-[var(--color-warning)] mr-2"></div>
                                            <div className="w-1/2 h-1.5 bg-white/30 rounded-full"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {projects.length === 0 && !isLoading ? (
                                <div className="mt-4 sm:mt-8 mb-8 sm:mb-12 flex flex-col items-center justify-center text-center p-6 sm:p-12 border border-[var(--color-gray-200)] border-dashed rounded-2xl bg-[var(--color-surface-secondary)]/50">
                                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-2xl border border-[var(--color-gray-200)] shadow-sm flex items-center justify-center mb-5 sm:mb-6 relative">
                                        <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-[var(--color-primary)] absolute -top-2 -right-2" />
                                        <FileVideo2 className="w-6 h-6 sm:w-8 sm:h-8 text-[var(--color-gray-400)]" />
                                    </div>
                                    <h2 className="text-xl sm:text-2xl font-serif text-[var(--color-gray-900)] mb-2 sm:mb-3">What are we translating today?</h2>
                                    <p className="text-sm sm:text-base text-[var(--color-gray-500)] max-w-md mb-6 sm:mb-8">Upload a video to automatically generate captions, apply dynamic text animations, refine them on a professional multi-track timeline, and export directly to a hardcoded MP4.</p>
                                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                                        <button
                                            onClick={() => setShowModal(true)}
                                            className="claude-button-primary px-6 py-3 rounded-xl shadow-sm font-medium flex items-center justify-center gap-2 w-full sm:w-auto"
                                        >
                                            <UploadCloud className="w-4 h-4" />
                                            Upload Media
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-lg font-serif text-[var(--color-gray-900)] flex items-center gap-2">
                                            Recent Projects
                                        </h2>
                                        <button onClick={() => navigate('/dashboard/transcribe')} className="text-sm font-medium text-[var(--color-primary)] hover:text-[#5926ec] transition-colors">View all →</button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                                        {projects.slice(0, 4).map((project) => (
                                            <div
                                                key={project.id}
                                                className="p-4 sm:p-5 bg-white border border-[var(--color-gray-200)] rounded-2xl shadow-sm hover:border-[var(--color-primary-light)] hover:shadow-md active:shadow-sm transition-all cursor-pointer group"
                                                onClick={() => navigate(`/dashboard/video-editor/${project.id}`)}
                                            >
                                                <div className="flex items-start justify-between mb-3 sm:mb-4 relative">
                                                    <div className="flex gap-2">
                                                        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary)]">
                                                            <FilePlay className="w-5 h-5" />
                                                        </div>
                                                        {project.status === 'processing' ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 max-h-6 rounded-md text-xs font-medium bg-[var(--color-warning-light)] text-[var(--color-warning)] border border-[var(--color-warning)]/20">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)] animate-pulse"></span>
                                                                Processing
                                                            </span>
                                                        ) : project.status === 'error' ? (
                                                            <span className="inline-flex items-center px-2.5 py-1 max-h-6 rounded-md text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                                                                Failed
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2.5 py-1 max-h-6 rounded-md text-xs font-medium bg-[var(--color-success-light)] text-[var(--color-success)] border border-[var(--color-success)]/20">
                                                                Ready
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="relative">
                                                        <button onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === project.id ? null : project.id) }} className="p-1.5 rounded-lg text-[var(--color-gray-400)] hover:text-[var(--color-gray-700)] hover:bg-[var(--color-gray-100)] transition-colors">
                                                            <MoreHorizontal className="w-4 h-4" />
                                                        </button>
                                                        {openDropdownId === project.id && (
                                                            <div className="absolute right-0 top-8 w-36 bg-white border border-[var(--color-gray-200)] rounded-xl shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-100 text-left">
                                                                <button onClick={(e) => { e.stopPropagation(); setOpenDropdownId(null); navigate(`/dashboard/video-editor/${project.id}`); }} className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-[var(--color-gray-50)] text-[var(--color-gray-700)]">Open Project</button>
                                                                <div className="h-px bg-[var(--color-gray-100)] my-1"></div>
                                                                <button onClick={(e) => handleDeleteProject(project.id, e)} className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-red-50 text-red-600 transition-colors">Delete</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <h3 className="font-medium text-[var(--color-gray-900)] mb-1 truncate group-hover:text-[var(--color-primary)] transition-colors">{project.name}</h3>
                                                <div className="flex items-center gap-3 text-xs text-[var(--color-gray-500)]">
                                                    <span>{project.duration_sec ? `${Math.round(project.duration_sec / 60)}m` : '0m'}</span>
                                                    <span>&middot;</span>
                                                    <span>{formatDate(project.created_at)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ═══════════════ MODALS ═══════════════ */}

            {/* Sign-Out Confirmation */}
            <SignOutModal
                isOpen={showSignOutModal}
                onConfirm={handleSignOut}
                onCancel={() => setShowSignOutModal(false)}
            />

            {/* Create Project Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-[var(--color-gray-200)] flex items-center justify-between">
                            <h3 className="font-serif text-lg text-[var(--color-gray-900)]">Create Project</h3>
                            <button onClick={() => setShowModal(false)} className="text-[var(--color-gray-500)] hover:text-[var(--color-gray-900)]">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-[var(--color-gray-300)] rounded-xl p-8 text-center cursor-pointer hover:bg-[var(--color-surface-secondary)] hover:border-[var(--color-primary-light)] transition-colors">
                                <UploadCloud className="w-8 h-8 text-[var(--color-gray-400)] mx-auto mb-3" />
                                <p className="text-sm text-[var(--color-gray-900)] font-medium mb-1">
                                    {selectedFile ? selectedFile.name : 'Click to select a file'}
                                </p>
                                <p className="text-xs text-[var(--color-gray-500)]">MP4, MP3, WAV, MOV, MKV, AVI, WebM up to 2GB</p>
                                <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileSelect} accept="video/*,audio/*" />
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-[var(--color-gray-700)]">Project Name</label>
                                    <input type="text" placeholder="Enter project name..." className="claude-input w-full" value={projectName} onChange={(e) => setProjectName(e.target.value)} required />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-[var(--color-gray-700)]">Project Type</label>
                                    <div className="flex gap-4 p-1">
                                        <label className="flex items-center gap-2 text-sm text-[var(--color-gray-900)] cursor-pointer">
                                            <input type="radio" value="subtitle" checked={projectType === 'subtitle'} onChange={() => setProjectType('subtitle')} className="accent-[var(--color-primary)] w-4 h-4 cursor-pointer" />
                                            <span>AI Video Subtitle</span>
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-[var(--color-gray-900)] cursor-pointer">
                                            <input type="radio" value="caption" checked={projectType === 'caption'} onChange={() => setProjectType('caption')} className="accent-[var(--color-primary)] w-4 h-4 cursor-pointer" />
                                            <span>AI Video Caption</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {isSubmitting && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-medium text-[var(--color-gray-600)]">
                                        <span>Uploading...</span>
                                        <span>{uploadProgress}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-[var(--color-gray-100)] rounded-full overflow-hidden">
                                        <div className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 flex justify-end gap-3 border-t border-[var(--color-gray-200)]">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)] transition-colors" disabled={isSubmitting}>Cancel</button>
                                <button type="submit" disabled={isSubmitting || !selectedFile} className="claude-button-primary px-4 py-2 text-sm disabled:opacity-50 flex items-center gap-2">
                                    {isSubmitting ? (<><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>) : ('Create Project')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
