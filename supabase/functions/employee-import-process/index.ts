import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

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
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
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

    const { fileName, fileType, fileSize, fileData } = await req.json();
    
    console.log(`Processing file: ${fileName}, type: ${fileType}, size: ${fileSize}`);

    // Generate S3 key
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const fileId = crypto.randomUUID();
    const s3Key = `imports/employees/${year}/${month}/${fileId}_${fileName}`;

    // Upload to S3
    const uploadResponse = await uploadToS3(fileData, s3Key, fileType);
    if (!uploadResponse.success) {
      throw new Error(`S3 upload failed: ${uploadResponse.error}`);
    }

    // Save import record
    const { data: importRecord, error: importError } = await supabase
      .from('employee_imports')
      .insert({
        file_name: fileName,
        file_key: s3Key,
        mime_type: fileType,
        file_size: fileSize,
        uploaded_by: user.id,
        status: 'processing'
      })
      .select()
      .single();

    if (importError) {
      throw new Error(`Failed to save import record: ${importError.message}`);
    }

    console.log('Import record created:', importRecord.id);

    // Parse file based on type
    let parsedEmployees: any[] = [];
    
    try {
      if (fileType === 'text/csv' || fileName.toLowerCase().endsWith('.csv')) {
        parsedEmployees = await parseCSV(new Uint8Array(fileData));
      } else if (fileType.includes('spreadsheet') || fileName.toLowerCase().match(/\.(xlsx?|xls)$/)) {
        parsedEmployees = await parseExcel(new Uint8Array(fileData));
      } else if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
        const text = await extractTextFromPDF(new Uint8Array(fileData));
        parsedEmployees = await extractEmployeeDataWithAI(text, openaiApiKey);
      } else if (fileType.includes('word') || fileName.toLowerCase().endsWith('.docx')) {
        const text = await extractTextFromDOCX(new Uint8Array(fileData));
        parsedEmployees = await extractEmployeeDataWithAI(text, openaiApiKey);
      } else if (fileType.includes('image') || fileName.toLowerCase().match(/\.(jpg|jpeg|png)$/)) {
        const text = await extractTextFromImage(new Uint8Array(fileData));
        parsedEmployees = await extractEmployeeDataWithAI(text, openaiApiKey);
      } else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }

      // Update import record with results
      await supabase
        .from('employee_imports')
        .update({
          status: 'parsed',
          processed_at: new Date().toISOString(),
          result_json: { employees: parsedEmployees, total: parsedEmployees.length }
        })
        .eq('id', importRecord.id);

      console.log(`Successfully parsed ${parsedEmployees.length} employees from ${fileName}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          employees: parsedEmployees,
          importId: importRecord.id
        }),
        { headers: corsHeaders }
      );

    } catch (parseError) {
      console.error('Parsing error:', parseError);
      
      // Update import record with error
      await supabase
        .from('employee_imports')
        .update({
          status: 'failed',
          processed_at: new Date().toISOString(),
          result_json: { error: parseError.message }
        })
        .eq('id', importRecord.id);

      throw parseError;
    }

  } catch (error) {
    console.error('Error in employee-import-process function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});

async function uploadToS3(fileData: ArrayBuffer, key: string, contentType: string) {
  try {
    const awsAccessKey = Deno.env.get('AWS_ACCESS_KEY_ID')!;
    const awsSecretKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')!;
    const awsBucket = Deno.env.get('AWS_S3_BUCKET')!;
    const awsRegion = Deno.env.get('AWS_REGION')!;

    const url = `https://${awsBucket}.s3.${awsRegion}.amazonaws.com/${key}`;
    
    // Create AWS signature
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
    const canonicalRequest = `PUT\n/${key}\n\n${canonicalHeaders}\n${signedHeaders}\nUNSIGNED-PAYLOAD`;
    
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
      method: 'PUT',
      headers: {
        'Authorization': authorization,
        'X-Amz-Date': dateString,
        'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
        'Content-Type': contentType
      },
      body: new Uint8Array(fileData)
    });

    if (!response.ok) {
      throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
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

async function parseCSV(data: Uint8Array): Promise<any[]> {
  // Simple CSV parser
  const text = new TextDecoder().decode(data);
  const lines = text.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const employees: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const employee: any = {};
    
    headers.forEach((header, index) => {
      const value = values[index] || '';
      const mappedField = mapColumnHeader(header);
      if (mappedField && value) {
        employee[mappedField] = value;
      }
    });
    
    if (employee.first_name || employee.email) {
      employees.push(normalizeEmployeeData(employee));
    }
  }
  
  return employees;
}

async function parseExcel(data: Uint8Array): Promise<any[]> {
  // For now, return empty array - would need xlsx parser
  // This is a placeholder for Excel parsing
  return [];
}

async function extractTextFromPDF(data: Uint8Array): Promise<string> {
  // Placeholder for PDF text extraction
  // Would need pdf-parse or similar library
  return "PDF text extraction not implemented";
}

async function extractTextFromDOCX(data: Uint8Array): Promise<string> {
  // Placeholder for DOCX text extraction
  // Would need mammoth or similar library
  return "DOCX text extraction not implemented";
}

