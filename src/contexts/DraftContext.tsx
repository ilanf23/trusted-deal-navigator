import { createContext, useContext, useState, ReactNode } from 'react';

export interface DraftEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  leadId: string | null;
  recipientName: string;
  threadId?: string | null;
  inReplyTo?: string | null;
  createdAt: string;
}

interface DraftContextType {
  // Current active compose state
  composeOpen: boolean;
  setComposeOpen: (open: boolean) => void;
  composeTo: string;
  setComposeTo: (to: string) => void;
  composeSubject: string;
  setComposeSubject: (subject: string) => void;
  composeBody: string;
  setComposeBody: (body: string) => void;
  composeLeadId: string | null;
  setComposeLeadId: (id: string | null) => void;
  composeRecipientName: string;
  setComposeRecipientName: (name: string) => void;
  replyThreadId: string | null;
  setReplyThreadId: (id: string | null) => void;
  replyInReplyTo: string | null;
  setReplyInReplyTo: (id: string | null) => void;
  
  // Saved drafts for persistence
  savedDrafts: DraftEmail[];
  saveDraft: (draft: Omit<DraftEmail, 'id' | 'createdAt'>) => string;
  updateDraft: (id: string, updates: Partial<DraftEmail>) => void;
  deleteDraft: (id: string) => void;
  loadDraft: (id: string) => void;
  
  // Clear compose state
  clearCompose: () => void;
  
  // Check if there's an active unsaved draft
  hasActiveDraft: boolean;
}

const DraftContext = createContext<DraftContextType | undefined>(undefined);

export const DraftProvider = ({ children }: { children: ReactNode }) => {
  // Active compose state - persists across navigation
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeLeadId, setComposeLeadId] = useState<string | null>(null);
  const [composeRecipientName, setComposeRecipientName] = useState('');
  const [replyThreadId, setReplyThreadId] = useState<string | null>(null);
  const [replyInReplyTo, setReplyInReplyTo] = useState<string | null>(null);
  
  // Saved drafts storage
  const [savedDrafts, setSavedDrafts] = useState<DraftEmail[]>([]);
  
  const hasActiveDraft = composeOpen && (composeTo.length > 0 || composeSubject.length > 0 || composeBody.length > 0);
  
  const clearCompose = () => {
    setComposeOpen(false);
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
    setComposeLeadId(null);
    setComposeRecipientName('');
    setReplyThreadId(null);
    setReplyInReplyTo(null);
  };
  
  const saveDraft = (draft: Omit<DraftEmail, 'id' | 'createdAt'>): string => {
    const id = crypto.randomUUID();
    const newDraft: DraftEmail = {
      ...draft,
      id,
      createdAt: new Date().toISOString(),
    };
    setSavedDrafts(prev => [...prev, newDraft]);
    return id;
  };
  
  const updateDraft = (id: string, updates: Partial<DraftEmail>) => {
    setSavedDrafts(prev => 
      prev.map(draft => 
        draft.id === id ? { ...draft, ...updates } : draft
      )
    );
  };
  
  const deleteDraft = (id: string) => {
    setSavedDrafts(prev => prev.filter(draft => draft.id !== id));
  };
  
  const loadDraft = (id: string) => {
    const draft = savedDrafts.find(d => d.id === id);
    if (draft) {
      setComposeTo(draft.to);
      setComposeSubject(draft.subject);
      setComposeBody(draft.body);
      setComposeLeadId(draft.leadId);
      setComposeRecipientName(draft.recipientName);
      setReplyThreadId(draft.threadId || null);
      setReplyInReplyTo(draft.inReplyTo || null);
      setComposeOpen(true);
    }
  };
  
  return (
    <DraftContext.Provider value={{
      composeOpen,
      setComposeOpen,
      composeTo,
      setComposeTo,
      composeSubject,
      setComposeSubject,
      composeBody,
      setComposeBody,
      composeLeadId,
      setComposeLeadId,
      composeRecipientName,
      setComposeRecipientName,
      replyThreadId,
      setReplyThreadId,
      replyInReplyTo,
      setReplyInReplyTo,
      savedDrafts,
      saveDraft,
      updateDraft,
      deleteDraft,
      loadDraft,
      clearCompose,
      hasActiveDraft,
    }}>
      {children}
    </DraftContext.Provider>
  );
};

export const useDraft = () => {
  const context = useContext(DraftContext);
  if (context === undefined) {
    throw new Error('useDraft must be used within a DraftProvider');
  }
  return context;
};
