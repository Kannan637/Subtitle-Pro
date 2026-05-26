import {
    AlertCircle,
    ArrowRight,
    Captions,
    Check,
    CreditCard,
    Loader2,
    Scissors,
    ShieldCheck,
    WandSparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { billingApi, getApiErrorMessage } from '@/lib/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type Plan = {
    key: 'free' | 'creator' | 'studio' | 'enterprise';
    name: string;
    price: string;
    period: string;
    credits: number | 'custom';
    summary: string;
    bestFor: string;
    features: string[];
    highlighted?: boolean;
};

const plans: Plan[] = [
    {
        key: 'free',
        name: 'Free',
        price: '$0',
        period: '/month',
        credits: 60,
        summary: 'Start with subtitles and light caption projects.',
        bestFor: 'Testing workflows',
        features: ['Subtitle projects', 'Basic captions', 'File exports'],
    },
    {
        key: 'creator',
        name: 'Creator',
        price: '$19',
        period: '/month',
        credits: 300,
        summary: 'Daily caption videos, shorts, and downloads.',
        bestFor: 'Solo creators',
        highlighted: true,
        features: ['Caption studio', 'Long to Viral', 'MP4 downloads'],
    },
    {
        key: 'studio',
        name: 'Studio',
        price: '$79',
        period: '/month',
        credits: 1500,
        summary: 'Higher volume workflows for production teams.',
        bestFor: 'Team production',
        features: ['Audio and visual agents', 'Team access', 'Priority workflow'],
    },
    {
        key: 'enterprise',
        name: 'Enterprise',
        price: 'Custom',
        period: '',
        credits: 'custom',
        summary: 'Custom credit pools and operational support.',
        bestFor: 'High-volume operations',
        features: ['Custom credits', 'Advanced support', 'Security review'],
    },
];

const creditUseCases = [
    { title: 'AI subtitles', body: 'Transcription, subtitle tracks, translations, and text exports.', icon: Captions },
    { title: 'Caption studio', body: 'Templates, styling, b-roll, music, SFX, transitions, and MP4 exports.', icon: WandSparkles },
    { title: 'Long to Viral', body: 'Short detection, reframing, captions, previews, and downloadable cuts.', icon: Scissors },
];

function includedCredits(plan?: string): number {
    const normalized = (plan || 'free').toLowerCase();
    if (normalized === 'creator') return 300;
    if (normalized === 'studio') return 1500;
    return 60;
}

