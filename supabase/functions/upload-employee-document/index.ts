import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Create FormData properly
    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: contentType }));
    formData.append('bucket', 'documents');
    formData.append('employeeId', employeeId);
    formData.append('category', category);
    formData.append('filename', fileName);

    // Use supabase-upload function instead of direct S3
    const { data: uploadData, error: uploadError } = await supabaseClient.functions.invoke('supabase-upload', {
      body: formData
    });

    if (uploadError) throw uploadError;
    const actualS3Key = uploadData.filePath;

    // Update database based on document kind
    if (documentKind === 'avatar') {
      // Update employee avatar_url
      const { error: updateError } = await supabaseClient
        .from('employees')
        .update({ avatar_url: actualS3Key })
        .eq('id', employeeId);

      if (updateError) throw updateError;
    } else if (documentKind === 'termination_letter') {
      // Handle termination letter - this would be processed elsewhere
      console.log('Termination letter uploaded:', actualS3Key);
    } else {
      // Check if this is a standard document type
      const standardDocumentTypes = ['aadhaar', 'pan', 'qualification', 'photo', 'passport_photo', 'regular_photo'];
      
      if (standardDocumentTypes.includes(documentKind)) {
        // Update employee table with specific document key
        const updateField = `${documentKind}_key`;
        const { error: updateError } = await supabaseClient
          .from('employees')
          .update({ [updateField]: actualS3Key })
          .eq('id', employeeId);

        if (updateError) throw updateError;
      } else if (documentKind === 'payslip') {
        // For payslips, just return the upload data - the payslip record will be created by the calling function
        console.log('Payslip document uploaded:', actualS3Key);
      } else {
        // Insert into employee_documents for other documents
        const { error: insertError } = await supabaseClient
          .from('employee_documents')
          .insert({
            employee_id: employeeId,
            title: fileName,
            s3_key: actualS3Key,
            content_type: contentType,
            size: buffer.length
          });

        if (insertError) throw insertError;
      }
    }

    console.log('Document uploaded successfully:', { key: actualS3Key, url: uploadData.signedUrl });

    return new Response(
      JSON.stringify({ 
        key: actualS3Key, 
        url: uploadData.signedUrl,
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