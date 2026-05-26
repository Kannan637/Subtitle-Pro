import { Link } from 'react-router-dom';
import { MonitorUp, ArrowLeft } from 'lucide-react';
import BrandLogo from '@/components/shared/BrandLogo';

export default function DesktopOnlyNotice() {
    return (
        <main className="min-h-screen bg-background px-4 py-6 text-foreground">
            <div className="flex items-center justify-between border-b border-border pb-4">
                <Link to="/" className="flex items-center" aria-label="Subtitlepro home">
                    <BrandLogo variant="wordmark" sizeClassName="h-9 w-[146px]" alt="Subtitlepro" />
                </Link>
                <span className="text-xs font-black uppercase text-primary">Desktop only</span>
            </div>

            <section className="grid min-h-[calc(100vh-96px)] content-center gap-8">
                <div>
                    <div className="mb-5 flex h-12 w-12 items-center justify-center bg-foreground text-background">
                        <MonitorUp className="h-6 w-6" />
                    </div>
                    <p className="text-xs font-black uppercase text-primary">Mobile access notice</p>
                    <h1 className="mt-5 font-['Barlow_Condensed'] text-5xl font-black uppercase leading-[0.9] tracking-normal">
                        Open this studio on desktop.
                    </h1>
                    <p className="mt-5 text-base font-semibold leading-relaxed text-muted-foreground">
                        Subtitlepro dashboard, editor, timeline, and export tools are currently not available in a perfect mobile view. Kindly open this workspace on a desktop or laptop for the full production experience.
                    </p>
                </div>

                <div className="border-y border-border">
                    {[
                        ['Available on mobile', 'Landing page, product information, pricing'],
                        ['Desktop required', 'Dashboard, caption editor, timeline, AI tools, exports'],
                    ].map(([label, copy]) => (
                        <div key={label} className="border-b border-border py-4 last:border-b-0">
                            <p className="text-sm font-black uppercase">{label}</p>
                            <p className="mt-1 text-sm font-semibold text-muted-foreground">{copy}</p>
                        </div>
                    ))}
                </div>

                <Link
                    to="/"
                    className="inline-flex w-full items-center justify-center gap-2 bg-foreground px-5 py-4 text-sm font-black uppercase text-background"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to landing page
                </Link>
            </section>
        </main>
    );
}
