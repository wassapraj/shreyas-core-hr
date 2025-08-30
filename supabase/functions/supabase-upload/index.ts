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
    const bucket = formData.get('bucket') as string
    const employeeId = formData.get('employee_id') as string
    const category = formData.get('category') as string
    const filename = formData.get('filename') as string || file.name

    if (!file || !bucket || !employeeId || !category) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get employee emp_code for folder structure
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

    const filePath = `${employee.emp_code}/${category}/${filename}`
    
    // Upload file
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .upload(filePath, file, { upsert: true })

    if (error) {
      console.error('Upload error:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate signed URL (7 days expiry)
    const { data: signedUrlData } = await supabaseClient.storage
      .from(bucket)
      .createSignedUrl(filePath, 60 * 60 * 24 * 7)

    return new Response(
      JSON.stringify({
        filePath: data.path,
        signedUrl: signedUrlData?.signedUrl,
        publicUrl: `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/${bucket}/${filePath}`
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