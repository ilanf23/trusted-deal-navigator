import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { PipelineColumn, ColumnType, MagicColumnType } from '@/components/admin/PipelineColumnHeader';
import { customColumnTypes, allMagicColumns } from '@/components/admin/PipelineColumnHeader';

const STORAGE_KEY = 'pipeline-columns-config';

// Default foundational columns that cannot be deleted
// Fixed widths for rigid grid alignment - no minmax to prevent layout shifts
const defaultFoundationalColumns: PipelineColumn[] = [
  { id: 'drag_handle', name: '', type: 'foundational', isVisible: true, isFrozen: false, canDelete: false, canRename: false, width: '36px' },
  { id: 'checkbox', name: '', type: 'foundational', isVisible: true, isFrozen: false, canDelete: false, canRename: false, width: '44px' },
  { id: 'avatar', name: '', type: 'foundational', isVisible: true, isFrozen: false, canDelete: false, canRename: false, width: '44px' },
  { id: 'name', name: 'Name', type: 'foundational', isVisible: true, isFrozen: true, canDelete: false, canRename: false, width: '180px' },
  { id: 'stage', name: 'Stage', type: 'foundational', isVisible: true, isFrozen: false, canDelete: false, canRename: false, width: '140px' },
  { id: 'company', name: 'Company', type: 'foundational', isVisible: true, isFrozen: false, canDelete: false, canRename: true, width: '160px' },
  { id: 'contact', name: 'Contact', type: 'foundational', isVisible: true, isFrozen: false, canDelete: false, canRename: false, width: '260px' },
  { id: 'owner', name: 'Owner', type: 'foundational', columnType: 'assigned_to', isVisible: true, isFrozen: false, canDelete: false, canRename: false, width: '100px' },
  { id: 'source', name: 'Source', type: 'foundational', isVisible: true, isFrozen: false, canDelete: false, canRename: true, width: '100px' },
  { id: 'last_touch', name: 'Last Touch', type: 'foundational', isVisible: true, isFrozen: false, canDelete: false, canRename: true, width: '100px' },
  { id: 'notes', name: 'Notes', type: 'foundational', isVisible: true, isFrozen: false, canDelete: false, canRename: false, width: '200px' },
];

// Load columns from localStorage or use defaults
const loadColumnsFromStorage = (): PipelineColumn[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to ensure new foundational columns are included
      const storedIds = new Set(parsed.map((c: PipelineColumn) => c.id));
      const missingDefaults = defaultFoundationalColumns.filter(d => !storedIds.has(d.id));
      return [...parsed, ...missingDefaults];
    }
  } catch (e) {
    console.error('Failed to load pipeline columns from storage:', e);
  }
  return defaultFoundationalColumns;
};

export const usePipelineColumns = () => {
  const [columns, setColumns] = useState<PipelineColumn[]>(() => loadColumnsFromStorage());

  // Persist to localStorage whenever columns change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
    } catch (e) {
      console.error('Failed to save pipeline columns:', e);
    }
  }, [columns]);

  const insertColumn = useCallback((
    afterColumnId: string,
    position: 'left' | 'right',
    type: ColumnType | MagicColumnType,
    isMagic: boolean = false
  ) => {
    const columnIndex = columns.findIndex(c => c.id === afterColumnId);
    if (columnIndex === -1) return;

    const insertIndex = position === 'left' ? columnIndex : columnIndex + 1;
    
    let newColumn: PipelineColumn;
    
    if (isMagic) {
      const magicType = allMagicColumns.find(m => m.type === type);
      newColumn = {
        id: `magic-${type}-${Date.now()}`,
        name: magicType?.label || type,
        type: 'magic',
        magicType: type as MagicColumnType,
        isVisible: true,
        isFrozen: false,
        canDelete: true,
        canRename: false,
        width: '100px',
      };
    } else {
      const customType = customColumnTypes.find(c => c.type === type);
      newColumn = {
        id: `custom-${type}-${Date.now()}`,
        name: `New ${customType?.label || 'Column'}`,
        type: 'custom',
        columnType: type as ColumnType,
        isVisible: true,
        isFrozen: false,
        canDelete: true,
        canRename: true,
        width: '100px',
      };
    }

    const newColumns = [...columns];
    newColumns.splice(insertIndex, 0, newColumn);
    setColumns(newColumns);
    toast.success(`Added ${isMagic ? 'magic' : 'custom'} column: ${newColumn.name}`);
  }, [columns]);

  const deleteColumn = useCallback((columnId: string) => {
    const column = columns.find(c => c.id === columnId);
    if (!column || !column.canDelete) {
      toast.error('This column cannot be deleted');
      return;
    }
    
    setColumns(columns.filter(c => c.id !== columnId));
    toast.success(`Deleted column: ${column.name}`);
  }, [columns]);

  const hideColumn = useCallback((columnId: string) => {
    setColumns(columns.map(c => 
      c.id === columnId ? { ...c, isVisible: !c.isVisible } : c
    ));
    const column = columns.find(c => c.id === columnId);
    toast.success(`${column?.isVisible ? 'Hidden' : 'Shown'} column: ${column?.name}`);
  }, [columns]);

  const freezeColumn = useCallback((columnId: string) => {
    setColumns(columns.map(c => 
      c.id === columnId ? { ...c, isFrozen: !c.isFrozen } : c
    ));
    const column = columns.find(c => c.id === columnId);
    toast.success(`${column?.isFrozen ? 'Unfroze' : 'Froze'} column: ${column?.name}`);
  }, [columns]);

  const moveColumn = useCallback((columnId: string, direction: 'left' | 'right') => {
    const columnIndex = columns.findIndex(c => c.id === columnId);
    if (columnIndex === -1) return;
    
    // Don't move drag_handle/checkbox/avatar columns
    if (columnIndex <= 2 || (direction === 'left' && columnIndex <= 3)) return;
    
    const newIndex = direction === 'left' ? columnIndex - 1 : columnIndex + 1;
    if (newIndex < 3 || newIndex >= columns.length) return;

    const newColumns = [...columns];
    const [removed] = newColumns.splice(columnIndex, 1);
    newColumns.splice(newIndex, 0, removed);
    setColumns(newColumns);
  }, [columns]);

  const renameColumn = useCallback((columnId: string, newName: string) => {
    const column = columns.find(c => c.id === columnId);
    if (!column || !column.canRename) {
      toast.error('This column cannot be renamed');
      return;
    }
    
    setColumns(columns.map(c => 
      c.id === columnId ? { ...c, name: newName } : c
    ));
  }, [columns]);

  const resizeColumn = useCallback((columnId: string, newWidth: number) => {
    // Minimum width of 60px, max of 500px
    const clampedWidth = Math.max(60, Math.min(500, newWidth));
    setColumns(columns.map(c => 
      c.id === columnId ? { ...c, width: `${clampedWidth}px` } : c
    ));
  }, [columns]);

  const getVisibleColumns = useCallback(() => {
    return columns.filter(c => c.isVisible);
  }, [columns]);

  const getGridTemplate = useCallback(() => {
    return getVisibleColumns().map(c => c.width || '100px').join(' ');
  }, [getVisibleColumns]);

  return {
    columns,
    setColumns,
    insertColumn,
    deleteColumn,
    hideColumn,
    freezeColumn,
    moveColumn,
    renameColumn,
    resizeColumn,
    getVisibleColumns,
    getGridTemplate,
  };
};

export type { PipelineColumn, ColumnType, MagicColumnType };
