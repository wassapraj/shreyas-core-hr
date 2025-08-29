import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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
    )

    const { offer_id } = await req.json();
    
    if (!offer_id) {
      throw new Error('offer_id is required');
    }

    console.log('Converting offer to employee:', offer_id);

    // Get the offer
    const { data: offer, error: fetchError } = await supabaseClient
      .from('offers')
      .select('*')
      .eq('id', offer_id)
      .single();

    if (fetchError) throw fetchError;
    if (!offer) throw new Error('Offer not found');

    if (offer.status !== 'Accepted') {
      throw new Error('Offer must be accepted before converting to employee');
    }

    // Check if employee already exists with this email
    const { data: existingEmployee, error: existingError } = await supabaseClient
      .from('employees')
      .select('*')
      .eq('email', offer.candidate_email)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingEmployee) {
      return new Response(
        JSON.stringify({
          success: true,
          employee: existingEmployee,
          message: 'Employee already exists with this email',
          already_exists: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Split candidate name into first and last name
    const nameParts = offer.candidate_name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Generate employee code
    const codePrefix = offer.dept ? offer.dept.substring(0, 2).toUpperCase() : 'EMP';
    const randomSuffix = Math.floor(Math.random() * 9000) + 1000;
    const empCode = `${codePrefix}${randomSuffix}`;

    // Create employee record
    const { data: newEmployee, error: createError } = await supabaseClient
      .from('employees')
      .insert({
        emp_code: empCode,
        first_name: firstName,
        last_name: lastName,
        email: offer.candidate_email,
        phone: offer.candidate_phone,
        department: offer.dept,
        designation: offer.job_title,
        location: offer.location,
        doj: offer.joining_date,
        status: 'Active',
        monthly_ctc: 0 // Will be updated later by HR
      })
      .select()
      .single();

    if (createError) throw createError;

    console.log('Created employee:', newEmployee.id);

    return new Response(
      JSON.stringify({
        success: true,
        employee: newEmployee,
        message: `Successfully converted offer to employee. Employee ID: ${empCode}`,
        employee_id: newEmployee.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error converting to employee:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})