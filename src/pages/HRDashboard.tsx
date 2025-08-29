import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Users, TrendingUp, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

interface DashboardData {
  todayLeaves: any[];
  tomorrowLeaves: any[];
  birthdays: any[];
  anniversaries: any[];
  hikeWatch: any[];
  stickyNotes: any[];
  reminders: any[];
}

const HRDashboard = () => {
  const [data, setData] = useState<DashboardData>({
    todayLeaves: [],
    tomorrowLeaves: [],
    birthdays: [],
    anniversaries: [],
    hikeWatch: [],
    stickyNotes: [],
    reminders: []
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayStr = today.toISOString().split('T')[0];
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Fetch today's leaves
      const { data: todayLeaves } = await supabase
        .from('leave_requests')
        .select(`
          *,
          employees:employee_id(first_name, last_name, department)
        `)
        .eq('status', 'Approved')
        .lte('start_date', todayStr)
        .gte('end_date', todayStr);

      // Fetch tomorrow's leaves
      const { data: tomorrowLeaves } = await supabase
        .from('leave_requests')
        .select(`
          *,
          employees:employee_id(first_name, last_name, department)
        `)
        .eq('status', 'Approved')
        .lte('start_date', tomorrowStr)
        .gte('end_date', tomorrowStr);

      // Fetch birthdays (today)
      const { data: birthdays } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'Active')
        .not('dob', 'is', null);

      // Filter birthdays by month and day
      const todayBirthdays = birthdays?.filter(emp => {
        if (!emp.dob) return false;
        const empBirthday = new Date(emp.dob);
        return empBirthday.getMonth() === today.getMonth() && 
               empBirthday.getDate() === today.getDate();
      }) || [];

      // Fetch anniversaries (today)
      const todayAnniversaries = birthdays?.filter(emp => {
        if (!emp.doj) return false;
        const empAnniversary = new Date(emp.doj);
        return empAnniversary.getMonth() === today.getMonth() && 
               empAnniversary.getDate() === today.getDate();
      }) || [];

      // Fetch hike watch (overdue)
      const hikeWatch = birthdays?.filter(emp => {
        if (!emp.last_hike_on || !emp.hike_cycle_months) return false;
        const lastHike = new Date(emp.last_hike_on);
        const nextDue = new Date(lastHike);
        nextDue.setMonth(nextDue.getMonth() + emp.hike_cycle_months);
        return nextDue <= today;
      }) || [];

      // Fetch sticky notes
      const { data: stickyNotes } = await supabase
        .from('sticky_notes')
        .select('*')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch reminders
      const { data: reminders } = await supabase
        .from('reminders')
        .select('*')
        .eq('status', 'Open')
        .order('due_date', { ascending: true })
        .limit(5);

      setData({
        todayLeaves: todayLeaves || [],
        tomorrowLeaves: tomorrowLeaves || [],
        birthdays: todayBirthdays,
        anniversaries: todayAnniversaries,
        hikeWatch: hikeWatch,
        stickyNotes: stickyNotes || [],
        reminders: reminders || []
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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
        title: 'Success',
        description: 'Reminder marked as done',
      });

      fetchDashboardData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update reminder',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">HR Dashboard</h1>
        <Button onClick={fetchDashboardData}>
          Refresh
        </Button>
      </div>

      {/* Today's Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Leaves</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.todayLeaves.length}</div>
            <p className="text-xs text-muted-foreground">
              Employees on leave today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tomorrow's Leaves</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.tomorrowLeaves.length}</div>
            <p className="text-xs text-muted-foreground">
              Planned leaves tomorrow
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Birthdays</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.birthdays.length}</div>
            <p className="text-xs text-muted-foreground">
              Celebrating today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hike Due</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.hikeWatch.length}</div>
            <p className="text-xs text-muted-foreground">
              Employees overdue
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Leaves */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Leaves</CardTitle>
            <CardDescription>Employees on leave today</CardDescription>
          </CardHeader>
          <CardContent>
            {data.todayLeaves.length === 0 ? (
              <p className="text-muted-foreground">No leaves for today</p>
            ) : (
              <div className="space-y-2">
                {data.todayLeaves.map((leave) => (
                  <div key={leave.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">
                        {leave.employees?.first_name} {leave.employees?.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {leave.employees?.department} • {leave.type}
                      </p>
                    </div>
                    <Badge variant="secondary">{leave.days} days</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Birthdays & Anniversaries */}
        <Card>
          <CardHeader>
            <CardTitle>Celebrations</CardTitle>
            <CardDescription>Birthdays and anniversaries today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.birthdays.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" /> Birthdays
                  </h4>
                  <div className="space-y-1">
                    {data.birthdays.map((emp) => (
                      <div key={emp.id} className="text-sm">
                        {emp.first_name} {emp.last_name} - {emp.department}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {data.anniversaries.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Work Anniversaries
                  </h4>
                  <div className="space-y-1">
                    {data.anniversaries.map((emp) => (
                      <div key={emp.id} className="text-sm">
                        {emp.first_name} {emp.last_name} - {emp.department}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {data.birthdays.length === 0 && data.anniversaries.length === 0 && (
                <p className="text-muted-foreground">No celebrations today</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Reminders */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Reminders</CardTitle>
            <CardDescription>Tasks and reminders due</CardDescription>
          </CardHeader>
          <CardContent>
            {data.reminders.length === 0 ? (
              <p className="text-muted-foreground">No pending reminders</p>
            ) : (
              <div className="space-y-2">
                {data.reminders.map((reminder) => (
                  <div key={reminder.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex-1">
                      <p className="font-medium">{reminder.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Due: {reminder.due_date} • {reminder.type}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markReminderDone(reminder.id)}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sticky Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Sticky Notes</CardTitle>
            <CardDescription>Important notes and reminders</CardDescription>
          </CardHeader>
          <CardContent>
            {data.stickyNotes.length === 0 ? (
              <p className="text-muted-foreground">No sticky notes</p>
            ) : (
              <div className="space-y-2">
                {data.stickyNotes.map((note) => (
                  <div key={note.id} className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                    {note.pinned && (
                      <Badge variant="secondary" className="mb-2">Pinned</Badge>
                    )}
                    <h4 className="font-medium">{note.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{note.note}</p>
                    {note.expires_on && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Expires: {note.expires_on}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HRDashboard;