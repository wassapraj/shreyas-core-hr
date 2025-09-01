import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get the current user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Check if user has HR or super_admin role
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['hr', 'super_admin']);

    if (roleError || !roles?.length) {
      return new Response(
        JSON.stringify({ error: 'Access denied. HR role required.' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const { employeeId, terminationDate, reason, notes, terminationLetterKey } = await req.json();
    
    if (!employeeId || !terminationDate || !reason) {
      return new Response(
        JSON.stringify({ error: 'Employee ID, termination date, and reason are required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`Starting termination of employee: ${employeeId}`);

    // Get employee details
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('emp_code, first_name, last_name, id')
      .eq('id', employeeId)
      .single();

    if (employeeError || !employee) {
      return new Response(
        JSON.stringify({ error: 'Employee not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Check if already terminated
    if (employee.status === 'Terminated') {
      return new Response(
        JSON.stringify({ error: 'Employee is already terminated' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Update employee status and termination details
    const { error: updateError } = await supabase
      .from('employees')
      .update({
        status: 'Terminated',
        termination_date: terminationDate,
        termination_reason: reason,
        termination_notes: notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', employeeId);

    if (updateError) {
      throw new Error(`Failed to update employee: ${updateError.message}`);
    }

    console.log(`Employee ${employee.emp_code} status updated to Terminated`);

    // End active asset assignments
    const { data: activeAssignments, error: assignmentError } = await supabase
      .from('asset_assignments')
      .update({
        returned_on: terminationDate,
        updated_at: new Date().toISOString()
      })
      .eq('employee_id', employeeId)
      .is('returned_on', null)
      .select('id');

    if (assignmentError) {
      console.error('Error updating asset assignments:', assignmentError);
    } else {
      console.log(`Ended ${activeAssignments?.length || 0} active asset assignments`);
    }

    // Store termination letter if provided
    if (terminationLetterKey) {
      try {
        await supabase
          .from('employee_documents')
          .insert({
            employee_id: employeeId,
            title: 'Termination Letter',
            file_path: terminationLetterKey
          });
        console.log('Termination letter document record created');
      } catch (docError) {
        console.error('Failed to create termination letter document record:', docError);
      }
    }

    // Add audit log
    try {
      await supabase
        .from('admin_audit_log')
        .insert({
          actor_email: user.email,
          action: 'employee_terminate',
          counts: {
            emp_code: employee.emp_code,
            employee_id: employeeId,
            termination_date: terminationDate,
            reason: reason,
            active_assignments_ended: activeAssignments?.length || 0
          }
        });
    } catch (auditError) {
      console.error('Failed to log audit entry:', auditError);
    }

    console.log(`Employee termination completed for ${employee.emp_code}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Employee terminated successfully',
        employeeCode: employee.emp_code,
        terminationDate,
        reason
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error in employee-terminate function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});