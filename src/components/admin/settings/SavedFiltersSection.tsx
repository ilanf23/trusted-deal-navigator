import { useState } from 'react';
import {
  Plus,
  Filter,
  Lock,
  Globe,
  Star,
  Pencil,
  Trash2,
  Copy,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSavedTaskFilters } from '@/hooks/useSavedTaskFilters';
import TaskFilterDrawer from '@/components/employee/tasks/savedFilters/TaskFilterDrawer';
import type { SavedTaskFilter } from '@/components/employee/tasks/savedFilters/types';
import { format } from 'date-fns';

const SavedFiltersSection = () => {
  const {
    myFilters,
    otherPublicFilters,
    defaultFilterId,
    isLoading,
    isAdmin,
    create,
    update,
    remove,
    duplicate,
    setDefault,
    canEdit,
    canDelete,
  } = useSavedTaskFilters();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<SavedTaskFilter | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (f: SavedTaskFilter) => {
    setEditing(f);
    setDrawerOpen(true);
  };

  const handleSave = async (input: {
    name: string;
    description?: string | null;
    visibility: 'public' | 'private';
    criteria: SavedTaskFilter['criteria'];
  }) => {
    if (editing) {
      await update.mutateAsync({ id: editing.id, patch: input });
      setEditing(null);
    } else {
      await create.mutateAsync(input);
    }
  };

  const handleDelete = (f: SavedTaskFilter) => {
    if (!confirm(`Delete filter "${f.name}"?`)) return;
    remove.mutate(f.id);
  };

  const handleToggleVisibility = (f: SavedTaskFilter) => {
    update.mutate({
      id: f.id,
      patch: { visibility: f.visibility === 'public' ? 'private' : 'public' },
    });
  };

  const renderRow = (f: SavedTaskFilter, opts: { allowEdit: boolean; allowDelete: boolean }) => {
    const isDefault = defaultFilterId === f.id;
    return (
      <div
        key={f.id}
        className="flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-b-0 hover:bg-accent/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isDefault && <Star className="h-3.5 w-3.5 shrink-0 text-[#f59e0b] fill-[#f59e0b]" />}
          {f.visibility === 'public' ? (
            <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium truncate">{f.name}</span>
              <span className="text-[10px] uppercase tracking-wide font-semibold rounded-full px-1.5 py-0.5 bg-muted text-muted-foreground shrink-0">
                {f.visibility}
              </span>
              {isDefault && (
                <span className="text-[10px] uppercase tracking-wide font-semibold rounded-full px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 shrink-0">
                  Default
                </span>
              )}
            </div>
            {f.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{f.description}</p>
            )}
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">
              {f.createdByName ? `By ${f.createdByName} · ` : ''}
              {f.updatedAt ? `Updated ${format(new Date(f.updatedAt), 'MMM d, yyyy')}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setDefault(isDefault ? null : f.id)}
          >
            <Star className={`h-3.5 w-3.5 mr-1 ${isDefault ? 'text-[#f59e0b] fill-[#f59e0b]' : ''}`} />
            {isDefault ? 'Clear default' : 'Set default'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {opts.allowEdit && (
                <DropdownMenuItem onClick={() => openEdit(f)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {opts.allowEdit && (
                <DropdownMenuItem onClick={() => handleToggleVisibility(f)}>
                  {f.visibility === 'public' ? (
                    <><Lock className="h-3.5 w-3.5 mr-2" /> Make private</>
                  ) : (
                    <><Globe className="h-3.5 w-3.5 mr-2" /> Make public</>
                  )}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => duplicate.mutate({ id: f.id, visibility: 'private' })}>
                <Copy className="h-3.5 w-3.5 mr-2" />
                Duplicate to private
              </DropdownMenuItem>
              {opts.allowDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                    onClick={() => handleDelete(f)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Saved Filters
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your task filters. Public filters are visible to everyone in the workspace; private filters are only visible to you.
            {!isAdmin && ' Only filter owners and admins can edit or delete public filters.'}
          </p>
        </div>
        <Button onClick={openCreate} className="bg-[#3b2778] hover:bg-[#2d1d5e] text-white">
          <Plus className="h-4 w-4 mr-1.5" />
          New filter
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="px-3 py-2 bg-muted/40 border-b border-border">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            My Filters
          </span>
        </div>
        {isLoading ? (
          <div className="px-3 py-6 text-sm text-muted-foreground text-center">Loading filters…</div>
        ) : myFilters.length === 0 ? (
          <div className="px-3 py-6 text-sm text-muted-foreground text-center">
            You haven't created any filters yet.
            <button onClick={openCreate} className="ml-1 text-[#3b2778] dark:text-purple-400 hover:underline">
              Create your first filter
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {myFilters.map(f => renderRow(f, { allowEdit: canEdit(f), allowDelete: canDelete(f) }))}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="px-3 py-2 bg-muted/40 border-b border-border">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Public Filters from Others
          </span>
        </div>
        {isLoading ? (
          <div className="px-3 py-6 text-sm text-muted-foreground text-center">Loading filters…</div>
        ) : otherPublicFilters.length === 0 ? (
          <div className="px-3 py-6 text-sm text-muted-foreground text-center">
            No public filters from other users.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {otherPublicFilters.map(f =>
              renderRow(f, { allowEdit: canEdit(f), allowDelete: canDelete(f) }),
            )}
          </div>
        )}
      </Card>

      <TaskFilterDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditing(null); }}
        onSave={handleSave}
        editingFilter={editing}
      />
    </div>
  );
};

export default SavedFiltersSection;
