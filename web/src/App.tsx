import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { router } from '@/router';
import { ToastHost } from '@/components/MemeToast';
import { Splash } from '@/screens/Splash';

export function App() {
  const status = useAuth((s) => s.status);
  const bootstrap = useAuth((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (status === 'loading') return <Splash />;

  return (
    <>
      <RouterProvider router={router} />
      <ToastHost />
    </>
  );
}
