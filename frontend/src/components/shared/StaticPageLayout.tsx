import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import BrandLogo from '@/components/shared/BrandLogo';
import { Button } from '@/components/ui/button';
import type { MouseEvent, ReactNode } from 'react';

const FOOTER_LINKS = {
    Product: [
        { label: 'Tools', href: '/#tools' },
        { label: 'Workflow', href: '/#workflow' },
        { label: 'Studio', href: '/#studio' },
        { label: 'Shorts', href: '/#shorts' },
    ],
    Resources: [
        { label: 'Documentation', href: '/docs' },
        { label: 'Changelog', href: '/changelog' },
        { label: 'Status', href: '/status' },
    ],
    Legal: [
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
        { label: 'Security', href: '/status' },
    ],
};

interface StaticPageLayoutProps {
    children: ReactNode;
    title: string;
    subtitle?: string;
    lastUpdated?: string;
}

export default function StaticPageLayout({ children, title, subtitle, lastUpdated }: StaticPageLayoutProps) {
    const location = useLocation();
    const { user, loading } = useAuth();
    const isAuthenticated = Boolean(user);
    const ctaPath = isAuthenticated ? '/dashboard' : '/login';
    const ctaLabel = loading ? 'Checking' : isAuthenticated ? 'Dashboard' : 'Start creating';

    const handlePendingAuthClick = (event: MouseEvent<HTMLAnchorElement>) => {
        if (loading) event.preventDefault();
    };

    return (
        <div className="apple-page apple-no-shadow">
            <nav className="sticky top-0 z-50 border-b border-border bg-background/78 backdrop-blur-2xl">
                <div className="apple-wide flex h-16 items-center justify-between">
                    <Link to="/" className="flex items-center" aria-label="Subtitlepro home">
                        <BrandLogo variant="wordmark" sizeClassName="h-9 w-[146px]" alt="Subtitlepro" />
                    </Link>

                    <div className="hidden items-center gap-1 lg:flex">
                        {FOOTER_LINKS.Product.map((link) => (
                            <Button key={link.href} variant="ghost" size="sm" asChild>
                                <Link to={link.href}>{link.label}</Link>
                            </Button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        {!loading && !isAuthenticated && (
                            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                                <Link to="/login">Sign in</Link>
                            </Button>
                        )}
                        <Button size="sm" asChild aria-disabled={loading}>
                            <Link to={ctaPath} onClick={handlePendingAuthClick}>
                                {ctaLabel}
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </nav>

            <header className="border-b border-border">
                <div className="apple-wide grid min-h-[420px] content-end gap-8 py-10 sm:py-14 lg:grid-cols-[1fr_360px]">
                    <div>
                        <Button variant="outline" size="sm" asChild className="mb-8">
                            <Link to="/">
                                <ArrowLeft className="h-4 w-4" />
                                Home
                            </Link>
                        </Button>
                        <span className="apple-kicker">
                            <Sparkles className="h-4 w-4 text-primary" />
                            Public product page
                        </span>
                        <h1 className="apple-title mt-5 max-w-[12ch]">{title}</h1>
                        {subtitle && <p className="apple-subtitle mt-6">{subtitle}</p>}
                    </div>

                    <aside className="apple-material overflow-hidden rounded-[1.5rem] self-end">
                        {[
                            ['Scope', 'Subtitlepro public layer'],
                            ['Access', isAuthenticated ? 'Signed in' : 'Public visitor'],
                            ['Updated', lastUpdated || 'Current revision'],
                        ].map(([label, value]) => (
                            <div key={label} className="apple-list-row grid grid-cols-[96px_1fr] items-center">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                                <p className="text-sm font-semibold">{value}</p>
                            </div>
                        ))}
                    </aside>
                </div>
            </header>

            <main className="apple-wide grid gap-8 py-10 lg:grid-cols-[280px_1fr] lg:py-14">
                <aside className="lg:sticky lg:top-24 lg:self-start">
                    <div className="apple-material overflow-hidden rounded-[1.5rem]">
                        {FOOTER_LINKS.Legal.map((link) => {
                            const active = location.pathname === link.href;
                            return (
                                <Link
                                    key={link.href}
                                    to={link.href}
                                    className={`apple-list-row flex items-center justify-between text-sm font-semibold ${
                                        active ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
                                    }`}
                                >
                                    {link.label}
                                    {active ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                                </Link>
                            );
                        })}
                    </div>
                    <div className="apple-grouped mt-5 p-5">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        <p className="mt-3 text-sm font-semibold">Dashboard data, media, exports, and billing require a verified secure session.</p>
                    </div>
                </aside>

                <section className="min-w-0">
                    <div className="apple-material rounded-[1.5rem] p-5 sm:p-8">
                        {children}
                    </div>
                </section>
            </main>

            <footer className="border-t border-border py-8">
                <div className="apple-wide grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-start">
                    <div>
                        <Link to="/" className="flex w-max items-center" aria-label="Subtitlepro home">
                            <BrandLogo variant="wordmark" sizeClassName="h-8 w-[130px]" alt="Subtitlepro" />
                        </Link>
                        <p className="mt-4 max-w-md text-sm font-medium leading-6 text-muted-foreground">
                            Public pages designed around clarity, trust, accessibility, and production-grade AI video workflows.
                        </p>
                    </div>
                    <div className="grid gap-6 sm:grid-cols-3">
                        {Object.entries(FOOTER_LINKS).map(([category, links]) => (
                            <div key={category}>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</p>
                                <div className="mt-3 grid gap-2 text-sm font-medium">
                                    {links.map((link) => (
                                        <Link key={link.href} to={link.href} className="text-muted-foreground hover:text-foreground">
                                            {link.label}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </footer>
        </div>
    );
}
