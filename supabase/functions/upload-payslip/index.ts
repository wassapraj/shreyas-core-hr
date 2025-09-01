import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { employeeId, fileName, fileData, contentType, metadata } = await req.json();

    console.log('Uploading payslip:', { employeeId, fileName, contentType, metadata });

    // First upload the document using the unified upload function
    const { data: uploadData, error: uploadError } = await supabaseClient.functions.invoke('upload-employee-document', {
      body: {
        employeeId,
        documentKind: 'payslip',
        fileName,
        fileData,
        contentType
      }
    });

    if (uploadError) throw uploadError;

    // Now create the payslip record with metadata
    const { data: payslipData, error: payslipError } = await supabaseClient
      .from('payslips')
      .insert({
        employee_id: employeeId,
        month: metadata.month,
        year: metadata.year,
        gross: metadata.gross,
        deductions: metadata.deductions,
        net: metadata.net,
        remarks: metadata.remarks,
        s3_key: uploadData.key,
        visible_to_employee: metadata.visible_to_employee
      })
      .select()
      .single();

    if (payslipError) throw payslipError;

    console.log('Payslip created successfully:', payslipData);

    return new Response(
      JSON.stringify({ 
        payslip: payslipData,
        uploadResult: uploadData,
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