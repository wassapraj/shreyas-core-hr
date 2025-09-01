import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { S3Client, PutObjectCommand, GetObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3';
import { getSignedUrl } from 'https://esm.sh/@aws-sdk/s3-request-presigner@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { 
      employee_id, 
      month, 
      year, 
      file_name, 
      file_data, 
      content_type, 
      size,
      gross, 
      deductions, 
      net, 
      remarks, 
      visible_to_employee = true 
    } = await req.json();

    console.log('Uploading payslip:', { employee_id, month, year, file_name });

    // Fetch employee details
    const { data: employee, error: employeeError } = await supabaseClient
      .from('employees')
      .select('id, emp_code, first_name, last_name')
      .eq('id', employee_id)
      .single();

    if (employeeError) throw employeeError;

    // Generate S3 key
    const s3Key = buildKey(employee, 'payslips', file_name);

    // Convert base64 to buffer
    const buffer = new Uint8Array(atob(file_data).split('').map(char => char.charCodeAt(0)));

    // Upload to S3
    const bucketName = Deno.env.get('AWS_S3_BUCKET') ?? '';
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: content_type,
    });

    await s3Client.send(uploadCommand);

    // Insert payslip record
    const { data: payslip, error: insertError } = await supabaseClient
      .from('payslips')
      .insert({
        employee_id,
        month,
        year,
        gross,
        deductions,
        net,
        remarks,
        s3_key: s3Key,
        content_type,
        size,
        visible_to_employee
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Generate signed URL
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });
    const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

    console.log('Payslip uploaded successfully:', { s3Key, payslip });

    return new Response(
      JSON.stringify({ 
        key: s3Key, 
        url: signedUrl,
        payslip,
        message: 'Payslip uploaded successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error uploading payslip:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});