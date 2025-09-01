import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get the current user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Check if user has HR or super_admin role
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['hr', 'super_admin']);

    if (roleError || !roles?.length) {
      return new Response(
        JSON.stringify({ error: 'Access denied. HR role required.' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const { employee_id, termination_date, reason } = await req.json();

    if (!employee_id || !termination_date || !reason) {
      return new Response(
        JSON.stringify({ error: 'Employee ID, termination date, and reason are required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get employee details
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('emp_code, first_name, last_name, designation, department, doj, email')
      .eq('id', employee_id)
      .single();

    if (employeeError || !employee) {
      return new Response(
        JSON.stringify({ error: 'Employee not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Format dates
    const terminationDateFormatted = new Date(termination_date).toLocaleDateString('en-GB');
    const dojFormatted = employee.doj ? new Date(employee.doj).toLocaleDateString('en-GB') : 'N/A';

    // Generate exit letter using OpenAI
    const prompt = `Generate a professional exit letter for the following employee:

Employee Details:
- Name: ${employee.first_name} ${employee.last_name}
- Employee Code: ${employee.emp_code}
- Designation: ${employee.designation || 'N/A'}
- Department: ${employee.department || 'N/A'}
- Date of Joining: ${dojFormatted}
- Last Working Day: ${terminationDateFormatted}
- Reason: ${reason}

Please generate a formal, professional exit letter that:
1. Acknowledges the employee's contributions
2. States the termination details clearly
3. Mentions final settlement procedures
4. Maintains a neutral, respectful tone
5. Is suitable for official company records

Keep the letter concise (1 page) and professional.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an HR professional generating formal exit letters. Write professional, respectful, and legally appropriate exit letters.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const letter = data.choices[0]?.message?.content || 'Failed to generate letter';

    return new Response(
      JSON.stringify({ letter }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-exit-letter function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});