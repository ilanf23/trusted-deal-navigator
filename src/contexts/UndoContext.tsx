import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

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

  const registerUndo = useCallback((action: Omit<UndoAction, 'id' | 'timestamp'>) => {
    setLastAction({
      ...action,
      id: `undo-${Date.now()}`,
      timestamp: Date.now(),
    });

    // Auto-clear after 30 seconds
    setTimeout(() => {
      setLastAction(prev => {
        if (prev && Date.now() - prev.timestamp >= 30000) {
          return null;
        }
        return prev;
      });
    }, 30000);
  }, []);

  const executeUndo = useCallback(async () => {
    if (!lastAction || isUndoing) return;

    setIsUndoing(true);
    try {
      await lastAction.execute();
      setLastAction(null);
    } catch (error) {
      console.error('Undo failed:', error);
    } finally {
      setIsUndoing(false);
    }
  }, [lastAction, isUndoing]);

  const clearUndo = useCallback(() => {
    setLastAction(null);
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
