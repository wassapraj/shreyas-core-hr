import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CommitRequest {
  csvText: string
  autoPrefix?: string
  startNumber?: number
  dryRun?: boolean
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

    const { csvText, autoPrefix = 'SM', startNumber, dryRun = false }: CommitRequest = await req.json()

    console.log('Starting import commit, dryRun:', dryRun)

    // Parse CSV exactly like preview
    const lines = csvText.trim().split('\n')
    const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const normalizedHeaders = rawHeaders.map(header => normalizeHeader(header))

    // Get existing employees
    const { data: existingEmployees } = await supabase
      .from('employees')
      .select('*')

    const existingByEmail = new Map()
    const existingByCode = new Map()
    existingEmployees?.forEach(emp => {
      existingByEmail.set(emp.email.toLowerCase(), emp)
      if (emp.emp_code) existingByCode.set(emp.emp_code, emp)
    })

    // Determine next employee code number
    let nextNumber = startNumber
    if (!nextNumber) {
      const existingCodes = existingEmployees
        ?.map(e => e.emp_code)
        .filter(code => code?.startsWith(autoPrefix + '-'))
        .map(code => parseInt(code.split('-')[1]))
        .filter(num => !isNaN(num)) || []
      
      nextNumber = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1
    }

    // Process rows
    const results = {
      created: 0,
      updated: 0, 
      skipped: 0,
      generated_codes: [] as Array<{email: string, emp_code: string}>,
      warnings: [] as string[]
    }

    for (let i = 1; i < lines.length; i++) {
      const rowData = lines[i].split(',').map(cell => cell.trim().replace(/"/g, ''))
      
      if (rowData.length !== rawHeaders.length) {
        results.warnings.push(`Row ${i}: Column count mismatch, skipped`)
        results.skipped++
        continue
      }

      const row: any = {}
      
      // Map columns
      for (let j = 0; j < normalizedHeaders.length; j++) {
        const fieldName = normalizedHeaders[j]
        const value = rowData[j].trim()
        
        if (ACCEPTED_FIELDS.includes(fieldName) && value) {
          row[fieldName] = value
        }
      }

      // Skip if no email or first name
      if (!row.email || !row.first_name) {
        results.warnings.push(`Row ${i}: Missing required fields (email, first_name), skipped`)
        results.skipped++
        continue
      }

      // Validate and clean data
      if (!validateAndCleanRow(row, i, results.warnings)) {
        results.skipped++
        continue
      }

      // Generate emp_code if needed
      if (!row.emp_code) {
        row.emp_code = `${autoPrefix}-${nextNumber.toString().padStart(4, '0')}`
        results.generated_codes.push({ email: row.email, emp_code: row.emp_code })
        nextNumber++
      }

      // Set defaults
      if (!row.status) row.status = 'Active'

      // Determine operation
      const existingByEmailMatch = existingByEmail.get(row.email.toLowerCase())
      const existingByCodeMatch = existingByCode.get(row.emp_code)
      
      try {
        if (!dryRun) {
          if (existingByEmailMatch || existingByCodeMatch) {
            // Update existing employee
            const existingEmployee = existingByEmailMatch || existingByCodeMatch
            const updateData = buildUpdateData(row, existingEmployee)
            
            if (Object.keys(updateData).length > 0) {
              const { error } = await supabase
                .from('employees')
                .update(updateData)
                .eq('id', existingEmployee.id)
              
              if (error) {
                console.error('Update error:', error)
                results.warnings.push(`Row ${i}: Update failed - ${error.message}`)
                results.skipped++
                continue
              }
            }
            
            results.updated++
          } else {
            // Create new employee
            const { error } = await supabase
              .from('employees')
              .insert(row)
            
            if (error) {
              console.error('Insert error:', error)
              results.warnings.push(`Row ${i}: Insert failed - ${error.message}`)
              results.skipped++
              continue
            }
            
            results.created++
          }
        } else {
          // Dry run - just count what would happen
          if (existingByEmailMatch || existingByCodeMatch) {
            results.updated++
          } else {
            results.created++
          }
        }
      } catch (error) {
        console.error('Row processing error:', error)
        results.warnings.push(`Row ${i}: Processing failed - ${error.message}`)
        results.skipped++
      }
    }

    console.log('Import completed:', results)

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in import commit:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function normalizeHeader(header: string): string {
  const normalized = header.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^\w]/g, '')
  
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

function validateAndCleanRow(row: any, rowIndex: number, warnings: string[]): boolean {
  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    warnings.push(`Row ${rowIndex}: Invalid email format`)
    return false
  }

  // Parse dates
  ['dob', 'doj', 'last_hike_on'].forEach(dateField => {
    if (row[dateField]) {
      const parsed = parseDate(row[dateField])
      if (parsed) {
        row[dateField] = parsed
      } else {
        warnings.push(`Row ${rowIndex}: Invalid ${dateField} format`)
        delete row[dateField]
      }
    }
  })

  // Validate aadhaar
  if (row.aadhaar_number && !/^\d{12}$/.test(row.aadhaar_number.replace(/\s/g, ''))) {
    warnings.push(`Row ${rowIndex}: Invalid Aadhaar format`)
    delete row.aadhaar_number
  }

  // Validate PAN
  if (row.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(row.pan_number)) {
    warnings.push(`Row ${rowIndex}: Invalid PAN format`)
    delete row.pan_number
  }

  // Validate IFSC
  if (row.bank_ifsc && row.bank_ifsc.length !== 11) {
    warnings.push(`Row ${rowIndex}: Invalid IFSC length`)
    delete row.bank_ifsc
  }

  // Coerce boolean
  if (row.pf_applicable) {
    row.pf_applicable = ['true', 'yes', 'y', '1'].includes(row.pf_applicable.toLowerCase())
  }

  // Validate PT state
  if (row.pt_state && !['TS', 'AP'].includes(row.pt_state.toUpperCase())) {
    warnings.push(`Row ${rowIndex}: Invalid PT State, using blank`)
    delete row.pt_state
  } else if (row.pt_state) {
    row.pt_state = row.pt_state.toUpperCase()
  }

  return true
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null
  
  const formats = [
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/
  ]
  
  for (const format of formats) {
    const match = dateStr.match(format)
    if (match) {
      const [, p1, p2, p3] = match
      let year: number, month: number, day: number
      
      if (format === formats[0]) {
        year = parseInt(p1)
        month = parseInt(p2)
        day = parseInt(p3)
      } else {
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

function buildUpdateData(csvRow: any, existingEmployee: any): any {
  const updateData: any = {}
  
  // Only update fields that are provided in CSV and different from existing
  // Never overwrite existing non-empty values with empty CSV values
  Object.keys(csvRow).forEach(field => {
    if (ACCEPTED_FIELDS.includes(field) && csvRow[field]) {
      const existingValue = existingEmployee[field]
      const newValue = csvRow[field]
      
      // Update if existing is null/empty or different
      if (!existingValue || existingValue !== newValue) {
        updateData[field] = newValue
      }
    }
  })
  
  return updateData
}