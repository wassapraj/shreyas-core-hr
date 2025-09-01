import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const { employee_id, approved_by, type, start_date, end_date, reason, days } = await req.json();

    console.log('Recording leave:', { employee_id, approved_by, type, start_date, end_date, days });

    if (!employee_id || !type || !start_date || !approved_by) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Insert leave request with pre-approved status
    const { data: leaveData, error: leaveError } = await supabase
      .from('leave_requests')
      .insert({
        employee_id,
        type,
        start_date,
        end_date: end_date || start_date,
        days: days || 1,
        reason: reason || 'HR recorded leave',
        status: 'Approved',
        approver_user_id: approved_by,
        priority_score: 1.0
      })
      .select()
      .single();

    if (leaveError) throw leaveError;

    // Generate date range for attendance updates
    const startDate = new Date(start_date);
    const endDate = new Date(end_date || start_date);
    const attendanceRecords = [];

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      attendanceRecords.push({
        employee_id,
        date: date.toISOString().split('T')[0],
        status: type === 'LOP' ? 'Absent' : 'OnLeave',
        source: 'hr_leave_record',
        work_hours: 0,
        remarks: `Leave: ${type} - ${reason || 'HR recorded leave'}`
      });
    }

    // Upsert attendance records
    const { error: attendanceError } = await supabase
      .from('attendance_status')
      .upsert(attendanceRecords, {
        onConflict: 'employee_id,date'
      });

    if (attendanceError) {
      console.error('Attendance update error:', attendanceError);
      // Don't fail the whole operation if attendance update fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          leave_id: leaveData.id,
          attendance_updated: attendanceRecords.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in leave record:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})