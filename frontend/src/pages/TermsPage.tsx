import { Link } from 'react-router-dom';
import StaticPageLayout from '@/components/shared/StaticPageLayout';

const agreementRows = [
    {
        title: 'Account access',
        body: 'Subtitlepro uses secure sign-in. You are responsible for your account, device access, uploaded content, and all activity performed through your authenticated session.',
    },
    {
        title: 'Authorization',
        body: 'Dashboard, media, export, billing, AI jobs, and project access require a valid secure session. UI access alone does not grant authorization to data.',
    },
    {
        title: 'Credits',
        body: 'Credits are the usage unit for transcription, AI shorts, b-roll, music, SFX, rendering, and other agent workflows. Features may consume different credit amounts.',
    },
    {
        title: 'Production output',
        body: 'AI captions, translations, alignment, shorts, audio matches, and edits are generated aids. You remain responsible for reviewing final output before publishing.',
    },
];

const acceptableUseRows = [
    'Only upload media you own, license, or have permission to process.',
    'Do not use Subtitlepro to process illegal, abusive, infringing, exploitative, or privacy-violating content.',
    'Do not bypass authentication, authorization, rate limits, credits, billing, storage limits, or export restrictions.',
    'Do not reverse engineer, scrape, overload, resell, or provide unauthorized access to the service.',
    'Do not use generated output in a way that misleads viewers, violates platform rules, or infringes third-party rights.',
];

const billingRows = [
    ['Free access', 'Free credits may be offered for evaluation. Free limits, feature access, and credit grants can change.'],
    ['Paid plans', 'Paid plans unlock larger credit pools, exports, agent workflows, and production features according to the plan selected.'],
    ['Secure billing', 'Payments, invoices, tax data, subscriptions, cancellations, and renewals may be handled by our secure payment processor.'],
    ['Failed payment', 'If payment fails or a subscription is cancelled, paid features may be paused, downgraded, or restricted until the account is current.'],
];

const serviceRows = [
    ['Media processing', 'Uploaded media may be transcoded, proxied, trimmed, reframed, captioned, analyzed, or rendered to provide the requested workflow.'],
    ['Third-party assets', 'B-roll, music, SFX, fonts, and stock media may be subject to source terms or license restrictions. You must confirm usage rights before publishing.'],
    ['Availability', 'We work to keep Subtitlepro reliable, but processing queues, connected services, network conditions, and maintenance can affect availability.'],
    ['Changes', 'We may change features, plans, credit pricing, usage limits, connected services, or UI behavior as the product evolves.'],
];

