import StaticPageLayout from '@/components/shared/StaticPageLayout';

const dataRows = [
    {
        title: 'Account identity',
        body: 'Name, email address, profile image, account identifier, sign-in state, plan, credits, onboarding answers, and account preferences.',
    },
    {
        title: 'Project media',
        body: 'Video, audio, thumbnails, proxy files, subtitle cues, transcripts, generated shorts, b-roll selections, music, SFX, and export settings.',
    },
    {
        title: 'Usage and reliability',
        body: 'Feature usage, job status, credit consumption, processing duration, errors, request IDs, device/browser metadata, and security events.',
    },
    {
        title: 'Billing records',
        body: 'Subscription status, plan, payment event references, invoices, tax metadata, and billing account identifiers. Full card data is handled by our secure payment processor.',
    },
];

const processingRows = [
    ['Authentication', 'To sign you in, protect your dashboard, verify secure requests, and keep account data tied to the correct user.'],
    ['AI generation', 'To transcribe, align captions, translate, suggest shorts, reframe video, select b-roll, match music, place SFX, and render exports.'],
    ['Product operations', 'To maintain job queues, debug failures, prevent abuse, calculate credits, improve reliability, and support customers.'],
    ['Legal and safety', 'To enforce terms, comply with lawful requests, protect the service, and investigate suspected misuse.'],
];

const serviceRows = [
    ['Account security', 'Authentication, session verification, analytics, and sign-in state'],
    ['Product database', 'Account records, project metadata, credits, job state, and cue data'],
    ['Media storage', 'Uploaded media, generated previews, audio assets, and export-ready files'],
    ['AI processing', 'Transcription, caption analysis, translation, summarization, and short-form analysis'],
    ['Media libraries', 'Optional b-roll discovery and preview assets'],
    ['Secure billing', 'Subscription, invoice, plan, and payment event processing'],
];

const rightsRows = [
    'Access your account profile, projects, generated captions, and exported files from the product interface.',
    'Delete projects and media you no longer need, subject to backup and abuse-prevention retention windows.',
    'Request account deletion, export, correction, or billing support by contacting us.',
    'Object to non-essential communications and analytics where applicable by law.',
];

export default function PrivacyPage() {
    return (
        <StaticPageLayout
            title="Privacy Policy"
            subtitle="How Subtitlepro handles account identity, uploaded media, AI processing, billing records, and product telemetry."
            lastUpdated="May 5, 2026"
        >
            <div className="space-y-14">
                <section className="grid gap-6 lg:grid-cols-[0.72fr_1fr]">
                    <div>
                        <p className="text-xs font-black uppercase text-primary">Privacy posture</p>
                        <h2 className="mt-4 font-[var(--static-display)] text-5xl font-black uppercase leading-[0.9] tracking-normal">
                            Built for video teams.
                        </h2>
                    </div>
                    <p className="text-lg font-semibold leading-relaxed text-muted-foreground">
                        Subtitlepro processes media so users can create captions, shorts, b-roll edits, music placement, sound effects, and exports. We collect the data needed to run those workflows, secure accounts, measure credits, and support production reliability.
                    </p>
                </section>

                <section className="border-y border-border">
                    {dataRows.map((row, index) => (
                        <article key={row.title} className="grid gap-4 border-b border-border py-6 last:border-b-0 md:grid-cols-[96px_240px_1fr]">
                            <p className="font-mono text-sm font-black text-primary">0{index + 1}</p>
                            <h3 className="text-xl font-black uppercase leading-tight">{row.title}</h3>
                            <p className="text-sm font-semibold leading-relaxed text-muted-foreground">{row.body}</p>
                        </article>
                    ))}
                </section>

                <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
                    <div>
                        <p className="text-xs font-black uppercase text-primary">Use of data</p>
                        <h2 className="mt-4 font-[var(--static-display)] text-4xl font-black uppercase leading-[0.92] tracking-normal">
                            Why we process it.
                        </h2>
                    </div>
                    <div className="grid gap-3">
                        {processingRows.map(([title, body]) => (
                            <div key={title} className="border border-border bg-secondary p-5">
                                <h3 className="text-sm font-black uppercase">{title}</h3>
                                <p className="mt-2 text-sm font-semibold leading-relaxed text-muted-foreground">{body}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section>
                    <p className="text-xs font-black uppercase text-primary">Retention and security</p>
                    <div className="mt-5 grid gap-5 border-y border-border py-6 lg:grid-cols-3">
                        {[
                            ['Media retention', 'Media and generated assets are retained while the project exists or while needed for processing, export, support, security, or billing records.'],
                            ['Transport and storage', 'We use authenticated requests, encrypted transport, secure storage controls, and access-limited operational systems.'],
                            ['Deletion workflow', 'Deleting a project removes it from normal product access. Some logs, backups, invoices, and abuse-prevention records may remain for a limited period.'],
                        ].map(([title, body]) => (
                            <div key={title} className="border-r border-border pr-5 last:border-r-0">
                                <h3 className="text-lg font-black uppercase">{title}</h3>
                                <p className="mt-3 text-sm font-semibold leading-relaxed text-muted-foreground">{body}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="overflow-hidden border border-border">
                    <div className="grid grid-cols-[1fr_1.5fr] bg-foreground px-4 py-3 text-xs font-black uppercase text-background">
                        <span>Processor</span>
                        <span>Purpose</span>
                    </div>
                    {serviceRows.map(([service, purpose]) => (
                        <div key={service} className="grid grid-cols-[1fr_1.5fr] border-t border-border px-4 py-4 text-sm">
                            <p className="font-black text-foreground">{service}</p>
                            <p className="font-semibold leading-relaxed text-muted-foreground">{purpose}</p>
                        </div>
                    ))}
                </section>

                <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
                    <div>
                        <p className="text-xs font-black uppercase text-primary">User rights</p>
                        <h2 className="mt-4 font-[var(--static-display)] text-4xl font-black uppercase leading-[0.92] tracking-normal">
                            Control your account.
                        </h2>
                    </div>
                    <div className="grid gap-3">
                        {rightsRows.map((right) => (
                            <div key={right} className="flex gap-3 border-t border-border pt-4">
                                <span className="mt-2 h-2 w-2 shrink-0 bg-primary" />
                                <p className="text-sm font-semibold leading-relaxed text-muted-foreground">{right}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="bg-foreground p-6 text-background sm:p-8">
                    <p className="text-xs font-black uppercase text-background/54">Contact</p>
                    <h2 className="mt-4 font-[var(--static-display)] text-4xl font-black uppercase leading-[0.9] tracking-normal">
                        Privacy questions go to the trust inbox.
                    </h2>
                    <p className="mt-5 text-sm font-semibold leading-relaxed text-background/70">
                        Email{' '}
                        <a href="mailto:privacy@subtitleai.pro" className="font-black text-primary underline underline-offset-4">
                            privacy@subtitleai.pro
                        </a>{' '}
                        for privacy requests, deletion requests, or questions about processing.
                    </p>
                </section>
            </div>
        </StaticPageLayout>
    );
}
