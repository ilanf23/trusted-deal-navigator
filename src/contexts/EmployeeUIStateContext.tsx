import { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';

// Generic state store keyed by page name
type StateMap = Record<string, Record<string, any>>;

interface EmployeeUIStateContextType {
  getPageState: <T extends Record<string, any>>(page: string, defaults: T) => T;
  setPageState: <T extends Record<string, any>>(page: string, state: Partial<T>) => void;
}

const EmployeeUIStateContext = createContext<EmployeeUIStateContextType | null>(null);

export const EmployeeUIStateProvider = ({ children }: { children: ReactNode }) => {
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
    <EmployeeUIStateContext.Provider value={{ getPageState, setPageState }}>
      {children}
    </EmployeeUIStateContext.Provider>
  );
};

export const useEmployeeUIState = () => {
  const ctx = useContext(EmployeeUIStateContext);
  if (!ctx) throw new Error('useEmployeeUIState must be used within EmployeeUIStateProvider');
  return ctx;
};
