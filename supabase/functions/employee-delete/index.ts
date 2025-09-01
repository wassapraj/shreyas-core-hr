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
    const awsAccessKey = Deno.env.get('AWS_ACCESS_KEY_ID')!;
    const awsSecretKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')!;
    const awsBucket = Deno.env.get('AWS_S3_BUCKET')!;
    const awsRegion = Deno.env.get('AWS_REGION')!;

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

    const { employeeId } = await req.json();
    
    if (!employeeId) {
      return new Response(
        JSON.stringify({ error: 'Employee ID is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`Starting deletion of employee: ${employeeId}`);

    // Get employee details for audit logging
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

    // Track deletion counts
    const deletedCounts: Record<string, number> = {};

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
      'messages_log'
    ];

    // Collect S3 keys for deletion
    const s3KeysToDelete: string[] = [];

    // Get S3 keys from documents and payslips before deletion
    const { data: documents } = await supabase
      .from('employee_documents')
      .select('file_path')
      .eq('employee_id', employeeId);
    
    if (documents) {
      s3KeysToDelete.push(...documents.map(doc => doc.file_path).filter(Boolean));
    }

    const { data: payslips } = await supabase
      .from('payslips')
      .select('file_path')
      .eq('employee_id', employeeId);
    
    if (payslips) {
      s3KeysToDelete.push(...payslips.map(p => p.file_path).filter(Boolean));
    }

    const { data: insurancePolicies } = await supabase
      .from('insurance_policies')
      .select('file_path')
      .eq('employee_id', employeeId);
    
    if (insurancePolicies) {
      s3KeysToDelete.push(...insurancePolicies.map(p => p.file_path).filter(Boolean));
    }

    // Delete from tables
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .delete()
          .eq('employee_id', employeeId)
          .select('id');

        if (error) {
          console.error(`Error deleting from ${table}:`, error);
          deletedCounts[table] = 0;
        } else {
          deletedCounts[table] = data?.length || 0;
          console.log(`Deleted ${deletedCounts[table]} records from ${table}`);
        }
      } catch (err) {
        console.error(`Exception deleting from ${table}:`, err);
        deletedCounts[table] = 0;
      }
    }

    // Release emp_code to pool
    try {
      await supabase
        .from('emp_code_pool')
        .insert({
          code: employee.emp_code,
          released_by: user.id,
          original_employee_id: employee.id
        });
      console.log(`Released emp_code ${employee.emp_code} to pool`);
    } catch (poolError) {
      console.error('Failed to release emp_code to pool:', poolError);
    }

    // Finally delete the employee record
    const { error: deleteEmployeeError } = await supabase
      .from('employees')
      .delete()
      .eq('id', employeeId);

    if (deleteEmployeeError) {
      throw new Error(`Failed to delete employee: ${deleteEmployeeError.message}`);
    }

    deletedCounts['employees'] = 1;
    console.log('Employee record deleted');

    // Delete S3 objects (best effort)
    if (s3KeysToDelete.length > 0) {
      console.log(`Attempting to delete ${s3KeysToDelete.length} S3 objects`);
      for (const s3Key of s3KeysToDelete) {
        try {
          await deleteS3Object(s3Key);
        } catch (s3Error) {
          console.error(`Failed to delete S3 object ${s3Key}:`, s3Error);
          // Continue with other deletions - this is best effort
        }
      }
    }

    // Add audit log
    try {
      await supabase
        .from('admin_audit_log')
        .insert({
          actor_email: user.email,
          action: 'employee_delete',
          counts: {
            emp_code: employee.emp_code,
            employee_id: employeeId,
            deleted_counts: deletedCounts,
            s3_files_deleted: s3KeysToDelete.length
          }
        });
    } catch (auditError) {
      console.error('Failed to log audit entry:', auditError);
    }

    console.log(`Employee deletion completed for ${employee.emp_code}:`, deletedCounts);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Employee deleted successfully',
        deletedCounts,
        empCodeReleased: employee.emp_code
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error in employee-delete function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});

async function deleteS3Object(key: string) {
  const awsAccessKey = Deno.env.get('AWS_ACCESS_KEY_ID')!;
  const awsSecretKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')!;
  const awsBucket = Deno.env.get('AWS_S3_BUCKET')!;
  const awsRegion = Deno.env.get('AWS_REGION')!;

  const url = `https://${awsBucket}.s3.${awsRegion}.amazonaws.com/${key}`;
  
  // Create AWS signature for DELETE request
  const date = new Date();
  const dateString = date.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = dateString.slice(0, 8);
  
  const encoder = new TextEncoder();
  const algorithm = 'AWS4-HMAC-SHA256';
  const service = 's3';
  const credentialScope = `${dateStamp}/${awsRegion}/${service}/aws4_request`;
  
  // Create canonical request
  const canonicalHeaders = `host:${awsBucket}.s3.${awsRegion}.amazonaws.com\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:${dateString}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `DELETE\n/${key}\n\n${canonicalHeaders}\n${signedHeaders}\nUNSIGNED-PAYLOAD`;
  
  // Create string to sign
  const hashedCanonicalRequest = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest));
  const hashedCanonicalRequestHex = Array.from(new Uint8Array(hashedCanonicalRequest))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  
  const stringToSign = `${algorithm}\n${dateString}\n${credentialScope}\n${hashedCanonicalRequestHex}`;
  
  // Create signing key
  const kDate = await hmacSha256(encoder.encode(`AWS4${awsSecretKey}`), dateStamp);
  const kRegion = await hmacSha256(kDate, awsRegion);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  
  const signature = await hmacSha256(kSigning, stringToSign);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  
  const authorization = `${algorithm} Credential=${awsAccessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': authorization,
      'X-Amz-Date': dateString,
      'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD'
    }
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`S3 delete failed: ${response.status} ${response.statusText}`);
  }

  console.log(`S3 object deleted: ${key}`);
}

async function hmacSha256(key: Uint8Array | ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}