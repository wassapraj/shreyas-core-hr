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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { public_token } = await req.json();
    
    if (!public_token) {
      throw new Error('public_token is required');
    }

    console.log('Accepting offer with token:', public_token);

    // Find offer by token
    const { data: offer, error: fetchError } = await supabaseClient
      .from('offers')
      .select('*')
      .eq('public_token', public_token)
      .single();

    if (fetchError) throw fetchError;
    if (!offer) throw new Error('Offer not found');

    if (offer.status !== 'Sent') {
      throw new Error('Offer cannot be accepted. Current status: ' + offer.status);
    }

    // Update offer status to Accepted
    const { data: updatedOffer, error: updateError } = await supabaseClient
      .from('offers')
      .update({
        status: 'Accepted',
        signed_at: new Date().toISOString()
      })
      .eq('public_token', public_token)
      .select()
      .single();

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        offer: updatedOffer,
        message: 'Offer accepted successfully! HR team will contact you soon for onboarding.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error accepting offer:', error);
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