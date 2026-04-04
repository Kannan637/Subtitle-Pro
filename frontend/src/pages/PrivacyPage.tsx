import StaticPageLayout from '@/components/shared/StaticPageLayout';

export default function PrivacyPage() {
    return (
        <StaticPageLayout
            title="Privacy Policy"
            subtitle="How we collect, use, and protect your data."
            lastUpdated="March 15, 2025"
        >
            <div className="space-y-10 text-[var(--color-gray-600)] leading-relaxed">

                <section>
                    <h2 className="text-xl font-serif text-[var(--color-gray-900)] mb-4">1. Information We Collect</h2>
                    <p className="mb-4">When you use SubtitleAI Pro, we collect the following categories of information:</p>
                    <div className="space-y-3">
                        {[
                            { title: 'Account Information', text: 'Your name, email address, and profile photo provided through Google Sign-In. We do not store passwords — authentication is handled entirely by Google.' },
                            { title: 'Media Files', text: 'Video and audio files you upload for transcription. Files are stored temporarily in encrypted cloud storage during processing and automatically deleted within 72 hours of export.' },
                            { title: 'Generated Content', text: 'Transcripts, translations, and subtitle files generated from your media. These are retained in your account until you choose to delete them.' },
                            { title: 'Usage Data', text: 'Pages visited, features used, processing times, and error logs. Collected via Firebase Analytics and used solely to improve our service.' },
                            { title: 'Payment Information', text: 'If you subscribe to a paid plan, payment processing is handled by Stripe. We never see or store your full credit card number.' },
                        ].map((item, i) => (
                            <div key={i} className="pl-5 border-l-2 border-[var(--color-gray-200)]">
                                <h3 className="font-medium text-[var(--color-gray-800)] text-sm">{item.title}</h3>
                                <p className="text-sm">{item.text}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section>
                    <h2 className="text-xl font-serif text-[var(--color-gray-900)] mb-4">2. How We Use Your Information</h2>
                    <ul className="space-y-2 pl-5 list-disc marker:text-[var(--color-gray-400)]">
                        <li>To provide, maintain, and improve the SubtitleAI Pro service</li>
                        <li>To process your media files and generate transcriptions and translations</li>
                        <li>To authenticate your identity and manage your account</li>
                        <li>To communicate with you about your account, updates, and support requests</li>
                        <li>To monitor and analyze usage patterns for service improvement</li>
                        <li>To detect, prevent, and address technical issues and security threats</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-serif text-[var(--color-gray-900)] mb-4">3. Data Storage & Security</h2>
                    <p className="mb-4">
                        All data is encrypted at rest (AES-256) and in transit (TLS 1.3). Our infrastructure is hosted on Google Cloud Platform with SOC 2 Type II compliance. Media files are stored in geographically distributed, encrypted object storage with automatic lifecycle policies.
                    </p>
                    <div className="bg-[var(--color-surface-secondary)] p-5 rounded-xl border border-[var(--color-gray-200)]">
                        <p className="text-sm font-medium text-[var(--color-gray-800)] mb-1">Media file retention</p>
                        <p className="text-sm">Uploaded files are automatically deleted 72 hours after your last export. You can request immediate deletion at any time from your dashboard settings.</p>
                    </div>
                </section>

                <section>
                    <h2 className="text-xl font-serif text-[var(--color-gray-900)] mb-4">4. Third-Party Services</h2>
                    <p className="mb-4">We use the following third-party services to operate SubtitleAI Pro:</p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-[var(--color-gray-200)]">
                                    <th className="text-left py-3 pr-4 font-medium text-[var(--color-gray-800)]">Service</th>
                                    <th className="text-left py-3 pr-4 font-medium text-[var(--color-gray-800)]">Purpose</th>
                                    <th className="text-left py-3 font-medium text-[var(--color-gray-800)]">Data Shared</th>
                                </tr>
                            </thead>
                            <tbody className="text-[var(--color-gray-600)]">
                                {[
                                    ['Google Firebase', 'Authentication & Analytics', 'Email, name, usage events'],
                                    ['Google Cloud', 'Infrastructure & Storage', 'Encrypted media files'],
                                    ['OpenAI', 'Transcription & Translation', 'Audio data (processed, not stored)'],
                                    ['DeepL', 'Translation', 'Text segments (not stored)'],
                                    ['Stripe', 'Payment processing', 'Billing info (handled by Stripe)'],
                                ].map(([service, purpose, data], i) => (
                                    <tr key={i} className="border-b border-[var(--color-gray-100)]">
                                        <td className="py-3 pr-4 font-medium text-[var(--color-gray-800)]">{service}</td>
                                        <td className="py-3 pr-4">{purpose}</td>
                                        <td className="py-3">{data}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <h2 className="text-xl font-serif text-[var(--color-gray-900)] mb-4">5. Your Rights</h2>
                    <p className="mb-4">You have the right to:</p>
                    <ul className="space-y-2 pl-5 list-disc marker:text-[var(--color-gray-400)]">
                        <li><strong className="text-[var(--color-gray-800)]">Access</strong> your personal data at any time through your account settings</li>
                        <li><strong className="text-[var(--color-gray-800)]">Export</strong> all your data in standard formats</li>
                        <li><strong className="text-[var(--color-gray-800)]">Delete</strong> your account and all associated data permanently</li>
                        <li><strong className="text-[var(--color-gray-800)]">Object</strong> to processing of your personal data for marketing purposes</li>
                        <li><strong className="text-[var(--color-gray-800)]">Restrict</strong> processing in certain circumstances as outlined by GDPR</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-serif text-[var(--color-gray-900)] mb-4">6. Contact</h2>
                    <p>
                        For privacy-related inquiries, contact our Data Protection Officer at{' '}
                        <a href="mailto:privacy@subtitleai.pro" className="text-[var(--color-primary)] underline underline-offset-2 hover:text-[var(--color-primary-hover)]">
                            privacy@subtitleai.pro
                        </a>.
                    </p>
                </section>
            </div>
        </StaticPageLayout>
    );
}
