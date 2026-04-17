import { useEffect, useRef } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import type { PageDatabaseDeclaration } from '@/types/pageDatabases';

export function usePageDatabases(decls: PageDatabaseDeclaration[]): void {
  const { setPageDatabases } = useAdminTopBar();
  const serializedRef = useRef<string>('');

  const serialized = JSON.stringify(decls);

  useEffect(() => {
    if (serialized === serializedRef.current) return;
    serializedRef.current = serialized;
    setPageDatabases(decls);
    return () => {
      setPageDatabases(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);
}
