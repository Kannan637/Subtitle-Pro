import { Link } from 'react-router-dom';
import {
    ArrowRight,
    Captions,
    Check,
    ChevronRight,
    Film,
    Layers3,
    Music2,
    Play,
    Ratio,
    Scissors,
    ShieldCheck,
    Sparkles,
    UploadCloud,
    WandSparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import BrandLogo from '@/components/shared/BrandLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const navItems = [
    ['Tools', '#tools'],
    ['Workflow', '#workflow'],
    ['Studio', '#studio'],
    ['Shorts', '#shorts'],
    ['Reliability', '#reliability'],
];

const images = {
    hero: 'https://images.unsplash.com/photo-1492724441997-5dc865305da7?auto=format&fit=crop&w=1800&q=88',
    studio: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&w=1400&q=88',
    workflow: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=88',
    shorts: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?auto=format&fit=crop&w=1400&q=88',
    audio: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1400&q=88',
};

const tools = [
    {
        icon: Captions,
        title: 'AI Video Subtitle',
        body: 'Transcribe media, correct subtitle timing, translate, and export SRT, VTT, TXT, or JSON.',
        href: '/dashboard/transcribe',
        meta: 'Subtitle files',
    },
    {
        icon: WandSparkles,
        title: 'AI Video Caption',
        body: 'Design social captions with templates, type controls, effects, b-roll, music, SFX, and MP4 export.',
        href: '/dashboard/translate',
        meta: 'Caption studio',
    },
    {
        icon: Scissors,
        title: 'Long to Viral',
        body: 'Analyze long videos, find hook-led clips, reframe, caption, preview, and download each short.',
        href: '/dashboard/long-to-shorts',
        meta: 'Shorts engine',
    },
];

const workflow = [
    ['01', 'Import', 'Upload a file or bring in long-form source video for AI subtitle, caption, or shorts workflows.'],
    ['02', 'Align', 'Generate transcript cues and caption groups that follow speech timing instead of fixed visual spacing.'],
    ['03', 'Design', 'Adjust typography, templates, layers, b-roll, music, SFX, raw clip timing, and aspect ratio.'],
    ['04', 'Export', 'Carry preview state into render jobs so caption size, position, media layers, and audio trims match.'],
];

const studioRows = [
    { icon: Layers3, title: 'Layered timeline', body: 'Raw clip, captions, b-roll, music, SFX, and transitions stay visible, hideable, and render-aware.' },
    { icon: Ratio, title: 'Adaptive framing', body: 'Use person-centered portrait crops when the subject fits, or 16:9 blur-fit inside 9:16 when cropping would damage the shot.' },
    { icon: Music2, title: 'Mood-matched audio', body: 'Music and SFX agents choose and trim timeline audio around pace, emotion, and scene meaning.' },
    { icon: ShieldCheck, title: 'Preview parity', body: 'Style, safe area, layer visibility, b-roll timing, and audio trims are saved as export data.' },
];

const reliability = [
    '3-word caption cue rhythm',
    'Important-word emphasis',
    'B-roll max 3 seconds',
    'Hook-led short starts',
    'Phrase-complete endings',
    'Render-aware caption templates',
];

