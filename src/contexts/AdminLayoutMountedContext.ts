import { createContext } from 'react';

/**
 * Kept separate from AdminLayout so hot updates to the layout component do not
 * replace the context instance and make nested page wrappers mount a second shell.
 */
export const AdminLayoutMountedContext = createContext(false);
