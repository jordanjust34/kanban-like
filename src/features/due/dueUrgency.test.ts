import { describe, expect, it } from 'vitest';
import { describeDue, getDueUrgency } from './dueUrgency';

// Friday 20 Nov 2026, mid-afternoon local time: never the real clock.
const TODAY = new Date(2026, 10, 20, 15, 30);

describe('getDueUrgency', () => {
  it('returns null when there is no due date', () => {
    expect(getDueUrgency(null, 'todo', TODAY)).toBeNull();
  });

  it('is danger with the day count when overdue', () => {
    expect(getDueUrgency('2026-11-18', 'todo', TODAY)).toEqual({
      tone: 'danger',
      label: 'Overdue · 2d',
      daysOverdue: 2,
    });
    expect(getDueUrgency('2026-11-19', 'in_review', TODAY)).toMatchObject({
      label: 'Overdue · 1d',
      daysOverdue: 1,
    });
  });

  it('is warning "Today" when due today', () => {
    expect(getDueUrgency('2026-11-20', 'in_progress', TODAY)).toEqual({
      tone: 'warning',
      label: 'Today',
    });
  });

  it('is warning "Tomorrow" when due tomorrow', () => {
    expect(getDueUrgency('2026-11-21', 'todo', TODAY)).toEqual({
      tone: 'warning',
      label: 'Tomorrow',
    });
  });

  it('is warning with the short weekday two days out', () => {
    expect(getDueUrgency('2026-11-22', 'todo', TODAY)).toEqual({ tone: 'warning', label: 'Sun' });
  });

  it('is neutral with month and day later this year', () => {
    expect(getDueUrgency('2026-11-23', 'todo', TODAY)).toEqual({
      tone: 'neutral',
      label: 'Nov 23',
    });
    expect(getDueUrgency('2026-12-31', 'todo', TODAY)).toEqual({
      tone: 'neutral',
      label: 'Dec 31',
    });
  });

  it('adds the year when the date is in another year', () => {
    expect(getDueUrgency('2027-01-15', 'todo', TODAY)).toEqual({
      tone: 'neutral',
      label: 'Jan 15, 2027',
    });
  });

  it('counts calendar days across the year boundary', () => {
    const newYearsEve = new Date(2026, 11, 31, 23, 59);
    expect(getDueUrgency('2027-01-01', 'todo', newYearsEve)).toEqual({
      tone: 'warning',
      label: 'Tomorrow',
    });
    expect(getDueUrgency('2027-01-02', 'todo', newYearsEve)).toEqual({
      tone: 'warning',
      label: 'Sat',
    });
    const newYearsDay = new Date(2027, 0, 1, 0, 1);
    expect(getDueUrgency('2026-12-30', 'todo', newYearsDay)).toEqual({
      tone: 'danger',
      label: 'Overdue · 2d',
      daysOverdue: 2,
    });
  });

  it('parses the date as local, not UTC midnight', () => {
    const lateEvening = new Date(2026, 10, 20, 23, 59);
    const earlyMorning = new Date(2026, 10, 20, 0, 1);
    expect(getDueUrgency('2026-11-20', 'todo', lateEvening)?.label).toBe('Today');
    expect(getDueUrgency('2026-11-20', 'todo', earlyMorning)?.label).toBe('Today');
  });

  it('never marks a done task as overdue', () => {
    expect(getDueUrgency('2026-11-17', 'done', TODAY)).toEqual({ tone: 'done', label: 'Nov 17' });
  });

  it('uses the done tone for done tasks due soon or later too', () => {
    expect(getDueUrgency('2026-11-20', 'done', TODAY)).toEqual({ tone: 'done', label: 'Today' });
    expect(getDueUrgency('2027-03-01', 'done', TODAY)).toEqual({
      tone: 'done',
      label: 'Mar 1, 2027',
    });
  });
});

describe('describeDue', () => {
  it('spells out the full date and the urgency', () => {
    expect(describeDue('2026-11-18', 'todo', TODAY)).toBe(
      'Due Wed, Nov 18, 2026 — overdue by 2 days',
    );
    expect(describeDue('2026-11-19', 'todo', TODAY)).toBe(
      'Due Thu, Nov 19, 2026 — overdue by 1 day',
    );
    expect(describeDue('2026-11-20', 'todo', TODAY)).toBe('Due Fri, Nov 20, 2026 — due today');
    expect(describeDue('2026-11-21', 'todo', TODAY)).toBe('Due Sat, Nov 21, 2026 — due tomorrow');
    expect(describeDue('2026-11-22', 'todo', TODAY)).toBe('Due Sun, Nov 22, 2026 — due in 2 days');
    expect(describeDue('2026-11-28', 'todo', TODAY)).toBe('Due Sat, Nov 28, 2026');
    expect(describeDue('2026-11-17', 'done', TODAY)).toBe('Due Tue, Nov 17, 2026 — completed');
  });

  it('returns null without a date', () => {
    expect(describeDue(null, 'todo', TODAY)).toBeNull();
  });
});
