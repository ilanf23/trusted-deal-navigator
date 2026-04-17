import { createContext, useContext, useState, ReactNode } from 'react';
import type { PageDatabaseDeclaration } from '@/types/pageDatabases';

interface AdminTopBarContextType {
  pageTitle: string | null;
  searchComponent: ReactNode | null;
  actionsComponent: ReactNode | null;
  pageDatabases: PageDatabaseDeclaration[] | null;
  setPageTitle: (title: string | null) => void;
  setSearchComponent: (node: ReactNode | null) => void;
  setActionsComponent: (node: ReactNode | null) => void;
  setPageDatabases: (decls: PageDatabaseDeclaration[] | null) => void;
}

const AdminTopBarContext = createContext<AdminTopBarContextType | null>(null);

export const AdminTopBarProvider = ({ children }: { children: ReactNode }) => {
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const [searchComponent, setSearchComponent] = useState<ReactNode | null>(null);
  const [actionsComponent, setActionsComponent] = useState<ReactNode | null>(null);
  const [pageDatabases, setPageDatabases] = useState<PageDatabaseDeclaration[] | null>(null);

  return (
    <AdminTopBarContext.Provider value={{
      pageTitle,
      searchComponent,
      actionsComponent,
      pageDatabases,
      setPageTitle,
      setSearchComponent,
      setActionsComponent,
      setPageDatabases,
    }}>
      {children}
    </AdminTopBarContext.Provider>
  );
};

export const useAdminTopBar = () => {
  const ctx = useContext(AdminTopBarContext);
  if (!ctx) throw new Error('useAdminTopBar must be used within AdminTopBarProvider');
  return ctx;
};
