import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { S3Client, DeleteObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    const { employeeId, confirmText } = await req.json();
    
    if (!employeeId || confirmText !== 'DELETE') {
      return new Response(
        JSON.stringify({ error: 'Employee ID and confirmation text "DELETE" are required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`Starting safe deletion of employee: ${employeeId}`);

    // Initialize S3 client
    const s3Client = new S3Client({
      region: Deno.env.get('AWS_REGION') || 'us-east-1',
      credentials: {
        accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') || '',
      },
    });
    const bucketName = Deno.env.get('AWS_S3_BUCKET') || '';

    // Get employee details first
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('emp_code, first_name, last_name, id, aadhaar_key, pan_key, qualification_key, photo_key, passport_photo_key, regular_photo_key')
      .eq('id', employeeId)
      .single();

    if (employeeError || !employee) {
      return new Response(
        JSON.stringify({ error: 'Employee not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    let deletionCounts = {
      employee_documents: 0,
      payslips: 0,
      insurance_policies: 0,
      asset_assignments: 0,
      leave_requests: 0,
      messages_log: 0,
      hikes: 0,
      s3_files_deleted: 0,
      s3_files_failed: 0
    };

    const s3Keys: string[] = [];

    // Collect S3 keys from employee documents
    const { data: empDocs } = await supabase
      .from('employee_documents')
      .select('s3_key, file_path')
      .eq('employee_id', employeeId);
    
    if (empDocs) {
      empDocs.forEach(doc => {
        if (doc.s3_key) s3Keys.push(doc.s3_key);
        if (doc.file_path) s3Keys.push(doc.file_path);
      });
    }

    // Collect S3 keys from payslips
    const { data: payslips } = await supabase
      .from('payslips')
      .select('s3_key, file_path')
      .eq('employee_id', employeeId);
    
    if (payslips) {
      payslips.forEach(payslip => {
        if (payslip.s3_key) s3Keys.push(payslip.s3_key);
        if (payslip.file_path) s3Keys.push(payslip.file_path);
      });
    }

    // Collect S3 keys from insurance policies
    const { data: insurance } = await supabase
      .from('insurance_policies')
      .select('s3_key, file_path')
      .eq('employee_id', employeeId);
    
    if (insurance) {
      insurance.forEach(policy => {
        if (policy.s3_key) s3Keys.push(policy.s3_key);
        if (policy.file_path) s3Keys.push(policy.file_path);
      });
    }

    // Add employee document keys
    const employeeKeys = [
      employee.aadhaar_key,
      employee.pan_key,
      employee.qualification_key,
      employee.photo_key,
      employee.passport_photo_key,
      employee.regular_photo_key
    ].filter(Boolean);
    
    s3Keys.push(...employeeKeys);

    // Delete child records in proper order
    const tables = [
      'employee_documents',
      'payslips',
      'insurance_policies',
      'asset_assignments',
      'leave_requests',
      'messages_log',
      'hikes'
    ];

    for (const table of tables) {
      const { data: deletedRows, error } = await supabase
        .from(table)
        .delete()
        .eq('employee_id', employeeId)
        .select('id');
      
      if (error) {
        console.error(`Error deleting from ${table}:`, error);
      } else {
        deletionCounts[table as keyof typeof deletionCounts] = deletedRows?.length || 0;
        console.log(`Deleted ${deletedRows?.length || 0} records from ${table}`);
      }
    }

    // Delete S3 files (best effort)
    for (const key of s3Keys) {
      if (!key) continue;
      
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        }));
        deletionCounts.s3_files_deleted++;
      } catch (s3Error) {
        console.error(`Failed to delete S3 object ${key}:`, s3Error);
        deletionCounts.s3_files_failed++;
      }
    }

    // Release employee code to pool
    try {
      await supabase
        .from('emp_code_pool')
        .insert({
          code: employee.emp_code,
          original_employee_id: employeeId,
          released_by: user.id,
          released_at: new Date().toISOString()
        });
      console.log(`Released employee code ${employee.emp_code} to pool`);
    } catch (poolError) {
      console.error('Failed to release employee code:', poolError);
    }

    // Delete main employee record
    const { error: deleteEmployeeError } = await supabase
      .from('employees')
      .delete()
      .eq('id', employeeId);

    if (deleteEmployeeError) {
      throw new Error(`Failed to delete employee: ${deleteEmployeeError.message}`);
    }

    // Log audit entry
    try {
      await supabase
        .from('admin_audit_log')
        .insert({
          actor_email: user.email,
          action: 'employee_delete',
          counts: {
            emp_code: employee.emp_code,
            employee_id: employeeId,
            ...deletionCounts
          }
        });
    } catch (auditError) {
      console.error('Failed to log audit entry:', auditError);
    }

    console.log(`Employee ${employee.emp_code} deleted successfully with counts:`, deletionCounts);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Employee ${employee.emp_code} deleted successfully`,
        counts: deletionCounts,
        employeeCode: employee.emp_code
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in delete-employee-safe function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});