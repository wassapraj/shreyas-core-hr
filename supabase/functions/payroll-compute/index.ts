import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { run_id } = await req.json();
    
    console.log('Computing payroll for run_id:', run_id);

    // Load payroll_runs row
    const { data: payrollRun, error: runError } = await supabase
      .from('payroll_runs')
      .select('*')
      .eq('run_id', run_id)
      .single();

    if (runError || !payrollRun) {
      throw new Error(`Payroll run not found: ${run_id}`);
    }

    console.log('Found payroll run:', payrollRun);

    // Get all active employees
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('status', 'Active');

    if (empError) throw empError;

    console.log(`Processing payroll for ${employees?.length || 0} employees`);

    let processed = 0;
    let grossTotals = 0;
    let netTotals = 0;
    let lopTotals = 0;

    // Process each employee
    for (const employee of employees || []) {
      try {
        // Count attendance for the month/year
        const startDate = new Date(payrollRun.year, payrollRun.month - 1, 1);
        const endDate = new Date(payrollRun.year, payrollRun.month, 0);

        console.log(`Processing ${employee.emp_code} for ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

        const { data: attendance, error: attError } = await supabase
          .from('attendance_status')
          .select('status')
          .eq('employee_id', employee.id)
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);

        if (attError) {
          console.error(`Error fetching attendance for ${employee.emp_code}:`, attError);
          continue;
        }

        // Count absent and half-day
        const absentCount = attendance?.filter(a => a.status === 'A').length || 0;
        const halfDayCount = attendance?.filter(a => a.status === 'HD').length || 0;
        const lopDays = absentCount + (0.5 * halfDayCount);

        // Calculate salary components
        const ctc = Number(employee.monthly_ctc) || 0;
        const perDay = ctc / 30;
        const lopAmount = perDay * lopDays;

        const basic = 0.4 * ctc;
        const hra = 0.4 * basic;
        const special = ctc - (basic + hra);

        const pf = employee.pf_applicable ? Math.min(0.12 * basic, 1800) : 0;
        const pt = employee.pt_state === 'AP' ? 200 : 200; // Static for now
        const totalDeductions = pf + pt + lopAmount;
        const net = Math.max(0, ctc - totalDeductions);

        const breakupJson = {
          BASIC: basic,
          HRA: hra,
          SPECIAL: special,
          PF: pf,
          PT: pt,
          LOP: lopAmount
        };

        console.log(`${employee.emp_code}: CTC=${ctc}, LOP=${lopDays}, Net=${net}`);

        // Upsert payroll_items
        const { error: itemError } = await supabase
          .from('payroll_items')
          .upsert({
            run_id: run_id,
            employee_id: employee.id,
            gross: ctc,
            deductions: totalDeductions,
            net: net,
            lop_days: lopDays,
            breakup_json: breakupJson,
            paid: false
          }, {
            onConflict: 'run_id,employee_id'
          });

        if (itemError) {
          console.error(`Error upserting payroll item for ${employee.emp_code}:`, itemError);
          continue;
        }

        processed++;
        grossTotals += ctc;
        netTotals += net;
        lopTotals += lopDays;

      } catch (error) {
        console.error(`Error processing employee ${employee.emp_code}:`, error);
        continue;
      }
    }

    // Update payroll_runs status
    const { error: updateError } = await supabase
      .from('payroll_runs')
      .update({ status: 'Computed' })
      .eq('run_id', run_id);

    if (updateError) {
      console.error('Error updating payroll run status:', updateError);
    }

    const result = {
      processed,
      lopTotals: Math.round(lopTotals * 100) / 100,
      grossTotals: Math.round(grossTotals * 100) / 100,
      netTotals: Math.round(netTotals * 100) / 100
    };

    console.log('Payroll computation completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in payroll-compute:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});