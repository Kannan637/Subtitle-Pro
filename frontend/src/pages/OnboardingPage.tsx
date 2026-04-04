import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import confetti from 'canvas-confetti';
import {
    ArrowRight, Sparkles, Mic, Globe, FileText,
    Search, Share2, UserPlus, Tv, BookOpen, MoreHorizontal,
    User, Building2, GraduationCap, Video, Megaphone
} from 'lucide-react';
import { api } from '@/lib/api';

/* ━━━ Form Options ━━━ */
const ROLES = [
    { value: 'creator', label: 'Content Creator', icon: Video },
    { value: 'podcaster', label: 'Podcaster', icon: Mic },
    { value: 'educator', label: 'Educator', icon: GraduationCap },
    { value: 'media', label: 'Media Company', icon: Building2 },
    { value: 'marketer', label: 'Marketer', icon: Megaphone },
    { value: 'other', label: 'Other', icon: User },
];

const HEARD_FROM = [
    { value: 'search', label: 'Search Engine', icon: Search },
    { value: 'social', label: 'Social Media', icon: Share2 },
    { value: 'friend', label: 'Friend / Colleague', icon: UserPlus },
    { value: 'youtube', label: 'YouTube', icon: Tv },
    { value: 'blog', label: 'Blog / Article', icon: BookOpen },
    { value: 'other', label: 'Other', icon: MoreHorizontal },
];

const TEAM_SIZES = [
    { value: 'solo', label: 'Just me' },
    { value: 'small', label: '2–5' },
    { value: 'medium', label: '6–20' },
    { value: 'large', label: '20+' },
];

const USE_CASES = [
    { value: 'subtitles', label: 'Subtitles', icon: FileText },
    { value: 'transcription', label: 'Transcription', icon: Mic },
    { value: 'translation', label: 'Translation', icon: Globe },
    { value: 'all', label: 'All of the above', icon: Sparkles },
];

/* ━━━ Confetti Helper ━━━ */
function fireConfetti() {
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
    const duration = 2500;
    const end = Date.now() + duration;

    const interval = window.setInterval(() => {
        if (Date.now() > end) {
            clearInterval(interval);
            return;
        }
        confetti({
            ...defaults,
            particleCount: 40,
            origin: { x: Math.random(), y: Math.random() * 0.4 },
            colors: ['#D97757', '#E8956A', '#F4B8A0', '#C4653E', '#FFD700', '#E0C068'],
        });
    }, 200);
}

