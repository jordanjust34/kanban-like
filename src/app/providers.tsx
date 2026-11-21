import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useMediaQuery } from './useMediaQuery';

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 30_000 },
      mutations: { retry: 0 },
    },
  });
}

/** Toasts: bottom-right on desktop, bottom-center on phones. Styled in styles/toast.css. */
function AppToaster() {
  const isMobile = useMediaQuery('(max-width: 639.98px)');
  return (
    <Toaster
      position={isMobile ? 'bottom-center' : 'bottom-right'}
      theme="light"
      richColors={false}
      closeButton={false}
      gap={8}
      offset={16}
      mobileOffset={12}
      visibleToasts={3}
    />
  );
}

export function Providers({ children }: { children: ReactNode }) {
  // One client per app mount (tests mount fresh providers each time).
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <AppToaster />
    </QueryClientProvider>
  );
}
