import { ArrowRight, Crown, Mail, Shield, UserPlus, Users } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const roles = [
    {
        name: 'Owner',
        description: 'Billing, credits, members, exports',
        permissions: ['Manage plan', 'Create projects', 'Export files'],
    },
    {
        name: 'Editor',
        description: 'AI tools, captions, timeline edits',
        permissions: ['Edit captions', 'Run AI tools', 'Render previews'],
    },
    {
        name: 'Reviewer',
        description: 'Preview, timing checks, final review',
        permissions: ['Review output', 'Comment timing', 'Approve cuts'],
    },
];

function initials(name?: string | null, email?: string | null): string {
    const source = name || email || 'Workspace Owner';
    return source
        .split(/\s|@/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'SO';
}

export default function TeamPage() {
    const { plan, user, creditsRemaining } = useAuth();
    const normalizedPlan = (plan || 'free').toLowerCase();
    const canInvite = normalizedPlan === 'studio' || normalizedPlan === 'enterprise';
    const seatLimitValue = normalizedPlan === 'enterprise' ? null : normalizedPlan === 'studio' ? 10 : 1;
    const seatLimitLabel = seatLimitValue ? `${seatLimitValue} seat${seatLimitValue > 1 ? 's' : ''}` : 'Unlimited';
    const seatsUsed = 1;
    const seatPct = seatLimitValue ? (seatsUsed / seatLimitValue) * 100 : 8;

    const inviteMailto = useMemo(() => {
        const subject = encodeURIComponent('Subtitlepro team invite request');
        const body = encodeURIComponent([
            'Hi Subtitlepro team,',
            '',
            'Please enable a team invite for my workspace.',
            `Plan: ${plan || 'free'}`,
            `Owner: ${user?.email || 'not provided'}`,
            '',
            'Invite email:',
            'Role: Editor',
        ].join('\n'));
        return `mailto:support@subtitleai.pro?subject=${subject}&body=${body}`;
    }, [plan, user?.email]);

    return (
        <div className="w-full p-4 sm:p-6 lg:p-8">
            <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
                <header className="rounded-[2rem] border border-border bg-card p-5 sm:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <Badge variant="secondary" className="mb-4">Team</Badge>
                            <h1 className="max-w-2xl text-3xl font-semibold sm:text-4xl">Members and access</h1>
                            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
                                Control who can create projects, edit captions, review shorts, and manage workspace billing.
                            </p>
                        </div>
                        {canInvite ? (
                            <Button asChild>
                                <a href={inviteMailto}>
                                    <UserPlus className="h-4 w-4" />
                                    Request invite
                                </a>
                            </Button>
                        ) : (
                            <Button asChild>
                                <Link to="/dashboard/billing">
                                    <Crown className="h-4 w-4" />
                                    Upgrade for teams
                                </Link>
                            </Button>
                        )}
                    </div>
                </header>

                <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <Card>
                        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                            <div>
                                <CardTitle>Workspace members</CardTitle>
                                <CardDescription>{seatsUsed} active member on the current plan.</CardDescription>
                            </div>
                            <Badge variant="outline" className="capitalize">{normalizedPlan} plan</Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="hidden grid-cols-[1fr_120px_120px] border-b border-border px-5 py-3 text-xs font-semibold uppercase text-muted-foreground md:grid">
                                <span>Member</span>
                                <span>Role</span>
                                <span>Status</span>
                            </div>
                            <div className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_120px_120px] md:items-center md:gap-4">
                                <div className="flex min-w-0 items-center gap-3">
                                    <Avatar className="h-12 w-12 rounded-xl">
                                        {user?.photoURL && <AvatarImage src={user.photoURL} referrerPolicy="no-referrer" alt="" />}
                                        <AvatarFallback className="rounded-xl">{initials(user?.displayName, user?.email)}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold">{user?.displayName || 'Workspace owner'}</p>
                                        <p className="truncate text-xs text-muted-foreground">{user?.email || 'Signed-in account'}</p>
                                    </div>
                                </div>
                                <Badge variant="outline" className="w-max">Owner</Badge>
                                <Badge variant="success" className="w-max">Active</Badge>
                            </div>
                            {!canInvite && (
                                <div className="border-t border-border bg-muted/30 px-5 py-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-sm text-muted-foreground">
                                            Team seats unlock on Studio and Enterprise plans.
                                        </p>
                                        <Button asChild variant="outline" size="sm">
                                            <Link to="/dashboard/billing">
                                                View plans
                                                <ArrowRight className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Workspace capacity</CardTitle>
                            <CardDescription>Seats and credits available now.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                                    <span>Seats used</span>
                                    <span>{seatsUsed} / {seatLimitLabel}</span>
                                </div>
                                <Progress value={seatPct} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-2xl border border-border bg-muted/35 p-4">
                                    <Users className="mb-3 h-4 w-4 text-primary" />
                                    <p className="text-xs font-semibold uppercase text-muted-foreground">Seats</p>
                                    <p className="mt-1 text-sm font-semibold">{seatLimitLabel}</p>
                                </div>
                                <div className="rounded-2xl border border-border bg-muted/35 p-4">
                                    <Shield className="mb-3 h-4 w-4 text-primary" />
                                    <p className="text-xs font-semibold uppercase text-muted-foreground">Credits</p>
                                    <p className="mt-1 text-sm font-semibold">{creditsRemaining}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                <section className="grid gap-4 lg:grid-cols-3">
                    {roles.map((role) => (
                        <Card key={role.name}>
                            <CardHeader>
                                <CardTitle>{role.name}</CardTitle>
                                <CardDescription>{role.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {role.permissions.map((permission) => (
                                        <li key={permission} className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                            {permission}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    ))}
                </section>

                <Card>
                    <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                        <div>
                            <CardTitle>Need help setting up a team?</CardTitle>
                            <CardDescription className="mt-1">
                                Send workspace details and the roles you want enabled.
                            </CardDescription>
                        </div>
                        <Button asChild variant="outline">
                            <a href="mailto:support@subtitleai.pro?subject=Subtitlepro%20team%20setup">
                                <Mail className="h-4 w-4" />
                                Contact support
                            </a>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
