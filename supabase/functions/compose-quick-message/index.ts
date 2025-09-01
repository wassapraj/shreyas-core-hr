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
    const { kind, employee_name, dept, datesText, channel = 'WhatsApp', tone = 'HR', custom_prompt } = await req.json();

    console.log('Composing quick message:', { kind, employee_name, dept, datesText, channel, tone });

    let message = '';

    // If custom prompt is provided, use OpenAI to generate
    if (kind === 'custom' && custom_prompt) {
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const prompt = `Generate a ${tone.toLowerCase()} ${channel.toLowerCase()} message for employee ${employee_name} (${dept}). Context: ${custom_prompt}. Keep it brief and professional.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: `You are an HR assistant. Generate ${tone.toLowerCase()} ${channel.toLowerCase()} messages.` },
            { role: 'user', content: prompt }
          ],
          max_tokens: 150,
          temperature: 0.7
        }),
      });

      const data = await response.json();
      if (data.choices?.[0]?.message?.content) {
        message = data.choices[0].message.content.trim();
      } else {
        throw new Error('Failed to generate message with OpenAI');
      }
    } else {
      // Use predefined templates
      switch (kind) {
        case 'reminder':
          if (tone === 'Friendly') {
            message = `Hi ${employee_name}! Just a friendly reminder about [topic]. Let me know if you have any questions. Thanks!`;
          } else if (tone === 'Formal') {
            message = `Dear ${employee_name}, This is a formal reminder regarding [topic]. Please address this at your earliest convenience. Best regards, HR Team`;
          } else {
            message = `Hello ${employee_name}, This is a reminder from HR regarding [topic]. Please take necessary action. Thank you.`;
          }
          break;
        
        case 'congrats':
          if (tone === 'Friendly') {
            message = `Congratulations ${employee_name}! 🎉 We're so proud of your achievements. Keep up the amazing work!`;
          } else if (tone === 'Formal') {
            message = `Dear ${employee_name}, We would like to extend our formal congratulations on your recent achievements. Your dedication is commendable. Best regards, HR Team`;
          } else {
            message = `Congratulations ${employee_name}! Your hard work and dedication have been recognized. Well done!`;
          }
          break;
        
        case 'warning':
          if (tone === 'Friendly') {
            message = `Hi ${employee_name}, We need to discuss a concern regarding [issue]. Let's schedule a time to talk and work this out together.`;
          } else if (tone === 'Formal') {
            message = `Dear ${employee_name}, This is an official notice regarding [issue]. Please report to HR at your earliest convenience to discuss this matter. Best regards, HR Team`;
          } else {
            message = `${employee_name}, We need to address a concern regarding [issue]. Please schedule a meeting with HR to discuss this matter.`;
          }
          break;

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