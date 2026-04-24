import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({ children, requireOnboarded = true }: { children: React.ReactNode; requireOnboarded?: boolean }) {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: pl } = useProfile();
  const loc = useLocation();

  if (loading || (user && pl)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace state={{ from: loc }} />;
  if (requireOnboarded && profile && !profile.onboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}
