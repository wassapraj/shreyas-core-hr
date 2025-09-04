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
    // AWS credentials are now optional - fallback to Supabase Storage
    const awsAccessKey = Deno.env.get('AWS_ACCESS_KEY_ID');
    const awsSecretKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
    const awsBucket = Deno.env.get('AWS_S3_BUCKET');
    const awsRegion = Deno.env.get('AWS_REGION');

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
    
    // Convert base64 back to ArrayBuffer if needed
    let processedFileData: ArrayBuffer;
    if (typeof fileData === 'string') {
      // Assume it's base64
      const binaryString = atob(fileData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      processedFileData = bytes.buffer;
    } else {
      processedFileData = fileData;
    }
    
    console.log(`Processing file: ${fileName}, type: ${fileType}, size: ${fileSize}`);

    // Generate storage key
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const fileId = crypto.randomUUID();
    const storageKey = `imports/employees/${year}/${month}/${fileId}_${fileName}`;

    // Try to upload file (non-blocking - parsing can still work if this fails)
    let uploadResult: { success: boolean; key?: string; error?: string };
    
    // Try S3 first if credentials are available, otherwise use Supabase Storage
    if (awsAccessKey && awsSecretKey && awsBucket && awsRegion) {
      uploadResult = await uploadToS3(processedFileData, storageKey, fileType, awsAccessKey, awsSecretKey, awsBucket, awsRegion);
      console.log('S3 upload result:', uploadResult.success ? 'success' : uploadResult.error);
    } else {
      uploadResult = await uploadToSupabaseStorage(supabase, processedFileData, storageKey, fileType);
      console.log('Supabase Storage upload result:', uploadResult.success ? 'success' : uploadResult.error);
    }
    
    // Don't fail the entire process if upload fails - log it and continue
    if (!uploadResult.success) {
      console.warn(`File upload failed (non-critical): ${uploadResult.error}`);
    }

    // Save import record
    const { data: importRecord, error: importError } = await supabase
      .from('employee_imports')
      .insert({
        file_name: fileName,
        file_key: uploadResult.success ? (uploadResult.key || storageKey) : null,
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
        parsedEmployees = await parseCSV(new Uint8Array(processedFileData));
      } else if (fileType.includes('spreadsheet') || fileName.toLowerCase().match(/\.(xlsx?|xls)$/)) {
        parsedEmployees = await parseExcel(new Uint8Array(processedFileData));
      } else if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
        const text = await extractTextFromPDF(new Uint8Array(processedFileData));
        parsedEmployees = await extractEmployeeDataWithAI(text, openaiApiKey);
      } else if (fileType.includes('word') || fileName.toLowerCase().endsWith('.docx')) {
        const text = await extractTextFromDOCX(new Uint8Array(processedFileData));
        parsedEmployees = await extractEmployeeDataWithAI(text, openaiApiKey);
      } else if (fileType.includes('image') || fileName.toLowerCase().match(/\.(jpg|jpeg|png)$/)) {
        const text = await extractTextFromImage(new Uint8Array(processedFileData));
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
          importId: importRecord.id,
          uploadStatus: uploadResult.success ? 'success' : 'failed'
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

async function uploadToSupabaseStorage(supabase: any, fileData: ArrayBuffer, key: string, contentType: string) {
  try {
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(key, new Uint8Array(fileData), {
        contentType,
        upsert: false
      });

    if (error) {
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }

    return { success: true, key: data.path };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function uploadToS3(fileData: ArrayBuffer, key: string, contentType: string, awsAccessKey: string, awsSecretKey: string, awsBucket: string, awsRegion: string) {
  try {
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
      const responseText = await response.text();
      throw new Error(`S3 upload failed: ${response.status} ${response.statusText} - ${responseText}`);
    }

    return { success: true, key };
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
  try {
    // Import XLSX library dynamically
    const XLSX = await import('https://esm.sh/xlsx@0.18.5');
    
    // Read workbook from buffer
    const workbook = XLSX.read(data, { type: 'array' });
    
    // Get first worksheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('No worksheet found in Excel file');
    }
    
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with header row
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: '',
      raw: false
    });
    
    if (jsonData.length < 2) {
      return [];
    }
    
    // Get headers and normalize them
    const headers = (jsonData[0] as string[]).map(h => (h || '').toString().trim());
    const employees: any[] = [];
    
    // Process each row
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as string[];
      if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
        continue; // Skip empty rows
      }
      
      const employee: any = {};
      
      // Map each column to employee fields
      headers.forEach((header, index) => {
        const value = (row[index] || '').toString().trim();
        if (value) {
          const mappedField = mapExcelColumnHeader(header);
          if (mappedField) {
            employee[mappedField] = value;
          }
        }
      });
      
      // Only add if has essential data
      if (employee.first_name || employee.full_name || employee.email) {
        // Handle full name split
        if (employee.full_name && !employee.first_name) {
          const nameParts = employee.full_name.split(' ').filter(Boolean);
          employee.first_name = nameParts[0] || '';
          employee.last_name = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
          delete employee.full_name;
        }
        
        employees.push(normalizeEmployeeData(employee));
      }
    }
    
    return employees;
    
  } catch (error) {
    console.error('Excel parsing error:', error);
    throw new Error(`Failed to parse Excel file: ${error.message}`);
  }
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

