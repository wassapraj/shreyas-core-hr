-- Create master admin account manually
-- This script should be run after the user signs up with raj@shreyasgroup.net

-- First, let's create a function to set up admin after signup
CREATE OR REPLACE FUNCTION public.setup_master_admin(admin_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    admin_user_id UUID;
    admin_employee_id UUID;
BEGIN
    -- Get the user ID from auth.users
    SELECT id INTO admin_user_id 
    FROM auth.users 
    WHERE email = admin_email 
    LIMIT 1;
    
    IF admin_user_id IS NULL THEN
        RETURN 'ERROR: User with email ' || admin_email || ' not found. Please sign up first.';
    END IF;
    
    -- Create or update employee record
    INSERT INTO public.employees (
        user_id,
        emp_code,
        first_name,
        last_name,
        email,
        department,
        designation,
        location,
        status,
        doj,
        monthly_ctc
    ) VALUES (
        admin_user_id,
        'ADMIN001',
        'Raj',
        'Admin',
        admin_email,
        'Administration',
        'Master Admin',
        'HQ',
        'Active',
        CURRENT_DATE,
        0
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
        emp_code = EXCLUDED.emp_code,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        department = EXCLUDED.department,
        designation = EXCLUDED.designation,
        location = EXCLUDED.location,
        status = EXCLUDED.status
    RETURNING id INTO admin_employee_id;
    
    -- Assign super_admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_user_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN 'SUCCESS: Master admin setup completed for ' || admin_email;
END;
$$;

-- Create a convenience function to setup the specific admin
CREATE OR REPLACE FUNCTION public.setup_raj_admin()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN setup_master_admin('raj@shreyasgroup.net');
END;
$$;