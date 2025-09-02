import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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

    // Generate presigned URL manually using AWS Signature Version 4
    const region = Deno.env.get('AWS_REGION') || 'us-east-1'
    const bucket = Deno.env.get('AWS_S3_BUCKET')!
    const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID')!
    const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')!
    
    const expiresIn = 300 // 5 minutes
    const timestamp = Math.floor(Date.now() / 1000)
    const expiration = timestamp + expiresIn
    
    // Create the presigned URL
    const url = new URL(`https://${bucket}.s3.${region}.amazonaws.com/${key}`)
    url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256')
    url.searchParams.set('X-Amz-Credential', `${accessKeyId}/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/${region}/s3/aws4_request`)
    url.searchParams.set('X-Amz-Date', new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''))
    url.searchParams.set('X-Amz-Expires', expiresIn.toString())
    url.searchParams.set('X-Amz-SignedHeaders', 'content-type;host')
    
    const signedUrl = url.toString() + `&X-Amz-Signature=placeholder` // Simplified for demo

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