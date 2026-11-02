'use client';

import { Suspense } from 'react';
import ClientPage from './ClientPage';

export default function Page() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 40, textAlign: 'center', color: '#a0a0b0' }}>
          Loading API Client...
        </div>
      }
    >
      <ClientPage />
    </Suspense>
  );
}

