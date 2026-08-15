import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { router } from './routes/router';
import { setOnAuthExpired } from './services/api-client';

export function App() {
  const qc = useQueryClient();

  useEffect(() => {
    // When a token refresh fails, drop the cached user so guards redirect to login.
    setOnAuthExpired(() => {
      qc.setQueryData(['auth', 'me'], null);
    });
  }, [qc]);

  return <RouterProvider router={router} />;
}
