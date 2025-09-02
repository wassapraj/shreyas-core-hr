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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
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

    // Generate storage path
    const category = documentKind === 'avatar' ? 'avatars' : 'documents';
    const storagePath = buildKey(employee, category, fileName);

    // Convert base64 to buffer
    const byteCharacters = atob(fileData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const buffer = new Uint8Array(byteNumbers);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: contentType,
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Generate signed URL
    const { data: signedUrlData } = await supabaseClient.storage
      .from('documents')
      .createSignedUrl(storagePath, 604800); // 7 days

    const actualStorageKey = uploadData.path;
    const signedUrl = signedUrlData?.signedUrl;

    // Update database based on document kind
    if (documentKind === 'avatar') {
      // Update employee avatar_url
      const { error: updateError } = await supabaseClient
        .from('employees')
        .update({ avatar_url: actualStorageKey })
        .eq('id', employeeId);

      if (updateError) throw updateError;
    } else if (documentKind === 'termination_letter') {
      // Handle termination letter - this would be processed elsewhere
      console.log('Termination letter uploaded:', actualStorageKey);
    } else {
      // Check if this is a standard document type
      const standardDocumentTypes = ['aadhaar', 'pan', 'qualification', 'photo', 'passport_photo', 'regular_photo'];
      
      if (standardDocumentTypes.includes(documentKind)) {
        // Update employee table with specific document key
        const updateField = `${documentKind}_key`;
        const { error: updateError } = await supabaseClient
          .from('employees')
          .update({ [updateField]: actualStorageKey })
          .eq('id', employeeId);

        if (updateError) throw updateError;
      } else if (documentKind === 'payslip') {
        // For payslips, just return the upload data - the payslip record will be created by the calling function
        console.log('Payslip document uploaded:', actualStorageKey);
      } else {
        // Insert into employee_documents for other documents
        const { error: insertError } = await supabaseClient
          .from('employee_documents')
          .insert({
            employee_id: employeeId,
            title: fileName,
            file_path: actualStorageKey,
            content_type: contentType,
            signed_url: signedUrl
          });

        if (insertError) throw insertError;
      }
    }

    console.log('Document uploaded successfully:', { key: actualStorageKey, url: signedUrl });

    return new Response(
      JSON.stringify({ 
        key: actualStorageKey, 
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