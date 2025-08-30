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
    const kind = formData.get('kind') as string
    const filename = formData.get('filename') as string || file.name

    if (!file || !employeeId || !kind) {
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

    const filePath = `${employee.emp_code}/${kind}/${filename}`
    
    // Upload file to documents bucket
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('documents')
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
      .from('documents')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7)

    // Update employee table or add to employee_documents
    if (['aadhaar', 'pan', 'qualification', 'photo', 'passport_photo', 'regular_photo'].includes(kind)) {
      const updateField = `${kind}_file_path`
      await supabaseClient
        .from('employees')
        .update({ [updateField]: filePath })
        .eq('id', employeeId)
    } else if (kind === 'other') {
      const title = formData.get('title') as string || filename
      await supabaseClient
        .from('employee_documents')
        .insert({
          employee_id: employeeId,
          title,
          file_path: filePath,
          signed_url: signedUrlData?.signedUrl
        })
    }

    return new Response(
      JSON.stringify({
        filePath,
        signedUrl: signedUrlData?.signedUrl,
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