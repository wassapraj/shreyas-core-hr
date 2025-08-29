
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ComposeMessageRequest {
  employee_id: string
  channel: 'Email' | 'WhatsApp'
  tone: 'HR' | 'Friendly' | 'Formal'
  intent: 'onboarding' | 'docs_missing' | 'policy' | 'custom'
  custom_prompt?: string
}

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

    const { employee_id, channel, tone, intent, custom_prompt }: ComposeMessageRequest = await req.json()

    // Fetch employee details
    const { data: employee, error } = await supabase
      .from('employees')
      .select('first_name, last_name, email, phone, department, designation, brand')
      .eq('id', employee_id)
      .single()

    if (error || !employee) {
      throw new Error('Employee not found')
    }

    const fullName = `${employee.first_name} ${employee.last_name || ''}`.trim()
    let subject = ''
    let body = ''

    // Generate message based on intent and tone
    switch (intent) {
      case 'onboarding':
        subject = `Welcome to ${employee.brand || 'Aadhyasree Infotainment'} - ${fullName}!`
        body = `Dear ${employee.first_name},

Welcome to ${employee.brand || 'Aadhyasree Infotainment'}! We're excited to have you join our ${employee.department || ''} team as ${employee.designation || 'team member'}.

Please ensure you complete your onboarding checklist:
- Submit required documents
- Complete your profile information
- Attend orientation session

Looking forward to working with you!

Best regards,
HR Team`
        break

      case 'docs_missing':
        subject = `Document Submission Required - ${fullName}`
        body = `Dear ${employee.first_name},

We noticed some documents are pending in your employee profile. Please submit the following at your earliest convenience:
- Aadhaar Card copy
- PAN Card copy
- Educational certificates
- Passport size photographs

You can upload these documents through your employee portal.

Thanks for your cooperation.

Best regards,
HR Team`
        break

      case 'policy':
        subject = `Important Policy Update - ${fullName}`
        body = `Dear ${employee.first_name},

We want to inform you about an important policy update that affects all employees in the ${employee.department || ''} department.

Please review the updated policy document and acknowledge your understanding through the employee portal.

If you have any questions, please don't hesitate to reach out.

Best regards,
HR Team`
        break

      case 'custom':
        subject = `Message for ${fullName}`
        body = custom_prompt || 'Custom message content here.'
        break
    }

    // Adjust tone
    if (tone === 'Friendly') {
      body = body.replace('Dear', 'Hi').replace('Best regards,', 'Cheers,')
    } else if (tone === 'Formal') {
      body = body.replace('Hi', 'Dear').replace('Cheers,', 'Sincerely,')
    }

    // Generate mailto and WhatsApp links
    const mailto = `mailto:${employee.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    
    const whatsappText = channel === 'WhatsApp' ? 
      `Hi ${employee.first_name}, ${body.replace(/\n\n/g, '\n').replace('Dear ' + employee.first_name + ',', '')}` 
      : body
    
    const whatsappDeepLink = employee.phone ? 
      `https://wa.me/91${employee.phone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappText)}` 
      : null

    return new Response(
      JSON.stringify({
        subject,
        body,
        mailto,
        whatsappDeepLink
      }),
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
