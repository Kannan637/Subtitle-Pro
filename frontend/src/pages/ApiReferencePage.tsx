import StaticPageLayout from '@/components/shared/StaticPageLayout';
import { ExternalLink } from 'lucide-react';

const ENDPOINTS = [
    {
        category: 'Authentication',
        endpoints: [
            { method: 'POST', path: '/api/auth/verify', description: 'Verify a Firebase ID token and return user profile', auth: false },
        ],
    },
    {
        category: 'Projects',
        endpoints: [
            { method: 'GET', path: '/api/projects', description: 'List all projects for the authenticated user', auth: true },
            { method: 'POST', path: '/api/projects', description: 'Create a new subtitling project', auth: true },
            { method: 'GET', path: '/api/projects/:id', description: 'Get project details, including transcription status', auth: true },
            { method: 'DELETE', path: '/api/projects/:id', description: 'Delete a project and all associated media', auth: true },
        ],
    },
    {
        category: 'Uploads',
        endpoints: [
            { method: 'POST', path: '/api/upload/presign', description: 'Generate a presigned URL for direct file upload to S3', auth: true },
            { method: 'POST', path: '/api/upload/youtube', description: 'Import a video from a YouTube URL', auth: true },
        ],
    },
    {
        category: 'Transcription',
        endpoints: [
            { method: 'POST', path: '/api/projects/:id/transcribe', description: 'Start AI transcription for the project\'s media', auth: true },
            { method: 'GET', path: '/api/projects/:id/transcript', description: 'Get the full transcript with timestamps and speakers', auth: true },
            { method: 'PUT', path: '/api/projects/:id/transcript', description: 'Update/edit specific cues in the transcript', auth: true },
        ],
    },
    {
        category: 'Translation',
        endpoints: [
            { method: 'POST', path: '/api/projects/:id/translate', description: 'Translate transcript to one or more target languages', auth: true },
            { method: 'GET', path: '/api/projects/:id/translations', description: 'List all available translations for a project', auth: true },
        ],
    },
    {
        category: 'Export',
        endpoints: [
            { method: 'GET', path: '/api/projects/:id/export', description: 'Export subtitles in a specified format (SRT, VTT, ASS, TTML)', auth: true },
        ],
    },
];

const METHOD_COLORS: Record<string, string> = {
    GET: 'bg-[var(--color-success-light)] text-[var(--color-success)]',
    POST: 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]',
    PUT: 'bg-[var(--color-warning-light)] text-[var(--color-warning)]',
    DELETE: 'bg-[var(--color-danger-light)] text-[var(--color-danger)]',
};

export default function ApiReferencePage() {
    return (
        <StaticPageLayout
            title="API Reference"
            subtitle="Integrate SubtitleAI Pro into your own applications and workflows."
        >
            {/* Base URL */}
            <section className="mb-10">
                <div className="p-5 rounded-xl bg-[var(--color-gray-900)] text-white font-mono text-sm flex items-center justify-between">
                    <span>
                        <span className="text-[var(--color-gray-500)]">Base URL: </span>
                        <span className="text-[var(--color-primary)]">https://api.subtitleai.pro/v1</span>
                    </span>
                </div>
            </section>

            {/* Authentication */}
            <section className="mb-10">
                <h2 className="text-xl font-serif text-[var(--color-gray-900)] mb-4">Authentication</h2>
                <p className="text-[var(--color-gray-600)] mb-4 leading-relaxed">
                    All API requests (except <code className="text-sm bg-[var(--color-gray-100)] px-1.5 py-0.5 rounded text-[var(--color-gray-800)]">/auth/verify</code>) must include a valid Firebase ID token in the <code className="text-sm bg-[var(--color-gray-100)] px-1.5 py-0.5 rounded text-[var(--color-gray-800)]">Authorization</code> header.
                </p>
                <div className="bg-[var(--color-surface-secondary)] rounded-xl p-5 border border-[var(--color-gray-200)] font-mono text-sm overflow-x-auto">
                    <pre className="text-[var(--color-gray-700)]">
                        {`curl -X GET https://api.subtitleai.pro/v1/projects \\
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" \\
  -H "Content-Type: application/json"`}
                    </pre>
                </div>
            </section>

            {/* Rate Limiting */}
            <section className="mb-12">
                <h2 className="text-xl font-serif text-[var(--color-gray-900)] mb-4">Rate Limiting</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-[var(--color-gray-200)]">
                                <th className="text-left py-3 pr-4 font-medium text-[var(--color-gray-800)]">Plan</th>
                                <th className="text-left py-3 pr-4 font-medium text-[var(--color-gray-800)]">Requests/min</th>
                                <th className="text-left py-3 font-medium text-[var(--color-gray-800)]">Concurrent Jobs</th>
                            </tr>
                        </thead>
                        <tbody className="text-[var(--color-gray-600)]">
                            <tr className="border-b border-[var(--color-gray-100)]"><td className="py-3 pr-4">Free</td><td className="py-3 pr-4">30</td><td className="py-3">1</td></tr>
                            <tr className="border-b border-[var(--color-gray-100)]"><td className="py-3 pr-4">Creator</td><td className="py-3 pr-4">120</td><td className="py-3">3</td></tr>
                            <tr className="border-b border-[var(--color-gray-100)]"><td className="py-3 pr-4">Studio</td><td className="py-3 pr-4">600</td><td className="py-3">10</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Endpoints */}
            <section className="space-y-10">
                <h2 className="text-xl font-serif text-[var(--color-gray-900)] mb-2">Endpoints</h2>
                {ENDPOINTS.map((cat, ci) => (
                    <div key={ci}>
                        <h3 className="text-base font-medium text-[var(--color-gray-800)] mb-4 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
                            {cat.category}
                        </h3>
                        <div className="space-y-2">
                            {cat.endpoints.map((ep, ei) => (
                                <div key={ei} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 rounded-xl border border-[var(--color-gray-200)] bg-white hover:border-[var(--color-gray-300)] transition-colors">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shrink-0 w-fit ${METHOD_COLORS[ep.method]}`}>
                                        {ep.method}
                                    </span>
                                    <code className="text-sm font-mono text-[var(--color-gray-800)] shrink-0">{ep.path}</code>
                                    <span className="text-sm text-[var(--color-gray-500)] sm:ml-auto">{ep.description}</span>
                                    {ep.auth && (
                                        <span className="text-[10px] font-semibold text-[var(--color-gray-400)] uppercase tracking-wider shrink-0">🔒 Auth</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </section>

            {/* SDK Note */}
            <section className="mt-12 p-6 rounded-2xl bg-[var(--color-surface-secondary)] border border-[var(--color-gray-200)] flex items-start gap-4">
                <ExternalLink className="w-5 h-5 text-[var(--color-primary)] shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-medium text-[var(--color-gray-900)] mb-1">SDKs coming soon</h3>
                    <p className="text-sm text-[var(--color-gray-600)]">
                        Official Python and JavaScript SDKs are in development. In the meantime, use the REST API directly with any HTTP client.
                    </p>
                </div>
            </section>
        </StaticPageLayout>
    );
}
