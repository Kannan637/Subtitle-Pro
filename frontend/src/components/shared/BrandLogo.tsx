import { useAppSettings } from '@/contexts/AppSettingsContext';

type BrandLogoProps = {
    sizeClassName?: string;
    className?: string;
    onDark?: boolean;
    alt?: string;
    variant?: 'mark' | 'wordmark';
};

const LIGHT_WORDMARK_SRC = '/Light%20version%20logo.png';
const DARK_WORDMARK_SRC = '/dark%20version%20logo.png';

export default function BrandLogo({
    sizeClassName = 'w-8 h-8',
    className = '',
    onDark = false,
    alt = 'Subtitlepro',
    variant = 'mark',
}: BrandLogoProps) {
    const { resolvedTheme } = useAppSettings();
    const src = onDark || resolvedTheme === 'dark' ? LIGHT_WORDMARK_SRC : DARK_WORDMARK_SRC;

    return (
        <span
            className={`${sizeClassName} inline-flex shrink-0 items-center overflow-hidden ${className}`.trim()}
            aria-label={alt}
        >
            {variant === 'wordmark' ? (
                <img src={src} alt={alt} className="h-full w-full object-contain object-left" decoding="async" />
            ) : (
                <img
                    src={src}
                    alt={alt}
                    className="h-full w-auto max-w-none object-contain object-left"
                    decoding="async"
                />
            )}
        </span>
    );
}
