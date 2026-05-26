import React, { Component } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * FE-03: React Error Boundary — catches runtime errors in the component tree
 * and renders a user-friendly fallback instead of a blank white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Log to console (replace with Sentry in production)
        console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)] p-6">
                    <div className="max-w-md w-full text-center">
                        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                        <h1 className="text-2xl font-serif font-medium text-[var(--color-gray-900)] mb-3">
                            Something went wrong
                        </h1>
                        <p className="text-sm text-[var(--color-gray-500)] mb-6">
                            An unexpected error occurred. Your work has been saved.
                        </p>
                        {this.state.error && (
                            <details className="text-left mb-6 p-4 bg-[var(--color-surface-secondary)] rounded-xl text-xs text-[var(--color-gray-500)] font-mono">
                                <summary className="cursor-pointer font-sans font-medium text-[var(--color-gray-700)] mb-2">
                                    Error details
                                </summary>
                                {this.state.error.message}
                            </details>
                        )}
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReset}
                                className="px-5 py-2.5 text-sm font-medium bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-dark)] transition-colors flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Try again
                            </button>
                            <button
                                onClick={() => (window.location.href = '/dashboard')}
                                className="px-5 py-2.5 text-sm font-medium text-[var(--color-gray-700)] bg-[var(--color-surface-secondary)] rounded-xl hover:bg-[var(--color-gray-200)] transition-colors"
                            >
                                Go to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
