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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { public_token } = await req.json();
    
    if (!public_token) {
      throw new Error('public_token is required');
    }

    console.log('Fetching offer with token:', public_token);

    // Use service role to bypass RLS and securely fetch offer by exact token match
    const { data: offer, error: fetchError } = await supabaseClient
      .from('offers')
      .select('*')
      .eq('public_token', public_token)
      .single();

    if (fetchError) {
      console.error('Database error:', fetchError);
      throw new Error('Offer not found');
    }

    if (!offer) {
      throw new Error('Offer not found');
    }

    console.log('Offer found:', offer.id, 'Status:', offer.status);

    return new Response(
      JSON.stringify({
        success: true,
        offer: offer
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error fetching offer:', error);
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