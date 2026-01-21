import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { PipelineColumn, ColumnType, MagicColumnType } from '@/components/admin/PipelineColumnHeader';
import { customColumnTypes, allMagicColumns } from '@/components/admin/PipelineColumnHeader';

// Default foundational columns that cannot be deleted
const defaultFoundationalColumns: PipelineColumn[] = [
  { id: 'checkbox', name: '', type: 'foundational', isVisible: true, isFrozen: false, canDelete: false, canRename: false, width: '32px' },
  { id: 'avatar', name: '', type: 'foundational', isVisible: true, isFrozen: false, canDelete: false, canRename: false, width: '32px' },
  { id: 'name', name: 'Name', type: 'foundational', isVisible: true, isFrozen: true, canDelete: false, canRename: false, width: 'minmax(140px,1.2fr)' },
  { id: 'stage', name: 'Stage', type: 'foundational', isVisible: true, isFrozen: false, canDelete: false, canRename: false, width: '90px' },
  { id: 'company', name: 'Company', type: 'foundational', isVisible: true, isFrozen: false, canDelete: false, canRename: true, width: 'minmax(100px,1fr)' },
  { id: 'contact', name: 'Contact', type: 'foundational', isVisible: true, isFrozen: false, canDelete: false, canRename: false, width: 'minmax(140px,1fr)' },
  { id: 'owner', name: 'Owner', type: 'foundational', columnType: 'assigned_to', isVisible: true, isFrozen: false, canDelete: false, canRename: false, width: '90px' },
  { id: 'source', name: 'Source', type: 'foundational', isVisible: true, isFrozen: false, canDelete: false, canRename: true, width: '80px' },
  { id: 'last_touch', name: 'Last Touch', type: 'foundational', isVisible: true, isFrozen: false, canDelete: false, canRename: true, width: '100px' },
  { id: 'updated', name: 'Updated', type: 'foundational', isVisible: true, isFrozen: false, canDelete: false, canRename: true, width: '90px' },
];

export const usePipelineColumns = () => {
  const [columns, setColumns] = useState<PipelineColumn[]>(defaultFoundationalColumns);

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
    
    // Don't move checkbox/avatar columns
    if (columnIndex <= 1 || (direction === 'left' && columnIndex <= 2)) return;
    
    const newIndex = direction === 'left' ? columnIndex - 1 : columnIndex + 1;
    if (newIndex < 2 || newIndex >= columns.length) return;

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
    getVisibleColumns,
    getGridTemplate,
  };
};

export type { PipelineColumn, ColumnType, MagicColumnType };
