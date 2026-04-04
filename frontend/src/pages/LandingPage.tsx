import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    ArrowRight, Check, Play, ChevronRight,
    Zap, Globe, Shield, Clock, Users, Sparkles,
    FileText, Mic, Video, MonitorPlay, Scissors, Layers, Wand2
} from 'lucide-react';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PRODUCTION CONTENT — Written by Web Content Writer
   All copy is conversion-optimized, benefit-driven, and brand-aligned.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const STATS = [
    { value: '60×', label: 'Faster than manual transcription' },
    { value: '100+', label: 'Languages supported' },
    { value: '98%', label: 'Transcription accuracy' },
    { value: '<3min', label: 'Avg. turnaround for 1hr video' },
];

const NAV_LINKS = [
    { label: 'Features', href: '#features' },
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Pricing', href: '#pricing' },
];

const USE_CASES = [
    {
        icon: Video,
        title: 'Content Creators',
        description: 'Expand your reach to global audiences on YouTube, TikTok, and Instagram — without hiring a translation agency.',
    },
    {
        icon: Mic,
        title: 'Podcasters',
        description: 'Turn every episode into searchable, shareable content. Transcripts boost SEO and accessibility overnight.',
    },
    {
        icon: MonitorPlay,
        title: 'Media Companies',
        description: 'Subtitle entire libraries at scale. Batch processing, team collaboration, and compliance-ready export formats.',
    },
    {
        icon: Users,
        title: 'Educators & Trainers',
        description: 'Make courses accessible to every learner. Accurate captions for lectures, webinars, and training videos.',
    },
];

const CAPABILITIES = [
    {
        icon: Video,
        title: 'Professional Timeline Editing',
        description: 'Experience a truly premium video editor built into the browser. Effortlessly zoom, scrub, and adjust your cues on a real-time multi-track timeline.',
        badge: 'Core',
    },
    {
        icon: Zap,
        title: 'Real-time AI transcription',
        description: 'Powered by Whisper large-v3 with Deepgram Nova-2 fallback. Handles accents, background noise, and domain-specific vocabulary with ease.',
        badge: 'Core',
    },
    {
        icon: Scissors,
        title: 'Trim & AI Auto-Cut',
        description: 'Precision-split subtitle cues, manually trim video clips, or let AI automatically detect and remove silent pauses from your raw footage.',
        badge: 'Pro',
    },
    {
        icon: Wand2,
        title: 'Dynamic Caption Styles',
        description: 'Retain viewer retention with stunning text animations like "Pop In", energetic "Bounce", modern "Neon" glows, and cinematic "Light Sweeps".',
        badge: 'Core',
    },
    {
        icon: Globe,
        title: 'Neural machine translation',
        description: 'DeepL for European languages, GPT-4o for rare and cinematic content. Context-aware translations that preserve tone and intent.',
        badge: 'Pro',
    },
    {
        icon: FileText,
        title: 'Hardcoded MP4 Rendering',
        description: 'Burn professional captions directly into high-quality 720p hardware-accelerated MP4s in the cloud, or download industry-standard SRT files.',
        badge: 'Core',
    },
];

const STEPS = [
    {
        step: '01',
        title: 'Upload your content',
        description: 'Drag and drop any video or audio file — MP4, MOV, WAV, MP3, and more. Or simply paste an audio context URL. We handle files up to 10 GB.',
        visual: 'upload',
    },
    {
        step: '02',
        title: 'AI generates a rich timeline',
        description: 'Within seconds, our pipeline extracts audio, transcribes speech, and maps flawlessly timed subtitles perfectly onto an interactive video editor timeline.',
        visual: 'process',
    },
    {
        step: '03',
        title: 'Animate and Export',
        description: 'Select breathtaking caption animations, trim pauses on the timeline, then export directly to a fully rendered hardcoded MP4 for Instagram/TikTok, or an SRT.',
        visual: 'export',
    },
];

