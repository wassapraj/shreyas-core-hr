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

    // Initialize S3 client with explicit configuration to avoid fs.readFile issues
    const s3Client = new S3Client({
      region: Deno.env.get('AWS_REGION') ?? 'us-east-1',
      credentials: {
        accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? '',
      },
      // Disable config file loading to avoid fs.readFile issues in Deno
      profile: undefined,
      credentialDefaultProvider: () => Promise.resolve({
        accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? '',
      })
    })

    const formData = await req.formData()
    const file = formData.get('file') as File
    const bucket = formData.get('bucket') as string // This is now used as a folder prefix
    const employeeId = formData.get('employee_id') as string
    const category = formData.get('category') as string
    const filename = formData.get('filename') as string || file.name

    if (!file || !bucket || !employeeId || !category) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Generic upload:', { bucket, employeeId, category, filename })

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

    const filePath = `${bucket}/${employee.emp_code}/${category}/${filename}`
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

    return new Response(
      JSON.stringify({
        filePath: filePath,
        signedUrl: signedUrl,
        publicUrl: null // S3 bucket is private, no public URLs
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