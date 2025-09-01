import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { S3Client, PutObjectCommand, GetObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3'
import { getSignedUrl } from 'https://esm.sh/@aws-sdk/s3-request-presigner@3'

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

    // Initialize S3 client
    const s3Client = new S3Client({
      region: Deno.env.get('AWS_REGION') ?? 'us-east-1',
      credentials: {
        accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? '',
      },
    })

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

    console.log('Uploading document:', { employeeId, kind, filename })

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

    const filePath = `documents/${employee.emp_code}/${kind}/${filename}`
    const bucketName = Deno.env.get('AWS_S3_BUCKET') ?? ''
    
    // Convert file to ArrayBuffer for S3 upload
    const fileBuffer = await file.arrayBuffer()
    
    // Upload file to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: filePath,
      Body: new Uint8Array(fileBuffer),
      ContentType: file.type || 'application/octet-stream',
    })

    await s3Client.send(uploadCommand)
    console.log('File uploaded to S3:', filePath)

    // Generate signed URL for download (7 days expiry)
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: filePath,
    })
    const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 60 * 60 * 24 * 7 })

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
          signed_url: signedUrl
        })
    }

    return new Response(
      JSON.stringify({
        filePath,
        signedUrl,
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