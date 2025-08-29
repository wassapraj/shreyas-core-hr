import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Reminder {
  id: string;
  title: string;
  due_date: string;
  due_time: string;
  type: string;
  status: string;
  template: string;
  created_at: string;
}

export default function EmployeeReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchEmployeeReminders();
    }
  }, [user]);

  const fetchEmployeeReminders = async () => {
    try {
      // First get current employee ID
      const { data: employeeData, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (empError) throw empError;
      setEmployeeId(employeeData.id);

      // Then fetch reminders for this employee
      const { data: remindersData, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('employee_id', employeeData.id)
        .order('due_date', { ascending: true });

      if (error) throw error;
      setReminders(remindersData || []);
    } catch (error) {
      console.error('Error fetching reminders:', error);
      toast({
        title: "Error",
        description: "Failed to fetch reminders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDone = async (reminderId: string) => {
    try {
      const { error } = await supabase.functions.invoke('reminder-mark-done', {
        body: { id: reminderId }
      });

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Reminder marked as done",
      });
      
      fetchEmployeeReminders();
    } catch (error) {
      console.error('Error marking reminder done:', error);
      toast({
        title: "Error",
        description: "Failed to mark reminder as done",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const isOverdue = (dateStr: string) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  if (loading) {
    return <div className="p-6">Loading reminders...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Reminders</h1>
      </div>

      <div className="grid gap-4">
        {reminders.map((reminder) => (
          <Card key={reminder.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{reminder.title}</CardTitle>
                  <Badge variant={reminder.status === 'Done' ? 'default' : 'secondary'}>
                    {reminder.status}
                  </Badge>
                  {reminder.type && (
                    <Badge variant="outline">{reminder.type}</Badge>
                  )}
                  {isOverdue(reminder.due_date) && reminder.status === 'Open' && (
                    <Badge variant="destructive">Overdue</Badge>
                  )}
                </div>
                {reminder.status === 'Open' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarkDone(reminder.id)}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Done
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Due: {formatDate(reminder.due_date)}
                  {reminder.due_time && ` at ${reminder.due_time}`}
                </span>
              </div>
              {reminder.template && (
                <p className="text-sm text-muted-foreground">{reminder.template}</p>
              )}
            </CardContent>
          </Card>
        ))}
        {reminders.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No reminders assigned to you at this time.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}