async function extractTextFromImage(data: Uint8Array): Promise<string> {
  // Placeholder for OCR
  // Would need tesseract.js or similar
  return "OCR text extraction not implemented";
}

async function extractEmployeeDataWithAI(text: string, apiKey: string): Promise<any[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting employee information from documents. Extract employee data from the provided text and return it as a JSON array of employee objects.

Each employee object should have these fields (all optional except first_name):
- emp_code: string (employee code/ID)
- first_name: string (required)
- last_name: string
- email: string
- phone: string (normalize to E.164 format with +91 for Indian numbers)
- department: one of ["Digital","Film Events","Utsav Events","Corp Events","Finance","Housekeeping","Admin/IT","Creative","Managerial","Others"]
- designation: string (job title/role)
- location: string
- doj: string (date of joining in YYYY-MM-DD format)
- status: one of ["Active","Inactive","On Hold","Terminated"] (default "Active")
- monthly_ctc: number

Rules:
1. If only "Full Name" is available, split into first_name (first word) and last_name (last word)
2. Validate email format
3. Normalize phone numbers to E.164 (+91 for 10-digit Indian numbers)
4. Parse dates to YYYY-MM-DD format
5. Only include employees with at least a first_name

Return only the JSON array, no other text.`
          },
          {
            role: 'user',
            content: `Extract employee information from this text:\n\n${text}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    // Parse JSON response
    let employees: any[];
    try {
      employees = JSON.parse(content);
    } catch {
      // If JSON parsing fails, try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        employees = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse AI response as JSON');
      }
    }
    
    if (!Array.isArray(employees)) {
      throw new Error('AI response is not an array');
    }
    
    return employees.map(emp => normalizeEmployeeData(emp));
    
  } catch (error) {
    console.error('AI extraction error:', error);
    throw new Error(`Failed to extract employee data with AI: ${error.message}`);
  }
}

function mapColumnHeader(header: string): string | null {
  const lower = header.toLowerCase().trim();
  
  const mappings: Record<string, string> = {
    'emp_code': 'emp_code',
    'employee_code': 'emp_code',
    'code': 'emp_code',
    'id': 'emp_code',
    'first_name': 'first_name',
    'firstname': 'first_name',
    'name_first': 'first_name',
    'fname': 'first_name',
    'last_name': 'last_name',
    'lastname': 'last_name',
    'name_last': 'last_name',
    'lname': 'last_name',
    'surname': 'last_name',
    'email': 'email',
    'email_address': 'email',
    'mail': 'email',
    'phone': 'phone',
    'mobile': 'phone',
    'phone_number': 'phone',
    'contact': 'phone',
    'department': 'department',
    'dept': 'department',
    'division': 'department',
    'designation': 'designation',
    'role': 'designation',
    'title': 'designation',
    'position': 'designation',
    'job_title': 'designation',
    'location': 'location',
    'office': 'location',
    'city': 'location',
    'doj': 'doj',
    'date_of_joining': 'doj',
    'joining_date': 'doj',
    'start_date': 'doj',
    'status': 'status',
    'employee_status': 'status',
    'ctc': 'monthly_ctc',
    'monthly_ctc': 'monthly_ctc',
    'salary': 'monthly_ctc'
  };
  
  return mappings[lower] || null;
}

function normalizeEmployeeData(employee: any): any {
  const normalized: any = { ...employee };
  
  // Normalize phone number
  if (normalized.phone) {
    normalized.phone = normalizePhone(normalized.phone);
  }
  
  // Validate email
  if (normalized.email && !isValidEmail(normalized.email)) {
    delete normalized.email;
  }
  
  // Normalize date
  if (normalized.doj) {
    normalized.doj = normalizeDate(normalized.doj);
  }
  
  // Ensure status is valid
  if (normalized.status && !['Active', 'Inactive', 'On Hold', 'Terminated'].includes(normalized.status)) {
    normalized.status = 'Active';
  }
  
  // Convert CTC to number
  if (normalized.monthly_ctc && typeof normalized.monthly_ctc === 'string') {
    const numericValue = parseFloat(normalized.monthly_ctc.replace(/[^0-9.]/g, ''));
    normalized.monthly_ctc = isNaN(numericValue) ? undefined : numericValue;
  }
  
  return normalized;
}

function normalizePhone(phone: string): string {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If already starts with +, assume it's E.164 format
  if (cleaned.startsWith('+')) {
    return cleaned.length >= 7 ? cleaned : '';
  }
  
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');
  
  // Handle Indian numbers (10 digits)
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  
  // For other lengths, try to format with +91
  if (cleaned.length >= 7) {
    return `+91${cleaned}`;
  }
  
  return '';
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function normalizeDate(dateStr: string): string {
  try {
    // Try different date formats
    const formats = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
      /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
      /^\d{1,2}\/\d{1,2}\/\d{4}$/, // D/M/YYYY or DD/M/YYYY
    ];
    
    // If already in YYYY-MM-DD format
    if (formats[0].test(dateStr)) {
      return dateStr;
    }
    
    // Parse DD/MM/YYYY or DD-MM-YYYY formats
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      
      if (year.length === 4) {
        return `${year}-${month}-${day}`;
      }
    }
    
    // If all else fails, try to parse with Date constructor
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    return '';
  } catch {
    return '';
  }
}