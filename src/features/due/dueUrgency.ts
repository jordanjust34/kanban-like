/**
 * Due-date urgency (DESIGN §7.3). Pure: callers pass `today`, so tests never touch the clock.
 *
 * `due_date` is a Postgres `date` ("YYYY-MM-DD"). `parseISO` reads it as LOCAL midnight
 * (`new Date('2026-11-20')` would be UTC midnight, i.e. the previous day west of UTC), and
 * `differenceInCalendarDays` compares calendar days, ignoring the time of day in `today`.
 */
import { differenceInCalendarDays, format, isSameYear, isValid, parseISO } from 'date-fns';
import type { Status } from '@/lib/domain';

export type DueTone = 'danger' | 'warning' | 'neutral' | 'done';

export type DueUrgency = {
  tone: DueTone;
  /** Short badge text: "Overdue · 2d", "Today", "Tomorrow", "Tue", "Nov 28", "Jan 5, 2027". */
  label: string;
  /** Only set when tone is `danger`. */
  daysOverdue?: number;
};

/** Parses "YYYY-MM-DD" as a local calendar date; null when absent or malformed. */
function parseDueDate(dueDate: string | null): Date | null {
  if (!dueDate) return null;
  const date = parseISO(dueDate);
  return isValid(date) ? date : null;
}

/** "Nov 28", or "Jan 5, 2027" outside the current year. */
function calendarLabel(due: Date, today: Date): string {
  return format(due, isSameYear(due, today) ? 'MMM d' : 'MMM d, yyyy');
}

/** Relative wording for the next two days, the calendar date otherwise. */
function upcomingLabel(due: Date, diff: number, today: Date): string {
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === 2) return format(due, 'EEE');
  return calendarLabel(due, today);
}

export function getDueUrgency(
  dueDate: string | null,
  status: Status,
  today: Date,
): DueUrgency | null {
  const due = parseDueDate(dueDate);
  if (!due) return null;
  const diff = differenceInCalendarDays(due, today);

  if (status === 'done') {
    // Done never reads as overdue: past dates show the plain date, not "Overdue".
    const label = diff < 0 ? calendarLabel(due, today) : upcomingLabel(due, diff, today);
    return { tone: 'done', label };
  }
  if (diff < 0) return { tone: 'danger', label: `Overdue · ${-diff}d`, daysOverdue: -diff };
  return { tone: diff <= 2 ? 'warning' : 'neutral', label: upcomingLabel(due, diff, today) };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Full accessible description, e.g. "Due Fri, Nov 28, 2026 — overdue by 2 days". */
export function describeDue(dueDate: string | null, status: Status, today: Date): string | null {
  const due = parseDueDate(dueDate);
  if (!due) return null;
  const full = `Due ${format(due, 'EEE, MMM d, yyyy')}`;
  if (status === 'done') return `${full} — completed`;
  const diff = differenceInCalendarDays(due, today);
  if (diff < 0) return `${full} — overdue by ${plural(-diff, 'day')}`;
  if (diff === 0) return `${full} — due today`;
  if (diff === 1) return `${full} — due tomorrow`;
  if (diff === 2) return `${full} — due in 2 days`;
  return full;
}
