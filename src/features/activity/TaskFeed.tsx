import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import {
  AlertTriangle,
  ArrowRight,
  CirclePlus,
  Pencil,
  RotateCw,
  Tag,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Skeleton } from '@/components/ui';
import { isTempId } from '@/features/tasks/taskList';
import { cn } from '@/lib/cn';
import {
  useActivity,
  useAddComment,
  useComments,
  useDeleteComment,
  useRefreshActivityOnChange,
} from './api';
import { CommentComposer } from './CommentComposer';
import {
  buildFeed,
  describeActivity,
  type ActivityEntry,
  type Comment,
  type FeedItem,
  type TextPart,
} from './model';

function relative(iso: string): string {
  const date = parseISO(iso);
  if (Date.now() - date.getTime() < 60_000) return 'just now';
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

function Time({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={format(parseISO(iso), "MMM d, yyyy 'at' h:mm a")}>
      {relative(iso)}
    </time>
  );
}

const ICONS: Record<string, LucideIcon> = {
  created: CirclePlus,
  status_changed: ArrowRight,
  edited: Pencil,
  assignee_added: UserPlus,
  assignee_removed: UserMinus,
  label_added: Tag,
  label_removed: Tag,
};

/** Left rail cell: sits on the timeline line, with a card-colored ring to cut the line. */
function RailIcon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full bg-app ring-4 ring-card',
        className,
      )}
    >
      {children}
    </span>
  );
}

function Parts({ parts }: { parts: TextPart[] }) {
  return parts.map((part, i) =>
    part.strong ? (
      <span key={i} className="inline-flex items-baseline gap-1 font-medium text-primary">
        {part.color && (
          <span
            aria-hidden
            className="inline-block size-2 shrink-0 self-center rounded-full"
            style={{ backgroundColor: part.color }}
          />
        )}
        {part.text}
      </span>
    ) : (
      <span key={i}>{part.text}</span>
    ),
  );
}

function ActivityLine({ entry, showTime }: { entry: ActivityEntry; showTime: boolean }) {
  const Icon = ICONS[entry.kind] ?? Pencil;
  return (
    <li className="flex gap-3 py-1">
      <RailIcon>
        <Icon className="size-3 text-subtle" strokeWidth={2.25} />
      </RailIcon>
      <p className="min-w-0 flex-1 pt-px text-[13px] leading-5 text-secondary">
        <span className="font-medium text-primary">You</span>{' '}
        <Parts parts={describeActivity(entry)} />
        {showTime && (
          <span className="text-subtle">
            <span aria-hidden> · </span>
            <Time iso={entry.created_at} />
          </span>
        )}
      </p>
    </li>
  );
}

function CommentRow({ comment, onDelete }: { comment: Comment; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const pending = isTempId(comment.id);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  const cancel = () => {
    setConfirming(false);
    requestAnimationFrame(() => deleteRef.current?.focus());
  };

  return (
    <li className="group/comment flex gap-3 py-1.5">
      <RailIcon className="bg-accent-soft text-[10px] font-semibold text-accent-text">Y</RailIcon>
      <article
        aria-label="Comment"
        className={cn(
          'min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 shadow-card',
          pending && 'opacity-70',
        )}
      >
        <header className="flex min-h-6 items-center gap-1.5 text-meta">
          <span className="font-semibold text-primary">You</span>
          <span aria-hidden className="text-subtle">
            ·
          </span>
          <span className="text-subtle">
            {pending ? 'Sending…' : <Time iso={comment.created_at} />}
          </span>
          {!pending && !confirming && (
            <button
              ref={deleteRef}
              type="button"
              aria-label="Delete comment"
              onClick={() => setConfirming(true)}
              className={cn(
                'ml-auto rounded-sm px-1.5 py-0.5 text-meta text-subtle transition-[opacity,color,background-color] duration-150',
                'hover:bg-danger-soft hover:text-danger-text focus-visible:opacity-100',
                'opacity-0 group-hover/comment:opacity-100 pointer-coarse:opacity-100',
              )}
            >
              Delete
            </button>
          )}
          {confirming && (
            <span
              data-esc-local
              className="ml-auto flex items-center gap-1"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  cancel();
                }
              }}
            >
              <span className="mr-1 text-subtle">Delete this comment?</span>
              <button
                ref={confirmRef}
                type="button"
                onClick={onDelete}
                className="rounded-sm bg-danger-strong px-1.5 py-0.5 font-medium text-white hover:brightness-95"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={cancel}
                className="rounded-sm px-1.5 py-0.5 text-secondary hover:bg-hover"
              >
                Cancel
              </button>
            </span>
          )}
        </header>
        <p className="mt-0.5 text-body [overflow-wrap:anywhere] whitespace-pre-wrap text-primary">
          {comment.body}
        </p>
      </article>
    </li>
  );
}

function FeedRow({ item, onDelete }: { item: FeedItem; onDelete: (c: Comment) => void }) {
  if (item.type === 'comment') {
    return <CommentRow comment={item.comment} onDelete={() => onDelete(item.comment)} />;
  }
  return item.entries.map((entry, i) => (
    <ActivityLine key={entry.id} entry={entry} showTime={i === 0} />
  ));
}

function FeedSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading activity" className="flex flex-col gap-3 py-1">
      {[0.6, 0.45, 0.7].map((w, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="h-3.5" style={{ width: `${w * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

/**
 * Comments and activity as one chronological feed, oldest first, with the composer at the end
 * (DESIGN §7.4, advanced #2 + #3). Renders nothing for a task that isn't saved yet.
 */
export function TaskFeed({ taskId }: { taskId: string }) {
  if (isTempId(taskId)) return null;
  return <Feed taskId={taskId} />;
}

function Feed({ taskId }: { taskId: string }) {
  const activity = useActivity(taskId);
  const comments = useComments(taskId);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  useRefreshActivityOnChange(taskId);

  const feed = useMemo(
    () => (activity.data && comments.data ? buildFeed(activity.data, comments.data) : undefined),
    [activity.data, comments.data],
  );
  const failed = (activity.isError && !activity.data) || (comments.isError && !comments.data);

  let body;
  if (failed) {
    body = (
      <div
        role="alert"
        className="flex items-center gap-2 rounded-md bg-danger-soft px-3 py-2 text-[13px] leading-5 text-danger-text"
      >
        <AlertTriangle aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">Couldn't load activity.</span>
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={<RotateCw />}
          loading={activity.isFetching || comments.isFetching}
          onClick={() => {
            if (activity.isError) void activity.refetch();
            if (comments.isError) void comments.refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  } else if (!feed) {
    body = <FeedSkeleton />;
  } else if (feed.length === 0) {
    body = <p className="py-1 text-[13px] leading-5 text-subtle">No activity yet</p>;
  } else {
    body = (
      <div className="relative">
        <span aria-hidden className="absolute top-3 bottom-3 left-[9.5px] w-px bg-border" />
        <ol>
          {feed.map((item) => (
            <FeedRow key={item.key} item={item} onDelete={deleteComment} />
          ))}
        </ol>
      </div>
    );
  }

  return (
    <section aria-labelledby={`feed-${taskId}`}>
      <h3 id={`feed-${taskId}`} className="mb-3 text-[13px] leading-5 font-medium text-secondary">
        Activity
      </h3>
      {body}
      <div className="mt-4">
        <CommentComposer onSend={(text) => addComment(taskId, text)} />
      </div>
    </section>
  );
}
