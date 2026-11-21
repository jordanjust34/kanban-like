import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest globals are off, so Testing Library can't register its own auto-cleanup.
afterEach(cleanup);

// Unit tests must never reach a real backend (e.g. the hosted Supabase project via .env.local):
// any outbound fetch fails the test loudly instead of silently creating guest users.
globalThis.fetch = (input: RequestInfo | URL) => {
  const url = input instanceof Request ? input.url : String(input);
  return Promise.reject(new Error(`Unit tests must not make network requests (tried ${url})`));
};
