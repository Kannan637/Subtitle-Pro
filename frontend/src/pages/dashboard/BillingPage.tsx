import { Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const CHECKOUT_URLS: Record<string, string> = {
    creator: 'https://letsbegin.lemonsqueezy.com/checkout/buy/a9fcdac4-1af5-4f19-b77c-33df3245bac2',
    studio: 'https://letsbegin.lemonsqueezy.com/checkout/buy/d968a2c1-7a60-4a89-99cd-74ec0fd4e9b0',
};

export default function BillingPage() {
    const { plan: currentPlan, user } = useAuth();

    const plans = [
        {
            key: 'free',
            name: 'Free',
            price: '$0',
            period: '/month',
            features: ['60 min transcription/mo', '3 languages', 'SRT/VTT export', 'Standard quality'],
            highlighted: false,
        },
        {
            key: 'creator',
            name: 'Creator',
            price: '$19',
            period: '/month',
            features: ['300 min transcription/mo', '30 languages', 'All export formats', 'HD quality', 'Priority processing', 'Custom vocabulary'],
            highlighted: true,
        },
        {
            key: 'studio',
            name: 'Studio',
            price: '$79',
            period: '/month',
            features: ['1500 min transcription/mo', '100+ languages', 'Burn-in subtitles', 'API access', 'Team collaboration', 'Dedicated support'],
            highlighted: false,
        },
        {
            key: 'enterprise',
            name: 'Enterprise',
            price: 'Custom',
            period: '',
            features: ['Unlimited transcription', 'All languages', 'Custom AI models', 'SSO / SAML', 'SLA guarantee', '24/7 premium support'],
            highlighted: false,
        },
    ];

    const getCheckoutUrl = (planKey: string) => {
        const base = CHECKOUT_URLS[planKey];
        if (!base) return '';
        const redirectUrl = `${window.location.origin}/payment/success`;
        const params = new URLSearchParams();
        if (user?.email) params.set('checkout[email]', user.email);
        params.set('checkout[custom][redirect_url]', redirectUrl);
        return `${base}?${params.toString()}`;
    };

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-8 text-center">
                <h1 className="text-2xl font-serif text-[var(--color-gray-900)] mb-2">Billing & Plans</h1>
                <p className="text-[var(--color-gray-500)]">Choose the plan that fits your workflow.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {plans.map((plan) => {
                    const isCurrent = plan.key === currentPlan;
                    const isUpgrade = !isCurrent && CHECKOUT_URLS[plan.key];
                    const badge = isCurrent ? 'Current' : plan.highlighted ? 'Popular' : '';

                    return (
                        <div key={plan.name} className={`relative bg-white border rounded-2xl p-6 shadow-sm flex flex-col ${plan.highlighted && !isCurrent ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary-light)]' : isCurrent ? 'border-[var(--color-success)] ring-2 ring-[var(--color-success)]/20' : 'border-[var(--color-gray-200)]'}`}>
                            {badge && (
                                <span className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${isCurrent ? 'bg-[var(--color-success)] text-white' : plan.highlighted ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-gray-100)] text-[var(--color-gray-600)]'}`}>
                                    {badge}
                                </span>
                            )}
                            <div className="mb-4 mt-2">
                                <h3 className="font-medium text-[var(--color-gray-900)] mb-1">{plan.name}</h3>
                                <div className="flex items-end gap-0.5">
                                    <span className="text-3xl font-serif font-medium text-[var(--color-gray-900)]">{plan.price}</span>
                                    <span className="text-sm text-[var(--color-gray-500)] mb-1">{plan.period}</span>
                                </div>
                            </div>
                            <ul className="space-y-2.5 mb-6 flex-1">
                                {plan.features.map((feat) => (
                                    <li key={feat} className="flex items-start gap-2 text-sm text-[var(--color-gray-600)]">
                                        <Check className="w-4 h-4 text-[var(--color-success)] shrink-0 mt-0.5" />
                                        {feat}
                                    </li>
                                ))}
                            </ul>
                            {isCurrent ? (
                                <button disabled className="w-full py-2.5 rounded-xl text-sm font-medium bg-[var(--color-gray-100)] text-[var(--color-gray-500)] cursor-not-allowed">
                                    Current Plan
                                </button>
                            ) : isUpgrade ? (
                                <a
                                    href={getCheckoutUrl(plan.key)}
                                    className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors text-center block ${plan.highlighted ? 'claude-button-primary' : 'claude-button bg-white'}`}
                                >
                                    Upgrade
                                </a>
                            ) : (
                                <button className="w-full py-2.5 rounded-xl text-sm font-medium claude-button bg-white">
                                    {plan.key === 'enterprise' ? 'Contact Sales' : 'Select'}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Invoice History */}
            <div className="mt-10 bg-white border border-[var(--color-gray-200)] rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-[var(--color-gray-900)] mb-4">Invoice History</h3>
                <div className="text-center py-6">
                    <p className="text-sm text-[var(--color-gray-400)]">No invoices yet.</p>
                </div>
            </div>
        </div>
    );
}
