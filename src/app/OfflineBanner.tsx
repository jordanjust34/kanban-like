import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const getOnline = () => navigator.onLine;

/** Thin warning strip shown while the browser reports no connection (DESIGN §7.6). */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, getOnline, () => true);
  return (
    <div role="status" aria-live="polite">
      {!online && (
        <div className="flex min-h-8 items-center justify-center gap-2 border-b border-warning/30 bg-warning-soft px-4 py-1.5 text-center text-meta text-warning-text">
          <WifiOff aria-hidden className="size-3.5 shrink-0" />
          <span>You're offline — changes will fail until you reconnect</span>
        </div>
      )}
    </div>
  );
}
