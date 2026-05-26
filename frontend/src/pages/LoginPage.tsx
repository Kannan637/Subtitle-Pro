import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    AlertCircle,
    ArrowRight,
    Captions,
    Check,
    Music2,
    Ratio,
    RefreshCw,
    Scissors,
    ShieldCheck,
    Sparkles,
    WandSparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import BrandLogo from '@/components/shared/BrandLogo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AUTH_SESSION_RECOVERY_MESSAGE } from '@/lib/api';
import { clearFirebaseBrowserStorage } from '@/lib/authStorage';

const authImages = {
    main: 'https://images.unsplash.com/photo-1492724441997-5dc865305da7?auto=format&fit=crop&w=1800&q=88',
    caption: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&w=1000&q=88',
};

const accessRows = [
    { icon: Captions, title: 'AI subtitles', body: 'Generate editable subtitle tracks and export SRT, VTT, TXT, or JSON.' },
    { icon: WandSparkles, title: 'AI captions', body: 'Style social captions with templates, type controls, b-roll, music, and SFX.' },
    { icon: Scissors, title: 'AI shorts', body: 'Cut long videos into hook-led clips with reframing, captions, preview, and download.' },
];

const trustRows = [
    { icon: ShieldCheck, label: 'Google secured sign-in' },
    { icon: Ratio, label: 'Aspect and render settings saved' },
    { icon: Music2, label: 'Timeline media preserved' },
];

const LEGACY_STALE_SESSION_TEXT = 'your saved sign-in session is stale';

function normalizeAuthErrorMessage(message: string) {
    return message.toLowerCase().includes(LEGACY_STALE_SESSION_TEXT)
        ? AUTH_SESSION_RECOVERY_MESSAGE
        : message;
}

