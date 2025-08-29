import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PreviewRequest {
  csvText: string
  delimiter?: string
}

const ACCEPTED_FIELDS = [
  'emp_code', 'first_name', 'last_name', 'father_name', 'mother_name', 'gender', 'marital_status', 
  'dob', 'blood_group', 'email', 'phone', 'alt_phone', 'emergency_contact_name', 'emergency_phone', 
  'permanent_address', 'current_address', 'whatsapp_number', 'brand', 'department', 'designation', 
  'manager_employee_id', 'doj', 'location', 'status', 'bank_account_name', 'bank_account_number', 
  'bank_ifsc', 'bank_branch', 'upi_id', 'monthly_ctc', 'pf_applicable', 'pt_state', 'last_hike_on', 
  'last_hike_pct', 'last_hike_amount', 'hike_cycle_months', 'aadhaar_number', 'pan_number', 
  'linkedin', 'facebook', 'instagram', 'twitter', 'other_social', 'hobbies_interests', 
  'languages_known', 'tshirt_size', 'personal_vision', 'open_box_notes', 'photo_url', 
  'passport_photo_url', 'regular_photo_url', 'qualification', 'qualification_proof_url'
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    })

    const { csvText, delimiter = ',' }: PreviewRequest = await req.json()

    console.log('Processing CSV preview, length:', csvText.length)

    // Parse CSV
    const lines = csvText.trim().split('\n')
    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ ok: false, error: 'CSV must have at least header and one data row' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process headers with flexible matching
    const rawHeaders = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''))
    const normalizedHeaders = rawHeaders.map(header => normalizeHeader(header))
    
    console.log('Raw headers:', rawHeaders)
    console.log('Normalized headers:', normalizedHeaders)

    // Get existing employees for duplicate checking
    const { data: existingEmployees } = await supabase
      .from('employees')
      .select('emp_code, email')

    const existingEmails = new Set(existingEmployees?.map(e => e.email.toLowerCase()) || [])
    const existingCodes = new Set(existingEmployees?.map(e => e.emp_code) || [])

    // Process data rows
    const rows = []
    const errors = []
    let createCount = 0
    let updateCount = 0
    let invalidCount = 0

    for (let i = 1; i < lines.length; i++) {
      const rowData = lines[i].split(delimiter).map(cell => cell.trim().replace(/"/g, ''))
      
      if (rowData.length !== rawHeaders.length) {
        errors.push({
          rowIndex: i,
          field: 'general',
          message: `Row has ${rowData.length} columns but header has ${rawHeaders.length}`
        })
        invalidCount++
        continue
      }

      const row: any = {}
      let hasValidationErrors = false

      // Map CSV columns to our fields
      for (let j = 0; j < normalizedHeaders.length; j++) {
        const fieldName = normalizedHeaders[j]
        const value = rowData[j].trim()
        
        if (ACCEPTED_FIELDS.includes(fieldName)) {
          row[fieldName] = value
        }
      }

      // Validate required fields
      if (!row.email) {
        errors.push({ rowIndex: i, field: 'email', message: 'Email is required' })
        hasValidationErrors = true
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors.push({ rowIndex: i, field: 'email', message: 'Invalid email format' })
        hasValidationErrors = true
      }

      if (!row.first_name) {
        errors.push({ rowIndex: i, field: 'first_name', message: 'First name is required' })
        hasValidationErrors = true
      }

      // Validate date fields
      ['dob', 'doj', 'last_hike_on'].forEach(dateField => {
        if (row[dateField]) {
          const parsed = parseDate(row[dateField])
          if (parsed) {
            row[dateField] = parsed
          } else {
            errors.push({ rowIndex: i, field: dateField, message: 'Invalid date format' })
            hasValidationErrors = true
          }
        }
      })

      // Validate specific formats
      if (row.aadhaar_number && !/^\d{12}$/.test(row.aadhaar_number.replace(/\s/g, ''))) {
        errors.push({ rowIndex: i, field: 'aadhaar_number', message: 'Aadhaar must be 12 digits' })
        hasValidationErrors = true
      }

      if (row.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(row.pan_number)) {
        errors.push({ rowIndex: i, field: 'pan_number', message: 'Invalid PAN format (ABCDE1234F)' })
        hasValidationErrors = true
      }

      if (row.bank_ifsc && row.bank_ifsc.length !== 11) {
        errors.push({ rowIndex: i, field: 'bank_ifsc', message: 'IFSC must be 11 characters' })
        hasValidationErrors = true
      }

      if (row.bank_account_number && row.bank_account_number.length < 9) {
        errors.push({ rowIndex: i, field: 'bank_account_number', message: 'Account number too short' })
        hasValidationErrors = true
      }

      // Coerce boolean fields
      if (row.pf_applicable) {
        row.pf_applicable = ['true', 'yes', 'y', '1'].includes(row.pf_applicable.toLowerCase())
      }

      // Validate PT state
      if (row.pt_state && !['TS', 'AP'].includes(row.pt_state.toUpperCase())) {
        errors.push({ rowIndex: i, field: 'pt_state', message: 'PT State must be TS or AP' })
        hasValidationErrors = true
      }

      // Set defaults
      if (!row.status) row.status = 'Active'
      if (!row.emp_code) row.emp_code_auto = true

      // Determine intent (create vs update)
      const emailExists = existingEmails.has(row.email.toLowerCase())
      const codeExists = row.emp_code && existingCodes.has(row.emp_code)
      
      if (emailExists || codeExists) {
        row._intent = 'update'
        updateCount++
      } else {
        row._intent = 'create'
        createCount++
      }

      if (hasValidationErrors) {
        invalidCount++
      }

      rows.push(row)
    }

    const sample = rows.slice(0, 10)
    const counts = {
      total: rows.length,
      create: createCount,
      update: updateCount,
      invalid: invalidCount
    }

    console.log('Preview completed:', counts)

    return new Response(
      JSON.stringify({
        ok: true,
        columns: normalizedHeaders.filter(h => ACCEPTED_FIELDS.includes(h)),
        sample,
        counts,
        errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in import preview:', error)
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function normalizeHeader(header: string): string {
  const normalized = header.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^\w]/g, '')
  
  // Handle common variations
  const mappings: Record<string, string> = {
    'emp_id': 'emp_code',
    'employee_code': 'emp_code', 
    'employee_id': 'emp_code',
    'joining_date': 'doj',
    'date_of_joining': 'doj',
    'birthday': 'dob',
    'date_of_birth': 'dob',
    'tshirt_size': 'tshirt_size',
    'shirt_size': 'tshirt_size',
    't_shirt_size': 'tshirt_size',
    'aadhar_number': 'aadhaar_number',
    'aadhar': 'aadhaar_number',
    'aadhaar': 'aadhaar_number',
    'pan_card_no': 'pan_number',
    'pan_no': 'pan_number',
    'pan': 'pan_number',
    'whatsapp_no': 'whatsapp_number',
    'whatsapp': 'whatsapp_number',
    'emergency_contact': 'emergency_contact_name',
    'emergency_phone_number': 'emergency_phone',
    'emergency_contact_phone': 'emergency_phone'
  }
  
  return mappings[normalized] || normalized
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null
  
  // Try various date formats
  const formats = [
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,  // yyyy-mm-dd
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // dd/mm/yyyy or mm/dd/yyyy
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/   // dd-mm-yyyy
  ]
  
  for (const format of formats) {
    const match = dateStr.match(format)
    if (match) {
      const [, p1, p2, p3] = match
      let year: number, month: number, day: number
      
      if (format === formats[0]) {
        // yyyy-mm-dd
        year = parseInt(p1)
        month = parseInt(p2) 
        day = parseInt(p3)
      } else {
        // Assume dd/mm/yyyy format for others
        day = parseInt(p1)
        month = parseInt(p2)
        year = parseInt(p3)
      }
      
      const date = new Date(year, month - 1, day)
      if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
        return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
      }
    }
  }
  
  return null
}