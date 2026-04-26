import Link from 'next/link';

import { BrandMark } from '@/components/brand-mark';
import { Toaster } from '@/components/ui/sonner';

const AuthLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
    <Link
      href="/"
      className="mb-8 inline-flex items-center gap-2 text-foreground/80 transition-colors hover:text-foreground"
    >
      <BrandMark className="size-6" />
      <span className="text-[15px] font-semibold tracking-[-0.01em]">Semantic GPS</span>
    </Link>
    <div className="w-full max-w-sm">{children}</div>
    <Toaster position="bottom-right" richColors />
  </div>
);

export default AuthLayout;
