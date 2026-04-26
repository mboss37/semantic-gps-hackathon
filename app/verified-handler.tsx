'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

import { Toaster } from '@/components/ui/sonner';

export const VerifiedHandler = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get('verified') === 'true';

  useEffect(() => {
    if (!verified) return;

    toast.success('Email verified, welcome to Semantic GPS');
    const timeout = setTimeout(() => {
      router.replace('/dashboard');
    }, 2000);

    return () => clearTimeout(timeout);
  }, [verified, router]);

  if (!verified) return null;

  return <Toaster position="bottom-right" richColors />;
};
