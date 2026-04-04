import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const FOOTER_LINKS = {
    Product: [
        { label: 'Features', href: '/#features' },
        { label: 'Pricing', href: '/#pricing' },
        { label: 'Changelog', href: '/changelog' },
    ],
    Resources: [
        { label: 'Documentation', href: '/docs' },
        { label: 'API Reference', href: '/api-reference' },
        { label: 'Status', href: '/status' },
    ],
    Company: [
        { label: 'About', href: '/about' },
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
    ],
};

interface StaticPageLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
    lastUpdated?: string;
}

export default function StaticPageLayout({ children, title, subtitle, lastUpdated }: StaticPageLayoutProps) {
    const location = useLocation();
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-[var(--color-surface)] flex flex-col font-sans">
            {/* Navbar */}
            <nav className="sticky top-0 z-50 bg-[var(--color-surface)]/80 backdrop-blur-xl border-b border-[var(--color-gray-200)]/60">
                <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
                    <Link to="/" className="flex items-center gap-2.5 group">
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] text-white flex items-center justify-center font-serif italic text-base shadow-sm transition-transform group-hover:scale-105">
                            S
                        </div>
                        <span className="font-serif font-medium text-lg tracking-tight text-[var(--color-gray-900)] hidden sm:inline">
                            SubtitleAI Pro
                        </span>
                    </Link>

                    <div className="flex items-center gap-3">
                        {user ? (
                            <>
                                {user.photoURL && (
                                    <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full border border-[var(--color-gray-200)]" referrerPolicy="no-referrer" />
                                )}
                                <Link to="/dashboard" className="claude-button-primary px-5 py-2 rounded-lg text-sm">
                                    Dashboard
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="text-sm font-medium text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)] transition-colors px-3 py-2">
                                    Sign in
                                </Link>
                                <Link to="/login" className="claude-button-primary px-5 py-2 rounded-lg text-sm">
                                    Start for free
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* Page Header */}
            <header className="border-b border-[var(--color-gray-200)] bg-white">
                <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-gray-500)] hover:text-[var(--color-gray-900)] transition-colors mb-6 group"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
                        Back to home
                    </Link>
                    <h1 className="text-3xl md:text-4xl font-serif text-[var(--color-gray-900)] tracking-tight mb-3">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="text-lg text-[var(--color-gray-500)] max-w-2xl">{subtitle}</p>
                    )}
                    {lastUpdated && (
                        <p className="mt-4 text-sm text-[var(--color-gray-400)]">Last updated: {lastUpdated}</p>
                    )}
                </div>
            </header>

            {/* Content */}
            <main className="flex-1">
                <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
                    <div className="prose-content">
                        {children}
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-12 px-6 border-t border-[var(--color-gray-200)] bg-white">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-col md:flex-row items-start justify-between gap-10">
                        <div className="max-w-xs">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="w-6 h-6 rounded bg-[var(--color-primary)] text-white flex items-center justify-center font-serif italic text-xs">S</div>
                                <span className="font-serif font-medium text-[var(--color-gray-900)]">SubtitleAI Pro</span>
                            </div>
                            <p className="text-sm text-[var(--color-gray-500)] leading-relaxed">
                                AI-powered subtitles and translations for professionals worldwide.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-x-14 gap-y-6 text-sm">
                            {Object.entries(FOOTER_LINKS).map(([category, links]) => (
                                <div key={category} className="flex flex-col gap-2.5">
                                    <span className="text-xs font-semibold text-[var(--color-gray-500)] uppercase tracking-wider">{category}</span>
                                    {links.map((link) => (
                                        <Link
                                            key={link.href}
                                            to={link.href}
                                            className={`hover:text-[var(--color-gray-900)] transition-colors ${location.pathname === link.href
                                                ? 'text-[var(--color-primary)] font-medium'
                                                : 'text-[var(--color-gray-600)]'
                                                }`}
                                        >
                                            {link.label}
                                        </Link>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="mt-10 pt-6 border-t border-[var(--color-gray-200)] text-xs text-[var(--color-gray-400)]">
                        © 2025 SubtitleAI Pro. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    );
}
