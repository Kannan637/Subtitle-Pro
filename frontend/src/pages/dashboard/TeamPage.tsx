import { Users, Mail, Shield, Crown, UserPlus } from 'lucide-react';

export default function TeamPage() {
    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-serif text-[var(--color-gray-900)] mb-2">Team Members</h1>
                    <p className="text-[var(--color-gray-500)]">Manage your team and permissions.</p>
                </div>
                <button className="claude-button-primary px-4 py-2.5 text-sm flex items-center gap-2 rounded-xl">
                    <UserPlus className="w-4 h-4" />
                    Invite Member
                </button>
            </div>

            {/* Pro Gate */}
            <div className="bg-white border border-[var(--color-gray-200)] rounded-2xl p-8 shadow-sm text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-light)] flex items-center justify-center mx-auto mb-5">
                    <Crown className="w-7 h-7 text-[var(--color-primary)]" />
                </div>
                <h2 className="text-xl font-serif text-[var(--color-gray-900)] mb-2">Team Collaboration</h2>
                <p className="text-sm text-[var(--color-gray-500)] max-w-md mx-auto mb-6">
                    Invite team members to collaborate on projects, share subtitle tracks, and manage permissions. Available on Studio and Enterprise plans.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
                    {[
                        { icon: Users, label: 'Unlimited Members', desc: 'Studio+' },
                        { icon: Shield, label: 'Role Permissions', desc: 'Admin / Editor / Viewer' },
                        { icon: Mail, label: 'Email Invites', desc: 'One-click onboarding' },
                    ].map((feat) => (
                        <div key={feat.label} className="p-4 rounded-xl bg-[var(--color-surface-secondary)]">
                            <feat.icon className="w-5 h-5 text-[var(--color-primary)] mx-auto mb-2" />
                            <div className="text-sm font-medium text-[var(--color-gray-900)]">{feat.label}</div>
                            <div className="text-xs text-[var(--color-gray-500)]">{feat.desc}</div>
                        </div>
                    ))}
                </div>

                <button className="claude-button-primary px-6 py-2.5 text-sm rounded-xl font-medium">
                    Upgrade to Studio
                </button>
            </div>
        </div>
    );
}
