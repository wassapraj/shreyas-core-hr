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

    const { runId } = await req.json();
    
    if (!runId) {
      throw new Error('runId is required');
    }

    console.log('Computing payroll for run:', runId);

    // Get payroll run details
    const { data: payrollRun, error: runError } = await supabaseClient
      .from('payroll_runs')
      .select('*')
      .eq('run_id', runId)
      .single();
    
    if (runError) throw runError;
    if (!payrollRun) throw new Error('Payroll run not found');

    const { month, year } = payrollRun;

    // Get all active employees
    const { data: employees, error: empError } = await supabaseClient
      .from('employees')
      .select('*')
      .eq('status', 'Active');
    
    if (empError) throw empError;

    console.log(`Processing payroll for ${employees.length} employees`);

    // Get attendance status for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month

    const { data: attendanceData, error: attError } = await supabaseClient
      .from('attendance_status')
      .select('employee_id, status')
      .gte('date', startDate)
      .lte('date', endDate);
    
    if (attError) throw attError;

    // Group attendance by employee
    const attendanceMap = new Map<string, { absent: number; halfday: number }>();
    attendanceData.forEach(att => {
      if (!attendanceMap.has(att.employee_id)) {
        attendanceMap.set(att.employee_id, { absent: 0, halfday: 0 });
      }
      
      const emp = attendanceMap.get(att.employee_id)!;
      if (att.status === 'A') emp.absent++;
      if (att.status === 'HD') emp.halfday++;
    });

    // Process each employee
    const payrollItems = [];
    
    for (const employee of employees) {
      const attendance = attendanceMap.get(employee.id) || { absent: 0, halfday: 0 };
      
      // Calculate LOP days
      const lopDays = attendance.absent + (attendance.halfday * 0.5);
      
      // Get CTC
      const ctc = employee.monthly_ctc || 0;
      const perDay = ctc / 30; // Simple calculation, no working days initially
      const lopAmount = perDay * lopDays;
      
      // Split CTC
      const basic = ctc * 0.4;
      const hra = basic * 0.4;
      const special = ctc - basic - hra;
      
      // Calculate deductions
      const pf = employee.pf_applicable ? Math.min(basic * 0.12, 1800) : 0;
      const pt = employee.pt_state === 'AP' ? 200 : 200; // Both states get 200 for now
      
      const totalDeductions = pf + pt + lopAmount;
      const net = Math.max(0, ctc - totalDeductions);
      
      // Create breakup JSON
      const breakup = {
        BASIC: basic,
        HRA: hra,
        SPECIAL: special,
        PF: pf,
        PT: pt,
        LOP: lopAmount,
        gross: ctc,
        deductions: totalDeductions,
        net: net
      };
      
      payrollItems.push({
        run_id: runId,
        employee_id: employee.id,
        gross: ctc,
        deductions: totalDeductions,
        net: net,
        breakup_json: breakup,
        lop_days: lopDays,
        paid: false
      });
    }

    console.log(`Created ${payrollItems.length} payroll items`);

    // Upsert payroll items
    if (payrollItems.length > 0) {
      const { error: upsertError } = await supabaseClient
        .from('payroll_items')
        .upsert(payrollItems, { 
          onConflict: 'run_id,employee_id',
          ignoreDuplicates: false 
        });
      
      if (upsertError) throw upsertError;
    }

    // Update payroll run status
    const { error: updateError } = await supabaseClient
      .from('payroll_runs')
      .update({ status: 'Computed' })
      .eq('run_id', runId);
    
    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Computed payroll for ${payrollItems.length} employees`,
        processed: payrollItems.length,
        totalGross: payrollItems.reduce((sum, item) => sum + item.gross, 0),
        totalDeductions: payrollItems.reduce((sum, item) => sum + item.deductions, 0),
        totalNet: payrollItems.reduce((sum, item) => sum + item.net, 0)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error computing payroll:', error);
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