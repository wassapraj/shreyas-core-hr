import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { kind, employee_name, dept, datesText } = await req.json();

    console.log('Composing quick message:', { kind, employee_name, dept, datesText });

    let message = '';

    switch (kind) {
      case 'birthday':
        message = `Happy Birthday, ${employee_name}! Wishing you a fantastic year ahead. — Shreyas Media`;
        break;
      
      case 'anniversary':
        message = `Congrats ${employee_name} on completing another year with Shreyas Media!`;
        break;
      
      case 'leave_notice':
        const deptText = dept ? ` (${dept})` : '';
        const datesPart = datesText ? ` ${datesText}` : '';
        message = `Heads-up: ${employee_name}${deptText} is on leave${datesPart}. Please plan allocations accordingly.`;
        break;
      
      default:
        throw new Error(`Unknown message kind: ${kind}`);
    }

    console.log('Generated message:', message);

    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in compose-quick-message:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});