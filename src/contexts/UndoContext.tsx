import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';

const UNDO_TIMEOUT_MS = 60000;
const UNDO_TOAST_ID = 'undo-toast';

interface UndoAction {
  id: string;
  label: string;
  execute: () => Promise<void>;
  timestamp: number;
}

interface UndoContextType {
  lastAction: UndoAction | null;
  isUndoing: boolean;
  isUndoingRef: React.RefObject<boolean>;
  registerUndo: (action: Omit<UndoAction, 'id' | 'timestamp'>) => void;
  executeUndo: () => Promise<void>;
  clearUndo: () => void;
}

const UndoContext = createContext<UndoContextType | null>(null);

export const UndoProvider = ({ children }: { children: ReactNode }) => {
  const [lastAction, setLastAction] = useState<UndoAction | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUndoingRef = useRef(false);
  const lastActionRef = useRef<UndoAction | null>(null);

  const doExecuteUndo = useCallback(async (action: UndoAction) => {
    if (isUndoingRef.current) return;
    isUndoingRef.current = true;
    setIsUndoing(true);
    try {
      await action.execute();
      setLastAction(null);
      lastActionRef.current = null;
      toast.dismiss(UNDO_TOAST_ID);
      toast.success('Undone');
    } catch (error) {
      console.error('Undo failed:', error);
      toast.error('Undo failed');
    } finally {
      isUndoingRef.current = false;
      setIsUndoing(false);
    }
  }, []);

  const registerUndo = useCallback((action: Omit<UndoAction, 'id' | 'timestamp'>) => {
    // Clear previous timeout to prevent race conditions
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const newAction: UndoAction = {
      ...action,
      id: `undo-${Date.now()}`,
      timestamp: Date.now(),
    };

    setLastAction(newAction);
    lastActionRef.current = newAction;

    // Dismiss previous undo toast, then show new one
    toast.dismiss(UNDO_TOAST_ID);
    toast(action.label, {
      id: UNDO_TOAST_ID,
      duration: UNDO_TIMEOUT_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          const current = lastActionRef.current;
          if (current) doExecuteUndo(current);
        },
      },
    });

    // Auto-clear after 60 seconds
    timeoutRef.current = setTimeout(() => {
      setLastAction(prev => {
        if (prev && Date.now() - prev.timestamp >= UNDO_TIMEOUT_MS) {
          lastActionRef.current = null;
          return null;
        }
        return prev;
      });
      timeoutRef.current = null;
    }, UNDO_TIMEOUT_MS);
  }, [doExecuteUndo]);

  const executeUndo = useCallback(async () => {
    if (!lastAction || isUndoing) return;
    await doExecuteUndo(lastAction);
  }, [lastAction, isUndoing, doExecuteUndo]);

  const clearUndo = useCallback(() => {
    setLastAction(null);
    lastActionRef.current = null;
    toast.dismiss(UNDO_TOAST_ID);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <UndoContext.Provider value={{ lastAction, isUndoing, isUndoingRef, registerUndo, executeUndo, clearUndo }}>
      {children}
    </UndoContext.Provider>
  );
};

export const useUndo = (): UndoContextType => {
  const context = useContext(UndoContext);
  // Return a no-op fallback if used outside provider (shouldn't happen but prevents crashes)
  if (!context) {
    return {
      lastAction: null,
      isUndoing: false,
      isUndoingRef: { current: false },
      registerUndo: () => {},
      executeUndo: async () => {},
      clearUndo: () => {},
    };
  }
  return context;
};
