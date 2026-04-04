import { Sparkles, FileVideo2, FilePlay, UploadCloud, MoreHorizontal } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '@/lib/api';
import type { Project } from '@/lib/api';

function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday) return 'today';
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TranscribePage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
    const navigate = useNavigate();

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
        }
    };

    useEffect(() => {
        projectsApi.list().then(res => {
            setProjects(res.data.filter(p => !p.type || p.type === 'subtitle'));
            setIsLoading(false);
        }).catch(() => setIsLoading(false));
    }, []);

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-serif text-[var(--color-gray-900)] flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] rounded-xl flex items-center justify-center">
                            <FileVideo2 className="w-5 h-5 text-white" />
                        </div>
                        AI Video Subtitle
                    </h1>
                    <p className="mt-2 text-sm text-[var(--color-gray-500)]">
                        Manage all your subtitled video projects here.
                    </p>
                </div>
            </div>

            {projects.length === 0 && !isLoading ? (
                <div className="mt-8 mb-12 flex flex-col items-center justify-center text-center p-12 border border-[var(--color-gray-200)] border-dashed rounded-2xl bg-[var(--color-surface-secondary)]/50">
                    <div className="w-16 h-16 bg-white rounded-2xl border border-[var(--color-gray-200)] shadow-sm flex items-center justify-center mb-6 relative">
                        <Sparkles className="w-8 h-8 text-[var(--color-primary)] absolute -top-2 -right-2" />
                        <FileVideo2 className="w-8 h-8 text-[var(--color-gray-400)]" />
                    </div>
                    <h2 className="text-2xl font-serif text-[var(--color-gray-900)] mb-3">No subtitle projects yet</h2>
                    <p className="text-base text-[var(--color-gray-500)] max-w-md mb-8">Upload a video or audio file to get started. Our AI will automatically generate accurate subtitles.</p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="claude-button-primary px-6 py-3 rounded-xl shadow-sm font-medium flex items-center gap-2"
                    >
                        <UploadCloud className="w-4 h-4" />
                        Go to Dashboard to Upload
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {projects.map((project) => (
                        <div
                            key={project.id}
                            className="p-5 bg-white border border-[var(--color-gray-200)] rounded-2xl shadow-sm hover:border-[var(--color-primary-light)] hover:shadow-md active:shadow-sm transition-all cursor-pointer group"
                            onClick={() => navigate(`/dashboard/video-editor/${project.id}`)}
                        >
                            <div className="flex items-start justify-between mb-4 relative">
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
            )}
        </div>
    );
}
