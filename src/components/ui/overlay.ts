import type { KeyboardEvent } from 'react';
import './overlay.css';

/** Dimmed backdrop shared by Dialog and Sheet. Keyframes live in overlay.css. */
export const overlayClass =
  'fixed inset-0 z-40 bg-overlay ' +
  'data-[state=open]:animate-[overlay-in_200ms_var(--motion-ease)] ' +
  'data-[state=closed]:animate-[overlay-out_150ms_ease-in_forwards]';

/**
 * Keys pressed inside an overlay stay inside it: board shortcuts (`C`, `/`) listen on `window`
 * and must not fire behind a modal. Radix's own Esc handling runs in the capture phase, so it
 * is unaffected.
 */
export function stopOverlayKeys(event: KeyboardEvent<HTMLElement>) {
  event.stopPropagation();
}
