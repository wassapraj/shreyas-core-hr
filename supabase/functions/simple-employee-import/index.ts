import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

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

    // Verify user authentication and role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    // Check if user has HR or super_admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const userRoles = roles?.map(r => r.role) || [];
    if (!userRoles.includes('hr') && !userRoles.includes('super_admin')) {
      throw new Error('Insufficient permissions');
    }

    const { fileName, fileType, fileData } = await req.json();
    
    if (!fileName || !fileData) {
      throw new Error('Missing file data');
    }

    console.log(`Processing file: ${fileName}, type: ${fileType}`);

    // Convert base64 back to binary data
    const binaryString = atob(fileData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    let employees: any[] = [];

    // Parse file based on type
    if (fileType === 'text/csv' || fileName.endsWith('.csv')) {
      const text = new TextDecoder().decode(bytes);
      employees = parseCSV(text);
    } else if (fileType.includes('sheet') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = XLSX.read(bytes, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      employees = normalizeExcelData(jsonData);
    } else {
      throw new Error('Unsupported file type. Please use CSV or Excel files.');
    }

    console.log(`Parsed ${employees.length} employee records`);

    // Process and save employees
    const results = await processEmployees(supabase, employees);

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in simple-employee-import:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function parseCSV(text: string): any[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const employees = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const employee: any = {};
    
    headers.forEach((header, index) => {
      const value = values[index] || '';
      const normalizedHeader = normalizeHeader(header);
      if (normalizedHeader && value) {
        employee[normalizedHeader] = value;
      }
    });

    if (employee.first_name) {
      employees.push(employee);
    }
  }

  return employees;
}

function normalizeExcelData(data: any[]): any[] {
  return data.map(row => {
    const employee: any = {};
    
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = normalizeHeader(key as string);
      if (normalizedKey && value) {
        employee[normalizedKey] = String(value).trim();
      }
    }
    
    return employee;
  }).filter(emp => emp.first_name);
}

function normalizeHeader(header: string): string | null {
  const normalized = header.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  
  const mappings: { [key: string]: string } = {
    // Names
    'firstname': 'first_name',
    'fname': 'first_name',
    'lastname': 'last_name',
    'lname': 'last_name',
    'surname': 'last_name',
    
    // Contact
    'emailid': 'email',
    'emailaddress': 'email',
    'phonenumber': 'phone',
    'mobile': 'phone',
    'contact': 'phone',
    
    // Work details
    'dept': 'department',
    'designation': 'designation',
    'position': 'designation',
    'role': 'designation',
    'empcode': 'emp_code',
    'employeecode': 'emp_code',
    'id': 'emp_code',
    
    // Dates and salary
    'dateofjoining': 'doj',
    'joiningdate': 'doj',
    'salary': 'monthly_ctc',
    'ctc': 'monthly_ctc',
    'monthlyctc': 'monthly_ctc'
  };

  return mappings[normalized] || (normalized.includes('name') ? 'first_name' : null);
}

async function processEmployees(supabase: any, employees: any[]) {
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const emp of employees) {
    try {
      // Normalize data
      const employeeData: any = {
        first_name: emp.first_name?.trim(),
        last_name: emp.last_name?.trim() || '',
        email: emp.email?.toLowerCase().trim(),
        phone: emp.phone?.trim(),
        department: emp.department?.trim(),
        designation: emp.designation?.trim(),
        emp_code: emp.emp_code?.trim(),
        status: 'Active'
      };

      // Handle date of joining
      if (emp.doj) {
        const date = new Date(emp.doj);
        if (!isNaN(date.getTime())) {
          employeeData.doj = date.toISOString().split('T')[0];
        }
      }

      // Handle CTC
      if (emp.monthly_ctc) {
        const ctc = parseFloat(String(emp.monthly_ctc).replace(/[^0-9.]/g, ''));
        if (!isNaN(ctc)) {
          employeeData.monthly_ctc = ctc;
        }
      }

      // Generate emp_code if not provided
      if (!employeeData.emp_code) {
        const { data: lastEmployee } = await supabase
          .from('employees')
          .select('emp_code')
          .order('created_at', { ascending: false })
          .limit(1);

        const lastCode = lastEmployee?.[0]?.emp_code;
        const nextNumber = lastCode ? parseInt(lastCode.replace(/[^0-9]/g, '')) + 1 : 1000;
        employeeData.emp_code = `EMP${nextNumber.toString().padStart(4, '0')}`;
      }

      // Check if employee exists
      const { data: existing } = await supabase
        .from('employees')
        .select('id')
        .or(`email.eq.${employeeData.email},emp_code.eq.${employeeData.emp_code}`)
        .single();

      if (existing) {
        // Update existing employee
        const { error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', existing.id);

        if (error) throw error;
        updated++;
      } else {
        // Create new employee
        const { error } = await supabase
          .from('employees')
          .insert(employeeData);

        if (error) throw error;
        created++;
      }

    } catch (error) {
      console.error(`Error processing employee ${emp.first_name}:`, error);
      errors.push(`${emp.first_name}: ${error.message}`);
    }
  }

  return { created, updated, errors };
}