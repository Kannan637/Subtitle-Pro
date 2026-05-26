import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppSettingsProvider } from '@/contexts/AppSettingsContext';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/shared/ProtectedRoute';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

const LandingPage = lazy(() => import('@/pages/LandingPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const SignupPage = lazy(() => import('@/pages/SignupPage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const ChangelogPage = lazy(() => import('@/pages/ChangelogPage'));
const DocsPage = lazy(() => import('@/pages/DocsPage'));
const ApiReferencePage = lazy(() => import('@/pages/ApiReferencePage'));
const StatusPage = lazy(() => import('@/pages/StatusPage'));
const PaymentSuccessPage = lazy(() => import('@/pages/PaymentSuccessPage'));

const TranscribePage = lazy(() => import('@/pages/dashboard/TranscribePage'));
const VideoCaptionHomePage = lazy(() => import('@/pages/dashboard/VideoCaptionHomePage'));
const VideoCaptionPage = lazy(() => import('@/pages/dashboard/VideoCaptionPage'));
const SubtitleEditorPage = lazy(() => import('@/pages/dashboard/SubtitleEditorPage'));
const AnalyticsPage = lazy(() => import('@/pages/dashboard/AnalyticsPage'));
const BillingPage = lazy(() => import('@/pages/dashboard/BillingPage'));
const TeamPage = lazy(() => import('@/pages/dashboard/TeamPage'));
const HelpPage = lazy(() => import('@/pages/dashboard/HelpPage'));
const VideoEditorPage = lazy(() => import('@/pages/dashboard/VideoEditorPage'));
const LongToShortsPage = lazy(() => import('@/pages/dashboard/LongToShortsPage'));
const SocialSchedulerPage = lazy(() => import('@/pages/dashboard/SocialSchedulerPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        <p className="text-sm font-semibold text-muted-foreground">Loading</p>
      </div>
    </div>
  );
}

function GuardedPage({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppSettingsProvider>
          <BrowserRouter>
            <AuthProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />

                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/changelog" element={<ChangelogPage />} />
                  <Route path="/docs" element={<DocsPage />} />
                  <Route path="/api-reference" element={<ApiReferencePage />} />
                  <Route path="/status" element={<StatusPage />} />

                  <Route element={<ProtectedRoute />}>
                    <Route
                      path="/onboarding"
                      element={<GuardedPage><OnboardingPage /></GuardedPage>}
                    />
                    <Route
                      path="/dashboard"
                      element={<GuardedPage><DashboardPage /></GuardedPage>}
                    >
                      <Route index element={null} />
                      <Route path="transcribe" element={<GuardedPage><TranscribePage /></GuardedPage>} />
                      <Route path="translate" element={<GuardedPage><VideoCaptionHomePage /></GuardedPage>} />
                      <Route path="long-to-shorts" element={<GuardedPage><LongToShortsPage mode="home" /></GuardedPage>} />
                      <Route path="long-to-shorts/studio" element={<GuardedPage><LongToShortsPage mode="studio" /></GuardedPage>} />
                      <Route path="social-scheduler" element={<GuardedPage><SocialSchedulerPage /></GuardedPage>} />
                      <Route path="caption-editor/:projectId" element={<GuardedPage><VideoCaptionPage /></GuardedPage>} />
                      <Route path="editor" element={<GuardedPage><SubtitleEditorPage /></GuardedPage>} />
                      <Route path="video-editor/:projectId" element={<GuardedPage><VideoEditorPage /></GuardedPage>} />
                      <Route path="analytics" element={<GuardedPage><AnalyticsPage /></GuardedPage>} />
                      <Route path="billing" element={<GuardedPage><BillingPage /></GuardedPage>} />
                      <Route path="team" element={<GuardedPage><TeamPage /></GuardedPage>} />
                      <Route path="help" element={<GuardedPage><HelpPage /></GuardedPage>} />
                      <Route path="payment/success" element={<GuardedPage><PaymentSuccessPage /></GuardedPage>} />
                    </Route>
                  </Route>
                </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </AppSettingsProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
