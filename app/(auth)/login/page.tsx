import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from './login-form';

const LoginPage = () => (
  <Card>
    <CardHeader>
      <CardTitle>Sign in</CardTitle>
      <CardDescription>Enter your email and password to continue.</CardDescription>
    </CardHeader>
    <CardContent>
      <Suspense fallback={<div className="h-48" aria-hidden />}>
        <LoginForm />
      </Suspense>
    </CardContent>
  </Card>
);

export default LoginPage;
