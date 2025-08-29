import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Pin, PinOff, Edit, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StickyNote {
  id: string;
  title: string;
  note: string;
  tags: string;
  expires_on: string;
  pinned: boolean;
  linked_departments: string;
  created_at: string;
}

export default function HRNotes() {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<StickyNote | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    note: '',
    tags: '',
    expires_on: '',
    pinned: false,
    linked_departments: ''
  });

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('sticky_notes')
        .select('*')
        .order('pinned', { ascending: false })
        .order('expires_on', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast({
        title: "Error",
        description: "Failed to fetch notes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePin = async (noteId: string) => {
    try {
      const { error } = await supabase.functions.invoke('note-toggle-pin', {
        body: { id: noteId }
      });

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Note pin status updated",
      });
      
      fetchNotes();
    } catch (error) {
      console.error('Error toggling pin:', error);
      toast({
        title: "Error",
        description: "Failed to update pin status",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      const { error } = await supabase
        .from('sticky_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Note deleted successfully",
      });
      
      fetchNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({
        title: "Error",
        description: "Failed to delete note",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const noteData = {
        ...formData,
        expires_on: formData.expires_on || null,
      };

      if (editingNote) {
        const { error } = await supabase
          .from('sticky_notes')
          .update(noteData)
          .eq('id', editingNote.id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Note updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('sticky_notes')
          .insert([noteData]);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Note created successfully",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchNotes();
    } catch (error) {
      console.error('Error saving note:', error);
      toast({
        title: "Error",
        description: "Failed to save note",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      note: '',
      tags: '',
      expires_on: '',
      pinned: false,
      linked_departments: ''
    });
    setEditingNote(null);
  };

  const startEdit = (note: StickyNote) => {
    setEditingNote(note);
    setFormData({
      title: note.title || '',
      note: note.note || '',
      tags: note.tags || '',
      expires_on: note.expires_on || '',
      pinned: note.pinned || false,
      linked_departments: note.linked_departments || ''
    });
    setIsDialogOpen(true);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'No expiry';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const isExpiringSoon = (dateStr: string) => {
    if (!dateStr) return false;
    const expiry = new Date(dateStr);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays >= 0;
  };

  if (loading) {
    return <div className="p-6">Loading notes...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Sticky Notes</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              New Note
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingNote ? 'Edit Note' : 'Create New Note'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="note">Note</Label>
                <Textarea
                  id="note"
                  value={formData.note}
                  onChange={(e) => setFormData({...formData, note: e.target.value})}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({...formData, tags: e.target.value})}
                  placeholder="tag1, tag2, tag3"
                />
              </div>
              <div>
                <Label htmlFor="departments">Linked Departments</Label>
                <Input
                  id="departments"
                  value={formData.linked_departments}
                  onChange={(e) => setFormData({...formData, linked_departments: e.target.value})}
                  placeholder="HR, IT, Sales"
                />
              </div>
              <div>
                <Label htmlFor="expires_on">Expires On</Label>
                <Input
                  id="expires_on"
                  type="date"
                  value={formData.expires_on}
                  onChange={(e) => setFormData({...formData, expires_on: e.target.value})}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="pinned"
                  checked={formData.pinned}
                  onCheckedChange={(checked) => setFormData({...formData, pinned: checked})}
                />
                <Label htmlFor="pinned">Pinned</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingNote ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {notes.map((note) => (
          <Card key={note.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{note.title}</CardTitle>
                  {note.pinned && <Badge variant="secondary">Pinned</Badge>}
                  {isExpiringSoon(note.expires_on) && (
                    <Badge variant="destructive">Expires Soon</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTogglePin(note.id)}
                  >
                    {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(note)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(note.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {note.note && (
                <p className="text-sm text-muted-foreground mb-2">{note.note}</p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  {note.tags && (
                    <span>Tags: {note.tags}</span>
                  )}
                  {note.linked_departments && (
                    <span>Depts: {note.linked_departments}</span>
                  )}
                </div>
                <span>Expires: {formatDate(note.expires_on)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
        {notes.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No sticky notes found. Create your first note!
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}