import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, UserPlus, X, Eye, Edit3, Search, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  avatar_url: string | null;
}

interface PipelineShare {
  id: string;
  owner_id: string;
  shared_with_id: string;
  access_level: 'view' | 'edit';
  created_at: string;
  team_member?: TeamMember;
}

interface PipelineSharingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string; // The team_member id of the pipeline owner (e.g., Evan)
  ownerName: string;
}

const PipelineSharingModal = ({ open, onOpenChange, ownerId, ownerName }: PipelineSharingModalProps) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingChanges, setPendingChanges] = useState<Map<string, 'view' | 'edit' | 'remove' | 'add'>>(new Map());
  const [pendingAccessLevels, setPendingAccessLevels] = useState<Map<string, 'view' | 'edit'>>(new Map());
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<'view' | 'edit'>('view');

  // Fetch all team members
  const { data: allTeamMembers = [] } = useQuery({
    queryKey: ['team-members-for-sharing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, email, role, avatar_url')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: open,
  });

  // Fetch current shares for this pipeline
  const { data: currentShares = [], isLoading: sharesLoading } = useQuery({
    queryKey: ['pipeline-shares', ownerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_shares')
        .select('*, team_member:team_members!pipeline_shares_shared_with_id_fkey(id, name, email, role, avatar_url)')
        .eq('owner_id', ownerId);
      if (error) throw error;
      return data as PipelineShare[];
    },
    enabled: open && !!ownerId,
  });

  // Reset pending changes when modal opens/closes
  useEffect(() => {
    if (!open) {
      setPendingChanges(new Map());
      setPendingAccessLevels(new Map());
      setSearchTerm('');
    }
  }, [open]);

  // Compute current team (shared members + pending additions)
  const currentTeamIds = new Set([
    ...currentShares.map(s => s.shared_with_id),
    ...Array.from(pendingChanges.entries())
      .filter(([_, action]) => action === 'add')
      .map(([id]) => id)
  ]);

  // Remove members marked for removal
  pendingChanges.forEach((action, id) => {
    if (action === 'remove') {
      currentTeamIds.delete(id);
    }
  });

  // Available members (not already shared, not the owner)
  const availableMembers = allTeamMembers.filter(
    member => !currentTeamIds.has(member.id) && member.id !== ownerId
  );

  // Filtered available members
  const filteredAvailable = availableMembers.filter(member =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Current shared members with their details
  const sharedMembers = allTeamMembers.filter(member => currentTeamIds.has(member.id));

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAccessLevel = (memberId: string): 'view' | 'edit' => {
    // Check pending changes first
    if (pendingAccessLevels.has(memberId)) {
      return pendingAccessLevels.get(memberId)!;
    }
    // Check existing shares
    const share = currentShares.find(s => s.shared_with_id === memberId);
    return share?.access_level || 'view';
  };

  const handleAddMember = (member: TeamMember) => {
    setPendingChanges(prev => new Map(prev).set(member.id, 'add'));
    setPendingAccessLevels(prev => new Map(prev).set(member.id, selectedAccessLevel));
  };

  const handleRemoveMember = (memberId: string) => {
    const isNewlyAdded = pendingChanges.get(memberId) === 'add';
    if (isNewlyAdded) {
      // Just remove from pending
      setPendingChanges(prev => {
        const next = new Map(prev);
        next.delete(memberId);
        return next;
      });
      setPendingAccessLevels(prev => {
        const next = new Map(prev);
        next.delete(memberId);
        return next;
      });
    } else {
      // Mark existing share for removal
      setPendingChanges(prev => new Map(prev).set(memberId, 'remove'));
    }
  };

  const handleAccessLevelChange = (memberId: string, level: 'view' | 'edit') => {
    setPendingAccessLevels(prev => new Map(prev).set(memberId, level));
    // If it's an existing share, mark as needing update
    const existingShare = currentShares.find(s => s.shared_with_id === memberId);
    if (existingShare && existingShare.access_level !== level) {
      setPendingChanges(prev => {
        const current = prev.get(memberId);
        if (current !== 'add' && current !== 'remove') {
          return new Map(prev).set(memberId, level);
        }
        return prev;
      });
    }
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Process additions
      const additions = Array.from(pendingChanges.entries())
        .filter(([_, action]) => action === 'add')
        .map(([memberId]) => ({
          owner_id: ownerId,
          shared_with_id: memberId,
          access_level: pendingAccessLevels.get(memberId) || 'view',
        }));

      if (additions.length > 0) {
        const { error } = await supabase.from('pipeline_shares').insert(additions);
        if (error) throw error;
      }

      // Process removals
      const removals = Array.from(pendingChanges.entries())
        .filter(([_, action]) => action === 'remove')
        .map(([memberId]) => memberId);

      for (const memberId of removals) {
        const { error } = await supabase.from('pipeline_shares')
          .delete()
          .eq('owner_id', ownerId)
          .eq('shared_with_id', memberId);
        if (error) throw error;
      }

      // Process access level updates
      const updates = Array.from(pendingAccessLevels.entries())
        .filter(([memberId]) => {
          const action = pendingChanges.get(memberId);
          if (action === 'add' || action === 'remove') return false;
          const existingShare = currentShares.find(s => s.shared_with_id === memberId);
          return existingShare && existingShare.access_level !== pendingAccessLevels.get(memberId);
        });

      for (const [memberId, level] of updates) {
        const { error } = await supabase.from('pipeline_shares')
          .update({ access_level: level })
          .eq('owner_id', ownerId)
          .eq('shared_with_id', memberId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-shares', ownerId] });
      toast.success('Pipeline sharing updated');
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error saving shares:', error);
      toast.error('Failed to update sharing settings');
    },
  });

  const hasChanges = pendingChanges.size > 0 || pendingAccessLevels.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-slate-200">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5 text-[#0066FF]" />
            Share {ownerName}'s Pipeline
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Add team members to collaborate on this pipeline. Choose their access level.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-[400px]">
          {/* Left Panel - Current Team */}
          <div className="flex-1 border-r border-slate-200 flex flex-col">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">Current Team</h3>
              <p className="text-xs text-slate-500 mt-0.5">{sharedMembers.length} member{sharedMembers.length !== 1 ? 's' : ''}</p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {/* Owner - always shown */}
                <div className="flex items-center gap-3 p-2 rounded-lg bg-[#0066FF]/5 border border-[#0066FF]/20">
                  <Avatar className="h-9 w-9 bg-[#0066FF]">
                    <AvatarFallback className="text-xs text-white font-semibold bg-[#0066FF]">
                      {getInitials(ownerName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{ownerName}</p>
                    <p className="text-xs text-slate-500">Owner</p>
                  </div>
                  <Badge className="bg-[#0066FF] text-white text-[10px]">Owner</Badge>
                </div>

                {/* Shared members */}
                {sharedMembers.map(member => {
                  const isMarkedForRemoval = pendingChanges.get(member.id) === 'remove';
                  const accessLevel = getAccessLevel(member.id);
                  
                  return (
                    <div
                      key={member.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg border transition-all",
                        isMarkedForRemoval 
                          ? "bg-red-50 border-red-200 opacity-60" 
                          : "bg-white border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <Avatar className="h-9 w-9 bg-slate-200">
                        <AvatarFallback className="text-xs text-slate-600 font-semibold">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{member.name}</p>
                        <p className="text-xs text-slate-500 truncate">{member.role || 'Team Member'}</p>
                      </div>
                      {!isMarkedForRemoval && (
                        <Select
                          value={accessLevel}
                          onValueChange={(val: 'view' | 'edit') => handleAccessLevelChange(member.id, val)}
                        >
                          <SelectTrigger className="w-24 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view">
                              <span className="flex items-center gap-1.5">
                                <Eye className="h-3 w-3" /> View
                              </span>
                            </SelectItem>
                            <SelectItem value="edit">
                              <span className="flex items-center gap-1.5">
                                <Edit3 className="h-3 w-3" /> Edit
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className={cn(
                          "p-1.5 rounded-md transition-colors",
                          isMarkedForRemoval
                            ? "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            : "text-slate-400 hover:text-red-600 hover:bg-red-50"
                        )}
                        title={isMarkedForRemoval ? "Undo remove" : "Remove from team"}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}

                {sharedMembers.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No team members added yet</p>
                    <p className="text-xs mt-1">Add members from the right panel</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel - Available Members */}
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">Add Team Members</h3>
              <p className="text-xs text-slate-500 mt-0.5">{availableMembers.length} available</p>
            </div>
            
            {/* Search and default access level */}
            <div className="px-3 py-2 border-b border-slate-100 space-y-2">
              <div className="relative">
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-3 h-8 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Default access:</span>
                <Select value={selectedAccessLevel} onValueChange={(val: 'view' | 'edit') => setSelectedAccessLevel(val)}>
                  <SelectTrigger className="w-24 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">
                      <span className="flex items-center gap-1.5">
                        <Eye className="h-3 w-3" /> View
                      </span>
                    </SelectItem>
                    <SelectItem value="edit">
                      <span className="flex items-center gap-1.5">
                        <Edit3 className="h-3 w-3" /> Edit
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {filteredAvailable.map(member => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-white border border-slate-200 hover:border-[#0066FF]/30 hover:bg-[#0066FF]/5 transition-all cursor-pointer group"
                    onClick={() => handleAddMember(member)}
                  >
                    <Avatar className="h-9 w-9 bg-slate-200">
                      <AvatarFallback className="text-xs text-slate-600 font-semibold">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{member.name}</p>
                      <p className="text-xs text-slate-500 truncate">{member.email || member.role || 'Team Member'}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[#0066FF] opacity-0 group-hover:opacity-100 transition-opacity">
                      <UserPlus className="h-4 w-4" />
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                ))}

                {filteredAvailable.length === 0 && availableMembers.length > 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No matches found</p>
                  </div>
                )}

                {availableMembers.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">All team members have been added</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {hasChanges ? (
              <span className="text-amber-600 font-medium">You have unsaved changes</span>
            ) : (
              <span>Changes are saved when you click "Save Changes"</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
              className="bg-[#0066FF] hover:bg-[#0055DD]"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PipelineSharingModal;
