import { useState, useMemo } from 'react';
import { Search, Plus, Bell } from 'lucide-react';
import { useTeamMember } from '@/hooks/useTeamMember';
import FeedLeftPanel from '@/components/feed/FeedLeftPanel';
import FeedCenter from '@/components/feed/FeedCenter';
import FeedRightPanel from '@/components/feed/FeedRightPanel';
import { FEED_MOCK_DATA } from '@/components/feed/feedMockData';
import type { ActivityItem } from '@/components/feed/feedMockData';

const PipelineFeed = () => {
  const { teamMember } = useTeamMember();
  const userName = teamMember?.name || 'User';

  const [selectedTeamMember, setSelectedTeamMember] = useState<string | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredActivities = useMemo(() => {
    let result = FEED_MOCK_DATA;

    // Filter by team member
    if (selectedTeamMember) {
      result = result.filter(
        (a) =>
          a.senderName.toLowerCase().includes(selectedTeamMember.toLowerCase()) ||
          a.recipientName.toLowerCase().includes(selectedTeamMember.toLowerCase())
      );
    }

    // Filter by activity type
    if (selectedFilters.length > 0) {
      const typeMap: Record<string, string[]> = {
        Email: ['email_sent', 'email_received'],
        'Phone Call': ['phone_call'],
        Note: ['note'],
        Meeting: ['calendar_invite'],
      };
      const allowedTypes = selectedFilters.flatMap((f) => typeMap[f] || []);
      if (allowedTypes.length > 0) {
        result = result.filter((a) => allowedTypes.includes(a.type));
      }
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.senderName.toLowerCase().includes(q) ||
          a.recipientName.toLowerCase().includes(q) ||
          (a.subject?.toLowerCase().includes(q)) ||
          a.preview.toLowerCase().includes(q)
      );
    }

    return result;
  }, [selectedTeamMember, selectedFilters, searchQuery]);

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] -m-6 md:-m-8">
      {/* Top bar */}
      <div className="h-14 bg-white border-b border-[#E5E7EB] flex items-center px-6 gap-4 flex-shrink-0">
        <h1 className="text-xl font-bold text-[#111827] mr-4">Feed</h1>
        <div className="flex-1 flex justify-center">
          <div className="relative w-full max-w-[500px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search by name, email, domain or phone number"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-10 pr-4 bg-[#F0F0F2] rounded-full text-sm outline-none border-0 placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#5B21B6]/20"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F3F4F6] text-[#6B7280]">
            <Plus className="w-5 h-5" />
          </button>
          <button className="relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F3F4F6] text-[#6B7280]">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 min-w-[20px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              99+
            </span>
          </button>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="flex flex-1 min-h-0">
        <FeedLeftPanel
          userName={userName}
          selectedTeamMember={selectedTeamMember}
          onTeamMemberSelect={setSelectedTeamMember}
          selectedFilters={selectedFilters}
          onFilterChange={setSelectedFilters}
        />
        <FeedCenter activities={filteredActivities} />
        <FeedRightPanel />
      </div>
    </div>
  );
};

export default PipelineFeed;
