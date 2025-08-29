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

    console.log('Issuing offer:', offer_id);

    // Get the offer to check status
    const { data: offer, error: fetchError } = await supabaseClient
      .from('offers')
      .select('*')
      .eq('id', offer_id)
      .single();

    if (fetchError) throw fetchError;
    if (!offer) throw new Error('Offer not found');

    if (offer.status !== 'Draft') {
      throw new Error('Offer can only be issued when status is Draft');
    }

    // Generate secure public token
    const { data: tokenData, error: tokenError } = await supabaseClient
      .rpc('generate_secure_token');

    if (tokenError) throw tokenError;

    const publicToken = tokenData.replace(/[/+=]/g, '').substring(0, 24);

    // Update offer with token and status
    const { data: updatedOffer, error: updateError } = await supabaseClient
      .from('offers')
      .update({
        public_token: publicToken,
        status: 'Sent'
      })
      .eq('id', offer_id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Generate public link
    const publicLink = `${req.headers.get('origin') || 'https://localhost:8080'}/offer/${publicToken}`;

    return new Response(
      JSON.stringify({
        success: true,
        offer: updatedOffer,
        public_token: publicToken,
        public_link: publicLink,
        message: 'Offer issued successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error issuing offer:', error);
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