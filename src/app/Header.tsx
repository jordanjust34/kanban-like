import { Plus } from 'lucide-react';
import { Button } from '@/components/ui';
import { FilterBar } from '@/features/filters/FilterBar';
import { HeaderMembers } from '@/features/members/HeaderMembers';
import { BoardStats } from '@/features/stats/BoardStats';
import { BOARD_NAME } from '@/lib/domain';
import { openCreateTask } from '@/lib/urlState';
import { LogoMark } from './LogoMark';

/**
 * Top chrome (DESIGN §7.1): title row + toolbar row. Slots render `null` until their phase
 * fills them; empty slot wrappers collapse (`empty:hidden`) so the layout never jumps.
 */
export function Header() {
  return (
    <header className="shrink-0 border-b border-border bg-card">
      <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:flex-none">
          <LogoMark />
          <h1 className="truncate text-[17px] leading-6 font-semibold tracking-[-0.015em] text-primary sm:text-page-title">
            {BOARD_NAME}
          </h1>
        </div>

        <div className="order-last w-full empty:hidden sm:order-none sm:w-auto">
          <BoardStats />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <HeaderMembers />
          <Button
            variant="primary"
            leadingIcon={<Plus />}
            onClick={() => openCreateTask('todo')}
            className="max-sm:w-8 max-sm:px-0"
          >
            <span className="max-sm:sr-only">New task</span>
          </Button>
        </div>
      </div>

      <div className="flex min-h-11 flex-wrap items-center gap-2 px-4 pb-2.5 sm:px-6">
        <FilterBar />
      </div>
    </header>
  );
}
