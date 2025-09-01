import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { S3Client, PutObjectCommand, GetObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3';
import { getSignedUrl } from 'https://esm.sh/@aws-sdk/s3-request-presigner@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize S3 client
const s3Client = new S3Client({
  region: Deno.env.get('AWS_REGION') ?? 'us-east-1',
  credentials: {
    accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID') ?? '',
    secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? '',
  },
});

const buildKey = (employee: any, category: string, filename: string): string => {
  const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `employees/${employee.emp_code || employee.id}/${category}/${Date.now()}_${sanitized}`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { employeeId, documentKind, fileName, fileData, contentType } = await req.json();

    console.log('Uploading employee document:', { employeeId, documentKind, fileName, contentType });

    // Fetch employee details
    const { data: employee, error: employeeError } = await supabaseClient
      .from('employees')
      .select('id, emp_code, first_name, last_name')
      .eq('id', employeeId)
      .single();

    if (employeeError) throw employeeError;

    // Generate S3 key - use documentKind for category
    const category = documentKind === 'avatar' ? 'avatars' : 'documents';
    const s3Key = buildKey(employee, category, fileName);

    // Convert base64 to buffer
    const buffer = new Uint8Array(atob(fileData).split('').map(char => char.charCodeAt(0)));

    // Upload to S3
    const bucketName = Deno.env.get('AWS_S3_BUCKET') ?? '';
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
    });

    await s3Client.send(uploadCommand);

    // Update database based on document kind
    if (documentKind === 'avatar') {
      // Update employee avatar_url
      const { error: updateError } = await supabaseClient
        .from('employees')
        .update({ avatar_url: s3Key })
        .eq('id', employeeId);

      if (updateError) throw updateError;
    } else if (documentKind === 'termination_letter') {
      // Handle termination letter - this would be processed elsewhere
      console.log('Termination letter uploaded:', s3Key);
    } else {
      // Insert into employee_documents for other documents
      const { error: insertError } = await supabaseClient
        .from('employee_documents')
        .insert({
          employee_id: employeeId,
          title: fileName,
          s3_key: s3Key,
          content_type: contentType,
          size: buffer.length
        });

      if (insertError) throw insertError;
    }

    // Generate signed URL for immediate access
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });
    const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

    console.log('Document uploaded successfully:', { s3Key, signedUrl });

    return new Response(
      JSON.stringify({ 
        key: s3Key, 
        url: signedUrl,
        message: 'Document uploaded successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error uploading employee document:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});