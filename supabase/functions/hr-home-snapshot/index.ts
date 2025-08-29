import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Date utility functions for Asia/Kolkata timezone
function todayIST(): Date {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

function atStartOfDayIST(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function sameMonthDay(a: Date, b: Date): boolean {
  return a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatEmployee(emp: any) {
  return {
    id: emp.id,
    emp_code: emp.emp_code,
    name: `${emp.first_name} ${emp.last_name || ''}`.trim(),
    department: emp.department
  };
}

function getNextBirthdayDaysAway(dob: string, today: Date): number {
  if (!dob) return 999;
  
  const dobDate = new Date(dob);
  const thisYear = today.getFullYear();
  let nextBirthday = new Date(thisYear, dobDate.getMonth(), dobDate.getDate());
  
  if (nextBirthday < today) {
    nextBirthday = new Date(thisYear + 1, dobDate.getMonth(), dobDate.getDate());
  }
  
  const diffTime = nextBirthday.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getNextAnniversaryDaysAway(doj: string, today: Date): number {
  if (!doj) return 999;
  
  const dojDate = new Date(doj);
  const thisYear = today.getFullYear();
  let nextAnniversary = new Date(thisYear, dojDate.getMonth(), dojDate.getDate());
  
  if (nextAnniversary < today) {
    nextAnniversary = new Date(thisYear + 1, dojDate.getMonth(), dojDate.getDate());
  }
  
  const diffTime = nextAnniversary.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { dept, manager_id } = await req.json();
    
    const now = todayIST();
    const today = atStartOfDayIST(now);
    const tomorrow = atStartOfDayIST(addDays(today, 1));

    console.log('Processing HR home snapshot with filters:', { dept, manager_id });

    // Build employee filter
    let employeeFilter = supabase
      .from('employees')
      .select('*')
      .eq('status', 'Active');

    if (dept) {
      employeeFilter = employeeFilter.eq('department', dept);
    }
    if (manager_id) {
      employeeFilter = employeeFilter.eq('manager_employee_id', manager_id);
    }

    const { data: employees, error: employeesError } = await employeeFilter;
    if (employeesError) throw employeesError;

    console.log(`Found ${employees?.length || 0} active employees`);

    const employeeIds = employees?.map(e => e.id) || [];

    // A) Today's leaves
    const { data: todayLeavesRaw, error: todayLeavesError } = await supabase
      .from('leave_requests')
      .select(`
        id, type, start_date, end_date, days,
        employee_id,
        employees!inner(id, emp_code, first_name, last_name, department)
      `)
      .eq('status', 'Approved')
      .lte('start_date', today.toISOString().split('T')[0])
      .gte('end_date', today.toISOString().split('T')[0])
      .in('employee_id', employeeIds);

    if (todayLeavesError) throw todayLeavesError;

    // B) Tomorrow's leaves
    const { data: tomorrowLeavesRaw, error: tomorrowLeavesError } = await supabase
      .from('leave_requests')
      .select(`
        id, type, start_date, end_date, days,
        employee_id,
        employees!inner(id, emp_code, first_name, last_name, department)
      `)
      .eq('status', 'Approved')
      .lte('start_date', tomorrow.toISOString().split('T')[0])
      .gte('end_date', tomorrow.toISOString().split('T')[0])
      .in('employee_id', employeeIds);

    if (tomorrowLeavesError) throw tomorrowLeavesError;

    // Process leaves data
    const todayLeaves = todayLeavesRaw?.map(leave => ({
      id: leave.id,
      employee: formatEmployee(leave.employees),
      type: leave.type,
      start_date: leave.start_date,
      end_date: leave.end_date,
      days: leave.days
    })) || [];

    const tomorrowLeaves = tomorrowLeavesRaw?.map(leave => ({
      id: leave.id,
      employee: formatEmployee(leave.employees),
      type: leave.type,
      start_date: leave.start_date,
      end_date: leave.end_date,
      days: leave.days
    })) || [];

    // C) Birthdays
    const birthdaysToday: any[] = [];
    const birthdaysNext7: any[] = [];
    const birthdaysNext30: any[] = [];

    employees?.forEach(emp => {
      if (!emp.dob) return;
      
      const daysAway = getNextBirthdayDaysAway(emp.dob, today);
      const employee = formatEmployee(emp);
      
      if (daysAway === 0) {
        birthdaysToday.push({
          employee,
          whenText: 'Today'
        });
      } else if (daysAway >= 1 && daysAway <= 7) {
        birthdaysNext7.push({
          employee,
          whenText: `In ${daysAway} day${daysAway > 1 ? 's' : ''}`
        });
      } else if (daysAway >= 8 && daysAway <= 30) {
        birthdaysNext30.push({
          employee,
          whenText: `In ${daysAway} days`
        });
      }
    });

    // D) Anniversaries
    const anniversariesToday: any[] = [];
    const anniversariesNext7: any[] = [];
    const anniversariesNext30: any[] = [];

    employees?.forEach(emp => {
      if (!emp.doj) return;
      
      const daysAway = getNextAnniversaryDaysAway(emp.doj, today);
      const employee = formatEmployee(emp);
      
      if (daysAway === 0) {
        anniversariesToday.push({
          employee,
          whenText: 'Today'
        });
      } else if (daysAway >= 1 && daysAway <= 7) {
        anniversariesNext7.push({
          employee,
          whenText: `In ${daysAway} day${daysAway > 1 ? 's' : ''}`
        });
      } else if (daysAway >= 8 && daysAway <= 30) {
        anniversariesNext30.push({
          employee,
          whenText: `In ${daysAway} days`
        });
      }
    });

    // E) Hike Watch
    const hikeOverdue: any[] = [];
    const hikeThisMonth: any[] = [];
    const hikeNext60: any[] = [];

    employees?.forEach(emp => {
      if (!emp.last_hike_on) return;
      
      const lastHikeDate = new Date(emp.last_hike_on);
      const nextDue = addMonths(lastHikeDate, emp.hike_cycle_months || 12);
      const employee = formatEmployee(emp);
      
      const hikeData = {
        employee,
        last_hike_on: emp.last_hike_on,
        next_due: nextDue.toISOString().split('T')[0]
      };
      
      if (nextDue < today) {
        hikeOverdue.push(hikeData);
      } else if (nextDue.getMonth() === today.getMonth() && nextDue.getFullYear() === today.getFullYear()) {
        hikeThisMonth.push(hikeData);
      } else if (nextDue > today && nextDue <= addDays(today, 60)) {
        hikeNext60.push(hikeData);
      }
    });

    // F) Sticky Notes
    const { data: stickyNotes, error: notesError } = await supabase
      .from('sticky_notes')
      .select('id, title, note, tags, expires_on, pinned')
      .order('pinned', { ascending: false })
      .order('expires_on', { ascending: true, nullsFirst: false })
      .limit(10);

    if (notesError) throw notesError;

    const notes = stickyNotes?.map(note => ({
      id: note.id,
      title: note.title,
      note: note.note,
      tags: note.tags,
      expires_on: note.expires_on,
      pinned: note.pinned
    })) || [];

    // G) Reminders
    const { data: reminders, error: remindersError } = await supabase
      .from('reminders')
      .select(`
        id, title, due_date, due_time, type,
        employee_id,
        employees(id, emp_code, first_name, last_name, department)
      `)
      .eq('status', 'Open')
      .order('due_date', { ascending: true })
      .limit(10);

    if (remindersError) throw remindersError;

    const openReminders = reminders?.map(reminder => ({
      id: reminder.id,
      title: reminder.title,
      due_date: reminder.due_date,
      due_time: reminder.due_time,
      type: reminder.type,
      employee: reminder.employees ? formatEmployee(reminder.employees) : null
    })) || [];

    const result = {
      todayLeaves,
      tomorrowLeaves,
      birthdays: {
        today: birthdaysToday,
        next7: birthdaysNext7,
        next30: birthdaysNext30
      },
      anniversaries: {
        today: anniversariesToday,
        next7: anniversariesNext7,
        next30: anniversariesNext30
      },
      hikeWatch: {
        overdue: hikeOverdue,
        thisMonth: hikeThisMonth,
        next60: hikeNext60
      },
      stickyNotes: notes,
      reminders: openReminders
    };

    console.log('HR home snapshot completed successfully');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in hr-home-snapshot:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});