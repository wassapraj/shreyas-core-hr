import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('seed-initial-users function called')
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role key to create users
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const results = {
      users_created: [],
      employees_created: [],
      errors: []
    }

    // Define users to create
    const usersToCreate = [
      {
        email: 'raj@shreyasgroup.net',
        password: 'Admin@24365',
        role: 'super_admin',
        employee_data: null
      },
      {
        email: 'hr@shreyasgroup.net',
        password: 'hr@24365',
        role: 'hr',
        employee_data: null
      },
      {
        email: 'emp@shreyasgroup.net',
        password: 'emp@24365',
        role: 'employee',
        employee_data: null
      }
    ]

    // Helper function to find user by email using listUsers pagination
    const findUserByEmail = async (email: string) => {
      let page = 1
      const perPage = 1000
      
      while (true) {
        const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage
        })
        
        const user = usersPage.users.find(u => u.email === email)
        if (user) return user
        
        // If we got fewer users than requested, we've reached the end
        if (usersPage.users.length < perPage) break
        page++
      }
      
      return null
    }

    for (const userData of usersToCreate) {
      try {
        console.log(`Creating user: ${userData.email}`)

        // Check if user already exists
        const existingUser = await findUserByEmail(userData.email)
        
        let userId = null
        
        if (existingUser) {
          console.log(`User ${userData.email} already exists, updating password`)
          userId = existingUser.id
          
          // Update the password for existing user
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { password: userData.password }
          )
          
          if (updateError) {
            console.error(`Error updating password for ${userData.email}:`, updateError)
            results.errors.push(`Failed to update password for ${userData.email}: ${updateError.message}`)
          } else {
            console.log(`Updated password for ${userData.email}`)
          }
          
          results.users_created.push({
            email: userData.email,
            status: 'password_updated',
            user_id: userId
          })
        } else {
          // Create new user
          const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: userData.email,
            password: userData.password,
            email_confirm: true // Auto-confirm email
          })

          if (createError) {
            console.error(`Error creating user ${userData.email}:`, createError)
            results.errors.push(`Failed to create user ${userData.email}: ${createError.message}`)
            continue
          }

          userId = newUser.user?.id
          console.log(`Created user: ${userData.email} with ID: ${userId}`)
          results.users_created.push({
            email: userData.email,
            status: 'created',
            user_id: userId
          })
        }

        if (!userId) {
          results.errors.push(`No user ID for ${userData.email}`)
          continue
        }

        // Assign role
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .upsert({ 
            user_id: userId, 
            role: userData.role 
          }, {
            onConflict: 'user_id,role'
          })

        if (roleError) {
          console.error(`Error assigning role to ${userData.email}:`, roleError)
          results.errors.push(`Failed to assign role to ${userData.email}: ${roleError.message}`)
        } else {
          console.log(`Assigned role ${userData.role} to ${userData.email}`)
        }

        // Create employee record if needed
        if (userData.employee_data) {
          const employeeData = {
            ...userData.employee_data,
            user_id: userId
          }

          const { data: existingEmployee } = await supabaseAdmin
            .from('employees')
            .select('id')
            .eq('user_id', userId)
            .single()

          if (existingEmployee) {
            console.log(`Employee record already exists for ${userData.email}`)
            results.employees_created.push({
              email: userData.email,
              status: 'already_exists'
            })
          } else {
            const { data: newEmployee, error: empError } = await supabaseAdmin
              .from('employees')
              .insert([employeeData])
              .select()

            if (empError) {
              console.error(`Error creating employee for ${userData.email}:`, empError)
              results.errors.push(`Failed to create employee for ${userData.email}: ${empError.message}`)
            } else {
              console.log(`Created employee record for ${userData.email}`)
              results.employees_created.push({
                email: userData.email,
                status: 'created',
                employee_id: newEmployee[0]?.id
              })
            }
          }
        }

      } catch (error) {
        console.error(`Error processing user ${userData.email}:`, error)
        results.errors.push(`Error processing ${userData.email}: ${error.message}`)
      }
    }

    console.log('Seeding completed:', results)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Initial users seeding completed',
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in seed-initial-users:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})