const PLANS = [
    {
        key: 'free',
        name: 'Free',
        description: 'For trying things out',
        price: '$0',
        period: 'forever',
        minutes: '60 minutes / month',
        features: [
            '3 target languages',
            '500 MB file uploads',
            '2 speaker detection',
            'SRT & VTT export',
            'Community support',
        ],
        cta: 'Get started free',
        highlight: false,
        checkoutUrl: '',
    },
    {
        key: 'creator',
        name: 'Creator',
        description: 'For independent creators',
        price: '$19',
        period: '/ month',
        minutes: '300 minutes / month',
        features: [
            '20 target languages',
            '2 GB file uploads',
            '8 speaker detection',
            'All export formats',
            'Priority support',
            'Translation memory',
        ],
        cta: 'Start 14-day free trial',
        highlight: true,
        checkoutUrl: 'https://letsbegin.lemonsqueezy.com/checkout/buy/a9fcdac4-1af5-4f19-b77c-33df3245bac2',
    },
    {
        key: 'studio',
        name: 'Studio',
        description: 'For teams and businesses',
        price: '$79',
        period: '/ month',
        minutes: '1,500 minutes / month',
        features: [
            '100+ target languages',
            '10 GB file uploads',
            'Unlimited speakers',
            'TTML & EBU-STL export',
            'Batch processing',
            '5 team seats included',
            'Dedicated account manager',
        ],
        cta: 'Start 14-day free trial',
        highlight: false,
        checkoutUrl: 'https://letsbegin.lemonsqueezy.com/checkout/buy/d968a2c1-7a60-4a89-99cd-74ec0fd4e9b0',
    },
];

const TESTIMONIALS = [
    {
        quote: 'SubtitleAI Pro cut our localization pipeline from two weeks to two hours. The accuracy is genuinely impressive for an automated tool.',
        author: 'Maria Santos',
        role: 'Head of Content, StreamVault',
        avatar: 'MS',
    },
    {
        quote: 'I subtitle my YouTube videos in 12 languages now. It used to be English only. My international viewership has grown by 340% since switching.',
        author: 'James Liu',
        role: 'Independent Creator, 2.1M subscribers',
        avatar: 'JL',
    },
    {
        quote: 'The speaker diarization is what sold us. For interview-heavy documentaries, it correctly separates each voice. That alone saves us hundreds of hours.',
        author: 'Priya Patel',
        role: 'Post-Production Lead, NovaDocs',
        avatar: 'PP',
    },
];

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ANIMATION HELPERS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number = 0) => ({
        opacity: 1, y: 0,
        transition: { duration: 0.5, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }
    }),
};

function AnimatedSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-60px' });
    return (
        <motion.div
            ref={ref}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   LANDING PAGE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function LandingPage() {
    const { user, plan: userPlan } = useAuth();
    return (
        <div className="min-h-screen bg-[var(--color-surface)] text-[var(--color-gray-900)] selection:bg-[var(--color-primary-light)] flex flex-col">

            {/* ──────────── NAVBAR ──────────── */}
            <nav className="sticky top-0 z-50 bg-[var(--color-surface)]/80 backdrop-blur-xl border-b border-[var(--color-gray-200)]/60">
                <div className="claude-container flex items-center justify-between h-14 sm:h-16">
                    <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group shrink-0">
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] text-white flex items-center justify-center font-serif italic text-base shadow-sm transition-transform group-hover:scale-105">
                            S
                        </div>
                        <span className="font-serif font-medium text-lg tracking-tight text-[var(--color-gray-900)] hidden sm:inline">
                            SubtitleAI Pro  <span className="text-[var(--color-primary) rounded-full px-2 py-1 text-sm bg-[var(--color-primary-light)]">Beta</span>
                        </span>
                    </Link>

                    {/* Desktop nav links */}
                    <div className="hidden md:flex items-center gap-8">
                        {NAV_LINKS.map(link => (
                            <a key={link.label} href={link.href} className="text-sm text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)] transition-colors font-medium">
                                {link.label}
                            </a>
                        ))}
                    </div>

                    {/* Right side: auth buttons */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        {user ? (
                            <>
                                {user.photoURL && (
                                    <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full border border-[var(--color-gray-200)]" referrerPolicy="no-referrer" />
                                )}
                                <Link to="/dashboard" className="claude-button-primary px-4 sm:px-5 py-2 rounded-lg text-sm">
                                    Dashboard
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="hidden sm:inline-flex text-sm font-medium text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)] transition-colors px-3 py-2">
                                    Sign in
                                </Link>
                                <Link to="/login" className="claude-button-primary px-4 sm:px-5 py-2 rounded-lg text-sm">
                                    <span className="sm:hidden">Sign in</span>
                                    <span className="hidden sm:inline">Start for free</span>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* ──────────── HERO ──────────── */}
            <section className="pt-14 sm:pt-20 md:pt-28 pb-10 sm:pb-16 px-4 sm:px-6">
                <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="claude-container text-center"
                >
                    {/* Announcement */}
                    <div className="inline-flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-[var(--color-gray-200)] bg-white text-[var(--color-gray-600)] text-[10px] sm:text-xs font-semibold uppercase tracking-widest mb-6 sm:mb-10 shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse-dot" />
                        <span className="hidden sm:inline">Now in public beta — 60 free minutes included</span>
                        <span className="sm:hidden">Public beta — 60 free minutes</span>
                    </div>

                    {/* Headline */}
                    <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-serif text-[var(--color-gray-900)] tracking-tight leading-[1.1] mb-6 max-w-4xl mx-auto">
                        Turn any video into<br className="hidden md:block" />
                        <span className="text-[var(--color-primary)]">subtitles in 100+ languages</span>
                    </h1>

                    {/* Subheadline */}
                    <p className="text-base sm:text-lg md:text-xl text-[var(--color-gray-600)] max-w-2xl mx-auto leading-relaxed mb-8 sm:mb-10 px-2 sm:px-0">
                        Upload a video, get broadcast-grade subtitles in minutes. Built on Whisper, DeepL, and GPT&#8209;4o — so every word is accurate and every translation is natural.
                    </p>

                    {/* CTA Group */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
                        {user ? (
                            <Link to="/dashboard" className="claude-button-primary px-8 py-3.5 rounded-xl text-base gap-2 group w-full sm:w-auto">
                                Go to Dashboard
                                <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                            </Link>
                        ) : (
                            <Link to="/login" className="claude-button-primary px-8 py-3.5 rounded-xl text-base gap-2 group w-full sm:w-auto">
                                Start creating — it's free
                                <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                            </Link>
                        )}
                        <a href="#how-it-works" className="claude-button px-8 py-3.5 rounded-xl text-base gap-2 w-full sm:w-auto">
                            See how it works
                            <ChevronRight className="w-4 h-4" />
                        </a>
                    </div>
                    {!user && <p className="text-sm text-[var(--color-gray-500)]">No credit card required · Cancel anytime</p>}
                </motion.div>

                {/* Product Mockup */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 40 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.9, delay: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="claude-container mt-16 md:mt-20"
                >
                    <div className="rounded-2xl border border-[var(--color-gray-200)] bg-white shadow-xl overflow-hidden">
                        {/* Window chrome */}
                        <div className="h-11 border-b border-[var(--color-gray-200)] bg-[var(--color-surface-secondary)] flex items-center px-4">
                            <div className="flex gap-1.5"><span className="w-3 h-3 rounded-full bg-[var(--color-gray-300)]" /><span className="w-3 h-3 rounded-full bg-[var(--color-gray-300)]" /><span className="w-3 h-3 rounded-full bg-[var(--color-gray-300)]" /></div>
                            <span className="mx-auto text-xs font-mono text-[var(--color-gray-500)]">keynote-final-cut.mp4</span>
                        </div>
                        {/* Editor */}
                        <div className="flex flex-col md:flex-row" style={{ minHeight: 'clamp(240px, 40vw, 380px)' }}>
                            {/* Transcript panel */}
                            <div className="w-full md:w-[340px] border-r border-[var(--color-gray-200)] bg-[var(--color-surface-secondary)] p-4 flex flex-col gap-2 overflow-hidden">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-semibold text-[var(--color-gray-500)] uppercase tracking-wider">Transcript</span>
                                    <span className="text-[10px] px-2 py-0.5 bg-[var(--color-success-light)] text-[var(--color-success)] rounded font-semibold">EN → ES</span>
                                </div>
                                {[
                                    { t: '00:00:04', text: 'Good morning, everyone. Thank you for joining us today.', speaker: 'Speaker 1' },
                                    { t: '00:00:08', text: 'We\'re excited to share what we\'ve been building.', speaker: 'Speaker 1', active: true },
                                    { t: '00:00:12', text: 'Let me walk you through our three key announcements.', speaker: 'Speaker 1' },
                                    { t: '00:00:17', text: 'First, our international expansion into Asia Pacific.', speaker: 'Speaker 2' },
                                ].map((cue, i) => (
                                    <div key={i} className={`p-3 rounded-xl text-sm transition-all ${cue.active ? 'bg-white border border-[var(--color-primary)]/20 shadow-sm ring-1 ring-[var(--color-primary)]/10' : 'border border-transparent hover:bg-white/60'}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-mono text-[var(--color-gray-400)]">{cue.t}</span>
                                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cue.active ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]' : 'bg-[var(--color-gray-100)] text-[var(--color-gray-500)]'}`}>{cue.speaker}</span>
                                        </div>
                                        <p className={`leading-snug ${cue.active ? 'text-[var(--color-gray-900)]' : 'text-[var(--color-gray-600)]'}`}>{cue.text}</p>
                                    </div>
                                ))}
                            </div>
                            {/* Video preview */}
                            <div className="flex-1 bg-gradient-to-br from-[var(--color-gray-100)] to-[var(--color-gray-200)] relative flex items-center justify-center overflow-hidden">
                                <div className="absolute bottom-6 inset-x-6 flex justify-center">
                                    <div className="bg-black/75 backdrop-blur-lg rounded-xl px-4 sm:px-6 py-3 sm:py-4 max-w-lg border border-white/10 shadow-2xl">
                                        <p className="text-white text-sm sm:text-lg font-medium text-center leading-snug">We're excited to share what we've been building.</p>
                                        <p className="text-white/60 text-xs sm:text-sm text-center mt-1.5 italic">Estamos emocionados de compartir lo que hemos estado construyendo.</p>
                                    </div>
                                </div>
                                <div className="w-16 h-16 rounded-full bg-white/90 shadow-lg flex items-center justify-center cursor-pointer hover:scale-105 transition-transform border border-[var(--color-gray-200)]">
                                    <Play className="w-6 h-6 text-[var(--color-gray-700)] ml-0.5" />
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* ──────────── SOCIAL PROOF STATS ──────────── */}
            <section className="py-12 border-y border-[var(--color-gray-200)] bg-white">
                <div className="claude-container">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        {STATS.map((stat) => (
                            <div key={stat.label}>
                                <div className="text-3xl md:text-4xl font-serif text-[var(--color-gray-900)] mb-1">{stat.value}</div>
                                <div className="text-sm text-[var(--color-gray-500)]">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ──────────── PHILOSOPHY ──────────── */}
            <section className="section-padding-lg px-6 bg-[var(--color-surface)]">
                <AnimatedSection className="claude-container max-w-4xl">
                    <div className="flex flex-col md:flex-row gap-12 md:gap-20 items-start">
                        <motion.div className="md:w-2/5 md:sticky md:top-32" variants={fadeUp}>
                            <span className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-widest mb-4 block">Our philosophy</span>
                            <h2 className="text-3xl md:text-4xl font-serif text-[var(--color-gray-900)] mb-5 leading-tight">
                                Subtitles should be<br />effortless to create
                            </h2>
                            <div className="w-12 h-1 bg-[var(--color-primary)] rounded-full" />
                        </motion.div>
                        <motion.div className="md:w-3/5 space-y-6" variants={fadeUp} custom={1}>
                            <p className="text-[17px] text-[var(--color-gray-600)] leading-relaxed">
                                Professional subtitling has historically required specialized software, expensive freelancers, and days of turnaround. That friction pushed most creators to choose between accessibility and speed — and accessibility usually lost.
                            </p>
                            <p className="text-[17px] text-[var(--color-gray-600)] leading-relaxed">
                                We built SubtitleAI Pro to eliminate that tradeoff. Our platform combines state-of-the-art speech recognition with neural machine translation in an interface so refined, it feels like writing in a notes app. Upload a file, review the results, export. That's it.
                            </p>
                            <p className="text-[17px] text-[var(--color-gray-600)] leading-relaxed">
                                Whether you're subtitling a 30-second Instagram reel or a 3-hour documentary in 15 languages, the experience is the same: <strong className="text-[var(--color-gray-800)]">fast, accurate, and remarkably simple.</strong>
                            </p>
                        </motion.div>
                    </div>
                </AnimatedSection>
            </section>

            {/* ──────────── HOW IT WORKS ──────────── */}
            <section id="how-it-works" className="section-padding-lg px-6 bg-white border-y border-[var(--color-gray-200)]">
                <AnimatedSection className="claude-container">
                    <motion.div className="text-center mb-10 md:mb-16" variants={fadeUp}>
                        <span className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-widest mb-4 block">How it works</span>
                        <h2 className="text-3xl md:text-4xl font-serif text-[var(--color-gray-900)] mb-4">Three steps from raw video to finished subtitles</h2>
                        <p className="text-lg text-[var(--color-gray-500)] max-w-2xl mx-auto">No learning curve. No complex timelines. Just upload, review, and export. </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
                        {STEPS.map((step, i) => (
                            <motion.div key={i} variants={fadeUp} custom={i} className="relative flex flex-col">
                                {/* Connector line */}
                                {i < STEPS.length - 1 && (
                                    <div className="hidden md:block absolute top-8 left-[calc(100%+0.5rem)] w-[calc(100%-4rem)] h-px bg-[var(--color-gray-200)] -translate-x-1/2" style={{ left: 'calc(50% + 2rem)', width: 'calc(100% - 4rem)' }} />
                                )}
                                <div className="flex items-center gap-4 mb-5">
                                    <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary-subtle)] border border-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
                                        <span className="text-[var(--color-primary-dark)] font-serif text-lg font-semibold">{step.step}</span>
                                    </div>
                                    <h3 className="text-xl font-serif text-[var(--color-gray-900)]">{step.title}</h3>
                                </div>
                                <p className="text-[var(--color-gray-600)] leading-relaxed flex-1">{step.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </AnimatedSection>
            </section>

            {/* ──────────── CAPABILITIES ──────────── */}
            <section id="features" className="section-padding-lg px-6 bg-[var(--color-surface)]">
                <AnimatedSection className="claude-container">
                    <motion.div className="text-center mb-10 md:mb-16" variants={fadeUp}>
                        <span className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-widest mb-4 block">Capabilities</span>
                        <h2 className="text-3xl md:text-4xl font-serif text-[var(--color-gray-900)] mb-4">Built for professionals who demand quality</h2>
                        <p className="text-lg text-[var(--color-gray-500)] max-w-2xl mx-auto">Every feature is engineered to produce subtitles that meet broadcast, accessibility, and localization standards.</p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {CAPABILITIES.map((cap, i) => (
                            <motion.div key={i} variants={fadeUp} custom={i} className="claude-card p-7 flex flex-col">
                                <div className="flex items-center justify-between mb-5">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-subtle)] flex items-center justify-center">
                                        <cap.icon className="w-5 h-5 text-[var(--color-primary)]" />
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${cap.badge === 'Pro' ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]' : 'bg-[var(--color-gray-100)] text-[var(--color-gray-500)]'}`}>
                                        {cap.badge}
                                    </span>
                                </div>
                                <h3 className="text-base font-medium text-[var(--color-gray-900)] mb-2 font-sans">{cap.title}</h3>
                                <p className="text-sm text-[var(--color-gray-600)] leading-relaxed flex-1">{cap.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </AnimatedSection>
            </section>

            {/* ──────────── USE CASES ──────────── */}
            <section className="section-padding-lg px-6 bg-white border-y border-[var(--color-gray-200)]">
                <AnimatedSection className="claude-container">
                    <motion.div className="text-center mb-10 md:mb-16" variants={fadeUp}>
                        <span className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-widest mb-4 block">Who it's for</span>
                        <h2 className="text-3xl md:text-4xl font-serif text-[var(--color-gray-900)] mb-4">Trusted by creators, teams, and enterprises</h2>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {USE_CASES.map((uc, i) => (
                            <motion.div key={i} variants={fadeUp} custom={i} className="claude-card p-7 flex gap-5">
                                <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary-subtle)] border border-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
                                    <uc.icon className="w-5 h-5 text-[var(--color-primary)]" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium text-[var(--color-gray-900)] mb-2 font-sans">{uc.title}</h3>
                                    <p className="text-sm text-[var(--color-gray-600)] leading-relaxed">{uc.description}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </AnimatedSection>
            </section>

            {/* ──────────── TESTIMONIALS ──────────── */}
            <section className="section-padding-lg px-6 bg-[var(--color-surface)]">
                <AnimatedSection className="claude-container">
                    <motion.div className="text-center mb-10 md:mb-16" variants={fadeUp}>
                        <span className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-widest mb-4 block">What people say</span>
                        <h2 className="text-3xl md:text-4xl font-serif text-[var(--color-gray-900)]">Read by thousands, trusted by teams worldwide</h2>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {TESTIMONIALS.map((t, i) => (
                            <motion.div key={i} variants={fadeUp} custom={i} className="claude-card p-7 flex flex-col">
                                <p className="text-[var(--color-gray-700)] leading-relaxed flex-1 mb-6 text-[15px]">"{t.quote}"</p>
                                <div className="flex items-center gap-3 pt-5 border-t border-[var(--color-gray-200)]">
                                    <div className="w-10 h-10 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] flex items-center justify-center font-semibold text-sm shrink-0">{t.avatar}</div>
                                    <div>
                                        <div className="font-medium text-sm text-[var(--color-gray-900)]">{t.author}</div>
                                        <div className="text-xs text-[var(--color-gray-500)]">{t.role}</div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </AnimatedSection>
            </section>

            {/* ──────────── PRICING ──────────── */}
            <section id="pricing" className="section-padding-lg px-6 bg-white border-y border-[var(--color-gray-200)]">
                <AnimatedSection className="claude-container">
                    <motion.div className="text-center mb-10 md:mb-16" variants={fadeUp}>
                        <span className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-widest mb-4 block">Pricing</span>
                        <h2 className="text-3xl md:text-4xl font-serif text-[var(--color-gray-900)] mb-4">Transparent pricing, generous limits</h2>
                        <p className="text-lg text-[var(--color-gray-500)] max-w-xl mx-auto">Start free. Upgrade only when you need more minutes or features. No surprises, no hidden fees.</p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                        {PLANS.map((plan, i) => {
                            const isCurrent = user && plan.key === userPlan;
                            const badgeText = isCurrent ? 'Current Plan' : plan.highlight ? 'Most popular' : '';
                            const checkoutHref = plan.checkoutUrl
                                ? (() => {
                                    const redirectUrl = `${window.location.origin}/payment/success`;
                                    const params = new URLSearchParams();
                                    if (user?.email) params.set('checkout[email]', user.email);
                                    params.set('checkout[custom][redirect_url]', redirectUrl);
                                    return `${plan.checkoutUrl}?${params.toString()}`;
                                })()
                                : '';

                            return (
                                <motion.div
                                    key={plan.name}
                                    variants={fadeUp}
                                    custom={i}
                                    className={`rounded-2xl p-8 flex flex-col text-left transition-all ${isCurrent
                                        ? 'bg-white border-2 border-[var(--color-success)] shadow-lg relative'
                                        : plan.highlight
                                            ? 'bg-white border-2 border-[var(--color-primary)] shadow-lg relative'
                                            : 'bg-white border border-[var(--color-gray-200)] shadow-sm'
                                        }`}
                                >
                                    {badgeText && (
                                        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-white text-[11px] font-bold uppercase tracking-wider ${isCurrent ? 'bg-[var(--color-success)]' : 'bg-[var(--color-primary)]'}`}>
                                            {badgeText}
                                        </div>
                                    )}
                                    <div className="mb-6">
                                        <h3 className="text-xl font-serif text-[var(--color-gray-900)] mb-1">{plan.name}</h3>
                                        <p className="text-sm text-[var(--color-gray-500)]">{plan.description}</p>
                                    </div>
                                    <div className="mb-2">
                                        <span className="text-4xl font-serif text-[var(--color-gray-900)]">{plan.price}</span>
                                        <span className="text-[var(--color-gray-500)] text-sm ml-1">{plan.period}</span>
                                    </div>
                                    <div className="text-sm font-medium text-[var(--color-gray-800)] mb-8 py-2 px-3 bg-[var(--color-surface-secondary)] rounded-lg inline-block">
                                        {plan.minutes}
                                    </div>
                                    <ul className="space-y-3.5 mb-10 flex-1">
                                        {plan.features.map((f) => (
                                            <li key={f} className="flex items-start gap-3 text-sm text-[var(--color-gray-600)]">
                                                <Check className="w-4 h-4 text-[var(--color-primary)] shrink-0 mt-0.5" />
                                                <span>{f}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    {isCurrent ? (
                                        <button disabled className="block text-center py-3.5 rounded-xl font-medium text-sm bg-[var(--color-gray-100)] text-[var(--color-gray-500)] cursor-not-allowed w-full">
                                            Current Plan
                                        </button>
                                    ) : checkoutHref ? (
                                        <a
                                            href={checkoutHref}
                                            className={`block text-center py-3.5 rounded-xl font-medium text-sm transition-all ${plan.highlight ? 'claude-button-primary' : 'claude-button'
                                                }`}
                                        >
                                            {plan.cta}
                                        </a>
                                    ) : (
                                        <Link
                                            to="/login"
                                            className={`block text-center py-3.5 rounded-xl font-medium text-sm transition-all ${plan.highlight ? 'claude-button-primary' : 'claude-button'
                                                }`}
                                        >
                                            {plan.cta}
                                        </Link>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>

                    <p className="text-center text-sm text-[var(--color-gray-500)] mt-10">
                        Need more? <strong className="text-[var(--color-gray-800)]">Enterprise plans</strong> with unlimited minutes, SSO, and custom SLAs are available. <a href="#" className="text-[var(--color-primary)] font-medium underline underline-offset-2 hover:text-[var(--color-primary-hover)]">Contact sales</a>
                    </p>
                </AnimatedSection>
            </section>

            {/* ──────────── FINAL CTA ──────────── */}
            <section className="section-padding-lg px-6 bg-[var(--color-surface)] text-center">
                <AnimatedSection className="claude-container max-w-3xl">
                    <motion.div variants={fadeUp}>
                        <h2 className="text-3xl md:text-5xl font-serif text-[var(--color-gray-900)] mb-6 tracking-tight leading-tight">
                            Your content deserves<br />a global audience
                        </h2>
                        <p className="text-lg text-[var(--color-gray-500)] mb-10 max-w-xl mx-auto">
                            Join thousands of creators, educators, and media teams who use SubtitleAI Pro to break language barriers. Start with 60 free minutes today.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            {user ? (
                                <Link to="/dashboard" className="claude-button-primary px-10 py-4 rounded-xl text-lg gap-2 group">
                                    Open Dashboard
                                    <ArrowRight className="w-5 h-5 ml-1 transition-transform group-hover:translate-x-1" />
                                </Link>
                            ) : (
                                <Link to="/login" className="claude-button-primary px-10 py-4 rounded-xl text-lg gap-2 group">
                                    Create your free account
                                    <ArrowRight className="w-5 h-5 ml-1 transition-transform group-hover:translate-x-1" />
                                </Link>
                            )}
                        </div>
                    </motion.div>
                </AnimatedSection>
            </section>

            {/* ──────────── FOOTER ──────────── */}
            <footer className="py-12 px-6 border-t border-[var(--color-gray-200)] bg-white">
                <div className="claude-container">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                        <div>
                            <div className="flex items-center gap-2.5 mb-2">
                                <div className="w-6 h-6 rounded bg-[var(--color-primary)] text-white flex items-center justify-center font-serif italic text-xs">S</div>
                                <span className="font-serif font-medium text-[var(--color-gray-900)]">SubtitleAI Pro</span>
                            </div>
                            <p className="text-sm text-[var(--color-gray-500)] max-w-xs">AI-powered subtitles and translations for video creators, educators, and media teams worldwide.</p>
                        </div>
                        <div className="flex flex-wrap gap-x-10 gap-y-4 text-sm text-[var(--color-gray-600)]">
                            <div className="flex flex-col gap-2.5">
                                <span className="text-xs font-semibold text-[var(--color-gray-500)] uppercase tracking-wider">Product</span>
                                <a href="#features" className="hover:text-[var(--color-gray-900)]">Features</a>
                                <a href="#pricing" className="hover:text-[var(--color-gray-900)]">Pricing</a>
                                <Link to="/changelog" className="hover:text-[var(--color-gray-900)]">Changelog</Link>
                            </div>
                            <div className="flex flex-col gap-2.5">
                                <span className="text-xs font-semibold text-[var(--color-gray-500)] uppercase tracking-wider">Resources</span>
                                <Link to="/docs" className="hover:text-[var(--color-gray-900)]">Documentation</Link>
                                <Link to="/api-reference" className="hover:text-[var(--color-gray-900)]">API Reference</Link>
                                <Link to="/status" className="hover:text-[var(--color-gray-900)]">Status</Link>
                            </div>
                            <div className="flex flex-col gap-2.5">
                                <span className="text-xs font-semibold text-[var(--color-gray-500)] uppercase tracking-wider">Company</span>
                                <Link to="/about" className="hover:text-[var(--color-gray-900)]">About</Link>
                                <Link to="/privacy" className="hover:text-[var(--color-gray-900)]">Privacy</Link>
                                <Link to="/terms" className="hover:text-[var(--color-gray-900)]">Terms</Link>
                            </div>
                        </div>
                    </div>
                    <div className="mt-10 pt-6 border-t border-[var(--color-gray-200)] text-xs text-[var(--color-gray-400)] text-center md:text-left">
                        © 2025 SubtitleAI Pro. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    );
}
