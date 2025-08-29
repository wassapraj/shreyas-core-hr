import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CheckCircle, Edit, Trash2, Plus, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Reminder {
  id: string;
  title: string;
  due_date: string;
  due_time: string;
  type: string;
  channel: string;
  status: string;
  template: string;
  employee_id: string;
  employees?: {
    first_name: string;
    last_name: string;
    emp_code: string;
  };
  created_at: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  emp_code: string;
}

export default function HRReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('Open');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    due_date: '',
    due_time: '',
    type: '',
    channel: '',
    template: '',
    employee_id: ''
  });

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    try {
      // Fetch reminders
      let query = supabase
        .from('reminders')
        .select(`
          *,
          employees (
            first_name,
            last_name,
            emp_code
          )
        `)
        .order('due_date', { ascending: true });

      if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter as 'Open' | 'Done');
      }

      const { data: remindersData, error } = await query;
      if (error) throw error;

      // Fetch employees for form
      const { data: employeesData, error: empError } = await supabase
        .from('employees')
        .select('id, first_name, last_name, emp_code')
        .eq('status', 'Active')
        .order('first_name');

      if (empError) throw empError;

      setReminders(remindersData || []);
      setEmployees(employeesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
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
      
      fetchData();
    } catch (error) {
      console.error('Error marking reminder done:', error);
      toast({
        title: "Error",
        description: "Failed to mark reminder as done",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (reminderId: string) => {
    if (!confirm('Are you sure you want to delete this reminder?')) return;

    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', reminderId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Reminder deleted successfully",
      });
      
      fetchData();
    } catch (error) {
      console.error('Error deleting reminder:', error);
      toast({
        title: "Error",
        description: "Failed to delete reminder",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const reminderData = {
        title: formData.title,
        due_date: formData.due_date,
        due_time: formData.due_time || null,
        type: formData.type as 'Birthday' | 'Anniversary' | 'Hike' | 'Doc' | 'Custom',
        channel: formData.channel as 'Email' | 'WhatsApp' | 'Both',
        template: formData.template,
        employee_id: formData.employee_id || null,
      };

      if (editingReminder) {
        const { error } = await supabase
          .from('reminders')
          .update(reminderData)
          .eq('id', editingReminder.id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Reminder updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('reminders')
          .insert([{ ...reminderData, status: 'Open' as 'Open' | 'Done' }]);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Reminder created successfully",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving reminder:', error);
      toast({
        title: "Error",
        description: "Failed to save reminder",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      due_date: '',
      due_time: '',
      type: '',
      channel: '',
      template: '',
      employee_id: ''
    });
    setEditingReminder(null);
  };

  const startEdit = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setFormData({
      title: reminder.title || '',
      due_date: reminder.due_date || '',
      due_time: reminder.due_time || '',
      type: reminder.type || '',
      channel: reminder.channel || '',
      template: reminder.template || '',
      employee_id: reminder.employee_id || ''
    });
    setIsDialogOpen(true);
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
        <h1 className="text-2xl font-bold">Reminders</h1>
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="Done">Done</SelectItem>
              <SelectItem value="All">All</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                New Reminder
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingReminder ? 'Edit Reminder' : 'Create New Reminder'}
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
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="due_date">Due Date</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="due_time">Due Time</Label>
                    <Input
                      id="due_time"
                      type="time"
                      value={formData.due_time}
                      onChange={(e) => setFormData({...formData, due_time: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Birthday">Birthday</SelectItem>
                        <SelectItem value="Anniversary">Anniversary</SelectItem>
                        <SelectItem value="Hike">Hike</SelectItem>
                        <SelectItem value="Doc">Document</SelectItem>
                        <SelectItem value="Custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="channel">Channel</Label>
                    <Select value={formData.channel} onValueChange={(value) => setFormData({...formData, channel: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select channel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Email">Email</SelectItem>
                        <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                        <SelectItem value="Both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="employee_id">Employee (Optional)</Label>
                  <Select value={formData.employee_id} onValueChange={(value) => setFormData({...formData, employee_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No specific employee</SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name} ({emp.emp_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="template">Template/Notes</Label>
                  <Textarea
                    id="template"
                    value={formData.template}
                    onChange={(e) => setFormData({...formData, template: e.target.value})}
                    rows={3}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingReminder ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
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
                <div className="flex items-center gap-2">
                  {reminder.status === 'Open' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkDone(reminder.id)}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(reminder)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(reminder.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {formatDate(reminder.due_date)}
                    {reminder.due_time && ` at ${reminder.due_time}`}
                  </span>
                </div>
                {reminder.employees && (
                  <span className="text-muted-foreground">
                    For: {reminder.employees.first_name} {reminder.employees.last_name} ({reminder.employees.emp_code})
                  </span>
                )}
                {reminder.channel && (
                  <span className="text-muted-foreground">
                    Channel: {reminder.channel}
                  </span>
                )}
              </div>
              {reminder.template && (
                <p className="text-sm text-muted-foreground mt-2">{reminder.template}</p>
              )}
            </CardContent>
          </Card>
        ))}
        {reminders.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No reminders found for the selected filter.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}