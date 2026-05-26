import { useEffect, useState } from 'react';

export function useIsMobileViewport(maxWidth = 767) {
    const query = `(max-width: ${maxWidth}px)`;
    const getMatches = () => (typeof window === 'undefined' ? false : window.matchMedia(query).matches);
    const [isMobile, setIsMobile] = useState(getMatches);

    useEffect(() => {
        const mediaQuery = window.matchMedia(query);
        const onChange = () => setIsMobile(mediaQuery.matches);

        onChange();
        mediaQuery.addEventListener('change', onChange);
        return () => mediaQuery.removeEventListener('change', onChange);
    }, [query]);

    return isMobile;
}
