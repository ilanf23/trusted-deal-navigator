import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
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
  registerUndo: (action: Omit<UndoAction, 'id' | 'timestamp'>) => void;
  executeUndo: () => Promise<void>;
  clearUndo: () => void;
}

const UndoContext = createContext<UndoContextType | null>(null);

export const UndoProvider = ({ children }: { children: ReactNode }) => {
  const [lastAction, setLastAction] = useState<UndoAction | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const executeUndoRef = useRef<() => Promise<void>>();

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

    // Store the execute function in a ref so the toast action can call it
    executeUndoRef.current = async () => {
      setIsUndoing(true);
      try {
        await newAction.execute();
        setLastAction(null);
        toast.dismiss(UNDO_TOAST_ID);
      } catch (error) {
        console.error('Undo failed:', error);
      } finally {
        setIsUndoing(false);
      }
    };

    // Dismiss previous undo toast, then show new one
    toast.dismiss(UNDO_TOAST_ID);
    toast(action.label, {
      id: UNDO_TOAST_ID,
      duration: UNDO_TIMEOUT_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          executeUndoRef.current?.();
        },
      },
    });

    // Auto-clear after 60 seconds
    timeoutRef.current = setTimeout(() => {
      setLastAction(prev => {
        if (prev && Date.now() - prev.timestamp >= UNDO_TIMEOUT_MS) {
          return null;
        }
        return prev;
      });
      timeoutRef.current = null;
    }, UNDO_TIMEOUT_MS);
  }, []);

  const executeUndo = useCallback(async () => {
    if (!lastAction || isUndoing) return;

    setIsUndoing(true);
    try {
      await lastAction.execute();
      setLastAction(null);
      toast.dismiss(UNDO_TOAST_ID);
    } catch (error) {
      console.error('Undo failed:', error);
    } finally {
      setIsUndoing(false);
    }
  }, [lastAction, isUndoing]);

  const clearUndo = useCallback(() => {
    setLastAction(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return (
    <UndoContext.Provider value={{ lastAction, isUndoing, registerUndo, executeUndo, clearUndo }}>
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
      registerUndo: () => {},
      executeUndo: async () => {},
      clearUndo: () => {},
    };
  }
  return context;
};