export default function TermsPage() {
    return (
        <StaticPageLayout
            title="Terms and Conditions"
            subtitle="The agreement for using Subtitlepro accounts, credits, AI agents, media processing, exports, and dashboard access."
            lastUpdated="May 5, 2026"
        >
            <div className="space-y-14">
                <section className="grid gap-6 lg:grid-cols-[0.72fr_1fr]">
                    <div>
                        <p className="text-xs font-black uppercase text-primary">Agreement</p>
                        <h2 className="mt-4 font-[var(--static-display)] text-5xl font-black uppercase leading-[0.9] tracking-normal">
                            Use the studio responsibly.
                        </h2>
                    </div>
                    <p className="text-lg font-semibold leading-relaxed text-muted-foreground">
                        By accessing Subtitlepro, signing in, uploading media, running AI jobs, exporting videos, or using the dashboard, you agree to these terms. If you use Subtitlepro for a company or client, you confirm you have authority to bind that organization.
                    </p>
                </section>

                <section className="border-y border-border">
                    {agreementRows.map((row, index) => (
                        <article key={row.title} className="grid gap-4 border-b border-border py-6 last:border-b-0 md:grid-cols-[96px_240px_1fr]">
                            <p className="font-mono text-sm font-black text-primary">0{index + 1}</p>
                            <h3 className="text-xl font-black uppercase leading-tight">{row.title}</h3>
                            <p className="text-sm font-semibold leading-relaxed text-muted-foreground">{row.body}</p>
                        </article>
                    ))}
                </section>

                <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
                    <div>
                        <p className="text-xs font-black uppercase text-primary">Content ownership</p>
                        <h2 className="mt-4 font-[var(--static-display)] text-4xl font-black uppercase leading-[0.92] tracking-normal">
                            Your media stays yours.
                        </h2>
                    </div>
                    <div className="space-y-4 text-sm font-semibold leading-relaxed text-muted-foreground">
                        <p>
                            You keep ownership of uploaded media, transcripts, subtitles, project edits, and final exports. You grant Subtitlepro a limited license to host, process, transform, analyze, preview, and render that content only as needed to provide the service, maintain security, resolve support issues, and comply with law.
                        </p>
                        <p>
                            Subtitlepro does not give you ownership of third-party stock footage, music, sound effects, fonts, or platform materials unless the applicable source license allows it.
                        </p>
                    </div>
                </section>

                <section>
                    <p className="text-xs font-black uppercase text-primary">Acceptable use</p>
                    <div className="mt-5 grid gap-3">
                        {acceptableUseRows.map((rule) => (
                            <div key={rule} className="flex gap-3 border-t border-border pt-4">
                                <span className="mt-2 h-2 w-2 shrink-0 bg-primary" />
                                <p className="text-sm font-semibold leading-relaxed text-muted-foreground">{rule}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="overflow-hidden border border-border">
                    <div className="grid grid-cols-[1fr_1.6fr] bg-foreground px-4 py-3 text-xs font-black uppercase text-background">
                        <span>Billing term</span>
                        <span>Meaning</span>
                    </div>
                    {billingRows.map(([title, body]) => (
                        <div key={title} className="grid grid-cols-[1fr_1.6fr] border-t border-border px-4 py-4 text-sm">
                            <p className="font-black text-foreground">{title}</p>
                            <p className="font-semibold leading-relaxed text-muted-foreground">{body}</p>
                        </div>
                    ))}
                </section>

                <section className="grid gap-5 lg:grid-cols-2">
                    {serviceRows.map(([title, body]) => (
                        <article key={title} className="border border-border bg-secondary p-5">
                            <h3 className="text-sm font-black uppercase">{title}</h3>
                            <p className="mt-3 text-sm font-semibold leading-relaxed text-muted-foreground">{body}</p>
                        </article>
                    ))}
                </section>

                <section className="grid gap-6 border-y border-border py-8 lg:grid-cols-[320px_1fr]">
                    <div>
                        <p className="text-xs font-black uppercase text-primary">Suspension and termination</p>
                        <h2 className="mt-4 font-[var(--static-display)] text-4xl font-black uppercase leading-[0.92] tracking-normal">
                            Access can be limited.
                        </h2>
                    </div>
                    <p className="text-sm font-semibold leading-relaxed text-muted-foreground">
                        We may suspend or terminate access if an account violates these terms, creates security risk, infringes rights, abuses infrastructure, fails payment, or exposes Subtitlepro or other users to legal or operational harm. You may stop using the service at any time and request deletion subject to retention obligations.
                    </p>
                </section>

                <section className="grid gap-6 lg:grid-cols-2">
                    <div className="bg-foreground p-6 text-background sm:p-8">
                        <p className="text-xs font-black uppercase text-background/54">Liability</p>
                        <h2 className="mt-4 font-[var(--static-display)] text-4xl font-black uppercase leading-[0.9] tracking-normal">
                            Review before publishing.
                        </h2>
                        <p className="mt-5 text-sm font-semibold leading-relaxed text-background/70">
                            Subtitlepro is provided as a production tool, not a guarantee of perfect caption timing, translation, rights clearance, platform compliance, or commercial outcome. To the maximum extent permitted by law, liability is limited to the amount paid for the service during the period giving rise to the claim.
                        </p>
                    </div>

                    <div className="border border-border p-6 sm:p-8">
                        <p className="text-xs font-black uppercase text-primary">Questions</p>
                        <h2 className="mt-4 font-[var(--static-display)] text-4xl font-black uppercase leading-[0.9] tracking-normal">
                            Contact legal support.
                        </h2>
                        <p className="mt-5 text-sm font-semibold leading-relaxed text-muted-foreground">
                            Questions about these terms can be sent to{' '}
                            <a href="mailto:legal@subtitleai.pro" className="font-black text-primary underline underline-offset-4">
                                legal@subtitleai.pro
                            </a>
                            . Service health and incident information is available on the{' '}
                            <Link to="/status" className="font-black text-primary underline underline-offset-4">
                                status page
                            </Link>
                            .
                        </p>
                    </div>
                </section>
            </div>
        </StaticPageLayout>
    );
}
