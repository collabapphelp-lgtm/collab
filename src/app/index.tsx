import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';

// Every launch and every auth change lands here first, then goes to the right place.
export default function Gate() {
  const { user, profile, signupInProgress } = useAuth();
  if (!user || signupInProgress) return <Redirect href="/welcome" />;
  if (!profile?.onboardingComplete) return <Redirect href="/onboarding" />;
  return <Redirect href="/discover" />;
}
