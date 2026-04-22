import { Toaster } from '@/components/ui/sonner';

const AuthLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-screen items-center justify-center bg-muted p-6">
    <div className="w-full max-w-sm">{children}</div>
    <Toaster position="bottom-right" richColors />
  </div>
);

export default AuthLayout;
