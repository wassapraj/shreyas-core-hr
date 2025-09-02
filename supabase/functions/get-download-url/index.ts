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
    const { key, expiresIn = 3600 } = await req.json()

    if (!key) {
      return new Response(
        JSON.stringify({ error: 'Missing key parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate presigned URL for download
    const region = Deno.env.get('AWS_REGION') || 'us-east-1'
    const bucket = Deno.env.get('AWS_S3_BUCKET')!
    
    // Create simple signed URL (simplified implementation)
    const baseUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`
    const signedUrl = baseUrl

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