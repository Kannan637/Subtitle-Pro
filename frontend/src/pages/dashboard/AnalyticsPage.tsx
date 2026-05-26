import {
    AlertCircle,
    BarChart3,
    Captions,
    CreditCard,
    FolderOpen,
    Gauge,
    RefreshCcw,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { analyticsApi, getApiErrorMessage, type UsageStats } from '@/lib/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCredits(value: number): string {
    return `${Math.max(0, Math.round(value || 0))}`;
}

function cycleCredits(plan?: string, remaining = 0, used = 0): number {
    const normalized = (plan || 'free').toLowerCase();
    if (normalized === 'creator') return 300;
    if (normalized === 'studio') return 1500;
    if (normalized === 'enterprise') return Math.max(remaining + used, 1500);
    return 60;
}

function activityTitle(entry: UsageStats['history'][number]): string {
    return entry.note || entry.reference || (entry.type === 'debit' ? 'Credits used' : 'Credits added');
}

export default function AnalyticsPage() {
    const [stats, setStats] = useState<UsageStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;
        analyticsApi.getUsage()
            .then((res) => {
                if (mounted) setStats(res.data);
            })
            .catch((err) => {
                if (mounted) setError(getApiErrorMessage(err, 'Failed to load analytics.'));
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, []);

    const usage = useMemo(() => {
        const remaining = stats?.credits_remaining ?? 0;
        const used = stats?.credits_used ?? 0;
        const total = cycleCredits(stats?.plan, remaining, used);
        const pct = Math.max(0, Math.min(100, (remaining / Math.max(1, total)) * 100));
        return { remaining, used, total, pct };
    }, [stats]);

    const chartRows = useMemo(() => {
        const rows = (stats?.history ?? []).slice(0, 7).reverse().map((entry) => ({
            label: formatDate(entry.created_at),
            value: Math.abs(Math.round(entry.amount_credits ?? entry.amount_sec ?? 0)),
            debit: entry.type === 'debit',
        }));
        const max = Math.max(1, ...rows.map((row) => row.value));
        return rows.map((row) => ({ ...row, pct: Math.max(8, (row.value / max) * 100) }));
    }, [stats]);

    if (loading) {
        return (
            <div className="w-full p-4 sm:p-6 lg:p-8">
                <div className="mx-auto w-full max-w-[1180px] space-y-5">
                    <Skeleton className="h-32 rounded-[2rem]" />
                    <div className="grid gap-3 md:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}
                    </div>
                    <Skeleton className="h-80 rounded-[2rem]" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full p-4 sm:p-6 lg:p-8">
                <div className="mx-auto w-full max-w-[1180px]">
                    <Alert variant="destructive" className="grid-cols-[20px_1fr]">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Unable to load usage</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </div>
            </div>
        );
    }

    const statCards = [
        { label: 'Remaining', value: formatCredits(usage.remaining), icon: CreditCard },
        { label: 'Used', value: formatCredits(usage.used), icon: BarChart3 },
        { label: 'Projects', value: stats?.project_count ?? 0, icon: FolderOpen },
        { label: 'Languages', value: stats?.languages_used ?? 0, icon: Captions },
    ];

    return (
        <div className="w-full p-4 sm:p-6 lg:p-8">
            <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
                <header className="rounded-[2rem] border border-border bg-card p-5 sm:p-6">
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-end">
                        <div>
                            <Badge variant="secondary" className="mb-4">Usage</Badge>
                            <h1 className="max-w-2xl text-3xl font-semibold sm:text-4xl">Credits and activity</h1>
                            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
                                Monitor credit balance, recent production activity, and project volume from one clean workspace view.
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-border bg-muted/35 p-4">
                                <div className="mb-3 flex items-center justify-between gap-4">
                                    <p className="text-sm font-semibold capitalize">{stats?.plan || 'Free'} plan</p>
                                    <p className="text-sm font-semibold">{Math.round(usage.pct)}%</p>
                                </div>
                                <Progress value={usage.pct} />
                                <p className="mt-3 text-xs text-muted-foreground">
                                    {formatCredits(usage.remaining)} of {formatCredits(usage.total)} credits left
                                </p>
                            </div>
                            <div className="rounded-2xl border border-border bg-muted/35 p-4">
                                <div className="flex items-center gap-3">
                                    <span className="apple-icon-cell">
                                        <Gauge className="h-5 w-5" />
                                    </span>
                                    <div>
                                        <p className="text-xs font-semibold uppercase text-muted-foreground">Cycle usage</p>
                                        <p className="text-2xl font-semibold">{formatCredits(usage.used)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <section className="grid gap-3 md:grid-cols-4">
                    {statCards.map((card) => (
                        <div key={card.label} className="rounded-2xl border border-border bg-card p-4">
                            <div className="flex items-center gap-3">
                                <span className="apple-icon-cell">
                                    <card.icon className="h-5 w-5" />
                                </span>
                                <div>
                                    <p className="text-xs font-semibold uppercase text-muted-foreground">{card.label}</p>
                                    <p className="text-2xl font-semibold">{card.value}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </section>

                <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <Card>
                        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                            <div>
                                <CardTitle>Recent activity</CardTitle>
                                <CardDescription>Latest credit events across subtitle, caption, and shorts workflows.</CardDescription>
                            </div>
                            <Badge variant="outline">{stats?.history?.length ?? 0} events</Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            {stats?.history && stats.history.length > 0 ? (
                                <div className="divide-y divide-border">
                                    {stats.history.slice(0, 10).map((entry, index) => {
                                        const amount = formatCredits(entry.amount_credits ?? entry.amount_sec);
                                        const isDebit = entry.type === 'debit';
                                        return (
                                            <div key={entry._id || index} className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-4 px-5 py-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold">{activityTitle(entry)}</p>
                                                    <p className="text-xs text-muted-foreground">{formatDate(entry.created_at)}</p>
                                                </div>
                                                <Badge variant={isDebit ? 'destructive' : 'success'}>
                                                    {isDebit ? '-' : '+'}{amount}
                                                </Badge>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex min-h-48 flex-col items-center justify-center px-5 py-10 text-center">
                                    <RefreshCcw className="mb-3 h-5 w-5 text-muted-foreground" />
                                    <p className="text-sm font-semibold">No usage activity yet</p>
                                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                                        Start a subtitle, caption, or shorts project and activity will appear here.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="space-y-5">
                        <Card>
                            <CardHeader>
                                <CardTitle>Credit balance</CardTitle>
                                <CardDescription>Current billing cycle allocation.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-2xl border border-border bg-muted/35 p-4">
                                        <p className="text-xs font-semibold uppercase text-muted-foreground">Available</p>
                                        <p className="mt-1 text-2xl font-semibold">{formatCredits(usage.remaining)}</p>
                                    </div>
                                    <div className="rounded-2xl border border-border bg-muted/35 p-4">
                                        <p className="text-xs font-semibold uppercase text-muted-foreground">Included</p>
                                        <p className="mt-1 text-2xl font-semibold">{formatCredits(usage.total)}</p>
                                    </div>
                                </div>
                                <Progress value={usage.pct} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Activity volume</CardTitle>
                                <CardDescription>Recent credit movement.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {chartRows.length > 0 ? (
                                    <div className="space-y-3">
                                        {chartRows.map((row, index) => (
                                            <div key={`${row.label}-${index}`} className="grid grid-cols-[44px_1fr_42px] items-center gap-3 text-xs">
                                                <span className="text-muted-foreground">{row.label}</span>
                                                <div className="h-2 overflow-hidden rounded-full bg-muted">
                                                    <div
                                                        className={row.debit ? 'h-full rounded-full bg-primary' : 'h-full rounded-full bg-emerald-500'}
                                                        style={{ width: `${row.pct}%` }}
                                                    />
                                                </div>
                                                <span className="text-right font-semibold">{row.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No chart data yet.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </section>
            </div>
        </div>
    );
}
