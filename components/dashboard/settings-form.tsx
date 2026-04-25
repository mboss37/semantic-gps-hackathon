'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { updateSettings, type SettingsInput } from '@/app/dashboard/settings/actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Sprint 22 WP-22.5: settings form. Controlled inputs hydrate from server-
// fetched initial values; submit calls the server action and refreshes the
// RSC tree on success so SiteHeader / NavUser pick up the new name.

type Props = {
  initial: SettingsInput;
  email: string;
};

export const SettingsForm = ({ initial, email }: Props) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<SettingsInput>(initial);
  const [issues, setIssues] = useState<Record<string, string>>({});

  const setField = (field: keyof SettingsInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: e.target.value }));
    if (issues[field]) {
      setIssues((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateSettings(values);
      if (result.ok) {
        toast.success('Settings saved');
        setIssues({});
        router.refresh();
        return;
      }
      if (result.error === 'invalid_input') {
        setIssues(result.issues);
        toast.error('Fix the highlighted fields');
        return;
      }
      if (result.error === 'unauthorized') {
        toast.error('Session expired — please sign in again');
        router.push('/login?next=/dashboard/settings');
        return;
      }
      toast.error(`Save failed: ${result.detail}`);
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How your name appears across the dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="first_name">First name</Label>
            <Input
              id="first_name"
              value={values.first_name}
              onChange={setField('first_name')}
              autoComplete="given-name"
              required
              maxLength={80}
            />
            {issues.first_name && (
              <p className="text-xs text-destructive">{issues.first_name}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="last_name">Last name</Label>
            <Input
              id="last_name"
              value={values.last_name}
              onChange={setField('last_name')}
              autoComplete="family-name"
              required
              maxLength={80}
            />
            {issues.last_name && (
              <p className="text-xs text-destructive">{issues.last_name}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} disabled readOnly />
            <p className="text-xs text-muted-foreground">Email change ships in V2.</p>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={values.company}
              onChange={setField('company')}
              autoComplete="organization"
              required
              maxLength={120}
            />
            {issues.company && <p className="text-xs text-destructive">{issues.company}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>The organization name shown in the dashboard header.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org_name">Workspace name</Label>
            <Input
              id="org_name"
              value={values.org_name}
              onChange={setField('org_name')}
              required
              maxLength={120}
            />
            {issues.org_name && <p className="text-xs text-destructive">{issues.org_name}</p>}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
};
