import { useState, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { swatchColors } from '@/lib/swatch';
import { initials, joinNames, type Member } from './model';

export type AvatarSize = 20 | 24;

const sizeClass: Record<AvatarSize, string> = {
  20: 'size-5 text-[8.5px]',
  24: 'size-6 text-[10px]',
};

type AvatarMember = Pick<Member, 'name' | 'color' | 'avatar_url'>;

function safeColors(color: string) {
  try {
    return swatchColors(color);
  } catch {
    return swatchColors('#8B8D98');
  }
}

/**
 * Round member avatar: the image when `avatar_url` loads, otherwise 1–2 initials on the
 * member's tint (AA text via `swatchColors`). Decorative (`aria-hidden`): callers announce
 * names in text. The `title` shows the name on hover.
 */
export function Avatar({
  member,
  size = 20,
  className,
  style,
}: {
  member: AvatarMember;
  size?: AvatarSize;
  className?: string;
  style?: CSSProperties;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = member.avatar_url && member.avatar_url !== failedUrl ? member.avatar_url : null;
  const colors = safeColors(member.color);

  return (
    <span
      aria-hidden
      title={member.name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full leading-none font-semibold tracking-[-0.02em] select-none',
        sizeClass[size],
        className,
      )}
      style={{ ...style, backgroundColor: colors.background, color: colors.text }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setFailedUrl(url)}
          className="size-full object-cover"
        />
      ) : (
        initials(member.name)
      )}
    </span>
  );
}

export type AvatarStackProps = {
  members: (AvatarMember & Pick<Member, 'id'>)[];
  size?: AvatarSize;
  /** Avatars shown before the "+N" chip. */
  max?: number;
  /**
   * Start of the screen-reader sentence, e.g. "Assigned to" → "Assigned to A, B and C".
   * `null` omits the sentence (the caller already names the members in visible text).
   */
  srPrefix?: string | null;
  className?: string;
};

/**
 * Overlapping avatars (max `max`, then "+N"). Non-interactive, so it is safe inside the card's
 * draggable `role="button"`. Screen readers get one short sentence; sighted users get titles.
 */
export function AvatarStack({
  members,
  size = 20,
  max = 3,
  srPrefix = 'Assigned to',
  className,
}: AvatarStackProps) {
  if (members.length === 0) return null;
  const visible = members.slice(0, max);
  const hidden = members.slice(max);
  const srNames =
    hidden.length > 0
      ? `${visible.map((m) => m.name).join(', ')} and ${hidden.length} more`
      : joinNames(members.map((m) => m.name));

  return (
    <span className={cn('inline-flex items-center', className)}>
      <span aria-hidden className="flex items-center -space-x-1">
        {visible.map((member, i) => (
          // Earlier avatars sit on top, so overlap hides the next avatar's left edge rather than
          // clipping the right half of this one's initials.
          <Avatar
            key={member.id}
            member={member}
            size={size}
            className="relative ring-2 ring-card"
            style={{ zIndex: visible.length - i }}
          />
        ))}
        {hidden.length > 0 && (
          <span
            title={hidden.map((m) => m.name).join(', ')}
            className={cn(
              'inline-flex shrink-0 items-center justify-center rounded-full bg-column px-1 font-semibold text-secondary tabular-nums ring-2 ring-card',
              size === 20 ? 'h-5 min-w-5 text-[10px]' : 'h-6 min-w-6 text-[11px]',
            )}
          >
            +{hidden.length}
          </span>
        )}
      </span>
      {srPrefix !== null && (
        <span className="sr-only">
          {srPrefix} {srNames}
        </span>
      )}
    </span>
  );
}
