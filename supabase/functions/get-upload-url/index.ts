import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { S3Client, PutObjectCommand } from "https://deno.land/x/s3_lite_client@0.7.0/mod.ts"
import { getSignedUrl } from "https://deno.land/x/s3_lite_client@0.7.0/sign.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { employeeId, category, fileName, contentType } = await req.json()

    if (!employeeId || !category || !fileName || !contentType) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate file types based on category
    const allowedTypes = {
      'profile': ['image/jpeg', 'image/png', 'image/webp'],
      'documents': ['application/pdf', 'image/jpeg', 'image/png'],
      'insurance': ['application/pdf', 'image/jpeg', 'image/png'],
      'payslips': ['application/pdf']
    }

    if (!allowedTypes[category]?.includes(contentType)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid file type for ${category}. Allowed: ${allowedTypes[category]?.join(', ')}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const s3Client = new S3Client({
      endPoint: 's3.amazonaws.com',
      useSSL: true,
      accessKey: Deno.env.get('AWS_ACCESS_KEY_ID')!,
      secretKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')!,
      region: Deno.env.get('AWS_REGION') || 'us-east-1',
    })

    // Generate S3 key based on category
    const timestamp = Date.now()
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    
    let key: string
    if (category === 'payslips') {
      const date = new Date()
      key = `employees/${employeeId}/payslips/${date.getFullYear()}/${date.getMonth() + 1}-${timestamp}_${sanitizedFileName}`
    } else {
      key = `employees/${employeeId}/${category}/${timestamp}_${sanitizedFileName}`
    }

    const command = new PutObjectCommand({
      Bucket: Deno.env.get('AWS_S3_BUCKET')!,
      Key: key,
      ContentType: contentType,
    })

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }) // 5 minutes

    console.log('Generated signed URL for upload:', key)
    
    return new Response(
      JSON.stringify({
        uploadUrl: signedUrl,
        key: key,
        expiresIn: 300
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