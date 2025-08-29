
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { request_id, to_employee_id, comments, approve = true } = await req.json()

    // Get the handover request
    const { data: request, error: reqError } = await supabase
      .from('asset_handover_requests')
      .select('*, assets(*)')
      .eq('id', request_id)
      .single()

    if (reqError || !request) {
      throw new Error('Handover request not found')
    }

    if (request.status !== 'Requested') {
      throw new Error('Request has already been processed')
    }

    if (!approve) {
      // Reject the request
      const { error } = await supabase
        .from('asset_handover_requests')
        .update({
          status: 'Rejected',
          approved_by: req.headers.get('user-id'),
          comments: comments || 'Request rejected'
        })
        .eq('id', request_id)

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true, action: 'rejected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Approve the request
    const now = new Date().toISOString().split('T')[0] // YYYY-MM-DD format

    // 1. Mark request as approved
    const { error: updateError } = await supabase
      .from('asset_handover_requests')
      .update({
        status: 'Approved',
        to_employee_id: to_employee_id || null,
        approved_by: req.headers.get('user-id'),
        comments
      })
      .eq('id', request_id)

    if (updateError) throw updateError

    // 2. Close current assignment (set returned_on)
    const { error: closeError } = await supabase
      .from('asset_assignments')
      .update({ returned_on: now })
      .eq('asset_id', request.asset_id)
      .eq('employee_id', request.from_employee_id)
      .is('returned_on', null)

    if (closeError) throw closeError

    // 3. Create new assignment if to_employee_id provided
    if (to_employee_id) {
      const { error: assignError } = await supabase
        .from('asset_assignments')
        .insert({
          asset_id: request.asset_id,
          employee_id: to_employee_id,
          assigned_on: now,
          condition: 'Good'
        })

      if (assignError) throw assignError
    }

    // 4. Mark request as completed
    const { error: completeError } = await supabase
      .from('asset_handover_requests')
      .update({ status: 'Completed' })
      .eq('id', request_id)

    if (completeError) throw completeError

    return new Response(
      JSON.stringify({ 
        success: true, 
        action: 'approved',
        assigned_to: to_employee_id ? 'employee' : 'store'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error approving handover:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