/* ━━━ Component ━━━ */
export default function OnboardingPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState<'welcome' | 'form'>('welcome');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [role, setRole] = useState('');
    const [heardFrom, setHeardFrom] = useState('');
    const [teamSize, setTeamSize] = useState('');
    const [useCase, setUseCase] = useState('');

    // Fire confetti on mount
    useEffect(() => {
        const timeout = setTimeout(fireConfetti, 300);
        return () => clearTimeout(timeout);
    }, []);

    const handleContinue = useCallback(() => {
        setStep('form');
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!role || !heardFrom || !teamSize || !useCase) return;

        setIsSubmitting(true);
        try {
            await api.put('/v1/users/me/onboarding', {
                role,
                heard_from: heardFrom,
                team_size: teamSize,
                use_case: useCase,
            });
        } catch (err) {
            // Non-blocking — we still navigate even if API fails
            console.error('Onboarding save failed:', err);
        }
        navigate('/dashboard');
    }, [role, heardFrom, teamSize, useCase, navigate]);

    const isFormComplete = role && heardFrom && teamSize && useCase;

    /* ──────── STEP 1: Welcome with Confetti ──────── */
    if (step === 'welcome') {
        return (
            <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center p-4 font-sans">
                <div className="text-center max-w-lg mx-auto">
                    {/* Avatar */}
                    <div className="relative inline-block mb-8">
                        {user?.photoURL ? (
                            <img
                                src={user.photoURL}
                                alt=""
                                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white shadow-xl"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-4xl font-serif shadow-xl">
                                {user?.displayName?.charAt(0) || '👋'}
                            </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-[var(--color-primary)]" />
                        </div>
                    </div>

                    {/* Greeting */}
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[var(--color-gray-900)] mb-4 tracking-tight">
                        Welcome{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}! 🎉
                    </h1>
                    <p className="text-lg sm:text-xl text-[var(--color-gray-500)] mb-10 max-w-md mx-auto leading-relaxed">
                        Your account is ready. You have <strong className="text-[var(--color-gray-800)]">60 free minutes</strong> of AI-powered subtitles waiting for you.
                    </p>

                    {/* Continue Button */}
                    <button
                        onClick={handleContinue}
                        className="claude-button-primary px-10 py-4 rounded-xl text-lg gap-2 group inline-flex items-center"
                    >
                        Let's get started
                        <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                    </button>

                    {/* Skip */}
                    <p className="mt-6 text-sm text-[var(--color-gray-400)]">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="underline underline-offset-2 hover:text-[var(--color-gray-600)] transition-colors cursor-pointer"
                        >
                            Skip for now
                        </button>
                    </p>
                </div>
            </div>
        );
    }

    /* ──────── STEP 2: Profile Form ──────── */
    return (
        <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center p-4 sm:p-6 font-sans">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="text-center mb-8 sm:mb-10">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)] text-white flex items-center justify-center font-serif italic text-lg shadow-sm mx-auto mb-5">
                        S
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-serif text-[var(--color-gray-900)] mb-2 tracking-tight">
                        Tell us about yourself
                    </h1>
                    <p className="text-[var(--color-gray-500)]">
                        This helps us personalize your experience.
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-2xl border border-[var(--color-gray-200)] shadow-sm p-5 sm:p-8 space-y-8">

                    {/* Role */}
                    <div>
                        <label className="block text-sm font-semibold text-[var(--color-gray-800)] mb-3">
                            What best describes your role?
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {ROLES.map((r) => (
                                <button
                                    key={r.value}
                                    onClick={() => setRole(r.value)}
                                    className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm font-medium border transition-all cursor-pointer ${role === r.value
                                        ? 'bg-[var(--color-primary-subtle)] border-[var(--color-primary)]/30 text-[var(--color-primary-dark)] shadow-sm'
                                        : 'bg-[var(--color-surface)] border-[var(--color-gray-200)] text-[var(--color-gray-700)] hover:bg-[var(--color-gray-50)] hover:border-[var(--color-gray-300)]'
                                        }`}
                                >
                                    <r.icon className="w-4 h-4 shrink-0" />
                                    <span className="truncate">{r.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Heard From */}
                    <div>
                        <label className="block text-sm font-semibold text-[var(--color-gray-800)] mb-3">
                            How did you hear about us?
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {HEARD_FROM.map((h) => (
                                <button
                                    key={h.value}
                                    onClick={() => setHeardFrom(h.value)}
                                    className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm font-medium border transition-all cursor-pointer ${heardFrom === h.value
                                        ? 'bg-[var(--color-primary-subtle)] border-[var(--color-primary)]/30 text-[var(--color-primary-dark)] shadow-sm'
                                        : 'bg-[var(--color-surface)] border-[var(--color-gray-200)] text-[var(--color-gray-700)] hover:bg-[var(--color-gray-50)] hover:border-[var(--color-gray-300)]'
                                        }`}
                                >
                                    <h.icon className="w-4 h-4 shrink-0" />
                                    <span className="truncate">{h.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Team Size */}
                    <div>
                        <label className="block text-sm font-semibold text-[var(--color-gray-800)] mb-3">
                            Team size
                        </label>
                        <div className="flex flex-wrap gap-2.5">
                            {TEAM_SIZES.map((t) => (
                                <button
                                    key={t.value}
                                    onClick={() => setTeamSize(t.value)}
                                    className={`px-5 py-2.5 rounded-xl text-sm font-medium border transition-all cursor-pointer ${teamSize === t.value
                                        ? 'bg-[var(--color-primary-subtle)] border-[var(--color-primary)]/30 text-[var(--color-primary-dark)] shadow-sm'
                                        : 'bg-[var(--color-surface)] border-[var(--color-gray-200)] text-[var(--color-gray-700)] hover:bg-[var(--color-gray-50)] hover:border-[var(--color-gray-300)]'
                                        }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Use Case */}
                    <div>
                        <label className="block text-sm font-semibold text-[var(--color-gray-800)] mb-3">
                            What will you primarily use SubtitleAI Pro for?
                        </label>
                        <div className="grid grid-cols-2 gap-2.5">
                            {USE_CASES.map((u) => (
                                <button
                                    key={u.value}
                                    onClick={() => setUseCase(u.value)}
                                    className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium border transition-all cursor-pointer ${useCase === u.value
                                        ? 'bg-[var(--color-primary-subtle)] border-[var(--color-primary)]/30 text-[var(--color-primary-dark)] shadow-sm'
                                        : 'bg-[var(--color-surface)] border-[var(--color-gray-200)] text-[var(--color-gray-700)] hover:bg-[var(--color-gray-50)] hover:border-[var(--color-gray-300)]'
                                        }`}
                                >
                                    <u.icon className="w-4 h-4 shrink-0" />
                                    {u.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Submit */}
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="text-sm text-[var(--color-gray-500)] hover:text-[var(--color-gray-700)] transition-colors cursor-pointer order-2 sm:order-1"
                    >
                        Skip for now
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!isFormComplete || isSubmitting}
                        className={`claude-button-primary px-8 py-3.5 rounded-xl text-base gap-2 group inline-flex items-center order-1 sm:order-2 w-full sm:w-auto justify-center ${!isFormComplete ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                    >
                        {isSubmitting ? 'Saving...' : 'Get Started'}
                        {!isSubmitting && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