export default function BillingPage() {
    const { plan: currentPlanRaw, creditsRemaining } = useAuth();
    const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
    const [checkoutError, setCheckoutError] = useState('');

    const currentPlan = (currentPlanRaw || 'free').toLowerCase();
    const allowance = useMemo(() => includedCredits(currentPlan), [currentPlan]);
    const creditPct = Math.max(0, Math.min(100, (Number(creditsRemaining || 0) / Math.max(1, allowance)) * 100));

    const startCheckout = async (planKey: 'creator' | 'studio') => {
        setCheckoutError('');
        setCheckoutPlan(planKey);
        try {
            const { data } = await billingApi.createCheckout(planKey);
            window.location.assign(data.checkout_url);
        } catch (error) {
            setCheckoutError(getApiErrorMessage(error, 'Unable to start secure checkout. Please retry.'));
            setCheckoutPlan(null);
        }
    };

    return (
        <div className="w-full p-4 sm:p-6 lg:p-8">
            <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
                <header className="rounded-[2rem] border border-border bg-card p-5 sm:p-6">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
                        <div>
                            <Badge variant="secondary" className="mb-4">Billing</Badge>
                            <h1 className="max-w-2xl text-3xl font-semibold sm:text-4xl">Plans and credits</h1>
                            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
                                Choose the credit pool that matches your subtitle, caption, and short-form production volume.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-border bg-muted/35 p-4">
                            <div className="mb-3 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <span className="apple-icon-cell">
                                        <CreditCard className="h-5 w-5" />
                                    </span>
                                    <div>
                                        <p className="text-xs font-semibold uppercase text-muted-foreground">Credits left</p>
                                        <p className="text-2xl font-semibold">{creditsRemaining}</p>
                                    </div>
                                </div>
                                <Badge variant="outline" className="capitalize">{currentPlan} plan</Badge>
                            </div>
                            <Progress value={creditPct} />
                        </div>
                    </div>
                </header>

                {checkoutError && (
                    <Alert variant="destructive" className="grid-cols-[20px_1fr]">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Checkout unavailable</AlertTitle>
                        <AlertDescription>{checkoutError}</AlertDescription>
                    </Alert>
                )}

                <section className="grid gap-4 lg:grid-cols-4">
                    {plans.map((plan) => {
                        const isCurrent = plan.key === currentPlan;
                        const isPaidCheckout = plan.key === 'creator' || plan.key === 'studio';
                        const isCheckingOut = checkoutPlan === plan.key;

                        return (
                            <Card
                                key={plan.key}
                                className={cn(
                                    'relative overflow-hidden',
                                    plan.highlighted && !isCurrent && 'border-primary bg-primary/5',
                                    isCurrent && 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20',
                                )}
                            >
                                <CardHeader>
                                    <div className="flex min-h-8 items-center justify-between gap-2">
                                        <Badge variant="outline">
                                            {typeof plan.credits === 'number' ? `${plan.credits} credits` : 'Custom credits'}
                                        </Badge>
                                        {isCurrent && <Badge variant="success">Current</Badge>}
                                        {!isCurrent && plan.highlighted && <Badge>Popular</Badge>}
                                    </div>
                                    <div className="pt-2">
                                        <CardTitle className="text-2xl">{plan.name}</CardTitle>
                                        <CardDescription className="mt-1">{plan.bestFor}</CardDescription>
                                    </div>
                                    <div className="flex items-end gap-1">
                                        <span className="text-4xl font-semibold">{plan.price}</span>
                                        <span className="pb-1 text-sm text-muted-foreground">{plan.period}</span>
                                    </div>
                                    <CardDescription>{plan.summary}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex min-h-[230px] flex-col gap-5">
                                    <ul className="space-y-2">
                                        {plan.features.map((feat) => (
                                            <li key={feat} className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                                                {feat}
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="mt-auto">
                                        {isCurrent ? (
                                            <Button disabled variant="secondary" className="w-full">Current plan</Button>
                                        ) : isPaidCheckout ? (
                                            <Button
                                                type="button"
                                                disabled={Boolean(checkoutPlan)}
                                                onClick={() => startCheckout(plan.key as 'creator' | 'studio')}
                                                variant={plan.highlighted ? 'default' : 'outline'}
                                                className="w-full"
                                            >
                                                {isCheckingOut && <Loader2 className="h-4 w-4 animate-spin" />}
                                                {isCheckingOut ? 'Opening checkout' : 'Upgrade'}
                                            </Button>
                                        ) : plan.key === 'enterprise' ? (
                                            <Button asChild variant="outline" className="w-full">
                                                <a href="mailto:sales@subtitleai.pro?subject=Subtitlepro%20Enterprise%20Plan">Contact sales</a>
                                            </Button>
                                        ) : (
                                            <Button disabled variant="outline" className="w-full">Included</Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </section>

                <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
                    <Card>
                        <CardHeader>
                            <CardTitle>What credits cover</CardTitle>
                            <CardDescription>Credits are shared across the AI tools in your workspace.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3 md:grid-cols-3">
                            {creditUseCases.map((item) => (
                                <div key={item.title} className="rounded-2xl border border-border bg-muted/35 p-4">
                                    <span className="apple-icon-cell mb-4">
                                        <item.icon className="h-5 w-5" />
                                    </span>
                                    <p className="text-sm font-semibold">{item.title}</p>
                                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.body}</p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Plan controls</CardTitle>
                            <CardDescription>Manage billing and team access from one place.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button asChild variant="outline" className="w-full justify-between">
                                <Link to="/dashboard/team">
                                    Team members
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                            <Button asChild variant="outline" className="w-full justify-between">
                                <Link to="/dashboard/analytics">
                                    Usage analytics
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                            <div className="rounded-2xl border border-border bg-muted/35 p-4">
                                <div className="flex items-start gap-3">
                                    <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                                    <p className="text-xs leading-5 text-muted-foreground">
                                        Plan changes keep your existing projects, captions, and exports in the same workspace.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>
            </div>
        </div>
    );
}