function mapExcelColumnHeader(header: string): string | null {
  const lower = header.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, '_');
  
  const mappings: Record<string, string> = {
    // Basic Info
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
    'full_name': 'full_name',
    'name': 'full_name',
    'preferred_name': 'preferred_name',
    'nickname': 'preferred_name',
    
    // Personal Info
    'date_of_birth': 'dob',
    'dob': 'dob',
    'birth_date': 'dob',
    'gender': 'gender',
    'marital_status': 'marital_status',
    'blood_group': 'blood_group',
    
    // Contact Info
    'personal_email': 'email',
    'email': 'email',
    'email_address': 'email',
    'mail': 'email',
    'mobile': 'phone',
    'phone': 'phone',
    'phone_number': 'phone',
    'contact': 'phone',
    'alternative_phone_no': 'alt_phone',
    'alt_phone': 'alt_phone',
    'whatsapp_no': 'whatsapp_number',
    'whatsapp': 'whatsapp_number',
    'whatsapp_number': 'whatsapp_number',
    
    // Emergency Contact
    'emergency_contact_name': 'emergency_contact_name',
    'emergency_phone': 'emergency_phone',
    'emergency_contact': 'emergency_phone',
    
    // Address
    'permanent_address_is': 'permanent_address',
    'permanent_address': 'permanent_address',
    'current_address_is': 'current_address',
    'current_address': 'current_address',
    
    // Professional Info
    'qualification': 'qualification',
    'designation': 'designation',
    'role': 'designation',
    'title': 'designation',
    'position': 'designation',
    'job_title': 'designation',
    'department': 'department',
    'dept': 'department',
    'division': 'department',
    'date_of_joining': 'doj',
    'doj': 'doj',
    'joining_date': 'doj',
    'start_date': 'doj',
    'company': 'brand',
    'brand': 'brand',
    
    // Financial Info
    'salary': 'monthly_ctc',
    'ctc': 'monthly_ctc',
    'monthly_ctc': 'monthly_ctc',
    'bank_ac_no': 'bank_account_number',
    'bank_account_number': 'bank_account_number',
    'account_no': 'bank_account_number',
    'ifsc_code': 'bank_ifsc',
    'ifsc': 'bank_ifsc',
    'branch': 'bank_branch',
    'bank_branch': 'bank_branch',
    'upi_id': 'upi_id',
    'upi': 'upi_id',
    
    // Documents & IDs
    'aadhar_number': 'aadhaar_number',
    'aadhaar_number': 'aadhaar_number',
    'aadhaar': 'aadhaar_number',
    'aadhar': 'aadhaar_number',
    'pan_number': 'pan_number',
    'pan': 'pan_number',
    'aadhar_card': 'aadhaar_file_path',
    'aadhaar_card': 'aadhaar_file_path',
    'pan_card': 'pan_file_path',
    'passport_size_photo': 'passport_photo_file_path',
    'regular_photo': 'regular_photo_file_path',
    
    // Social Media & Personal
    'linkedin': 'linkedin',
    'facebook': 'facebook',
    'instagram': 'instagram',
    'twitter': 'twitter',
    'any_other': 'other_social',
    'hobbies_interests': 'hobbies_interests',
    'hobbies': 'hobbies_interests',
    'interests': 'hobbies_interests',
    'languages_known': 'languages_known',
    'languages': 'languages_known',
    't_shirt_shirt_size': 'tshirt_size',
    'tshirt_size': 'tshirt_size',
    'shirt_size': 'tshirt_size',
    'personal_vision_or_career_goal': 'personal_vision',
    'career_goal': 'personal_vision',
    'vision': 'personal_vision',
    'open_box_share_your_thoughts': 'open_box_notes',
    'thoughts': 'open_box_notes',
    'open_box': 'open_box_notes',
    
    // Status
    'status': 'status',
    'employee_status': 'status'
  };
  
  return mappings[lower] || null;
}

function mapColumnHeader(header: string): string | null {
  return mapExcelColumnHeader(header);
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