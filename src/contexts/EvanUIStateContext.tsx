import { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';

// Generic state store keyed by page name
type StateMap = Record<string, Record<string, any>>;

interface EvanUIStateContextType {
  getPageState: <T extends Record<string, any>>(page: string, defaults: T) => T;
  setPageState: <T extends Record<string, any>>(page: string, state: Partial<T>) => void;
}

const EvanUIStateContext = createContext<EvanUIStateContextType | null>(null);

export const EvanUIStateProvider = ({ children }: { children: ReactNode }) => {
  const stateRef = useRef<StateMap>({});
  // Force re-renders aren't needed — consumers read on mount and write through setters
  const [, setTick] = useState(0);

  const getPageState = useCallback(<T extends Record<string, any>>(page: string, defaults: T): T => {
    const stored = stateRef.current[page];
    if (!stored) return defaults;
    return { ...defaults, ...stored } as T;
  }, []);

  const setPageState = useCallback(<T extends Record<string, any>>(page: string, state: Partial<T>) => {
    stateRef.current[page] = { ...(stateRef.current[page] || {}), ...state };
    // No re-render needed — state is read on mount by each page
  }, []);

  return (
    <EvanUIStateContext.Provider value={{ getPageState, setPageState }}>
      {children}
    </EvanUIStateContext.Provider>
  );
};

export const useEvanUIState = () => {
  const ctx = useContext(EvanUIStateContext);
  if (!ctx) throw new Error('useEvanUIState must be used within EvanUIStateProvider');
  return ctx;
};
