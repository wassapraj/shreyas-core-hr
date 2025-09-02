import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// AWS Signature V4 implementation
async function hmacSha256(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(signature);
}

function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Promise<Uint8Array> {
  return hmacSha256(new TextEncoder().encode('AWS4' + key), dateStamp)
    .then(kDate => hmacSha256(kDate, regionName))
    .then(kRegion => hmacSha256(kRegion, serviceName))
    .then(kService => hmacSha256(kService, 'aws4_request'));
}

function createCanonicalRequest(method: string, uri: string, queryString: string, headers: string, signedHeaders: string, payloadHash: string): string {
  return `${method}\n${uri}\n${queryString}\n${headers}\n${signedHeaders}\n${payloadHash}`;
}

async function generatePresignedUrl(
  bucket: string,
  key: string,
  region: string,
  accessKeyId: string,
  secretAccessKey: string,
  contentType: string,
  expiresIn: number = 300
): Promise<string> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const credential = `${accessKeyId}/${credentialScope}`;
  
  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': expiresIn.toString(),
    'X-Amz-SignedHeaders': 'content-type;host'
  });
  
  const canonicalUri = `/${key}`;
  const canonicalQueryString = queryParams.toString();
  const canonicalHeaders = `content-type:${contentType}\nhost:${bucket}.s3.${region}.amazonaws.com\n`;
  const signedHeaders = 'content-type;host';
  const payloadHash = 'UNSIGNED-PAYLOAD';
  
  const canonicalRequest = createCanonicalRequest(
    'PUT',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  );
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest)).then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''))}`;
  
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, 's3');
  const signature = Array.from(await hmacSha256(signingKey, stringToSign)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  queryParams.set('X-Amz-Signature', signature);
  
  return `https://${bucket}.s3.${region}.amazonaws.com${canonicalUri}?${queryParams.toString()}`;
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

    // Generate presigned URL using AWS Signature Version 4
    const region = Deno.env.get('AWS_REGION') || 'us-east-1'
    const bucket = Deno.env.get('AWS_S3_BUCKET')!
    const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID')!
    const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')!
    
    const signedUrl = await generatePresignedUrl(
      bucket,
      key,
      region,
      accessKeyId,
      secretAccessKey,
      contentType,
      300 // 5 minutes
    )

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