function HeroPreview() {
    return (
        <div className="apple-material relative overflow-hidden rounded-[2rem] p-3">
            <div className="relative min-h-[560px] overflow-hidden rounded-[1.55rem] bg-foreground">
                <img src={images.hero} alt="Creator video preview inside Subtitlepro" className="absolute inset-0 h-full w-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/20 to-black/10" />
                <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
                    <Badge className="bg-background text-foreground hover:bg-background">Live preview</Badge>
                    <Badge variant="outline" className="border-white/35 bg-white/10 text-white">9:16 / 16:9</Badge>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                    <div className="mx-auto max-w-md rounded-[1.35rem] border border-white/22 bg-black/36 p-4 text-center text-white backdrop-blur-xl">
                        <p className="text-3xl font-black leading-none tracking-[-0.03em]">Captions that stay aligned.</p>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-semibold text-white/78">
                            <span>Words</span>
                            <span>Layers</span>
                            <span>Export</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LandingPage() {
    const { user, loading } = useAuth();
    const isAuthed = Boolean(user);
    const ctaPath = isAuthed ? '/dashboard' : '/login';
    const ctaLabel = loading ? 'Checking session' : isAuthed ? 'Open dashboard' : 'Start creating';

    return (
        <main className="apple-page apple-no-shadow">
            <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/78 backdrop-blur-2xl">
                <div className="apple-wide flex h-16 items-center justify-between">
                    <Link to="/" className="flex items-center" aria-label="Subtitlepro home">
                        <BrandLogo variant="wordmark" sizeClassName="h-9 w-[146px]" alt="Subtitlepro" />
                    </Link>

                    <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
                        {navItems.map(([label, href]) => (
                            <Button key={href} variant="ghost" size="sm" asChild>
                                <a href={href}>{label}</a>
                            </Button>
                        ))}
                    </nav>

                    <div className="flex items-center gap-2">
                        {!isAuthed && (
                            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                                <Link to="/login">Sign in</Link>
                            </Button>
                        )}
                        <Button size="sm" asChild aria-disabled={loading}>
                            <Link to={ctaPath}>
                                {ctaLabel}
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </header>

            <section className="apple-wide grid min-h-screen items-center gap-10 pb-16 pt-28 lg:grid-cols-[0.88fr_1.12fr] lg:pt-20">
                <div>
                    <span className="apple-kicker">
                        <Sparkles className="h-4 w-4 text-primary" />
                        AI video production suite
                    </span>
                    <h1 className="apple-title mt-5 max-w-[12ch]">Captions, subtitles, and shorts in one calm studio.</h1>
                    <p className="apple-subtitle mt-6">
                        Subtitlepro turns source media into aligned subtitles, designed social captions, hook-led shorts, timeline audio, b-roll, and render-ready exports.
                    </p>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <Button size="lg" asChild>
                            <Link to={ctaPath}>
                                {ctaLabel}
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                        <Button size="lg" variant="outline" asChild>
                            <a href="#tools">
                                <Play className="h-4 w-4" />
                                See product
                            </a>
                        </Button>
                    </div>
                    <div className="mt-9 grid gap-3 sm:grid-cols-3">
                        {[
                            ['3-word cues', 'Caption rhythm'],
                            ['Blur-fit', 'Vertical safety'],
                            ['Export parity', 'Preview matches render'],
                        ].map(([value, label]) => (
                            <div key={value} className="apple-grouped p-4">
                                <p className="text-sm font-semibold">{value}</p>
                                <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <HeroPreview />
            </section>

            <section id="tools" className="border-y border-border bg-secondary/54 py-16 sm:py-24">
                <div className="apple-wide">
                    <div className="mb-10 max-w-3xl">
                        <span className="apple-kicker">Current AI tools</span>
                        <h2 className="apple-section-title mt-4">A focused workspace for each video job.</h2>
                        <p className="apple-subtitle mt-4">
                            The product is split by intent: subtitle files, styled caption videos, and short-form cuts from long content.
                        </p>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-3">
                        {tools.map((tool) => (
                            <Link key={tool.title} to={ctaPath} className="apple-link-card group block p-5">
                                <div className="mb-8 flex items-center justify-between">
                                    <span className="apple-icon-cell">
                                        <tool.icon className="h-5 w-5" />
                                    </span>
                                    <Badge variant="outline">{tool.meta}</Badge>
                                </div>
                                <h3 className="text-2xl font-semibold tracking-[-0.03em]">{tool.title}</h3>
                                <p className="mt-3 text-sm font-medium leading-6 text-muted-foreground">{tool.body}</p>
                                <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-primary">
                                    Open workflow
                                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <section id="workflow" className="py-16 sm:py-24">
                <div className="apple-wide grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
                    <div className="lg:sticky lg:top-24 lg:self-start">
                        <span className="apple-kicker">
                            <UploadCloud className="h-4 w-4 text-primary" />
                            Production flow
                        </span>
                        <h2 className="apple-section-title mt-4">From raw file to publish-ready output.</h2>
                        <p className="apple-subtitle mt-4">
                            Every step preserves context so the AI output can be corrected, designed, layered, and exported.
                        </p>
                        <div className="apple-material mt-8 overflow-hidden rounded-[1.75rem] p-2">
                            <img src={images.workflow} alt="Video production workflow" className="aspect-[4/3] w-full rounded-[1.35rem] object-cover" />
                        </div>
                    </div>

                    <div className="apple-material overflow-hidden rounded-[1.75rem]">
                        {workflow.map(([step, title, body]) => (
                            <div key={step} className="apple-list-row grid gap-4 sm:grid-cols-[72px_1fr]">
                                <p className="text-3xl font-semibold tracking-[-0.04em] text-primary">{step}</p>
                                <div>
                                    <h3 className="text-xl font-semibold tracking-[-0.02em]">{title}</h3>
                                    <p className="mt-1 text-sm font-medium leading-6 text-muted-foreground">{body}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="studio" className="border-y border-border bg-secondary/54 py-16 sm:py-24">
                <div className="apple-wide grid gap-8 lg:grid-cols-[1fr_1fr]">
                    <div>
                        <span className="apple-kicker">
                            <Film className="h-4 w-4 text-primary" />
                            Editor-grade controls
                        </span>
                        <h2 className="apple-section-title mt-4">CapCut-level control with render discipline.</h2>
                        <p className="apple-subtitle mt-4">
                            Caption style, timeline layers, reframing, and audio choices are treated as production data, not visual decoration.
                        </p>
                        <div className="apple-material mt-8 overflow-hidden rounded-[1.75rem] p-2">
                            <img src={images.studio} alt="Caption studio interface inspiration" className="aspect-[16/10] w-full rounded-[1.35rem] object-cover" />
                        </div>
                    </div>

                    <div className="grid content-start gap-4 sm:grid-cols-2">
                        {studioRows.map((row) => (
                            <Card key={row.title}>
                                <CardContent className="p-5">
                                    <span className="apple-icon-cell mb-5">
                                        <row.icon className="h-5 w-5" />
                                    </span>
                                    <h3 className="text-xl font-semibold tracking-[-0.02em]">{row.title}</h3>
                                    <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">{row.body}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            <section id="shorts" className="py-16 sm:py-24">
                <div className="apple-wide grid gap-8 lg:grid-cols-[1fr_0.9fr]">
                    <div>
                        <span className="apple-kicker">
                            <Scissors className="h-4 w-4 text-primary" />
                            Long to Viral
                        </span>
                        <h2 className="apple-section-title mt-4">Find the hook. Keep the meaning. Fit the frame.</h2>
                        <p className="apple-subtitle mt-4">
                            Shorts start at high-retention moments, end on complete phrases, and use portrait crop or 16:9 blur-fit depending on the subject.
                        </p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Button asChild>
                                <Link to={ctaPath}>
                                    Create shorts
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                            <Button variant="outline" asChild>
                                <a href="#reliability">Review standards</a>
                            </Button>
                        </div>
                    </div>
                    <div className="apple-material overflow-hidden rounded-[1.75rem] p-2">
                        <img src={images.shorts} alt="Short form video preview" className="aspect-[4/5] w-full rounded-[1.35rem] object-cover" />
                    </div>
                </div>
            </section>

            <section id="reliability" className="border-y border-border bg-secondary/54 py-16 sm:py-24">
                <div className="apple-wide grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
                    <div>
                        <span className="apple-kicker">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            Reliability standards
                        </span>
                        <h2 className="apple-section-title mt-4">The preview must survive the export.</h2>
                        <p className="apple-subtitle mt-4">
                            Subtitlepro’s promise is simple: the caption size, style, timing, b-roll, audio trims, and frame mode visible in preview are the same values sent to render.
                        </p>
                    </div>
                    <Card>
                        <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
                            {reliability.map((item) => (
                                <div key={item} className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-background/62 px-4">
                                    <Check className="h-4 w-4 shrink-0 text-primary" />
                                    <span className="text-sm font-semibold">{item}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </section>

            <section className="px-4 py-16 sm:px-6 sm:py-24">
                <div className="apple-material mx-auto max-w-6xl overflow-hidden rounded-[2rem]">
                    <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
                        <div>
                            <span className="apple-kicker">Ready for production</span>
                            <h2 className="mt-4 max-w-3xl text-4xl font-semibold leading-none tracking-[-0.045em] sm:text-5xl">
                                Start with one video. Leave with captions, shorts, and export-ready assets.
                            </h2>
                        </div>
                        <Button size="lg" asChild>
                            <Link to={ctaPath}>
                                {ctaLabel}
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>

            <footer className="border-t border-border py-8">
                <div className="apple-wide flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <Link to="/" className="flex items-center" aria-label="Subtitlepro home">
                        <BrandLogo variant="wordmark" sizeClassName="h-8 w-[130px]" alt="Subtitlepro" />
                    </Link>
                    <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-muted-foreground">
                        <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
                        <Link to="/terms" className="hover:text-foreground">Terms</Link>
                        <Link to="/status" className="hover:text-foreground">Status</Link>
                        <Link to="/docs" className="hover:text-foreground">Docs</Link>
                    </div>
                </div>
            </footer>
        </main>
    );
}
