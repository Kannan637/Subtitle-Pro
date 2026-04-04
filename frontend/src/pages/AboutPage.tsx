import StaticPageLayout from '@/components/shared/StaticPageLayout';
import { Link } from 'react-router-dom';
import { ArrowRight, Globe, Zap, Shield, Sparkles } from 'lucide-react';

export default function AboutPage() {
    return (
        <StaticPageLayout
            title="About SubtitleAI Pro"
            subtitle="We're building the fastest, most accurate subtitling platform on the planet."
        >
            {/* Mission */}
            <section className="mb-16">
                <h2 className="text-2xl font-serif text-[var(--color-gray-900)] mb-6">Our Mission</h2>
                <div className="bg-[var(--color-primary-subtle)] border border-[var(--color-primary)]/10 rounded-2xl p-8 mb-8">
                    <p className="text-xl font-serif text-[var(--color-gray-800)] leading-relaxed italic">
                        "Every piece of video content deserves to be understood by anyone, anywhere, in any language — without the cost and complexity that traditionally made this impossible."
                    </p>
                </div>
                <p className="text-[var(--color-gray-600)] leading-relaxed mb-4">
                    SubtitleAI Pro was born from a simple frustration: professional subtitling tools were either absurdly expensive, painfully slow, or required weeks of training to use competently. We believed that modern AI could eliminate all three of those barriers.
                </p>
                <p className="text-[var(--color-gray-600)] leading-relaxed">
                    Today, our platform combines state-of-the-art speech recognition (Whisper large-v3), neural machine translation (DeepL + GPT-4o), and speaker diarization (pyannote.audio) inside an interface so refined that it requires zero training. Upload, review, export. That's it.
                </p>
            </section>

            {/* What we believe */}
            <section className="mb-16">
                <h2 className="text-2xl font-serif text-[var(--color-gray-900)] mb-8">What We Believe</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                        { icon: Zap, title: 'Speed is respect', text: 'Your time is the most valuable thing you have. We built every feature to minimize the time between "I have a video" and "I have subtitles."' },
                        { icon: Shield, title: 'Accuracy is non-negotiable', text: 'A misspelled name, a confused speaker, or a hallucinated phrase can destroy credibility. We obsess over correctness.' },
                        { icon: Globe, title: 'Language is a right, not a feature', text: 'Every person deserves access to content in their language. We support 100+ languages because accessibility should not be optional.' },
                        { icon: Sparkles, title: 'Simplicity is sophistication', text: 'Complex tools create bottlenecks. We deliberately constrain our interface to only what matters, and we execute those things flawlessly.' },
                    ].map((item, i) => (
                        <div key={i} className="p-6 rounded-2xl border border-[var(--color-gray-200)] bg-white">
                            <item.icon className="w-5 h-5 text-[var(--color-primary)] mb-4" />
                            <h3 className="font-medium text-[var(--color-gray-900)] mb-2">{item.title}</h3>
                            <p className="text-sm text-[var(--color-gray-600)] leading-relaxed">{item.text}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Technology */}
            <section className="mb-16">
                <h2 className="text-2xl font-serif text-[var(--color-gray-900)] mb-6">Our Technology Stack</h2>
                <p className="text-[var(--color-gray-600)] leading-relaxed mb-6">
                    We don't build AI models from scratch — we carefully select, combine, and optimize the best models in the world for the subtitling domain.
                </p>
                <div className="space-y-4">
                    {[
                        { label: 'Speech-to-Text', value: 'OpenAI Whisper large-v3 with Deepgram Nova-2 fallback', icon: '🎤' },
                        { label: 'Translation', value: 'DeepL for European languages, GPT-4o for rare and cinematic content', icon: '🌍' },
                        { label: 'Speaker Detection', value: 'pyannote.audio 3.1 — up to 32 speakers', icon: '👥' },
                        { label: 'Cue Optimization', value: 'Custom segmenter: 7s max, 42 chars/line, pause-aligned', icon: '⏱️' },
                        { label: 'Hallucination Filter', value: 'Proprietary detection for repeated phrases and phantom dialogue', icon: '🛡️' },
                    ].map((item, i) => (
                        <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-gray-200)]">
                            <span className="text-2xl">{item.icon}</span>
                            <div>
                                <span className="text-sm font-medium text-[var(--color-gray-900)]">{item.label}</span>
                                <p className="text-sm text-[var(--color-gray-600)]">{item.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="text-center py-12 px-8 rounded-2xl bg-[var(--color-gray-900)]">
                <h2 className="text-2xl font-serif text-white mb-4">Ready to try it yourself?</h2>
                <p className="text-white/60 mb-8">60 free minutes. No credit card. No setup.</p>
                <Link to="/login" className="claude-button-primary px-8 py-3.5 rounded-xl text-base inline-flex items-center gap-2 group">
                    Get started free
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
            </section>
        </StaticPageLayout>
    );
}
