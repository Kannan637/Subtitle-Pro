import StaticPageLayout from '@/components/shared/StaticPageLayout';
import { CheckCircle, AlertTriangle, Clock } from 'lucide-react';

const SERVICES = [
    { name: 'Web Application', status: 'operational', uptime: '99.98%' },
    { name: 'Transcription Service', status: 'operational', uptime: '99.95%' },
    { name: 'Translation Engine', status: 'operational', uptime: '99.97%' },
    { name: 'File Upload / Storage', status: 'operational', uptime: '99.99%' },
    { name: 'Secure Sign-in', status: 'operational', uptime: '99.99%' },
    { name: 'Export Service', status: 'operational', uptime: '99.96%' },
];

const INCIDENTS = [
    {
        date: 'March 22, 2025',
        title: 'Elevated latency on Translation Engine',
        status: 'resolved',
        description: 'Between 14:00 and 15:30 UTC, translation requests experienced elevated latency due to a regional service issue. All systems restored to normal performance by 15:32 UTC.',
        duration: '1h 32m',
    },
    {
        date: 'March 15, 2025',
        title: 'Scheduled maintenance - data upgrade',
        status: 'completed',
        description: 'Planned 20-minute maintenance window for a product data upgrade. All services remained available during the update. No user impact reported.',
        duration: '18m',
    },
    {
        date: 'March 8, 2025',
        title: 'Intermittent upload failures',
        status: 'resolved',
        description: 'A subset of users experienced upload failures for files larger than 2 GB. The issue was corrected at 09:45 UTC.',
        duration: '45m',
    },
];

const STATUS_STYLES = {
    operational: {
        icon: CheckCircle,
        label: 'Operational',
        dot: 'bg-[var(--color-success)]',
        text: 'text-[var(--color-success)]',
        bg: 'bg-[var(--color-success-light)]',
    },
    degraded: {
        icon: AlertTriangle,
        label: 'Degraded',
        dot: 'bg-[var(--color-warning)]',
        text: 'text-[var(--color-warning)]',
        bg: 'bg-[var(--color-warning-light)]',
    },
};

export default function StatusPage() {
    const allOperational = SERVICES.every(s => s.status === 'operational');

    return (
        <StaticPageLayout
            title="System Status"
            subtitle="Real-time operational status for all Subtitlepro services."
        >
            {/* Overall Status */}
            <section className="mb-10">
                <div className={`p-6 rounded-2xl flex items-center gap-4 ${allOperational ? 'bg-[var(--color-success-light)] border border-[var(--color-success)]/20' : 'bg-[var(--color-warning-light)] border border-[var(--color-warning)]/20'}`}>
                    <CheckCircle className={`w-6 h-6 ${allOperational ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`} />
                    <div>
                        <h2 className={`font-medium ${allOperational ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}>
                            {allOperational ? 'All systems operational' : 'Some systems experiencing issues'}
                        </h2>
                        <p className="text-sm text-[var(--color-gray-600)] mt-0.5">
                            Last checked: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                        </p>
                    </div>
                </div>
            </section>

            {/* Service List */}
            <section className="mb-12">
                <h2 className="text-lg font-serif text-[var(--color-gray-900)] mb-4">Services</h2>
                <div className="rounded-2xl border border-[var(--color-gray-200)] bg-white overflow-hidden divide-y divide-[var(--color-gray-100)]">
                    {SERVICES.map((service, i) => {
                        const style = STATUS_STYLES[service.status as keyof typeof STATUS_STYLES];
                        return (
                            <div key={i} className="flex items-center justify-between px-5 py-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                                    <span className="text-sm font-medium text-[var(--color-gray-800)]">{service.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-xs text-[var(--color-gray-500)] hidden sm:inline">
                                        {service.uptime} uptime (30d)
                                    </span>
                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${style.bg} ${style.text}`}>
                                        {style.label}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* 30-Day Uptime Bar */}
            <section className="mb-12">
                <h2 className="text-lg font-serif text-[var(--color-gray-900)] mb-4">30-day uptime</h2>
                <div className="flex gap-0.5 h-10 rounded-lg overflow-hidden">
                    {Array.from({ length: 30 }, (_, i) => {
                        const isToday = i === 29;
                        const hasIncident = i === 22 || i === 8; // March 22 and March 8 incidents
                        return (
                            <div
                                key={i}
                                className={`flex-1 rounded-sm transition-colors ${hasIncident
                                        ? 'bg-[var(--color-warning)]'
                                        : isToday
                                            ? 'bg-[var(--color-success)]'
                                            : 'bg-[var(--color-success)]/80 hover:bg-[var(--color-success)]'
                                    }`}
                                title={`Day ${i + 1}`}
                            />
                        );
                    })}
                </div>
                <div className="flex justify-between text-xs text-[var(--color-gray-400)] mt-2">
                    <span>30 days ago</span>
                    <span>Today</span>
                </div>
            </section>

            {/* Recent Incidents */}
            <section>
                <h2 className="text-lg font-serif text-[var(--color-gray-900)] mb-4">Recent Incidents</h2>
                <div className="space-y-4">
                    {INCIDENTS.map((incident, i) => (
                        <div key={i} className="p-5 rounded-2xl border border-[var(--color-gray-200)] bg-white">
                            <div className="flex flex-wrap items-center gap-3 mb-2">
                                <h3 className="font-medium text-[var(--color-gray-900)] text-sm">{incident.title}</h3>
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${incident.status === 'resolved'
                                        ? 'bg-[var(--color-success-light)] text-[var(--color-success)]'
                                        : 'bg-[var(--color-gray-100)] text-[var(--color-gray-600)]'
                                    }`}>
                                    {incident.status}
                                </span>
                            </div>
                            <p className="text-sm text-[var(--color-gray-600)] mb-3 leading-relaxed">{incident.description}</p>
                            <div className="flex items-center gap-4 text-xs text-[var(--color-gray-500)]">
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{incident.duration}</span>
                                <span>{incident.date}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </StaticPageLayout>
    );
}
