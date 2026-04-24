'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { completeOnboarding, type OnboardingInput } from './actions';

// Sprint 15 A.7: 4-field onboarding capture. Feeds `organizations.name`,
// `memberships.profile_completed`, `auth.users.raw_user_meta_data`.
// Zod validation happens server-side in the action; client only checks
// required-field presence before firing to save a round-trip on obvious gaps.

type Props = {
  defaultEmail?: string;
};

export const OnboardingForm = ({ defaultEmail }: Props) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const input: OnboardingInput = {
      first_name: String(form.get('first_name') ?? ''),
      last_name: String(form.get('last_name') ?? ''),
      company: String(form.get('company') ?? ''),
      org_name: String(form.get('org_name') ?? ''),
    };

    startTransition(async () => {
      setFieldErrors({});
      const result = await completeOnboarding(input);
      if (result.ok) {
        toast.success('Welcome aboard');
        router.push('/dashboard');
        router.refresh();
        return;
      }
      if (result.error === 'invalid_input') {
        setFieldErrors(result.issues);
        return;
      }
      if (result.error === 'already_completed') {
        router.replace('/dashboard');
        return;
      }
      if (result.error === 'unauthorized') {
        router.replace('/login?next=/onboarding');
        return;
      }
      toast.error(`Couldn't save: ${result.detail}`);
    });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Finish setting up your workspace</CardTitle>
        <CardDescription>
          {defaultEmail ? `Signed in as ${defaultEmail}. ` : ''}A few quick details so the dashboard knows who you are.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="first_name">First name</Label>
              <Input id="first_name" name="first_name" autoComplete="given-name" required />
              {fieldErrors.first_name ? (
                <span className="text-xs text-destructive">{fieldErrors.first_name}</span>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="last_name">Last name</Label>
              <Input id="last_name" name="last_name" autoComplete="family-name" required />
              {fieldErrors.last_name ? (
                <span className="text-xs text-destructive">{fieldErrors.last_name}</span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company">Company</Label>
            <Input id="company" name="company" autoComplete="organization" required />
            {fieldErrors.company ? (
              <span className="text-xs text-destructive">{fieldErrors.company}</span>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org_name">Workspace name</Label>
            <Input id="org_name" name="org_name" placeholder="Acme Platform" required />
            <span className="text-xs text-muted-foreground">
              Shown across the dashboard. You can change it later in Settings.
            </span>
            {fieldErrors.org_name ? (
              <span className="text-xs text-destructive">{fieldErrors.org_name}</span>
            ) : null}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Saving…' : 'Continue to dashboard'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};
