import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { S3Client, GetObjectCommand } from "https://deno.land/x/s3_lite_client@0.7.0/mod.ts"
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
    const { key, expiresIn = 3600 } = await req.json()

    if (!key) {
      return new Response(
        JSON.stringify({ error: 'Missing key parameter' }),
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

    const command = new GetObjectCommand({
      Bucket: Deno.env.get('AWS_S3_BUCKET')!,
      Key: key,
    })

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn })

    console.log('Generated signed URL for download:', key)
    
    return new Response(
      JSON.stringify({
        signedUrl: signedUrl,
        expiresAt: new Date(Date.now() + (expiresIn * 1000)).toISOString()
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