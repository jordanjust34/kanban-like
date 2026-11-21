import { addDays, isSameDay, startOfDay } from 'date-fns';
import { useSyncExternalStore } from 'react';

/**
 * Today's local date (at 00:00), shared by every badge. One timer fires just after local
 * midnight, so badges flip ("Tomorrow" → "Today" → "Overdue") without a reload. Also re-checks
 * when the tab becomes visible again: timers can be throttled or paused while a laptop sleeps.
 */
let today = startOfDay(new Date());
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

/** Updates `today` if the calendar day changed; returns whether it did. */
function refresh(): boolean {
  const now = new Date();
  if (isSameDay(now, today)) return false;
  today = startOfDay(now);
  return true;
}

function check() {
  if (refresh()) for (const listener of listeners) listener();
}

function schedule() {
  clearTimeout(timer);
  const nextMidnight = addDays(startOfDay(new Date()), 1);
  // +50 ms so the timer never lands a hair before midnight and reschedules for the same day.
  timer = setTimeout(
    () => {
      check();
      schedule();
    },
    nextMidnight.getTime() - Date.now() + 50,
  );
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    check();
    schedule();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    schedule();
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearTimeout(timer);
      timer = undefined;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  };
}

function getSnapshot() {
  // Catches a day change that happened while nothing was subscribed. Stable within a day.
  refresh();
  return today;
}

export function useToday(): Date {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
