import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ComposeMessageRequest {
  employee_id: string
  kind: 'onboarding' | 'docs_missing' | 'kyc_reminder' | 'custom'
  custom_note?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: { Authorization: req.headers.get('Authorization')! }
      }
    })

    const { employee_id, kind, custom_note }: ComposeMessageRequest = await req.json()

    console.log(`Composing message for employee ${employee_id}, kind: ${kind}`)

    // Fetch employee details
    const { data: employee, error } = await supabase
      .from('employees')
      .select('first_name, last_name, emp_code, department, email, aadhaar_number, pan_number, bank_ifsc, bank_account_number, photo_url, qualification_proof_url')
      .eq('id', employee_id)
      .single()

    if (error || !employee) {
      console.error('Employee not found:', error)
      return new Response(
        JSON.stringify({ error: 'Employee not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const employeeName = `${employee.first_name} ${employee.last_name || ''}`.trim()
    const companySignature = `\n\nBest regards,\nHR Team\nAadhyasree Infotainment`

    let subject = ''
    let body = ''

    switch (kind) {
      case 'onboarding':
        subject = `Welcome to Aadhyasree Infotainment - ${employeeName}`
        body = `Dear ${employeeName},

Welcome to Aadhyasree Infotainment! We are excited to have you join our team.

Your employee code is: ${employee.emp_code}
Department: ${employee.department}

Here are your next steps:
1. Complete your profile information and upload required documents
2. Set up your workstation and access credentials
3. Attend the orientation session scheduled for your first day
4. Complete any pending KYC documentation

If you have any questions, please don't hesitate to reach out to the HR team.

${companySignature}`
        break

      case 'docs_missing':
        const missingDocs = []
        if (!employee.aadhaar_number) missingDocs.push('Aadhaar Number')
        if (!employee.pan_number) missingDocs.push('PAN Number')
        if (!employee.bank_ifsc) missingDocs.push('Bank IFSC Code')
        if (!employee.bank_account_number) missingDocs.push('Bank Account Number')
        if (!employee.photo_url) missingDocs.push('Profile Photo')
        if (!employee.qualification_proof_url) missingDocs.push('Qualification Proof')

        subject = `Document Submission Required - ${employeeName}`
        body = `Dear ${employeeName},

We need to complete your employee documentation. Please submit the following missing documents:

${missingDocs.map(doc => `• ${doc}`).join('\n')}

Please log into the employee portal and upload these documents at your earliest convenience.

${companySignature}`
        break

      case 'kyc_reminder':
        subject = `KYC Verification Reminder - ${employeeName}`
        body = `Dear ${employeeName},

This is a friendly reminder to complete your KYC verification process.

Please ensure the following details are verified and up-to-date:
• PF account details
• Professional Tax information
• Bank account details for salary processing
• Emergency contact information

Please update your profile with the correct information.

${companySignature}`
        break

      case 'custom':
        subject = `Important Communication - ${employeeName}`
        body = `Dear ${employeeName},

${custom_note || 'Please find the important communication below.'}

${companySignature}`
        break

      default:
        throw new Error('Invalid message kind')
    }

    console.log(`Message composed successfully for ${employeeName}`)

    return new Response(
      JSON.stringify({ subject, body }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error composing message:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})