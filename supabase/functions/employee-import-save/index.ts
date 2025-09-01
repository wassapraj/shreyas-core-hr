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

    const { employees } = await req.json();
    
    if (!employees || !Array.isArray(employees)) {
      return new Response(
        JSON.stringify({ error: 'Invalid employees data' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`Processing ${employees.length} employees for import`);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Process employees one by one to handle duplicates
    for (const employeeData of employees) {
      try {
        const processResult = await processEmployee(supabase, employeeData);
        
        if (processResult.action === 'created') {
          created++;
        } else if (processResult.action === 'updated') {
          updated++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`Error processing employee ${employeeData.first_name}:`, error);
        skipped++;
      }
    }

    console.log(`Import completed - Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        created,
        updated,
        skipped,
        total: employees.length
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error in employee-import-save function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});

async function processEmployee(supabase: any, employeeData: any): Promise<{ action: 'created' | 'updated' | 'skipped' }> {
  // Validate required fields
  if (!employeeData.first_name?.trim()) {
    throw new Error('First name is required');
  }

  // Check for existing employee by emp_code or email
  let existingEmployee = null;
  
  if (employeeData.emp_code) {
    const { data } = await supabase
      .from('employees')
      .select('*')
      .eq('emp_code', employeeData.emp_code)
      .single();
    existingEmployee = data;
  }
  
  if (!existingEmployee && employeeData.email) {
    const { data } = await supabase
      .from('employees')
      .select('*')
      .eq('email', employeeData.email)
      .single();
    existingEmployee = data;
  }

  // Prepare employee data
  const employeeRecord = {
    first_name: employeeData.first_name.trim(),
    last_name: employeeData.last_name?.trim() || null,
    email: employeeData.email?.trim() || null,
    phone: employeeData.phone?.trim() || null,
    department: employeeData.department || null,
    designation: employeeData.designation?.trim() || null,
    location: employeeData.location?.trim() || null,
    doj: employeeData.doj || null,
    status: employeeData.status || 'Active',
    monthly_ctc: employeeData.monthly_ctc || null
  };

  if (existingEmployee) {
    // Update existing employee (only update non-empty fields)
    const updateData: any = {};
    
    Object.entries(employeeRecord).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        updateData[key] = value;
      }
    });
    
    updateData.updated_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', existingEmployee.id);

    if (updateError) {
      throw new Error(`Failed to update employee: ${updateError.message}`);
    }

    console.log(`Updated employee: ${employeeRecord.first_name} ${employeeRecord.last_name}`);
    return { action: 'updated' };

  } else {
    // Create new employee
    
    // Generate emp_code if not provided
    if (!employeeData.emp_code) {
      employeeRecord.emp_code = await generateEmpCode(supabase);
    } else {
      employeeRecord.emp_code = employeeData.emp_code;
    }

    const { data: newEmployee, error: insertError } = await supabase
      .from('employees')
      .insert(employeeRecord)
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create employee: ${insertError.message}`);
    }

    console.log(`Created employee: ${employeeRecord.first_name} ${employeeRecord.last_name} (${employeeRecord.emp_code})`);
    return { action: 'created' };
  }
}

async function generateEmpCode(supabase: any): Promise<string> {
  // Get the highest existing WM code
  const { data: employees } = await supabase
    .from('employees')
    .select('emp_code')
    .like('emp_code', 'WM%')
    .order('emp_code', { ascending: false })
    .limit(1);

  let nextNumber = 1;
  
  if (employees && employees.length > 0) {
    const highestCode = employees[0].emp_code;
    const numberPart = highestCode.replace('WM', '');
    nextNumber = parseInt(numberPart, 10) + 1;
  }

  // Check for any gaps in the sequence and reuse them
  for (let i = 1; i < nextNumber; i++) {
    const candidateCode = `WM${String(i).padStart(4, '0')}`;
    const { data: existing } = await supabase
      .from('employees')
      .select('id')
      .eq('emp_code', candidateCode)
      .single();
    
    if (!existing) {
      return candidateCode;
    }
  }

  // If no gaps, use the next number
  return `WM${String(nextNumber).padStart(4, '0')}`;
}