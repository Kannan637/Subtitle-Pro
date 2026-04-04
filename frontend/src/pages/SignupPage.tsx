import { Navigate } from 'react-router-dom';

// With Google-only auth, there's no separate signup flow.
// Redirect /signup to /login — Google sign-in handles both.
export default function SignupPage() {
    return <Navigate to="/login" replace />;
}
