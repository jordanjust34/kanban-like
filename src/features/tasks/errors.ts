import { toast } from 'sonner';

/** Short, human reason for a failed request (FR-S3: "toast with the reason"). */
export function describeError(error: unknown): string {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : String(error ?? '');
  if (offline || /failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return 'Check your connection and try again.';
  }
  return message || 'Something went wrong. Please try again.';
}

/** Error toast with the reason and a Retry action. */
export function showErrorToast(title: string, error: unknown, retry?: () => void): void {
  toast.error(title, {
    description: describeError(error),
    action: retry ? { label: 'Retry', onClick: retry } : undefined,
    duration: 8000,
  });
}
