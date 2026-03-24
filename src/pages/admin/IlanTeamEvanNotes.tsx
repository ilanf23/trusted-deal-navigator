import { useState, useEffect } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  StickyNote,
  Plus,
  Pin,
  Trash2,
  Loader2,
  PinOff,
  Save,
} from 'lucide-react';

interface Note {
  id: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

const IlanTeamEvanNotes = () => {
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle("Evan's Notes");
    return () => { setPageTitle(null); };
  }, []);

  // Fetch Evan's notes
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['evan-notes-ilan-view'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as Note[];
    },
  });

  // Create note
  const createMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase
        .from('notes')
        .insert({ content });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evan-notes-ilan-view'] });
      setNewNote('');
      toast.success('Note created');
    },
    onError: () => toast.error('Failed to create note'),
  });

  // Update note
  const updateMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase
        .from('notes')
        .update({ content })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evan-notes-ilan-view'] });
      setEditingNote(null);
      toast.success('Note updated');
    },
    onError: () => toast.error('Failed to update note'),
  });

  // Toggle pin
  const togglePinMutation = useMutation({
    mutationFn: async ({ id, isPinned }: { id: string; isPinned: boolean }) => {
      const { error } = await supabase
        .from('notes')
        .update({ is_pinned: !isPinned })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evan-notes-ilan-view'] });
    },
    onError: () => toast.error('Failed to update note'),
  });

  // Delete note
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evan-notes-ilan-view'] });
      toast.success('Note deleted');
    },
    onError: () => toast.error('Failed to delete note'),
  });

  const handleCreateNote = () => {
    if (!newNote.trim()) return;
    createMutation.mutate(newNote.trim());
  };

  const handleSaveEdit = (id: string) => {
    if (!editContent.trim()) return;
    updateMutation.mutate({ id, content: editContent.trim() });
  };

  const startEditing = (note: Note) => {
    setEditingNote(note.id);
    setEditContent(note.content);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Create Note */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add New Note
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Write a note for Evan..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="min-h-[100px]"
            />
            <Button
              onClick={handleCreateNote}
              disabled={!newNote.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Note
            </Button>
          </CardContent>
        </Card>

        {/* Notes List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            All Notes ({notes.length})
          </h2>

          {notes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <StickyNote className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No notes yet. Create one above!</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-450px)]">
              <div className="space-y-3 pr-4">
                {notes.map((note) => (
                  <Card
                    key={note.id}
                    className={`transition-all ${
                      note.is_pinned ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20' : ''
                    }`}
                  >
                    <CardContent className="py-4">
                      {editingNote === note.id ? (
                        <div className="space-y-3">
                          <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="min-h-[100px]"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(note.id)}
                              disabled={updateMutation.isPending}
                            >
                              <Save className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingNote(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-4">
                            <p
                              className="text-sm whitespace-pre-wrap flex-1 cursor-pointer hover:bg-muted/50 rounded p-2 -m-2 transition-colors"
                              onClick={() => startEditing(note)}
                            >
                              {note.content}
                            </p>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => togglePinMutation.mutate({ id: note.id, isPinned: note.is_pinned })}
                              >
                                {note.is_pinned ? (
                                  <PinOff className="h-4 w-4 text-amber-600" />
                                ) : (
                                  <Pin className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => deleteMutation.mutate(note.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-3">
                            Updated {format(new Date(note.updated_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default IlanTeamEvanNotes;
