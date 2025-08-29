
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
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    })

    const { asset_id, to_employee_id, comments } = await req.json()
    const userId = req.headers.get('Authorization')?.split(' ')[1]

    if (!userId) {
      throw new Error('Authentication required')
    }

    // Get current user's employee record
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (empError || !employee) {
      throw new Error('Employee record not found')
    }

    // Verify the asset is currently assigned to the requesting employee
    const { data: currentAssignment, error: assignError } = await supabase
      .from('asset_assignments')
      .select('id')
      .eq('asset_id', asset_id)
      .eq('employee_id', employee.id)
      .is('returned_on', null)
      .single()

    if (assignError || !currentAssignment) {
      throw new Error('Asset is not currently assigned to you')
    }

    // Create handover request
    const { data: handoverRequest, error } = await supabase
      .from('asset_handover_requests')
      .insert({
        asset_id,
        from_employee_id: employee.id,
        to_employee_id: to_employee_id || null,
        comments,
        status: 'Requested'
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({ success: true, request_id: handoverRequest.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error creating handover request:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
