import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export default function PaymentSuccessPage() {
    const { user, plan, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const purchasedPlan = searchParams.get('plan') || 'selected';
    const [pollCount, setPollCount] = useState(0);
    const MAX_POLLS = 12;
    const synced = Boolean(plan && plan !== 'free');
    const timedOut = !synced && pollCount >= MAX_POLLS;

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        let cancelled = false;

        const pollPlan = async () => {
            if (cancelled) return;
            await refreshProfile();
            setPollCount((count) => count + 1);
        };

        const interval = setInterval(() => {
            void pollPlan();
        }, 2500);

        void pollPlan();

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [navigate, refreshProfile, user]);

    useEffect(() => {
        if (!synced) return;
        const timeout = setTimeout(() => navigate('/dashboard'), 3000);
        return () => clearTimeout(timeout);
    }, [navigate, synced]);

    return (
        <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
            <Card className="w-full max-w-md overflow-hidden text-center">
                <CardHeader className="items-center gap-4 pb-4">
                    <div className="relative">
                        <div
                            className={`flex h-20 w-20 items-center justify-center rounded-full ring-4 transition-all duration-700 ${
                                synced ? 'bg-emerald-500/10 ring-emerald-500/20' : 'bg-primary/10 ring-primary/10'
                            }`}
                        >
                            {synced ? (
                                <Check className="h-10 w-10 text-emerald-600" />
                            ) : (
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            )}
                        </div>
                        {synced && (
                            <Sparkles className="absolute -right-1 -top-1 h-6 w-6 animate-bounce text-amber-500" />
                        )}
                    </div>

                    <div>
                        <Badge variant={synced ? 'success' : timedOut ? 'warning' : 'secondary'} className="mb-3">
                            {synced ? 'Plan active' : timedOut ? 'Activation pending' : 'Confirming checkout'}
                        </Badge>
                        <CardTitle className="text-2xl">
                            {synced ? 'Payment successful' : timedOut ? 'Payment received' : 'Processing payment'}
                        </CardTitle>
                        <CardDescription className="mt-2 text-sm leading-6">
                            {synced
                                ? 'Your plan is active. You will be redirected to the dashboard in a moment.'
                                : timedOut
                                    ? `Checkout completed for the ${purchasedPlan} plan, but account activation is still syncing.`
                                    : 'Confirming your subscription with the billing provider. This usually takes a few seconds.'}
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="space-y-5">
                    {synced && plan !== 'free' && (
                        <Badge variant="success" className="capitalize">
                            <Check className="mr-1 h-3.5 w-3.5" />
                            {plan} plan activated
                        </Badge>
                    )}

                    {!synced && !timedOut && (
                        <Progress value={Math.min(95, (pollCount / MAX_POLLS) * 100)} className="mx-auto max-w-56" />
                    )}

                    {timedOut && (
                        <Alert variant="warning" className="text-left">
                            <AlertTitle>Activation is still syncing</AlertTitle>
                            <AlertDescription>
                                Keep this tab open or go back to Billing and refresh after payment confirmation completes.
                            </AlertDescription>
                        </Alert>
                    )}

                    <Button onClick={() => navigate('/dashboard')} className="w-full">
                        Go to dashboard
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </CardContent>
            </Card>
        </main>
    );
}
