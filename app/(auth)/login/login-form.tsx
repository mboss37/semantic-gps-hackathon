'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';

const isSafeNext = (value: string | null): value is string =>
  value !== null && /^\/[^/\\]/.test(value);

// Sprint 18.3 / from Sprint 16 backlog: render `?error=...` params that the
// auth callback redirects here with on PKCE failure. Silent failure = users
// staring at the login page wondering why verification didn't land them on
// the dashboard.
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  missing_code: 'Verification link is missing the code parameter. Request a new verification email.',
  exchange_failed:
    'Verification link is invalid or expired. Request a new verification email.',
};

export const LoginForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const code = searchParams.get('error');
    if (!code) return;
    const message = AUTH_ERROR_MESSAGES[code] ?? `Sign-in error: ${code}`;
    toast.error(message);
  }, [searchParams]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const raw = searchParams.get('next');
    const next = isSafeNext(raw) ? raw : '/dashboard';
    router.push(next);
    router.refresh();
  };

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        No account?{' '}
        <Link href="/signup" className="font-medium text-foreground hover:underline">
          Create one
        </Link>
      </p>
    </>
  );
};
