import { Suspense } from 'react';

import { CheckEmailView } from './check-email-view';

const CheckEmailPage = () => (
  <Suspense fallback={null}>
    <CheckEmailView />
  </Suspense>
);

export default CheckEmailPage;
