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

    const { id, status, approver_user_id } = await req.json();
    
    if (!id || !status) {
      throw new Error('id and status are required');
    }

    if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
      throw new Error('Invalid status. Must be Approved, Rejected, or Pending');
    }

    console.log('Setting leave status:', { id, status, approver_user_id });

    // Prepare update data
    const updateData: any = { status };
    
    // Set approver_user_id only for Approved/Rejected statuses
    if (status === 'Approved' || status === 'Rejected') {
      if (approver_user_id) {
        updateData.approver_user_id = approver_user_id;
      }
    }

    const { data, error } = await supabaseClient
      .from('leave_requests')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to update leave status: ${error.message}`);
    }

    console.log('Updated leave request:', data);

    return new Response(
      JSON.stringify({
        success: true,
        data: data[0]
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in leave set status:', error);
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