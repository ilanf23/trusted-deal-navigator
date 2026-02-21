import { useState } from 'react';
import { X, Linkedin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SUGGESTED_PEOPLE } from './feedMockData';

const FeedRightPanel = () => {
  const [showTaskCard, setShowTaskCard] = useState(true);
  const [showMeetingCard, setShowMeetingCard] = useState(true);
  const [dismissedPeople, setDismissedPeople] = useState<string[]>([]);

  const visiblePeople = SUGGESTED_PEOPLE.filter((p) => !dismissedPeople.includes(p.name));

  return (
    <div className="w-[300px] min-w-[300px] bg-card border-l border-border h-full overflow-y-auto">
      <div className="p-4">
        {/* Date */}
        <div className="text-right text-sm text-muted-foreground mb-4">Friday, February 20th</div>

        {/* Keep things moving */}
        <div className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-3">
          Keep things moving
        </div>

        {/* Task Due Card */}
        {showTaskCard && (
          <div className="bg-card rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.3)] border border-border p-4 mb-3 relative">
            <button
              onClick={() => setShowTaskCard(false)}
              className="absolute top-3 right-3 text-muted-foreground/60 hover:text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#5B21B6] flex items-center justify-center flex-shrink-0">
                <div className="w-4 h-4 border-2 border-white rounded-sm" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">You have a task due in 3 days!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  "<span className="font-bold">F/U w/Client</span>" is due in{' '}
                  <span className="font-bold">3 days</span>!
                </p>
              </div>
            </div>
            <button className="w-full mt-3 py-2 text-xs font-bold text-foreground border border-foreground rounded-lg hover:bg-muted transition-colors">
              GET ON IT
            </button>
          </div>
        )}

        {/* Upcoming Meeting Card */}
        {showMeetingCard && (
          <div className="bg-card rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.3)] border border-border p-4 mb-3 relative">
            <button
              onClick={() => setShowMeetingCard(false)}
              className="absolute top-3 right-3 text-muted-foreground/60 hover:text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex gap-3 mb-3">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground">
                  MC
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                  <span className="text-[8px] text-white">📅</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Upcoming Meeting</p>
                <p className="text-xs text-muted-foreground">with Maura +2 more</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You have a meeting on <span className="font-bold">Monday</span> at{' '}
              <span className="font-bold">2:30pm EST</span>. Prepare for your meeting now.
            </p>
            <button className="w-full mt-3 py-2 text-xs font-bold text-foreground border border-foreground rounded-lg hover:bg-muted transition-colors">
              PREPARE
            </button>
          </div>
        )}

        {/* Suggestions */}
        <div className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium mt-6 mb-3">
          Suggestions
        </div>

        {/* Add Suggested People */}
        <div className="bg-card rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.3)] border border-border p-4 mb-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-foreground">Add Suggested People</h3>
            <button className="text-xs text-[#5B21B6] font-medium hover:underline">View all</button>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
            Once added, all the conversations with them will be visible and auto-tracked in CLX
          </p>

          {visiblePeople.map((person) => (
            <div key={person.name} className="flex items-center gap-2 py-2 border-t border-border">
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0">
                {person.initial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-foreground truncate">{person.name}</span>
                  {person.hasLinkedin && (
                    <Linkedin className="w-3.5 h-3.5 text-[#0A66C2] flex-shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{person.email}</p>
              </div>
              <button
                onClick={() => setDismissedPeople([...dismissedPeople, person.name])}
                className="text-muted-foreground/60 hover:text-muted-foreground flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button className="px-3 py-1 bg-[#2D1B4E] text-white text-xs font-bold rounded-lg hover:bg-[#3D2B5E] transition-colors flex-shrink-0">
                Add
              </button>
            </div>
          ))}
        </div>

        {/* Invite Team Members */}
        <div className="bg-card rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.3)] border border-border p-4">
          <h3 className="text-sm font-bold text-foreground mb-1">Invite Team Members</h3>
          <p className="text-[11px] text-muted-foreground mb-3">
            Add team members to collaborate with them on CLX
          </p>
          <div className="flex items-center gap-2 py-2 border-t border-border">
            <div className="w-9 h-9 rounded-full bg-[#DBEAFE] flex items-center justify-center text-xs font-bold text-[#1D4ED8] flex-shrink-0">
              A
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-foreground">Adam Foster</span>
              <p className="text-[11px] text-muted-foreground truncate">adam@commerciallendingx.com</p>
            </div>
            <button className="text-muted-foreground/60 hover:text-muted-foreground flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
            <button className="px-3 py-1 bg-[#2D1B4E] text-white text-xs font-bold rounded-lg hover:bg-[#3D2B5E] transition-colors flex-shrink-0">
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedRightPanel;