export default function LoginPage() {
    const { signInWithGoogle, signOut, user, loading, authError, clearAuthError } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionResetComplete, setSessionResetComplete] = useState(false);

    useEffect(() => {
        if (!loading && user && !sessionResetComplete) navigate('/', { replace: true });
    }, [user, loading, sessionResetComplete, navigate]);

    useEffect(() => {
        if (!user && authError) setError(normalizeAuthErrorMessage(authError));
    }, [authError, user]);

    const handleGoogleSignIn = async () => {
        try {
            setError('');
            setNotice('');
            setSessionResetComplete(false);
            clearAuthError();
            setIsLoading(true);
            await signInWithGoogle();
            navigate('/', { replace: true });
        } catch (err: unknown) {
            setError(err instanceof Error && err.message ? err.message : 'Failed to sign in with Google.');
        } finally {
            setIsLoading(false);
        }
    };

    const resetLocalSession = async () => {
        setIsLoading(true);
        setError('');
        setNotice('');
        setSessionResetComplete(true);
        clearAuthError();
        try {
            await signOut();
        } catch {
            // Continue local cleanup if Firebase cannot finish network sign-out.
        }
        try {
            await clearFirebaseBrowserStorage();
            setNotice('Local sign-in session cleared. Continue with Google again.');
        } catch {
            setNotice('Session reset attempted. Continue with Google again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="apple-page apple-no-shadow">
            <header className="border-b border-border bg-background/78 backdrop-blur-2xl">
                <div className="apple-wide flex h-16 items-center justify-between">
                    <Link to="/" className="flex items-center" aria-label="Subtitlepro home">
                        <BrandLogo variant="wordmark" sizeClassName="h-9 w-[146px]" alt="Subtitlepro" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="hidden sm:inline-flex">
                            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                            Secure access
                        </Badge>
                        <Button variant="ghost" size="sm" asChild>
                            <Link to="/">Back to site</Link>
                        </Button>
                    </div>
                </div>
            </header>

            <section className="apple-wide grid min-h-[calc(100vh-4rem)] items-center gap-8 py-8 lg:grid-cols-[0.86fr_1.14fr] lg:py-10">
                <div className="max-w-xl">
                    <span className="apple-kicker">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Account access
                    </span>
                    <h1 className="apple-title mt-5 max-w-[11ch]">Open your AI video workspace.</h1>
                    <p className="apple-subtitle mt-6">
                        Sign in to manage captions, subtitles, shorts, credits, billing, team access, and render-ready video projects.
                    </p>

                    <Card className="mt-8">
                        <CardHeader>
                            <CardTitle className="text-2xl">Continue with Google</CardTitle>
                            <CardDescription>
                                Subtitlepro keeps projects, templates, credits, and render history connected to your account.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {error && (
                                <Alert variant="destructive" className="grid-cols-[20px_1fr]">
                                    <AlertCircle className="mt-0.5 h-4 w-4" />
                                    <AlertTitle>Session needs attention</AlertTitle>
                                    <AlertDescription className="mt-1">
                                        {error}
                                        <Button
                                            type="button"
                                            variant="link"
                                            size="sm"
                                            className="mt-2 h-auto p-0 text-destructive"
                                            disabled={isLoading}
                                            onClick={() => void resetLocalSession()}
                                        >
                                            <RefreshCw className="h-3.5 w-3.5" />
                                            Clear local session
                                        </Button>
                                    </AlertDescription>
                                </Alert>
                            )}

                            {notice && (
                                <Alert variant="success" className="grid-cols-[20px_1fr]">
                                    <Check className="mt-0.5 h-4 w-4" />
                                    <AlertTitle>Session reset</AlertTitle>
                                    <AlertDescription>{notice}</AlertDescription>
                                </Alert>
                            )}

                            <Button
                                type="button"
                                size="lg"
                                className="w-full justify-between px-5"
                                disabled={isLoading}
                                onClick={handleGoogleSignIn}
                            >
                                <span className="flex items-center gap-3">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
                                        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                            <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05" />
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                                        </svg>
                                    </span>
                                    {isLoading ? 'Signing in' : 'Continue with Google'}
                                </span>
                                <ArrowRight className="h-4 w-4" />
                            </Button>

                            <p className="text-xs font-medium leading-5 text-muted-foreground">
                                By continuing, you agree to Subtitlepro&apos;s{' '}
                                <Link to="/terms" className="font-semibold text-foreground underline underline-offset-4">Terms</Link>
                                {' '}and{' '}
                                <Link to="/privacy" className="font-semibold text-foreground underline underline-offset-4">Privacy Policy</Link>.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 lg:grid-rows-[1fr_auto]">
                    <div className="apple-material relative min-h-[480px] overflow-hidden rounded-[2rem] p-2">
                        <div className="relative h-full min-h-[460px] overflow-hidden rounded-[1.55rem]">
                            <img src={authImages.main} alt="AI video editing workspace" className="absolute inset-0 h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/18 to-black/10" />
                            <div className="absolute left-5 top-5 flex flex-wrap gap-2">
                                <Badge className="bg-background text-foreground hover:bg-background">Studio access</Badge>
                                <Badge variant="outline" className="border-white/35 bg-white/10 text-white">Session protected</Badge>
                            </div>
                            <div className="absolute bottom-5 left-5 right-5">
                                <p className="max-w-xl text-4xl font-semibold leading-none tracking-[-0.04em] text-white">
                                    Projects stay ready for captions, shorts, audio, and export.
                                </p>
                                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                                    {trustRows.map((row) => (
                                        <div key={row.label} className="rounded-[1rem] border border-white/24 bg-white/10 p-3 text-white backdrop-blur">
                                            <row.icon className="mb-2 h-4 w-4 text-white" />
                                            <p className="text-xs font-semibold leading-5">{row.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[0.7fr_1fr]">
                        <div className="apple-material overflow-hidden rounded-[1.5rem] p-2">
                            <img src={authImages.caption} alt="Caption design preview" className="h-full min-h-64 w-full rounded-[1.15rem] object-cover" />
                        </div>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-xl">What opens after sign in</CardTitle>
                                <CardDescription>One account unlocks every current AI tool and keeps timeline data in one place.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                {accessRows.map((row, index) => (
                                    <div key={row.title}>
                                        <div className="apple-list-row flex items-start gap-3">
                                            <span className="apple-icon-cell">
                                                <row.icon className="h-4 w-4" />
                                            </span>
                                            <div>
                                                <p className="text-sm font-semibold">{row.title}</p>
                                                <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">{row.body}</p>
                                            </div>
                                        </div>
                                        {index < accessRows.length - 1 && <Separator />}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>
        </main>
    );
}
