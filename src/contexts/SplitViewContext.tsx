import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SplitViewState {
  isActive: boolean;
  leftPage: string;
  rightPage: string;
  panelSizes: [number, number];
}

interface SplitViewContextType extends SplitViewState {
  toggleSplitView: () => void;
  setLeftPage: (page: string) => void;
  setRightPage: (page: string) => void;
  swapPanels: () => void;
  setPanelSizes: (sizes: [number, number]) => void;
  exitSplitView: () => void;
  navigateFromPanel: (path: string) => void;
}

const STORAGE_KEY = 'splitview-state';

const defaultState: SplitViewState = {
  isActive: false,
  leftPage: 'dashboard',
  rightPage: 'pipeline',
  panelSizes: [50, 50],
};

function loadState(): SplitViewState {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaultState, ...JSON.parse(stored) };
  } catch {}
  return defaultState;
}

function saveState(state: SplitViewState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

const SplitViewContext = createContext<SplitViewContextType | null>(null);

export const useSplitView = () => {
  const ctx = useContext(SplitViewContext);
  if (!ctx) throw new Error('useSplitView must be used within SplitViewProvider');
  return ctx;
};

export const SplitViewProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<SplitViewState>(loadState);
  const navigate = useNavigate();
  const location = useLocation();
  const activatedPathRef = useRef<string | null>(null);

  // Track pathname when split view is activated; exit if URL changes
  useEffect(() => {
    if (state.isActive) {
      if (activatedPathRef.current === null) {
        activatedPathRef.current = location.pathname;
      } else if (location.pathname !== activatedPathRef.current) {
        setState(prev => ({ ...prev, isActive: false }));
      }
    } else {
      activatedPathRef.current = null;
    }
  }, [state.isActive, location.pathname]);

  // Persist to sessionStorage
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Auto-disable on narrow viewports
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches && state.isActive) {
        setState(prev => ({ ...prev, isActive: false }));
      }
    };
    mq.addEventListener('change', handler);
    // Also check on mount
    if (mq.matches && state.isActive) {
      setState(prev => ({ ...prev, isActive: false }));
    }
    return () => mq.removeEventListener('change', handler);
  }, [state.isActive]);

  const toggleSplitView = useCallback(() => {
    setState(prev => ({ ...prev, isActive: !prev.isActive }));
  }, []);

  const exitSplitView = useCallback(() => {
    setState(prev => ({ ...prev, isActive: false }));
  }, []);

  const setLeftPage = useCallback((page: string) => {
    setState(prev => ({ ...prev, leftPage: page }));
  }, []);

  const setRightPage = useCallback((page: string) => {
    setState(prev => ({ ...prev, rightPage: page }));
  }, []);

  const swapPanels = useCallback(() => {
    setState(prev => ({
      ...prev,
      leftPage: prev.rightPage,
      rightPage: prev.leftPage,
    }));
  }, []);

  const setPanelSizes = useCallback((sizes: [number, number]) => {
    setState(prev => ({ ...prev, panelSizes: sizes }));
  }, []);

  const navigateFromPanel = useCallback((path: string) => {
    setState(prev => ({ ...prev, isActive: false }));
    navigate(path);
  }, [navigate]);

  return (
    <SplitViewContext.Provider
      value={{
        ...state,
        toggleSplitView,
        setLeftPage,
        setRightPage,
        swapPanels,
        setPanelSizes,
        exitSplitView,
        navigateFromPanel,
      }}
    >
      {children}
    </SplitViewContext.Provider>
  );
};
