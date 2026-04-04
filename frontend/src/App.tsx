import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/shared/ProtectedRoute';

import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import OnboardingPage from '@/pages/OnboardingPage';
import DashboardPage from '@/pages/DashboardPage';
import AboutPage from '@/pages/AboutPage';
import PrivacyPage from '@/pages/PrivacyPage';
import TermsPage from '@/pages/TermsPage';
import ChangelogPage from '@/pages/ChangelogPage';
import DocsPage from '@/pages/DocsPage';
import ApiReferencePage from '@/pages/ApiReferencePage';
import StatusPage from '@/pages/StatusPage';
import PaymentSuccessPage from '@/pages/PaymentSuccessPage';

import TranscribePage from '@/pages/dashboard/TranscribePage';
import VideoCaptionPage from '@/pages/dashboard/VideoCaptionPage';
import SubtitleEditorPage from '@/pages/dashboard/SubtitleEditorPage';
import AnalyticsPage from '@/pages/dashboard/AnalyticsPage';
import BillingPage from '@/pages/dashboard/BillingPage';
import TeamPage from '@/pages/dashboard/TeamPage';
import HelpPage from '@/pages/dashboard/HelpPage';
import VideoEditorPage from '@/pages/dashboard/VideoEditorPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* Static Content Pages */}
            <Route path="/about" element={<AboutPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/changelog" element={<ChangelogPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/api-reference" element={<ApiReferencePage />} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/dashboard" element={<DashboardPage />}>
                <Route index element={null} />
                <Route path="transcribe" element={<TranscribePage />} />
                <Route path="translate" element={<VideoCaptionPage />} />
                <Route path="editor" element={<SubtitleEditorPage />} />
                <Route path="video-editor/:projectId" element={<VideoEditorPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="billing" element={<BillingPage />} />
                <Route path="team" element={<TeamPage />} />
                <Route path="help" element={<HelpPage />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
