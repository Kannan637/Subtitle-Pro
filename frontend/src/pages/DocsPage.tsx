import StaticPageLayout from '@/components/shared/StaticPageLayout';
import { BookOpen, Upload, Languages, Download, Settings, ArrowRight } from 'lucide-react';

const GUIDE_SECTIONS = [
    {
        icon: Upload,
        title: 'Uploading Media',
        description: 'Learn how to upload video and audio files for processing.',
        topics: [
            'Supported file formats (MP4, MOV, AVI, WAV, MP3, FLAC, OGG, WebM)',
            'Maximum file size per plan (500 MB – 10 GB)',
            'Importing from YouTube via URL paste',
            'Batch upload for Studio plan users',
        ],
    },
    {
        icon: BookOpen,
        title: 'Transcription',
        description: 'How our AI transcription pipeline works.',
        topics: [
            'Automatic language detection vs. manual selection',
            'Speaker diarization and speaker labeling',
            'Handling background noise and music',
            'Accuracy expectations and confidence scoring',
        ],
    },
    {
        icon: Languages,
        title: 'Translation',
        description: 'Translating subtitles to 100+ target languages.',
        topics: [
            'Selecting target languages',
            'Translation engine selection (DeepL vs. GPT-4o)',
            'Preserving tone and context in translations',
            'Translating between non-English language pairs',
        ],
    },
    {
        icon: Download,
        title: 'Exporting',
        description: 'Export your subtitles in any industry-standard format.',
        topics: [
            'SRT — Universal compatibility',
            'VTT — Web video and HTML5',
            'ASS/SSA — Styled subtitles for anime and video editing',
            'TTML — Broadcast and streaming compliance',
            'Plain text — Transcripts for blogs and articles',
        ],
    },
    {
        icon: Settings,
        title: 'Account & Billing',
        description: 'Manage your account, subscription, and team.',
        topics: [
            'Upgrading and downgrading plans',
            'Viewing usage and remaining minutes',
            'Adding and managing team members (Studio plan)',
            'Exporting and deleting your data',
        ],
    },
];

export default function DocsPage() {
    return (
        <StaticPageLayout
            title="Documentation"
            subtitle="Everything you need to get the most out of SubtitleAI Pro."
        >
            {/* Quick Start */}
            <section className="mb-12">
                <div className="p-8 rounded-2xl bg-[var(--color-gray-900)] text-white">
                    <h2 className="text-xl font-serif mb-3">Quick Start</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-white/70">
                        <div className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-[var(--color-primary)] font-serif text-sm font-semibold shrink-0">1</span>
                            <p>Sign in with your Google account — no registration form needed.</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-[var(--color-primary)] font-serif text-sm font-semibold shrink-0">2</span>
                            <p>Drop your video file or paste a YouTube URL into the dashboard.</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-[var(--color-primary)] font-serif text-sm font-semibold shrink-0">3</span>
                            <p>Review the transcript, select target languages, and export.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Guide Sections */}
            <section className="space-y-6">
                {GUIDE_SECTIONS.map((section, i) => (
                    <details key={i} className="group rounded-2xl border border-[var(--color-gray-200)] bg-white overflow-hidden open:shadow-sm">
                        <summary className="flex items-center gap-4 p-6 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-subtle)] flex items-center justify-center shrink-0">
                                <section.icon className="w-5 h-5 text-[var(--color-primary)]" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-medium text-[var(--color-gray-900)]">{section.title}</h3>
                                <p className="text-sm text-[var(--color-gray-500)]">{section.description}</p>
                            </div>
                            <div className="w-5 h-5 text-[var(--color-gray-400)] transition-transform group-open:rotate-90">
                                <ArrowRight className="w-5 h-5" />
                            </div>
                        </summary>
                        <div className="px-6 pb-6 pt-2 border-t border-[var(--color-gray-100)]">
                            <ul className="space-y-3 mt-4">
                                {section.topics.map((topic, ti) => (
                                    <li key={ti} className="flex items-start gap-3 text-sm text-[var(--color-gray-600)]">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] mt-2 shrink-0" />
                                        <span>{topic}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </details>
                ))}
            </section>

            {/* Help CTA */}
            <section className="mt-12 text-center p-8 rounded-2xl bg-[var(--color-surface-secondary)] border border-[var(--color-gray-200)]">
                <h3 className="text-lg font-serif text-[var(--color-gray-900)] mb-2">Need help?</h3>
                <p className="text-sm text-[var(--color-gray-500)] mb-6">Can't find what you're looking for? Our support team typically responds within 2 hours.</p>
                <a href="mailto:support@subtitleai.pro" className="claude-button-primary px-6 py-3 rounded-xl text-sm inline-flex items-center gap-2">
                    Contact Support
                </a>
            </section>
        </StaticPageLayout>
    );
}
