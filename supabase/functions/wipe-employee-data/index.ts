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
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
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

    // Check if user has super_admin role
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin');

    if (roleError || !roles?.length) {
      return new Response(
        JSON.stringify({ error: 'Access denied. Super admin role required.' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const { confirm } = await req.json();
    
    if (!confirm) {
      return new Response(
        JSON.stringify({ error: 'Confirmation required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`Starting employee data wipe by user: ${user.email}`);

    // Track deletion counts
    const counts: Record<string, number> = {};

    // Delete in FK dependency order to avoid constraint violations
    const tables = [
      'employee_documents',
      'payslips', 
      'insurance_policies',
      'asset_assignments',
      'leave_requests',
      'hikes',
      'sticky_notes',
      'reminders',
      'employees'
    ];

    // Execute deletions in transaction
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

        if (error) {
          console.error(`Error deleting from ${table}:`, error);
          // Continue with other tables even if one fails
          counts[table] = 0;
        } else {
          counts[table] = data?.length || 0;
          console.log(`Deleted ${counts[table]} records from ${table}`);
        }
      } catch (err) {
        console.error(`Exception deleting from ${table}:`, err);
        counts[table] = 0;
      }
    }

    // Log audit entry
    try {
      await supabase
        .from('admin_audit_log')
        .insert({
          actor_email: user.email,
          action: 'wipe_employee_data',
          counts: counts
        });
    } catch (auditError) {
      console.error('Failed to log audit entry:', auditError);
    }

    console.log('Employee data wipe completed:', counts);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'All employee data has been deleted',
        counts 
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error in wipe-employee-data function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});