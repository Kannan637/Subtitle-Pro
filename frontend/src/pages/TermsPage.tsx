import StaticPageLayout from '@/components/shared/StaticPageLayout';

export default function TermsPage() {
    return (
        <StaticPageLayout
            title="Terms of Service"
            subtitle="The legal agreement between you and SubtitleAI Pro."
            lastUpdated="March 15, 2025"
        >
            <div className="space-y-10 text-[var(--color-gray-600)] leading-relaxed">

                <section>
                    <h2 className="text-xl font-serif text-[var(--color-gray-900)] mb-4">1. Acceptance of Terms</h2>
                    <p>
                        By accessing or using SubtitleAI Pro ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service. These Terms apply to all visitors, users, and others who access or use the Service.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-serif text-[var(--color-gray-900)] mb-4">2. Account Registration</h2>
                    <p className="mb-4">
                        To use SubtitleAI Pro, you must sign in with a valid Google account. You are responsible for maintaining the security of your Google account credentials. You must promptly notify us of any unauthorized use of your account.
                    </p>
                    <div className="bg-[var(--color-warning-light)] border border-[var(--color-warning)]/20 p-4 rounded-xl text-sm">
                        <p className="font-medium text-[var(--color-gray-800)] mb-1">Important</p>
                        <p className="text-[var(--color-gray-700)]">You must be at least 16 years of age to use this Service. By using SubtitleAI Pro, you represent and warrant that you meet this minimum age requirement.</p>
                    </div>
                </section>

                <section>
                    <h2 className="text-xl font-serif text-[var(--color-gray-900)] mb-4">3. Acceptable Use</h2>
                    <p className="mb-4">You agree not to use SubtitleAI Pro to:</p>
                    <ul className="space-y-2 pl-5 list-disc marker:text-[var(--color-gray-400)]">
                        <li>Process content that you do not own or have explicit rights to subtitle</li>
                        <li>Generate subtitles for content that is illegal, harmful, threatening, abusive, or otherwise objectionable</li>
                        <li>Attempt to reverse-engineer, decompile, or extract our AI models or algorithms</li>
                        <li>Circumvent usage limits, rate limits, or other technical restrictions</li>
                        <li>Use automated tools to access the Service in a way that exceeds reasonable human usage</li>
                        <li>Resell, redistribute, or commercially exploit the Service without written permission</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-serif text-[var(--color-gray-900)] mb-4">4. Content Ownership & Licensing</h2>
                    <p className="mb-4">
                        <strong className="text-[var(--color-gray-800)]">Your content remains yours.</strong> You retain all intellectual property rights to your uploaded media and generated subtitle files. By uploading content to SubtitleAI Pro, you grant us a limited, non-exclusive license to process your content solely for the purpose of providing the Service.
                    </p>
                    <p>
                        We do not use your content to train AI models. Your media files are processed in isolated environments and deleted according to our retention policy (72 hours after your last export).
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-serif text-[var(--color-gray-900)] mb-4">5. Subscription & Billing</h2>
                    <div className="space-y-4">
                        {[
                            { title: 'Free Tier', text: 'Includes 60 minutes of processing per month. Unused minutes do not roll over. No credit card required.' },
                            { title: 'Paid Plans', text: 'Subscriptions are billed monthly or annually. You may upgrade, downgrade, or cancel at any time. Changes take effect at the start of your next billing cycle.' },
                            { title: 'Refunds', text: 'We offer a full refund within 14 days of your first paid subscription if you are not satisfied. Contact support to initiate a refund.' },
                            { title: 'Overages', text: 'If you exceed your plan\'s minute allowance, additional processing is paused until the next billing cycle. You will not be charged overage fees without explicit opt-in.' },
                        ].map((item, i) => (
                            <div key={i} className="pl-5 border-l-2 border-[var(--color-gray-200)]">
                                <h3 className="font-medium text-[var(--color-gray-800)] text-sm">{item.title}</h3>
                                <p className="text-sm">{item.text}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section>
                    <h2 className="text-xl font-serif text-[var(--color-gray-900)] mb-4">6. Service Availability</h2>
                    <p>
                        We strive for 99.9% uptime but do not guarantee uninterrupted access. We reserve the right to modify, suspend, or discontinue any part of the Service with 30 days' prior notice. Scheduled maintenance windows are communicated via email and our <a href="/status" className="text-[var(--color-primary)] underline underline-offset-2 hover:text-[var(--color-primary-hover)]">Status page</a>.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-serif text-[var(--color-gray-900)] mb-4">7. Limitation of Liability</h2>
                    <p>
                        SubtitleAI Pro is provided "as is" without warranties of any kind, either express or implied. In no event shall SubtitleAI Pro be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, including but not limited to loss of revenue, data, or business opportunities.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-serif text-[var(--color-gray-900)] mb-4">8. Governing Law</h2>
                    <p>
                        These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-serif text-[var(--color-gray-900)] mb-4">9. Contact</h2>
                    <p>
                        Questions about these Terms? Contact us at{' '}
                        <a href="mailto:legal@subtitleai.pro" className="text-[var(--color-primary)] underline underline-offset-2 hover:text-[var(--color-primary-hover)]">
                            legal@subtitleai.pro
                        </a>.
                    </p>
                </section>
            </div>
        </StaticPageLayout>
    );
}
