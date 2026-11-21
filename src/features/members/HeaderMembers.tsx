import { UserPlus } from 'lucide-react';
import { useMediaQuery } from '@/app/useMediaQuery';
import { Button } from '@/components/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { useMembers } from './api';
import { AvatarStack } from './Avatar';
import { TeamManager } from './TeamManager';

const MOBILE_QUERY = '(max-width: 639.98px)';

/** Header (DESIGN §7.1): the team's avatar stack + a button opening team management. */
export function HeaderMembers() {
  const { data: members } = useMembers();
  const isMobile = useMediaQuery(MOBILE_QUERY);

  return (
    <div className="flex items-center gap-1">
      {members && members.length > 0 && (
        <AvatarStack members={members} size={24} max={isMobile ? 2 : 3} srPrefix="Team:" />
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            icon={<UserPlus />}
            aria-label="Manage team members"
            title="Manage team members"
          />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          aria-label="Team members"
          className="w-[min(18rem,calc(100vw-1rem))] p-0"
        >
          <TeamManager />
        </PopoverContent>
      </Popover>
    </div>
  );
}
