import { BarChart3, Loader2, Clock, CreditCard, FolderOpen, Globe } from 'lucide-react';
import { useState, useEffect } from 'react';
import { analyticsApi } from '@/lib/api';
import type { UsageStats } from '@/lib/api';

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

export default function AnalyticsPage() {
    const [stats, setStats] = useState<UsageStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        analyticsApi.getUsage()
            .then(res => { setStats(res.data); setLoading(false); })
            .catch(err => {
                setError(err.response?.data?.detail || 'Failed to load analytics');
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto py-10 text-center">
                <p className="text-red-500">{error}</p>
            </div>
        );
    }

    const statCards = [
        {
            label: 'Credits Remaining',
            value: `${stats?.credits_remaining ?? 0} min`,
            icon: CreditCard,
            color: 'from-[var(--color-primary)] to-[var(--color-primary-hover)]',
        },
        {
            label: 'Minutes Transcribed',
            value: `${stats?.minutes_transcribed ?? 0} min`,
            icon: Clock,
            color: 'from-blue-500 to-indigo-600',
        },
        {
            label: 'Total Projects',
            value: stats?.project_count ?? 0,
            icon: FolderOpen,
            color: 'from-emerald-500 to-teal-600',
        },
        {
            label: 'Languages Used',
            value: stats?.languages_used ?? 0,
            icon: Globe,
            color: 'from-amber-500 to-orange-600',
        },
    ];

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-serif text-[var(--color-gray-900)] flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-white" />
                    </div>
                    Usage & Analytics
                </h1>
                <p className="mt-2 text-sm text-[var(--color-gray-500)]">
                    Track your usage, credits, and activity
                </p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {statCards.map((card, i) => (
                    <div key={i} className="bg-white border border-[var(--color-gray-200)] rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-medium text-[var(--color-gray-500)] uppercase tracking-wider">{card.label}</span>
                            <div className={`w-8 h-8 bg-gradient-to-br ${card.color} rounded-lg flex items-center justify-center`}>
                                <card.icon className="w-4 h-4 text-white" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-[var(--color-gray-900)]">{card.value}</p>
                    </div>
                ))}
            </div>

            {/* Plan Info */}
            <div className="bg-white border border-[var(--color-gray-200)] rounded-2xl p-6 shadow-sm mb-8">
                <h2 className="text-sm font-semibold text-[var(--color-gray-700)] uppercase tracking-wider mb-3">Current Plan</h2>
                <div className="flex items-center gap-3">
                    <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-[var(--color-primary-light)] text-[var(--color-primary)] border border-[var(--color-primary)]/20 capitalize">
                        {stats?.plan || 'Free'}
                    </span>
                    <span className="text-sm text-[var(--color-gray-500)]">
                        {stats?.credits_remaining ?? 0} minutes remaining this month
                    </span>
                </div>
            </div>

            {/* Activity History */}
            <div className="bg-white border border-[var(--color-gray-200)] rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--color-gray-200)]">
                    <h2 className="text-sm font-semibold text-[var(--color-gray-700)] uppercase tracking-wider">Recent Activity</h2>
                </div>
                {stats?.history && stats.history.length > 0 ? (
                    <div className="divide-y divide-[var(--color-gray-100)]">
                        {stats.history.map((entry, i) => (
                            <div key={entry._id || i} className="px-6 py-3 flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-[var(--color-gray-800)]">
                                        {entry.note || entry.reference || (entry.type === 'debit' ? 'Credit used' : 'Credit added')}
                                    </p>
                                    <p className="text-xs text-[var(--color-gray-400)]">{formatDate(entry.created_at)}</p>
                                </div>
                                <span className={`text-sm font-mono font-medium ${entry.type === 'debit' ? 'text-red-500' : 'text-green-600'
                                    }`}>
                                    {entry.type === 'debit' ? '-' : '+'}{entry.amount_sec} min
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="px-6 py-8 text-center text-[var(--color-gray-400)]">
                        <p className="text-sm">No activity yet. Start transcribing to see your usage.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
