import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, Zap, Globe, Shield, Sparkles, Clock, Languages } from 'lucide-react';

/* ━━━ Feature Carousel Data ━━━ */
const FEATURES = [
    {
        icon: Zap,
        title: 'Lightning-Fast Transcription',
        description: 'Process hours of video in minutes. Our AI pipeline is built for speed, so your creative flow never stops.',
        stat: '60×',
        statLabel: 'Faster than manual',
    },
    {
        icon: Globe,
        title: 'Translate to 100+ Languages',
        description: 'Break language barriers instantly. Professional-grade translations powered by DeepL and GPT-4o preserve tone and nuance.',
        stat: '100+',
        statLabel: 'Languages supported',
    },
    {
        icon: Shield,
        title: 'Broadcast-Grade Accuracy',
        description: 'Powered by Whisper large-v3 with speaker diarization. Handles accents, domain vocabulary, and background noise effortlessly.',
        stat: '98%',
        statLabel: 'Transcription accuracy',
    },
    {
        icon: Clock,
        title: 'Smart Cue Segmentation',
        description: 'Every subtitle is optimized for readability — max 7 seconds, 42 characters per line, aligned to natural speech pauses.',
        stat: '< 3 min',
        statLabel: 'Avg. turnaround for 1hr video',
    },
    {
        icon: Languages,
        title: 'No Hallucinations',
        description: 'Our proprietary filter catches and removes AI hallucinations — repeated phrases, phantom dialogue, and fabricated content.',
        stat: '0',
        statLabel: 'Hallucinated phrases',
    },
    {
        icon: Sparkles,
        title: 'Universal Export',
        description: 'SRT, VTT, ASS/SSA, TTML, and plain text. Every format your platform, broadcaster, or client requires — in one click.',
        stat: '6+',
        statLabel: 'Export formats',
    },
];

export default function LoginPage() {
    const { signInWithGoogle, user } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeFeature, setActiveFeature] = useState(0);

    // Redirect if already logged in
    useEffect(() => {
        if (user) navigate('/', { replace: true });
    }, [user, navigate]);

    // Auto-carousel every 4 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveFeature((prev) => (prev + 1) % FEATURES.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    const handleGoogleSignIn = async () => {
        try {
            setError('');
            setIsLoading(true);
            const { isNew } = await signInWithGoogle();
            if (isNew) {
                navigate('/onboarding');
            } else {
                navigate('/');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to sign in with Google');
        } finally {
            setIsLoading(false);
        }
    };

    const currentFeature = FEATURES[activeFeature];

    return (
        <div className="min-h-screen flex bg-[var(--color-surface)] font-sans">

            {/* ─────── LEFT: Feature Carousel ─────── */}
            <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] bg-[var(--color-gray-900)] relative overflow-hidden flex-col justify-between p-12 xl:p-16">

                {/* Subtle background pattern */}
                <div className="absolute inset-0 opacity-[0.03]" style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
                    backgroundSize: '32px 32px',
                }} />

                {/* Top: Brand */}
                <div className="relative z-10">
                    <Link to="/" className="flex items-center gap-3 group">
                        <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)] text-white flex items-center justify-center font-serif italic text-lg shadow-lg">
                            S
                        </div>
                        <span className="font-serif font-medium text-xl text-white/90 tracking-tight">SubtitleAI Pro</span>
                    </Link>
                </div>

                {/* Middle: Feature Content (animated) */}
                <div className="relative z-10 flex-1 flex flex-col justify-center max-w-lg">
                    <div key={activeFeature} className="animate-slide-up">
                        {/* Stat */}
                        <div className="flex items-end gap-2 mb-6">
                            <span className="text-6xl xl:text-7xl font-serif text-[var(--color-primary)] leading-none">
                                {currentFeature.stat}
                            </span>
                            <span className="text-base text-white/50 mb-2">{currentFeature.statLabel}</span>
                        </div>

                        {/* Icon + Title */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                <currentFeature.icon className="w-5 h-5 text-[var(--color-primary)]" />
                            </div>
                            <h2 className="text-2xl xl:text-3xl font-serif text-white">{currentFeature.title}</h2>
                        </div>

                        {/* Description */}
                        <p className="text-lg text-white/60 leading-relaxed max-w-md">
                            {currentFeature.description}
                        </p>
                    </div>
                </div>

                {/* Bottom: Carousel Dots */}
                <div className="relative z-10 flex items-center gap-2">
                    {FEATURES.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setActiveFeature(i)}
                            className={`h-1.5 rounded-full transition-all duration-500 ${i === activeFeature
                                ? 'w-8 bg-[var(--color-primary)]'
                                : 'w-1.5 bg-white/20 hover:bg-white/40'
                                }`}
                            aria-label={`Feature ${i + 1}`}
                        />
                    ))}
                </div>
            </div>

            {/* ─────── RIGHT: Google Sign-In ─────── */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
                <div className="w-full max-w-md">

                    {/* Mobile Brand (visible on small screens) */}
                    <div className="lg:hidden text-center mb-10">
                        <Link to="/" className="inline-flex items-center gap-3 group">
                            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)] text-white flex items-center justify-center font-serif italic text-2xl shadow-sm">
                                S
                            </div>
                        </Link>
                    </div>

                    {/* Heading */}
                    <div className="text-center lg:text-left mb-10">
                        <h1 className="text-3xl xl:text-4xl font-serif text-[var(--color-gray-900)] tracking-tight mb-3">
                            Welcome to SubtitleAI Pro
                        </h1>
                        <p className="text-[var(--color-gray-600)] text-lg">
                            Sign in to start creating professional subtitles in 100+ languages.
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 bg-[var(--color-danger-light)] border border-[var(--color-danger)]/20 p-4 rounded-xl flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-[var(--color-danger)] shrink-0 mt-0.5" />
                            <p className="text-sm text-[var(--color-danger)]">{error}</p>
                        </div>
                    )}

                    {/* Google Sign-In Button */}
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-base font-medium bg-white border border-[var(--color-gray-200)] text-[var(--color-gray-800)] hover:bg-[var(--color-gray-50)] hover:border-[var(--color-gray-300)] hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                    >
                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                                fill="#EA4335"
                            />
                        </svg>
                        {isLoading ? 'Signing in...' : 'Continue with Google'}
                    </button>

                    {/* Terms */}
                    <p className="mt-8 text-center text-xs text-[var(--color-gray-500)] leading-relaxed">
                        By continuing, you agree to SubtitleAI Pro's{' '}
                        <Link to="/terms" className="underline underline-offset-2 hover:text-[var(--color-gray-700)]">Terms of Service</Link>{' '}
                        and{' '}
                        <Link to="/privacy" className="underline underline-offset-2 hover:text-[var(--color-gray-700)]">Privacy Policy</Link>.
                    </p>

                    {/* Free Minutes Badge */}
                    <div className="mt-10 flex items-center justify-center gap-3 py-4 px-5 rounded-xl bg-[var(--color-primary-subtle)] border border-[var(--color-primary)]/10">
                        <Sparkles className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
                        <p className="text-sm text-[var(--color-gray-700)]">
                            <strong className="text-[var(--color-gray-900)]">60 free minutes</strong> included with every new account. No credit card required.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
