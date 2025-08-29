
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    })

    const { employee_id } = await req.json()

    // Get current date
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1)

    // Fetch employee basic info
    const { data: employee } = await supabase
      .from('employees')
      .select('dob, monthly_ctc, last_hike_on, hike_cycle_months')
      .eq('id', employee_id)
      .single()

    // Leave statistics (last 12 months)
    const { data: leaves } = await supabase
      .from('leave_requests')
      .select('status, type, days')
      .eq('employee_id', employee_id)
      .gte('created_at', twelveMonthsAgo.toISOString())

    const leaveStats = {
      totalRequests: leaves?.length || 0,
      approvedCount: leaves?.filter(l => l.status === 'Approved').length || 0,
      rejectedCount: leaves?.filter(l => l.status === 'Rejected').length || 0,
      pendingCount: leaves?.filter(l => l.status === 'Pending').length || 0,
      daysTakenByType: {
        SL: leaves?.filter(l => l.type === 'SL' && l.status === 'Approved').reduce((sum, l) => sum + (l.days || 0), 0) || 0,
        CL: leaves?.filter(l => l.type === 'CL' && l.status === 'Approved').reduce((sum, l) => sum + (l.days || 0), 0) || 0,
        EL: leaves?.filter(l => l.type === 'EL' && l.status === 'Approved').reduce((sum, l) => sum + (l.days || 0), 0) || 0,
        LOP: leaves?.filter(l => l.type === 'LOP' && l.status === 'Approved').reduce((sum, l) => sum + (l.days || 0), 0) || 0
      }
    }

    // Current month attendance
    const { data: attendance } = await supabase
      .from('attendance_status')
      .select('status')
      .eq('employee_id', employee_id)
      .gte('date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)

    const attendanceStats = {
      P: attendance?.filter(a => a.status === 'P').length || 0,
      A: attendance?.filter(a => a.status === 'A').length || 0,
      HD: attendance?.filter(a => a.status === 'HD').length || 0,
      L: attendance?.filter(a => a.status === 'L').length || 0,
      WFH: attendance?.filter(a => a.status === 'WFH').length || 0
    }

    // Birthday calculation
    let birthday = null
    let daysToBirthday = null
    if (employee?.dob) {
      const dobDate = new Date(employee.dob)
      const currentYear = now.getFullYear()
      const thisYearBirthday = new Date(currentYear, dobDate.getMonth(), dobDate.getDate())
      
      if (thisYearBirthday < now) {
        thisYearBirthday.setFullYear(currentYear + 1)
      }
      
      daysToBirthday = Math.ceil((thisYearBirthday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      birthday = {
        date: dobDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        daysToBirthday
      }
    }

    // Next hike calculation
    let nextHikeDate = null
    if (employee?.last_hike_on) {
      const lastHikeDate = new Date(employee.last_hike_on)
      const cycleMonths = employee.hike_cycle_months || 12
      const nextHike = new Date(lastHikeDate.getFullYear(), lastHikeDate.getMonth() + cycleMonths, lastHikeDate.getDate())
      nextHikeDate = nextHike.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    return new Response(
      JSON.stringify({
        leaves: leaveStats,
        attendance: attendanceStats,
        birthday,
        salary: {
          monthly_ctc: employee?.monthly_ctc || 0,
          next_hike_date: nextHikeDate
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error generating employee snapshot:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
