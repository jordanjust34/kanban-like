/** App mark: an indigo tile with three "columns" of different heights. Decorative. */
export function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden className="shrink-0">
      <rect width="24" height="24" rx="6" fill="var(--accent)" />
      <rect x="5.5" y="6" width="3.5" height="12" rx="1.25" fill="#fff" />
      <rect x="10.25" y="6" width="3.5" height="8" rx="1.25" fill="#fff" fillOpacity="0.8" />
      <rect x="15" y="6" width="3.5" height="5" rx="1.25" fill="#fff" fillOpacity="0.6" />
    </svg>
  );
}
