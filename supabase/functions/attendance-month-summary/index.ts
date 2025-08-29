import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AttendanceSummaryRequest {
  employee_id: string
  month: number
  year: number
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: { Authorization: req.headers.get('Authorization')! }
      }
    })

    const { employee_id, month, year }: AttendanceSummaryRequest = await req.json()

    console.log(`Getting attendance summary for employee ${employee_id}, ${month}/${year}`)

    // Create date range for the month
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]

    // Fetch attendance records for the month
    const { data: attendanceRecords, error } = await supabase
      .from('attendance_status')
      .select('status')
      .eq('employee_id', employee_id)
      .gte('date', startDate)
      .lte('date', endDate)

    if (error) {
      console.error('Error fetching attendance:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch attendance records' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize counters
    const summary = {
      P: 0,   // Present
      A: 0,   // Absent
      HD: 0,  // Half Day
      L: 0,   // Leave
      OD: 0,  // On Duty
      WFH: 0, // Work From Home
      lop_days: 0
    }

    // Count each status type
    attendanceRecords.forEach(record => {
      const status = record.status
      if (summary.hasOwnProperty(status)) {
        summary[status as keyof typeof summary]++
      }
    })

    // Calculate LOP days (Absent + 0.5 * Half Day)
    summary.lop_days = summary.A + (summary.HD * 0.5)

    console.log(`Attendance summary calculated:`, summary)

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error calculating attendance summary:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})