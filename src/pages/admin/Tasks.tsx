import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, ArrowLeft } from 'lucide-react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { usePageDatabases } from '@/hooks/usePageDatabases';
import { useEmployeeUIState } from '@/contexts/EmployeeUIStateContext';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { TaskWorkspace } from '@/components/employee/tasks/TaskWorkspace';
import { SavedFiltersSidebar, type SavedFilterOption } from '@/components/admin/SavedFiltersSidebar';
import TaskFilterDrawer from '@/components/employee/tasks/savedFilters/TaskFilterDrawer';
import { useSavedTaskFilters, findFilterById } from '@/hooks/useSavedTaskFilters';
import type { SavedTaskFilter } from '@/components/employee/tasks/savedFilters/types';

interface TasksPageState {
  activeFilterId: string | null;
  sidebarOpen: boolean;
}

const PAGE_DEFAULTS: TasksPageState = {
  activeFilterId: null,
  sidebarOpen: true,
};

const Tasks = () => {
  const { setPageTitle } = useAdminTopBar();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getPageState, setPageState } = useEmployeeUIState();

  usePageDatabases([
    { table: 'tasks', access: 'readwrite', usage: 'Task records — create, complete, edit, delete via TaskWorkspace.', via: 'src/hooks/useTasksData.ts' },
    { table: 'task_activities', access: 'write', usage: 'Activity-log entries written on every task change.', via: 'src/hooks/useTasksData.ts' },
    { table: 'potential', access: 'read', usage: 'Lead context shown alongside each task.', via: 'src/hooks/useTasksData.ts' },
    { table: 'task_saved_filters', access: 'readwrite', usage: 'Persisted public/private saved filters for the Tasks page.', via: 'src/hooks/useSavedTaskFilters.ts' },
  ]);

  useEffect(() => {
    setPageTitle('Tasks');
    return () => { setPageTitle(null); };
  }, [setPageTitle]);

  const persisted = getPageState('tasks', PAGE_DEFAULTS);

  const {
    filters,
    publicFilters,
    privateFilters,
    otherPublicFilters,
    defaultFilterId,
    isLoading: filtersLoading,
    create,
    update,
    remove,
    duplicate,
    setDefault,
    canEdit,
    canDelete,
  } = useSavedTaskFilters();

  const urlFilterId = searchParams.get('filterId');
  const initialActiveId = urlFilterId
    ?? persisted.activeFilterId
    ?? defaultFilterId
    ?? null;

  const [activeFilterId, setActiveFilterIdLocal] = useState<string | null>(initialActiveId);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(persisted.sidebarOpen);

  // Sync filter from URL when it changes externally (e.g. deep-links)
  useEffect(() => {
    if (urlFilterId && urlFilterId !== activeFilterId) {
      setActiveFilterIdLocal(urlFilterId);
      setPageState('tasks', { activeFilterId: urlFilterId });
    }
  }, [urlFilterId]);  // eslint-disable-line react-hooks/exhaustive-deps

  // When filters finish loading and we have a default but no active selection, apply it.
  useEffect(() => {
    if (!filtersLoading && !activeFilterId && defaultFilterId) {
      setActiveFilterIdLocal(defaultFilterId);
      setPageState('tasks', { activeFilterId: defaultFilterId });
    }
  }, [filtersLoading, defaultFilterId]);  // eslint-disable-line react-hooks/exhaustive-deps

  const setActiveFilterId = useCallback((id: string | null) => {
    setActiveFilterIdLocal(id);
    setPageState('tasks', { activeFilterId: id });
    const next = new URLSearchParams(searchParams);
    if (id) next.set('filterId', id);
    else next.delete('filterId');
    setSearchParams(next, { replace: true });
  }, [setPageState, searchParams, setSearchParams]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(v => {
      const next = !v;
      setPageState('tasks', { sidebarOpen: next });
      return next;
    });
  }, [setPageState]);

  const activeFilter: SavedTaskFilter | null = useMemo(
    () => findFilterById(filters, activeFilterId),
    [filters, activeFilterId],
  );

  // ── Drawer state ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<SavedTaskFilter | null>(null);

  const openCreateDrawer = () => {
    setEditingFilter(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (id: string) => {
    const f = findFilterById(filters, id);
    if (f) {
      setEditingFilter(f);
      setDrawerOpen(true);
    }
  };

  const handleDrawerSave = async (input: {
    name: string;
    description?: string | null;
    visibility: 'public' | 'private';
    criteria: SavedTaskFilter['criteria'];
  }) => {
    if (editingFilter) {
      await update.mutateAsync({ id: editingFilter.id, patch: input });
      setEditingFilter(null);
    } else {
      const saved = await create.mutateAsync(input);
      setActiveFilterId(saved.id);
    }
  };

  // ── Sidebar option mapping ──
  const sidebarOptions: SavedFilterOption[] = useMemo(() => {
    const allFilters: { f: SavedTaskFilter; group: 'public' | 'private' }[] = [];
    publicFilters.forEach(f => allFilters.push({ f, group: 'public' }));
    privateFilters.forEach(f => allFilters.push({ f, group: 'private' }));
    return allFilters.map(({ f, group }) => ({
      id: f.id,
      label: f.name,
      group,
      visibility: f.visibility,
      isDefault: defaultFilterId === f.id,
      ownedByCurrentUser: canEdit(f),
      editable: canEdit(f),
    }));
  }, [publicFilters, privateFilters, defaultFilterId, canEdit]);

  const handleRename = (
    filter: { id: string; kind: 'public' | 'custom' | 'private'; currentLabel: string },
    newLabel: string,
  ) => {
    const trimmed = newLabel.trim();
    if (!trimmed || trimmed === filter.currentLabel) return;
    update.mutate({ id: filter.id, patch: { name: trimmed } });
  };

  const handleToggleVisibility = (id: string, next: 'public' | 'private') => {
    update.mutate({ id, patch: { visibility: next } });
  };

  const handleDelete = (id: string) => {
    const filter = findFilterById(filters, id);
    if (!filter) return;
    if (!canDelete(filter)) return;
    if (!confirm(`Delete filter "${filter.name}"?`)) return;
    remove.mutate(id);
    if (activeFilterId === id) {
      setActiveFilterId(null);
    }
  };

  const handleDuplicate = (id: string) => {
    duplicate.mutate({ id, visibility: 'private' });
  };

  return (
    <EmployeeLayout>
      <div className="system-font flex flex-col h-full min-h-0 overflow-hidden bg-white dark:bg-background -m-3 sm:-m-4 md:-m-6 lg:-m-8 xl:-m-10">
        <div className="relative flex flex-1 min-h-0 overflow-y-hidden overflow-x-clip">
          <button
            onClick={toggleSidebar}
            title={sidebarOpen ? 'Hide filters' : 'Show filters'}
            style={{ left: sidebarOpen ? 'calc(18rem - 1.3125rem + 19px)' : 'calc(72px - 21px + 19px)', borderRadius: '50%', transition: 'left 200ms ease' }}
            className="absolute top-[9px] z-20 h-[42px] w-[42px] border border-gray-300 dark:border-border bg-white dark:bg-card flex items-center justify-center text-black dark:text-foreground hover:bg-gray-50 dark:hover:bg-muted hover:border-gray-400 transition-colors shadow-sm"
          >
            <ArrowLeft
              className="h-5 w-5"
              strokeWidth={2.5}
              style={{ transform: `scale(2) ${sidebarOpen ? '' : 'rotate(180deg)'}`, transition: 'transform 200ms ease' }}
            />
          </button>

          <SavedFiltersSidebar
            sidebarOpen={sidebarOpen}
            filterOptions={sidebarOptions}
            customFilters={[]}
            activeFilter={activeFilterId ?? ''}
            onSelectFilter={(id) => setActiveFilterId(id)}
            onRenameFilter={handleRename}
            onToggleVisibility={handleToggleVisibility}
            onSetDefault={(id) => { void setDefault(id); }}
            onDeleteFilter={handleDelete}
            onDuplicateFilter={handleDuplicate}
            onEditFilter={openEditDrawer}
            createFilterAction={
              <button
                onClick={openCreateDrawer}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-[#3b2778] bg-[#eee6f6] hover:bg-[#e0d4f0] dark:text-purple-300 dark:bg-purple-950/40 dark:hover:bg-purple-950/60 transition-colors"
                title="Create new filter"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New</span>
              </button>
            }
          />

          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 pb-8 pt-3">
              <TaskWorkspace
                activeFilter={activeFilter}
                otherPublicFiltersCount={otherPublicFilters.length}
                onClearActiveFilter={() => setActiveFilterId(null)}
                onEditActiveFilter={() => activeFilter && openEditDrawer(activeFilter.id)}
              />
            </div>
          </main>
        </div>
      </div>

      <TaskFilterDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditingFilter(null); }}
        onSave={handleDrawerSave}
        editingFilter={editingFilter}
      />
    </EmployeeLayout>
  );
};

export default Tasks;
