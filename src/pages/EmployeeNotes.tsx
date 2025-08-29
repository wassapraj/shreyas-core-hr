import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
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

interface Employee {
  id: string;
  department: string;
}

export default function EmployeeNotes() {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchEmployeeAndNotes();
    }
  }, [user]);

  const fetchEmployeeAndNotes = async () => {
    try {
      // First get current employee info
      const { data: employeeData, error: empError } = await supabase
        .from('employees')
        .select('id, department')
        .eq('user_id', user?.id)
        .single();

      if (empError) throw empError;
      setEmployee(employeeData);

      // Then fetch visible notes
      const { data: notesData, error: notesError } = await supabase
        .from('sticky_notes')
        .select('*')
        .order('pinned', { ascending: false })
        .order('expires_on', { ascending: true, nullsFirst: false });

      if (notesError) throw notesError;

      // Filter notes based on visibility rules
      const visibleNotes = (notesData || []).filter((note) => {
        // Global notes (no links)
        if (!note.linked_departments) {
          return true;
        }

        // Department-specific notes
        if (note.linked_departments && employeeData.department) {
          const linkedDepts = note.linked_departments.split(',').map(d => d.trim().toLowerCase());
          if (linkedDepts.includes(employeeData.department.toLowerCase())) {
            return true;
          }
        }

        return false;
      });

      setNotes(visibleNotes);
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
        <h1 className="text-2xl font-bold">Company Notes</h1>
        {employee && (
          <Badge variant="outline">Department: {employee.department}</Badge>
        )}
      </div>

      <div className="grid gap-4">
        {notes.map((note) => (
          <Card key={note.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{note.title}</CardTitle>
                {note.pinned && <Badge variant="secondary">Pinned</Badge>}
                {isExpiringSoon(note.expires_on) && (
                  <Badge variant="destructive">Expires Soon</Badge>
                )}
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
                    <span>For: {note.linked_departments}</span>
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
              No notes available for you at this time.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}