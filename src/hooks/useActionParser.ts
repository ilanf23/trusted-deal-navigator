import { useCallback } from 'react';
import type { ActionProposal } from '@/components/ai/actions/ActionCard';

// Parse <action> tags from AI response text
// Returns { cleanText, actions }
export const useActionParser = () => {
  const parseActions = useCallback((text: string): { cleanText: string; actions: ActionProposal[] } => {
    const actions: ActionProposal[] = [];
    const actionRegex = /<action\s+([^/>]*)\/?>/g;
    let match;

    while ((match = actionRegex.exec(text)) !== null) {
      const attrsStr = match[1];
      const attrs: Record<string, string> = {};

      // Parse attributes
      const attrRegex = /(\w+)="([^"]*)"/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
        attrs[attrMatch[1]] = attrMatch[2];
      }

      if (attrs.type && attrs.label) {
        actions.push({
          id: crypto.randomUUID(),
          type: attrs.type,
          label: attrs.label,
          status: 'proposed',
          params: attrs,
        });
      }
    }

    // Remove action tags from text for clean display
    const cleanText = text.replace(/<action\s+[^/>]*\/?>/g, '').trim();

    return { cleanText, actions };
  }, []);

  return { parseActions };
};
