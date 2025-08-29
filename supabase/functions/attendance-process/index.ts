import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { start_date, end_date } = await req.json();
    const HALF_DAY_HOURS = 4;

    // Default to last 31 days if no dates provided (Asia/Kolkata timezone)
    let startDate = start_date;
    let endDate = end_date;
    
    if (!startDate || !endDate) {
      const today = new Date();
      const thirtyOneDaysAgo = new Date(today);
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
      
      startDate = thirtyOneDaysAgo.toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
    }

    console.log('Processing attendance from', startDate, 'to', endDate);

    // 1. Load all attendance_upload rows for the date range
    const { data: uploadData, error: uploadError } = await supabaseClient
      .from('attendance_upload')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate);

    if (uploadError) throw uploadError;

    console.log(`Found ${uploadData?.length || 0} attendance upload records`);

    // 2. Build map: emp_code → employees.id
    const { data: employees, error: empError } = await supabaseClient
      .from('employees')
      .select('id, emp_code');
    if (empError) throw empError;

    const empCodeMap = new Map(employees.map(emp => [emp.emp_code, emp.id]));

    // 3. Load approved leave requests and materialize date ranges
    const { data: leaveRequests, error: leaveError } = await supabaseClient
      .from('leave_requests')
      .select('employee_id, start_date, end_date')
      .eq('status', 'Approved');
    if (leaveError) throw leaveError;

    // Build leave dates map
    const leaveDatesMap = new Map<string, Set<string>>();
    leaveRequests.forEach(leave => {
      if (leave.start_date && leave.end_date) {
        const startDate = new Date(leave.start_date);
        const endDate = new Date(leave.end_date);
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          const empId = leave.employee_id;
          
          if (!leaveDatesMap.has(empId)) {
            leaveDatesMap.set(empId, new Set());
          }
          leaveDatesMap.get(empId)!.add(dateStr);
        }
      }
    });

    // 4. Process each upload row and create attendance status
    const statusRecords = [];
    const unmatchedEmpCodes = new Set<string>();
    
    for (const row of uploadData || []) {
      const employeeId = empCodeMap.get(row.emp_code);
      if (!employeeId) {
        unmatchedEmpCodes.add(row.emp_code);
        continue;
      }

      const dateStr = row.date;
      let status = 'A';
      let source = 'none';
      let workHours = 0;

      // Check if date is within any approved leave range
      if (leaveDatesMap.get(employeeId)?.has(dateStr)) {
        status = 'L';
        source = 'leave';
      } else if (row.first_swipe || row.last_swipe) {
        // Calculate work hours
        if (row.first_swipe && row.last_swipe) {
          const firstSwipe = new Date(row.first_swipe);
          const lastSwipe = new Date(row.last_swipe);
          workHours = Math.abs(lastSwipe.getTime() - firstSwipe.getTime()) / (1000 * 60 * 60);
        }
        
        status = workHours < HALF_DAY_HOURS ? 'HD' : 'P';
        source = 'device';
      }

      statusRecords.push({
        date: dateStr,
        employee_id: employeeId,
        status: status,
        work_hours: workHours,
        source: source,
        remarks: null
      });
    }

    console.log(`Processed ${statusRecords.length} attendance status records`);

    // 5. Upsert into attendance_status
    let insertedOrUpdated = 0;
    if (statusRecords.length > 0) {
      const { error: upsertError } = await supabaseClient
        .from('attendance_status')
        .upsert(statusRecords, { 
          onConflict: 'employee_id,date',
          ignoreDuplicates: false 
        });
      
      if (upsertError) throw upsertError;
      insertedOrUpdated = statusRecords.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed_rows: uploadData?.length || 0,
        inserted_or_updated: insertedOrUpdated,
        unmatched_emp_codes: Array.from(unmatchedEmpCodes),
        message: `Processed ${uploadData?.length || 0} rows. Updated ${insertedOrUpdated} attendance status records.${unmatchedEmpCodes.size > 0 ? ` Unmatched emp codes: ${Array.from(unmatchedEmpCodes).join(', ')}` : ''}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error processing attendance:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})