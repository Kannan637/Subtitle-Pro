import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Check, Loader2, Sparkles } from 'lucide-react';

/**
 * Post-checkout landing page.
 * Lemonsqueezy redirects here after a successful purchase.
 * This page:
 *   1. Polls the backend until the user's plan is updated (webhook may arrive with a short delay)
 *   2. Shows a success animation
 *   3. Auto-redirects to the dashboard
 */
export default function PaymentSuccessPage() {
    const { user, plan, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const [synced, setSynced] = useState(false);
    const [pollCount, setPollCount] = useState(0);
    const MAX_POLLS = 12; // 12 × 2.5s = 30s max wait

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        let cancelled = false;

        const pollPlan = async () => {
            if (cancelled) return;

            await refreshProfile();
            setPollCount((c) => c + 1);
        };

        // Start polling every 2.5 seconds
        const interval = setInterval(() => {
            if (cancelled) return;
            pollPlan();
        }, 2500);

        // Initial immediate check
        pollPlan();

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [user]);

    // Watch for plan change → mark as synced
    useEffect(() => {
        if (plan && plan !== 'free') {
            setSynced(true);
        }
        // If we've polled enough times, consider it synced anyway (webhook might be delayed)
        if (pollCount >= MAX_POLLS) {
            setSynced(true);
        }
    }, [plan, pollCount]);

    // Auto-redirect to dashboard after sync
    useEffect(() => {
        if (synced) {
            const timeout = setTimeout(() => navigate('/dashboard'), 3000);
            return () => clearTimeout(timeout);
        }
    }, [synced, navigate]);

    return (
        <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center">
                {/* Success icon */}
                <div className="relative inline-flex mb-8">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-700 ${synced
                        ? 'bg-[var(--color-success)]/10 ring-4 ring-[var(--color-success)]/20'
                        : 'bg-[var(--color-primary-light)] ring-4 ring-[var(--color-primary)]/10'
                        }`}>
                        {synced ? (
                            <Check className="w-10 h-10 text-[var(--color-success)] animate-[scale-in_0.3s_ease-out]" />
                        ) : (
                            <Loader2 className="w-10 h-10 text-[var(--color-primary)] animate-spin" />
                        )}
                    </div>
                    {synced && (
                        <Sparkles className="w-6 h-6 text-[var(--color-warning)] absolute -top-1 -right-1 animate-bounce" />
                    )}
                </div>

                {/* Title */}
                <h1 className="text-3xl font-serif text-[var(--color-gray-900)] mb-3">
                    {synced ? 'Payment Successful!' : 'Processing Payment...'}
                </h1>

                {/* Description */}
                <p className="text-[var(--color-gray-500)] mb-6 text-lg">
                    {synced
                        ? <>Your <span className="font-semibold text-[var(--color-gray-900)] capitalize">{plan}</span> plan is now active. Redirecting to your dashboard...</>
                        : 'Confirming your subscription. This usually takes just a few seconds.'
                    }
                </p>

                {/* Plan badge */}
                {synced && plan !== 'free' && (
                    <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 mb-8">
                        <Check className="w-4 h-4 text-[var(--color-success)]" />
                        <span className="text-sm font-semibold text-[var(--color-success)] capitalize">{plan} Plan Activated</span>
                    </div>
                )}

                {/* Progress bar */}
                {!synced && (
                    <div className="w-48 h-1.5 bg-[var(--color-gray-100)] rounded-full mx-auto overflow-hidden">
                        <div
                            className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${Math.min(95, (pollCount / MAX_POLLS) * 100)}%` }}
                        />
                    </div>
                )}

                {/* Manual redirect link */}
                <div className="mt-8">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-medium underline underline-offset-2 transition-colors"
                    >
                        Go to Dashboard now →
                    </button>
                </div>
            </div>
        </div>
    );
}
