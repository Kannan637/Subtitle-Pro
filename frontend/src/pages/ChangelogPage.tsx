import StaticPageLayout from '@/components/shared/StaticPageLayout';
import { Sparkles, Zap, Bug, Wrench } from 'lucide-react';

const RELEASES = [
    {
        version: '1.0.0',
        date: 'March 25, 2025',
        tag: 'Latest',
        tagColor: 'bg-[var(--color-success-light)] text-[var(--color-success)]',
        summary: 'Public beta release — the beginning.',
        changes: [
            { type: 'feature', icon: Sparkles, text: 'Full transcription pipeline powered by Whisper large-v3' },
            { type: 'feature', icon: Sparkles, text: 'Neural machine translation in 100+ languages via DeepL and GPT-4o' },
            { type: 'feature', icon: Sparkles, text: 'Speaker diarization with pyannote.audio 3.1 (up to 32 speakers)' },
            { type: 'feature', icon: Sparkles, text: 'Export to SRT, VTT, ASS/SSA, TTML, and plain text' },
            { type: 'feature', icon: Sparkles, text: 'Drag-and-drop file upload (up to 10 GB) and YouTube URL import' },
            { type: 'feature', icon: Sparkles, text: 'Side-by-side transcript editor with inline translation preview' },
            { type: 'feature', icon: Sparkles, text: 'Google Sign-In authentication' },
            { type: 'improvement', icon: Zap, text: 'Intelligent cue segmentation: 7s max, 42 chars/line, pause-aligned' },
            { type: 'improvement', icon: Zap, text: 'Hallucination detection filter for AI-generated transcripts' },
        ],
    },
    {
        version: '0.9.0',
        date: 'March 10, 2025',
        tag: 'Pre-release',
        tagColor: 'bg-[var(--color-warning-light)] text-[var(--color-warning)]',
        summary: 'Internal alpha release for testing.',
        changes: [
            { type: 'feature', icon: Sparkles, text: 'Core transcription pipeline with Whisper integration' },
            { type: 'feature', icon: Sparkles, text: 'Basic SRT export' },
            { type: 'fix', icon: Bug, text: 'Fixed audio extraction crash on certain MP4 containers' },
            { type: 'improvement', icon: Zap, text: 'Reduced average processing time by 40%' },
            { type: 'fix', icon: Bug, text: 'Fixed Unicode rendering issues in CJK subtitle output' },
        ],
    },
    {
        version: '0.8.0',
        date: 'February 20, 2025',
        tag: '',
        tagColor: '',
        summary: 'Infrastructure foundation and auth system.',
        changes: [
            { type: 'feature', icon: Sparkles, text: 'Project scaffold: Vite + React 18 + TypeScript frontend' },
            { type: 'feature', icon: Sparkles, text: 'FastAPI backend with PostgreSQL and Redis' },
            { type: 'feature', icon: Sparkles, text: 'Firebase authentication integration' },
            { type: 'improvement', icon: Wrench, text: 'CI/CD pipeline for automated deployments' },
        ],
    },
];

const TYPE_LABELS: Record<string, string> = {
    feature: 'New',
    improvement: 'Improved',
    fix: 'Fixed',
};
const TYPE_COLORS: Record<string, string> = {
    feature: 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]',
    improvement: 'bg-[var(--color-success-light)] text-[var(--color-success)]',
    fix: 'bg-[var(--color-warning-light)] text-[var(--color-warning)]',
};

export default function ChangelogPage() {
    return (
        <StaticPageLayout
            title="Changelog"
            subtitle="A detailed history of everything we've shipped."
        >
            <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[7px] top-6 bottom-0 w-px bg-[var(--color-gray-200)] hidden md:block" />

                <div className="space-y-16">
                    {RELEASES.map((release, ri) => (
                        <div key={ri} className="relative md:pl-10">
                            {/* Timeline dot */}
                            <div className={`hidden md:block absolute left-0 top-2 w-[15px] h-[15px] rounded-full border-2 ${ri === 0 ? 'border-[var(--color-primary)] bg-[var(--color-primary)]' : 'border-[var(--color-gray-300)] bg-white'}`} />

                            {/* Header */}
                            <div className="flex flex-wrap items-center gap-3 mb-3">
                                <h2 className="text-2xl font-serif text-[var(--color-gray-900)]">v{release.version}</h2>
                                {release.tag && (
                                    <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${release.tagColor}`}>
                                        {release.tag}
                                    </span>
                                )}
                                <span className="text-sm text-[var(--color-gray-500)]">{release.date}</span>
                            </div>
                            <p className="text-[var(--color-gray-600)] mb-6">{release.summary}</p>

                            {/* Changes */}
                            <div className="space-y-3">
                                {release.changes.map((change, ci) => (
                                    <div key={ci} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-[var(--color-gray-200)] hover:border-[var(--color-gray-300)] transition-colors">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0 mt-0.5 ${TYPE_COLORS[change.type]}`}>
                                            {TYPE_LABELS[change.type]}
                                        </span>
                                        <p className="text-sm text-[var(--color-gray-700)] leading-relaxed">{change.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </StaticPageLayout>
    );
}
