import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, isSameDay, parseISO } from 'date-fns';
import { 
  Copy, 
  Calendar, 
  Clock, 
  Users, 
  Gift, 
  TrendingUp, 
  StickyNote, 
  Bell,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface DashboardData {
  todayLeaves: any[];
  tomorrowLeaves: any[];
  birthdays: {
    today: any[];
    next7: any[];
    next30: any[];
  };
  anniversaries: {
    today: any[];
    next7: any[];
    next30: any[];
  };
  hikeWatch: {
    overdue: any[];
    thisMonth: any[];
    next60: any[];
  };
  stickyNotes: any[];
  reminders: any[];
}

const HRDashboard = () => {
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<string[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [filters, setFilters] = useState({ dept: '', manager_id: '' });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventsForDate, setEventsForDate] = useState<any[]>([]);

  useEffect(() => {
    loadFilterOptions();
    loadDashboardData();
  }, []);

  const loadFilterOptions = async () => {
    try {
      // Load unique departments
      const { data: deptData } = await supabase
        .from('employees')
        .select('department')
        .eq('status', 'Active')
        .not('department', 'is', null);
      
      const uniqueDepts = [...new Set(deptData?.map(emp => emp.department).filter(Boolean))];
      setDepartments(uniqueDepts);

      // Load managers (employees who are managers)
      const { data: managerData } = await supabase
        .from('employees')
        .select('id, emp_code, first_name, last_name')
        .eq('status', 'Active')
        .not('id', 'is', null);
      
      setManagers(managerData || []);
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('hr-home-snapshot', {
        body: filters
      });

      if (error) throw error;
      setData(result);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load dashboard data"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    // Reload data with new filters
    setTimeout(() => loadDashboardData(), 100);
  };

  const copyMessage = async (kind: string, employeeName: string, dept?: string, datesText?: string) => {
    try {
      const { data: result, error } = await supabase.functions.invoke('compose-quick-message', {
        body: { kind, employee_name: employeeName, dept, datesText }
      });

      if (error) throw error;

      await navigator.clipboard.writeText(result.message);
      toast({
        title: "Copied!",
        description: "Message copied to clipboard"
      });
    } catch (error) {
      console.error('Error composing message:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to compose message"
      });
    }
  };

  const markReminderDone = async (reminderId: string) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .update({
          status: 'Done',
          done_on: new Date().toISOString()
        })
        .eq('id', reminderId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Reminder marked as done"
      });
      
      loadDashboardData();
    } catch (error) {
      console.error('Error updating reminder:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update reminder"
      });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const isExpiringSoon = (expiresOn: string) => {
    if (!expiresOn) return false;
    const expiry = new Date(expiresOn);
    const today = new Date();
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays >= 0;
  };

  const isOverdue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    return due < today;
  };

  const getEventsForDate = (date: Date) => {
    if (!data) return [];
    
    const events: any[] = [];
    
    // Add birthdays
    [...data.birthdays.today, ...data.birthdays.next7, ...data.birthdays.next30].forEach(birthday => {
      if (birthday.employee?.dob) {
        const birthDate = new Date(birthday.employee.dob);
        const thisYearBirthday = new Date(date.getFullYear(), birthDate.getMonth(), birthDate.getDate());
        if (isSameDay(thisYearBirthday, date)) {
          events.push({
            type: 'Birthday',
            title: `${birthday.employee.name}'s Birthday`,
            description: `Department: ${birthday.employee.department}`,
            icon: '🎂'
          });
        }
      }
    });

    // Add anniversaries
    [...data.anniversaries.today, ...data.anniversaries.next7, ...data.anniversaries.next30].forEach(anniversary => {
      if (anniversary.employee?.doj) {
        const joinDate = new Date(anniversary.employee.doj);
        const thisYearAnniversary = new Date(date.getFullYear(), joinDate.getMonth(), joinDate.getDate());
        if (isSameDay(thisYearAnniversary, date)) {
          const years = date.getFullYear() - joinDate.getFullYear();
          events.push({
            type: 'Anniversary',
            title: `${anniversary.employee.name}'s Work Anniversary`,
            description: `${years} years at company - Department: ${anniversary.employee.department}`,
            icon: '🎉'
          });
        }
      }
    });

    // Add leaves
    [...data.todayLeaves, ...data.tomorrowLeaves].forEach(leave => {
      const startDate = new Date(leave.start_date);
      const endDate = new Date(leave.end_date);
      if (date >= startDate && date <= endDate) {
        events.push({
          type: 'Leave',
          title: `${leave.employee.name} - ${leave.type}`,
          description: `${leave.days} day(s) - Department: ${leave.employee.department}`,
          icon: '🏖️'
        });
      }
    });

    // Add hike watch
    [...data.hikeWatch.overdue, ...data.hikeWatch.thisMonth, ...data.hikeWatch.next60].forEach(hike => {
      if (hike.nextHikeDate) {
        const hikeDate = new Date(hike.nextHikeDate);
        if (isSameDay(hikeDate, date)) {
          events.push({
            type: 'Hike Due',
            title: `${hike.employee.name} - Hike Due`,
            description: `Department: ${hike.employee.department}`,
            icon: '💰'
          });
        }
      }
    });

    // Add reminders
    data.reminders.forEach(reminder => {
      if (reminder.due_date) {
        const reminderDate = new Date(reminder.due_date);
        if (isSameDay(reminderDate, date)) {
          events.push({
            type: 'Reminder',
            title: reminder.title,
            description: `Type: ${reminder.type}`,
            icon: '🔔'
          });
        }
      }
    });

    return events;
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    setSelectedDate(date);
    const events = getEventsForDate(date);
    setEventsForDate(events);
    setShowEventModal(true);
  };

  const hasEventsOnDate = (date: Date) => {
    return getEventsForDate(date).length > 0;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold gradient-text">HR Dashboard</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="glass-card animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-5/6"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold gradient-text">HR Dashboard</h1>
        
        <div className="flex gap-3">
          <Select value={filters.dept} onValueChange={(value) => handleFilterChange('dept', value)}>
            <SelectTrigger className="w-48 form-modern">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.manager_id} onValueChange={(value) => handleFilterChange('manager_id', value)}>
            <SelectTrigger className="w-48 form-modern">
              <SelectValue placeholder="All Managers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Managers</SelectItem>
              {managers.map(manager => (
                <SelectItem key={manager.id} value={manager.id}>
                  {manager.first_name} {manager.last_name} ({manager.emp_code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Today's Leaves */}
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Today's Leaves
                </CardTitle>
                <CardDescription>{data.todayLeaves.length} employee(s)</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.todayLeaves.length === 0 ? (
                <p className="text-muted-foreground text-sm">No leaves today</p>
              ) : (
                data.todayLeaves.map((leave: any) => (
                  <div key={leave.id} className="flex items-center justify-between p-2 rounded bg-accent/10">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{leave.employee.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {leave.employee.department} • {leave.type} • {leave.days} day(s)
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyMessage('leave_notice', leave.employee.name, leave.employee.department, 'today')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Tomorrow's Leaves */}
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-accent" />
                  Tomorrow's Leaves
                </CardTitle>
                <CardDescription>{data.tomorrowLeaves.length} employee(s)</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.tomorrowLeaves.length === 0 ? (
                <p className="text-muted-foreground text-sm">No leaves tomorrow</p>
              ) : (
                data.tomorrowLeaves.map((leave: any) => (
                  <div key={leave.id} className="flex items-center justify-between p-2 rounded bg-accent/10">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{leave.employee.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {leave.employee.department} • {leave.type} • {leave.days} day(s)
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyMessage('leave_notice', leave.employee.name, leave.employee.department, 'tomorrow')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Birthdays */}
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gift className="h-4 w-4 text-primary" />
                  Birthdays
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="today" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="today">Today</TabsTrigger>
                  <TabsTrigger value="next7">Next 7</TabsTrigger>
                  <TabsTrigger value="next30">Next 30</TabsTrigger>
                </TabsList>
                <TabsContent value="today" className="space-y-2">
                  {data.birthdays.today.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No birthdays today</p>
                  ) : (
                    data.birthdays.today.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded bg-accent/10">
                        <div>
                          <p className="font-medium text-sm">{item.employee.name}</p>
                          <p className="text-xs text-muted-foreground">{item.employee.department}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyMessage('birthday', item.employee.name)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </TabsContent>
                <TabsContent value="next7" className="space-y-2">
                  {data.birthdays.next7.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-accent/10">
                      <div>
                        <p className="font-medium text-sm">{item.employee.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.employee.department} • {item.whenText}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyMessage('birthday', item.employee.name)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="next30" className="space-y-2">
                  {data.birthdays.next30.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-accent/10">
                      <div>
                        <p className="font-medium text-sm">{item.employee.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.employee.department} • {item.whenText}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyMessage('birthday', item.employee.name)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Anniversaries */}
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-accent" />
                  Anniversaries
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="today" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="today">Today</TabsTrigger>
                  <TabsTrigger value="next7">Next 7</TabsTrigger>
                  <TabsTrigger value="next30">Next 30</TabsTrigger>
                </TabsList>
                <TabsContent value="today" className="space-y-2">
                  {data.anniversaries.today.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No anniversaries today</p>
                  ) : (
                    data.anniversaries.today.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded bg-accent/10">
                        <div>
                          <p className="font-medium text-sm">{item.employee.name}</p>
                          <p className="text-xs text-muted-foreground">{item.employee.department}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyMessage('anniversary', item.employee.name)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </TabsContent>
                <TabsContent value="next7" className="space-y-2">
                  {data.anniversaries.next7.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-accent/10">
                      <div>
                        <p className="font-medium text-sm">{item.employee.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.employee.department} • {item.whenText}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyMessage('anniversary', item.employee.name)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="next30" className="space-y-2">
                  {data.anniversaries.next30.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-accent/10">
                      <div>
                        <p className="font-medium text-sm">{item.employee.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.employee.department} • {item.whenText}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyMessage('anniversary', item.employee.name)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Hike Watch */}
          <Card className="glass-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Hike Watch
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-destructive" />
                    Overdue ({data.hikeWatch.overdue.length})
                  </h4>
                  {data.hikeWatch.overdue.map((item: any, idx: number) => (
                    <div key={idx} className="p-2 rounded bg-destructive/10 border border-destructive/20">
                      <p className="font-medium text-xs">{item.employee.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Last: {formatDate(item.last_hike_on)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due: {formatDate(item.next_due)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm">This Month ({data.hikeWatch.thisMonth.length})</h4>
                  {data.hikeWatch.thisMonth.map((item: any, idx: number) => (
                    <div key={idx} className="p-2 rounded bg-warning/10 border border-warning/20">
                      <p className="font-medium text-xs">{item.employee.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Last: {formatDate(item.last_hike_on)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due: {formatDate(item.next_due)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Next 60 Days ({data.hikeWatch.next60.length})</h4>
                  {data.hikeWatch.next60.map((item: any, idx: number) => (
                    <div key={idx} className="p-2 rounded bg-accent/10">
                      <p className="font-medium text-xs">{item.employee.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Last: {formatDate(item.last_hike_on)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due: {formatDate(item.next_due)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sticky Notes */}
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-warning" />
                  Sticky Notes
                </CardTitle>
                <CardDescription>Recent notes</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.stickyNotes.length === 0 ? (
                <p className="text-muted-foreground text-sm">No notes</p>
              ) : (
                data.stickyNotes.slice(0, 5).map((note: any) => (
                  <div key={note.id} className="p-3 rounded bg-card/50 border">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm">{note.title}</h4>
                      <div className="flex gap-1">
                        {note.pinned && <Badge variant="secondary" className="text-xs">Pinned</Badge>}
                        {note.expires_on && isExpiringSoon(note.expires_on) && (
                          <Badge variant="destructive" className="text-xs">Expiring</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{note.note}</p>
                    {note.expires_on && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Expires: {formatDate(note.expires_on)}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Reminders */}
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4 text-info" />
                  Open Reminders
                </CardTitle>
                <CardDescription>{data.reminders.length} pending</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.reminders.length === 0 ? (
                <p className="text-muted-foreground text-sm">No open reminders</p>
              ) : (
                data.reminders.slice(0, 5).map((reminder: any) => (
                  <div 
                    key={reminder.id} 
                    className={`p-2 rounded flex items-center justify-between ${
                      reminder.due_date && isOverdue(reminder.due_date) 
                        ? 'bg-destructive/10 border border-destructive/20' 
                        : 'bg-accent/10'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{reminder.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {reminder.due_date && (
                          <span>Due: {formatDate(reminder.due_date)}</span>
                        )}
                        {reminder.employee && (
                          <span>• {reminder.employee.name}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markReminderDone(reminder.id)}
                    >
                      <CheckCircle className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          </div>

          {/* Events Calendar - Full Width */}
          <Card className="glass-card w-full">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Events Calendar
              </CardTitle>
              <CardDescription>
                Click on a date to view events. Dates with events are highlighted.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                className="rounded-md border shadow pointer-events-auto scale-110"
                modifiers={{
                  hasEvents: (date) => hasEventsOnDate(date)
                }}
                modifiersStyles={{
                  hasEvents: { 
                    backgroundColor: 'hsl(var(--primary))', 
                    color: 'hsl(var(--primary-foreground))',
                    fontWeight: 'bold'
                  }
                }}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Event Details Modal */}
      <Dialog open={showEventModal} onOpenChange={setShowEventModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Events for {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {eventsForDate.length === 0 ? (
              <p className="text-muted-foreground text-sm">No events on this date</p>
            ) : (
              eventsForDate.map((event, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded bg-accent/10">
                  <span className="text-lg">{event.icon}</span>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                    <Badge variant="outline" className="text-xs mt-1">{event.type}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HRDashboard;