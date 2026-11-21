import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** WCAG 2.0 + 2.1, levels A and AA. */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;

/** One readable block per violation: rule, impact, help URL and each failing node. */
export function formatViolations(violations: AxeResults['violations']): string {
  return violations
    .map((v) => {
      const nodes = v.nodes
        .map((n) => {
          const target = n.target.map(String).join(' > ');
          const summary = n.failureSummary?.replace(/\n\s*/g, ' ').trim() ?? '';
          return `    - ${target}\n      ${summary}`;
        })
        .join('\n');
      return `[${v.impact ?? 'unknown'}] ${v.id}: ${v.help}\n  ${v.helpUrl}\n${nodes}`;
    })
    .join('\n\n');
}

/**
 * Runs axe on the current page (or on `include` only) and fails with a readable list of
 * violations. No rules are disabled: add a documented `disableRules` here only for a proven
 * false positive.
 */
export async function expectNoA11yViolations(
  page: Page,
  label: string,
  options: { include?: string } = {},
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  if (options.include) builder = builder.include(options.include);
  const results = await builder.analyze();
  const count = results.violations.length;
  expect(
    count,
    `${count} accessibility violation(s) on "${label}":\n\n${formatViolations(results.violations)}\n`,
  ).toBe(0);
}
