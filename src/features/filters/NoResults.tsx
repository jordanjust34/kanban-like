import { SearchX } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';

/** Board-area state when search / filters hide every task (DESIGN §7.6). */
export function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <EmptyState
        icon={<SearchX />}
        title="No tasks match your filters"
        description="Try a different search, or clear the filters to see every task."
        action={<Button onClick={onClear}>Clear filters</Button>}
      />
    </div>
  );
}
