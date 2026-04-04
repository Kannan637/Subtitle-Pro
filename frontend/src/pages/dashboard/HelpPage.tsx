import { HelpCircle, MessageSquare, BookOpen, Mail, ExternalLink } from 'lucide-react';

export default function HelpPage() {
    const faqs = [
        { q: 'What file formats are supported?', a: 'We support MP4, MOV, MKV, AVI, WebM, MP3, WAV, FLAC, and more.' },
        { q: 'How accurate is the transcription?', a: 'Our Whisper Large V3 model achieves 98.5% accuracy on most content. It handles accents, background noise, and multiple speakers.' },
        { q: 'How many languages are supported?', a: 'We support 100+ languages for transcription and translation. The exact number depends on your plan tier.' },
        { q: 'What export formats are available?', a: 'SRT, VTT, ASS, JSON, and plain text. Studio plans also support burned-in subtitle video exports.' },
        { q: 'How are credits calculated?', a: 'Credits are consumed per minute of media processed. A 10-minute video uses 10 minutes of credit for transcription.' },
        { q: 'Can I collaborate with my team?', a: 'Yes! Team collaboration is available on Studio and Enterprise plans. Invite members and manage permissions.' },
    ];

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-serif text-[var(--color-gray-900)] mb-2">Help & Support</h1>
                <p className="text-[var(--color-gray-500)]">Find answers, get help, and contact our team.</p>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {[
                    { icon: BookOpen, label: 'Documentation', desc: 'Guides and tutorials', href: '/docs' },
                    { icon: MessageSquare, label: 'Community', desc: 'Join the discussion', href: '#' },
                    { icon: Mail, label: 'Contact Support', desc: 'Email our team', href: 'mailto:support@subtitleai.pro' },
                ].map((link) => (
                    <a key={link.label} href={link.href} className="bg-white border border-[var(--color-gray-200)] rounded-2xl p-5 shadow-sm hover:border-[var(--color-primary-light)] hover:shadow-md transition-all group">
                        <link.icon className="w-6 h-6 text-[var(--color-primary)] mb-3" />
                        <h3 className="text-sm font-medium text-[var(--color-gray-900)] mb-1 flex items-center gap-1 group-hover:text-[var(--color-primary)]">
                            {link.label}
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </h3>
                        <p className="text-xs text-[var(--color-gray-500)]">{link.desc}</p>
                    </a>
                ))}
            </div>

            {/* FAQ */}
            <div className="bg-white border border-[var(--color-gray-200)] rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-[var(--color-gray-200)]">
                    <h3 className="text-sm font-semibold text-[var(--color-gray-900)] flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-[var(--color-primary)]" />
                        Frequently Asked Questions
                    </h3>
                </div>
                <div className="divide-y divide-[var(--color-gray-100)]">
                    {faqs.map((item) => (
                        <details key={item.q} className="group">
                            <summary className="px-5 py-4 cursor-pointer text-sm font-medium text-[var(--color-gray-900)] hover:bg-[var(--color-surface-secondary)] transition-colors list-none flex items-center justify-between">
                                {item.q}
                                <span className="text-[var(--color-gray-400)] group-open:rotate-180 transition-transform text-lg">▾</span>
                            </summary>
                            <div className="px-5 pb-4 text-sm text-[var(--color-gray-600)] leading-relaxed">{item.a}</div>
                        </details>
                    ))}
                </div>
            </div>
        </div>
    );
}
