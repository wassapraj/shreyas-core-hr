import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const formData = await req.formData()
    const file = formData.get('file') as File
    const employeeId = formData.get('employee_id') as string
    const month = parseInt(formData.get('month') as string)
    const year = parseInt(formData.get('year') as string)
    const gross = parseFloat(formData.get('gross') as string || '0')
    const deductions = parseFloat(formData.get('deductions') as string || '0')
    const net = parseFloat(formData.get('net') as string || '0')
    const remarks = formData.get('remarks') as string || ''
    const filename = formData.get('filename') as string || file.name

    if (!file || !employeeId || !month || !year) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get employee emp_code
    const { data: employee } = await supabaseClient
      .from('employees')
      .select('emp_code')
      .eq('id', employeeId)
      .single()

    if (!employee) {
      return new Response(
        JSON.stringify({ error: 'Employee not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const filePath = `${employee.emp_code}/${year}-${month.toString().padStart(2, '0')}/${filename}`
    
    // Upload file to payslips bucket
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('payslips')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return new Response(
        JSON.stringify({ error: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate signed URL
    const { data: signedUrlData } = await supabaseClient.storage
      .from('payslips')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7)

    // Create or update payslips record
    const { data: payslipData, error: payslipError } = await supabaseClient
      .from('payslips')
      .upsert({
        employee_id: employeeId,
        month,
        year,
        gross,
        deductions,
        net,
        file_path: filePath,
        signed_url: signedUrlData?.signedUrl,
        remarks,
        visible_to_employee: true
      }, {
        onConflict: 'employee_id,month,year'
      })

    if (payslipError) {
      console.error('Payslip error:', payslipError)
      return new Response(
        JSON.stringify({ error: payslipError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        filePath,
        signedUrl: signedUrlData?.signedUrl,
        payslip: payslipData,
        success: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})