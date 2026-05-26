import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';
import DesktopOnlyNotice from '@/components/shared/DesktopOnlyNotice';

export default function ProtectedRoute() {
    const { user, loading } = useAuth();
    const location = useLocation();
    const isMobile = useIsMobileViewport();

    if (isMobile) {
        return <DesktopOnlyNotice />;
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[var(--color-surface)]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-[3px] border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--color-gray-500)] text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
}

