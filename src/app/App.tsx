import { Board } from '@/features/board/Board';
import { RealtimeSync } from '@/features/realtime/RealtimeSync';
import { TaskSheetHost } from '@/features/tasks/TaskSheetHost';
import { ErrorState } from '@/components/ui';
import { useSession } from './auth';
import { BoardSkeleton } from './BoardSkeleton';
import { Header } from './Header';
import { OfflineBanner } from './OfflineBanner';

/** Board area gated on the guest session: skeleton → board, or a retryable error. */
function SessionGate() {
  const session = useSession();
  switch (session.status) {
    case 'loading':
      return <BoardSkeleton />;
    case 'error':
      return (
        <div className="flex h-full items-center justify-center p-6">
          <ErrorState
            title="Couldn't start your session"
            reason={session.error.message || 'Something went wrong while signing you in.'}
            onRetry={session.retry}
          />
        </div>
      );
    case 'ready': {
      const userId = session.session.user?.id;
      return (
        <>
          {userId && <RealtimeSync userId={userId} />}
          <Board />
        </>
      );
    }
  }
}

/** App shell (DESIGN §7.1). The header renders immediately, whatever the session state. */
export function App() {
  return (
    <div className="flex h-dvh flex-col bg-app text-primary">
      <OfflineBanner />
      <Header />
      <main className="min-h-0 flex-1">
        <SessionGate />
      </main>
      <TaskSheetHost />
    </div>
  );
}
