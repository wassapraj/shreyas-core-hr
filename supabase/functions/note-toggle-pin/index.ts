import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('note-toggle-pin function called')
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { id } = await req.json()
    console.log('Processing note toggle pin for id:', id)

    if (!id) {
      throw new Error('Note ID is required')
    }

    // First get the current pinned status
    const { data: currentNote, error: fetchError } = await supabaseClient
      .from('sticky_notes')
      .select('pinned')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('Error fetching note:', fetchError)
      throw fetchError
    }

    // Toggle the pinned status
    const { data, error } = await supabaseClient
      .from('sticky_notes')
      .update({ 
        pinned: !currentNote.pinned,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()

    if (error) {
      console.error('Error toggling pin:', error)
      throw error
    }

    console.log('Note pin toggled successfully:', data)

    return new Response(
      JSON.stringify({ success: true, data }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in note-toggle-pin:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})