import { BookOpen, ExternalLink, HelpCircle, Mail, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const faqs = [
    ['Supported formats', 'MP4, MOV, MKV, AVI, WebM, MP3, WAV, FLAC, and common browser-safe media formats.'],
    ['Credits', 'Credits are shared across subtitles, captions, shorts, b-roll, music, SFX, reframing, and exports.'],
    ['Exports', 'Subtitle workflows export SRT, VTT, text, and JSON. Caption and shorts workflows render MP4.'],
    ['Teams', 'Team collaboration is planned around Studio and Enterprise workspaces.'],
];

const quickLinks = [
    { icon: BookOpen, label: 'Documentation', href: '/docs' },
    { icon: MessageSquare, label: 'Product support', href: 'mailto:support@subtitleai.pro' },
    { icon: Mail, label: 'Billing help', href: 'mailto:support@subtitleai.pro?subject=Subtitlepro%20billing%20help' },
];

export default function HelpPage() {
    return (
        <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6 lg:p-8">
            <Card>
                <CardContent className="p-5 sm:p-6">
                    <Badge variant="secondary" className="mb-3">
                        <HelpCircle className="h-3.5 w-3.5" />
                        Help
                    </Badge>
                    <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Support</h1>
                    <p className="mt-2 max-w-xl text-sm font-medium text-muted-foreground">
                        Quick routes for product, billing, and workspace questions.
                    </p>
                </CardContent>
            </Card>

            <section className="grid gap-3 sm:grid-cols-3">
                {quickLinks.map((link) => (
                    <Card key={link.label} className="transition-colors hover:border-primary/35">
                        <CardContent className="flex items-center gap-3 p-4">
                            <span className="apple-icon-cell">
                                <link.icon className="h-5 w-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{link.label}</p>
                                <Button asChild variant="link" className="h-auto p-0 text-xs">
                                    <a href={link.href}>
                                        Open
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </section>

            <Card>
                <CardHeader>
                    <CardTitle>FAQ</CardTitle>
                    <CardDescription>Short answers for common workspace questions.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {faqs.map(([question, answer], index) => (
                        <div key={question}>
                            <details className="group">
                                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-sm font-semibold hover:bg-muted/60">
                                    {question}
                                    <span className="text-muted-foreground transition-transform group-open:rotate-180">⌄</span>
                                </summary>
                                <p className="px-5 pb-4 text-sm leading-6 text-muted-foreground">{answer}</p>
                            </details>
                            {index < faqs.length - 1 && <Separator />}
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
