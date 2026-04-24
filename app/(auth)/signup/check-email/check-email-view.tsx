'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MailIcon, RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

const RESEND_COOLDOWN_SECONDS = 60;

export const CheckEmailView = () => {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!email) {
      router.replace('/signup');
    }
  }, [email, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearInterval(t);
  }, [cooldown]);

  const onResend = async () => {
    if (cooldown > 0 || pending || !email) return;
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Verification email resent');
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  if (!email) return null;

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div
          className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card"
          aria-hidden
        >
          <MailIcon className="h-5 w-5 text-foreground/70" />
        </div>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          We sent a verification link to{' '}
          <span className="font-medium text-foreground">{email}</span>. Click the link to activate
          your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-md border border-border bg-card/40 p-4 text-sm leading-relaxed text-foreground/70">
          <p className="mb-1 font-medium text-foreground">Didn&apos;t get the email?</p>
          <p>Check your spam folder — delivery can take a minute or land there.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onResend}
          disabled={pending || cooldown > 0}
        >
          <RefreshCwIcon className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
          {cooldown > 0
            ? `Resend available in ${cooldown}s`
            : pending
              ? 'Resending…'
              : 'Resend verification email'}
        </Button>
        <div className="space-y-1 text-center text-sm text-muted-foreground">
          <p>
            Wrong email?{' '}
            <Link href="/signup" className="font-medium text-foreground hover:underline">
              Sign up again
            </Link>
          </p>
          <p>
            Already verified?{' '}
            <Link href="/login" className="font-medium text-foreground hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
