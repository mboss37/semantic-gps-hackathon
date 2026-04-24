import { redirect } from 'next/navigation';
import { Toaster } from '@/components/ui/sonner';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { OnboardingForm } from './onboarding-form';

// Sprint 15 A.7: onboarding wizard. Gated by `memberships.profile_completed`.
// proxy.ts handles the dashboard-redirect + already-onboarded bounce; this
// page runs a second belt-and-braces check for defence in depth.

export const dynamic = 'force-dynamic';

const OnboardingPage = async () => {
  let ctx;
  try {
    ctx = await requireAuth();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      redirect('/login?next=/onboarding');
    }
    throw e;
  }

  if (ctx.profile_completed) {
    redirect('/dashboard');
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <OnboardingForm defaultEmail={ctx.user.email ?? undefined} />
      <Toaster position="bottom-right" richColors />
    </main>
  );
};

export default OnboardingPage;
