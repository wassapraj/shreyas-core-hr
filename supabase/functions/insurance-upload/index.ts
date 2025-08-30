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
    const insurerName = formData.get('insurer_name') as string
    const productName = formData.get('product_name') as string
    const policyNumber = formData.get('policy_number') as string
    const startDate = formData.get('start_date') as string
    const endDate = formData.get('end_date') as string
    const notes = formData.get('notes') as string || ''
    const filename = formData.get('filename') as string || file.name

    if (!file || !employeeId || !insurerName || !productName || !policyNumber) {
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

    const filePath = `${employee.emp_code}/${insurerName}/${filename}`
    
    // Upload file to insurance bucket
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('insurance')
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
      .from('insurance')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7)

    // Create insurance policy record
    const { data: policyData, error: policyError } = await supabaseClient
      .from('insurance_policies')
      .insert({
        employee_id: employeeId,
        insurer_name: insurerName,
        product_name: productName,
        policy_number: policyNumber,
        start_date: startDate || null,
        end_date: endDate || null,
        file_path: filePath,
        signed_url: signedUrlData?.signedUrl,
        notes
      })
      .select()
      .single()

    if (policyError) {
      console.error('Policy error:', policyError)
      return new Response(
        JSON.stringify({ error: policyError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        filePath,
        signedUrl: signedUrlData?.signedUrl,
        policy: policyData,
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