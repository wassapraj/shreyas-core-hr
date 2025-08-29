-- Create custom types/enums
CREATE TYPE public.app_role AS ENUM ('super_admin', 'hr', 'employee');
CREATE TYPE public.employee_status AS ENUM ('Active', 'Inactive');
CREATE TYPE public.pt_state AS ENUM ('TS', 'AP');
CREATE TYPE public.leave_type AS ENUM ('SL', 'CL', 'EL', 'LOP');
CREATE TYPE public.leave_status AS ENUM ('Pending', 'Approved', 'Rejected');
CREATE TYPE public.attendance_status_enum AS ENUM ('P', 'A', 'HD', 'L', 'OD', 'WFH');
CREATE TYPE public.attendance_source AS ENUM ('device', 'leave', 'override', 'none');
CREATE TYPE public.payroll_status AS ENUM ('Draft', 'Computed', 'Approved', 'Locked');
CREATE TYPE public.asset_status AS ENUM ('InUse', 'Idle', 'Repair', 'Retired');
CREATE TYPE public.reminder_type AS ENUM ('Birthday', 'Anniversary', 'Hike', 'Doc', 'Custom');
CREATE TYPE public.reminder_channel AS ENUM ('Email', 'WhatsApp', 'Both');
CREATE TYPE public.reminder_status AS ENUM ('Open', 'Done');

-- Create user_roles table for RBAC
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Function to check if a user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's highest role priority (super_admin=3, hr=2, employee=1)
CREATE OR REPLACE FUNCTION public.get_user_role_priority(_user_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(MAX(
    CASE role
      WHEN 'super_admin' THEN 3
      WHEN 'hr' THEN 2
      WHEN 'employee' THEN 1
      ELSE 0
    END
  ), 0)
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- Create employees table
CREATE TABLE public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    emp_code TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    department TEXT,
    designation TEXT,
    doj DATE,
    dob DATE,
    manager_employee_id UUID REFERENCES public.employees(id),
    location TEXT,
    monthly_ctc NUMERIC CHECK (monthly_ctc >= 0),
    pf_applicable BOOLEAN DEFAULT false,
    pt_state pt_state DEFAULT 'TS',
    status employee_status DEFAULT 'Active',
    last_hike_on DATE,
    last_hike_pct NUMERIC,
    last_hike_amount NUMERIC,
    hike_cycle_months INTEGER DEFAULT 12,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on employees
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Create leave_requests table
CREATE TABLE public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    type leave_type,
    start_date DATE,
    end_date DATE,
    days NUMERIC,
    reason TEXT,
    attachment_url TEXT,
    status leave_status DEFAULT 'Pending',
    approver_user_id UUID REFERENCES auth.users(id),
    created_on TIMESTAMP WITH TIME ZONE DEFAULT now(),
    priority_score NUMERIC DEFAULT 0,
    raw_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on leave_requests
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Create attendance_upload table
CREATE TABLE public.attendance_upload (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    emp_code TEXT NOT NULL,
    first_swipe TIMESTAMP WITH TIME ZONE,
    last_swipe TIMESTAMP WITH TIME ZONE,
    device_id TEXT,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on attendance_upload
ALTER TABLE public.attendance_upload ENABLE ROW LEVEL SECURITY;

-- Create attendance_status table
CREATE TABLE public.attendance_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    status attendance_status_enum NOT NULL,
    work_hours NUMERIC DEFAULT 0,
    source attendance_source DEFAULT 'none',
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (employee_id, date)
);

-- Enable RLS on attendance_status
ALTER TABLE public.attendance_status ENABLE ROW LEVEL SECURITY;

-- Create payroll_runs table
CREATE TABLE public.payroll_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id TEXT UNIQUE NOT NULL,
    month INTEGER CHECK (month >= 1 AND month <= 12),
    year INTEGER,
    status payroll_status DEFAULT 'Draft',
    created_on TIMESTAMP WITH TIME ZONE DEFAULT now(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on payroll_runs
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

-- Create payroll_items table
CREATE TABLE public.payroll_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id TEXT REFERENCES public.payroll_runs(run_id) ON DELETE CASCADE NOT NULL,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    gross NUMERIC DEFAULT 0,
    deductions NUMERIC DEFAULT 0,
    net NUMERIC DEFAULT 0,
    breakup_json JSONB,
    payslip_url TEXT,
    paid BOOLEAN DEFAULT false,
    paid_at TIMESTAMP WITH TIME ZONE,
    evidence_url TEXT,
    remarks TEXT,
    lop_days NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (run_id, employee_id)
);

-- Enable RLS on payroll_items
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

-- Create assets table
CREATE TABLE public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_code TEXT UNIQUE NOT NULL,
    type TEXT,
    model TEXT,
    serial TEXT,
    purchase_date DATE,
    warranty_till DATE,
    status asset_status DEFAULT 'InUse',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on assets
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Create asset_assignments table
CREATE TABLE public.asset_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    assigned_on DATE,
    returned_on DATE,
    condition TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on asset_assignments
ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;

-- Create announcements table
CREATE TABLE public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT,
    audience TEXT,
    posted_on TIMESTAMP WITH TIME ZONE DEFAULT now(),
    read_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on announcements
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Create sticky_notes table
CREATE TABLE public.sticky_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    note TEXT,
    tags TEXT,
    expires_on DATE,
    pinned BOOLEAN DEFAULT false,
    linked_departments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on sticky_notes
ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;

-- Create reminders table
CREATE TABLE public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    due_date DATE,
    due_time TEXT,
    type reminder_type,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    channel reminder_channel,
    template TEXT,
    status reminder_status DEFAULT 'Open',
    done_on TIMESTAMP WITH TIME ZONE,
    evidence_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on reminders
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- Create update timestamp function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER handle_user_roles_updated_at BEFORE UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_attendance_upload_updated_at BEFORE UPDATE ON public.attendance_upload FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_attendance_status_updated_at BEFORE UPDATE ON public.attendance_status FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_payroll_runs_updated_at BEFORE UPDATE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_payroll_items_updated_at BEFORE UPDATE ON public.payroll_items FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_asset_assignments_updated_at BEFORE UPDATE ON public.asset_assignments FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_sticky_notes_updated_at BEFORE UPDATE ON public.sticky_notes FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_reminders_updated_at BEFORE UPDATE ON public.reminders FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "HR and super_admin can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Only super_admin can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for employees
CREATE POLICY "Employees can view own record" ON public.employees FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "HR and super_admin can view all employees" ON public.employees FOR SELECT USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "HR and super_admin can insert employees" ON public.employees FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "HR can update employee basic info" ON public.employees FOR UPDATE USING (public.has_role(auth.uid(), 'hr')) WITH CHECK (public.has_role(auth.uid(), 'hr'));
CREATE POLICY "Only super_admin can update CTC and hike fields" ON public.employees FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "HR and super_admin can delete employees" ON public.employees FOR DELETE USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for leave_requests
CREATE POLICY "Employees can view own leave requests" ON public.leave_requests FOR SELECT USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));
CREATE POLICY "HR and super_admin can view all leave requests" ON public.leave_requests FOR SELECT USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Employees can create own leave requests" ON public.leave_requests FOR INSERT WITH CHECK (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));
CREATE POLICY "Employees can update own pending requests" ON public.leave_requests FOR UPDATE USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()) AND status = 'Pending') WITH CHECK (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()) AND status = 'Pending');
CREATE POLICY "HR and super_admin can update all leave requests" ON public.leave_requests FOR UPDATE USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "HR and super_admin can delete leave requests" ON public.leave_requests FOR DELETE USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for attendance_upload
CREATE POLICY "Only HR and super_admin can manage attendance uploads" ON public.attendance_upload FOR ALL USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for attendance_status
CREATE POLICY "Employees can view own attendance status" ON public.attendance_status FOR SELECT USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));
CREATE POLICY "HR and super_admin can view all attendance status" ON public.attendance_status FOR SELECT USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Only HR and super_admin can manage attendance status" ON public.attendance_status FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Only HR and super_admin can update attendance status" ON public.attendance_status FOR UPDATE USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for payroll (HR and super_admin only)
CREATE POLICY "Only HR and super_admin can manage payroll runs" ON public.payroll_runs FOR ALL USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Only HR and super_admin can manage payroll items" ON public.payroll_items FOR ALL USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for assets
CREATE POLICY "HR and super_admin can manage assets" ON public.assets FOR ALL USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for asset_assignments
CREATE POLICY "Employees can view own asset assignments" ON public.asset_assignments FOR SELECT USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));
CREATE POLICY "HR and super_admin can view all asset assignments" ON public.asset_assignments FOR SELECT USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "HR and super_admin can manage asset assignments" ON public.asset_assignments FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "HR and super_admin can update asset assignments" ON public.asset_assignments FOR UPDATE USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for announcements
CREATE POLICY "Everyone can view announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "HR and super_admin can manage announcements" ON public.announcements FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "HR and super_admin can update announcements" ON public.announcements FOR UPDATE USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for sticky_notes and reminders (HR and super_admin only)
CREATE POLICY "HR and super_admin can manage sticky notes" ON public.sticky_notes FOR ALL USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "HR and super_admin can manage reminders" ON public.reminders FOR ALL USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));

-- Function to compute leave days
CREATE OR REPLACE FUNCTION public.compute_leave_days()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL THEN
        NEW.days = NEW.end_date - NEW.start_date + 1;
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger to auto-compute leave days
CREATE TRIGGER compute_leave_days_trigger
    BEFORE INSERT OR UPDATE ON public.leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION compute_leave_days();

-- Insert seed data
INSERT INTO public.employees (emp_code, first_name, last_name, email, department, designation, location, monthly_ctc, doj, dob, status) VALUES
('WM0001', 'John', 'Doe', 'john.doe@shreyas.com', 'Design', 'Designer', 'HYD', 45000, '2023-01-15', '1995-03-22', 'Active'),
('WM0002', 'Jane', 'Smith', 'jane.smith@shreyas.com', 'Events', 'Event Manager', 'VZG', 70000, '2022-06-10', '1992-08-14', 'Active'),
('WM0003', 'Mike', 'Johnson', 'mike.johnson@shreyas.com', 'Finance', 'Accounts', 'HYD', 35000, '2023-03-01', '1990-12-05', 'Active');

-- Insert sample attendance upload
INSERT INTO public.attendance_upload (date, emp_code, first_swipe, last_swipe, device_id, location) VALUES
(CURRENT_DATE - INTERVAL '1 day', 'WM0001', (CURRENT_DATE - INTERVAL '1 day')::date + TIME '09:15:00', (CURRENT_DATE - INTERVAL '1 day')::date + TIME '18:30:00', 'DEV001', 'HYD'),
(CURRENT_DATE - INTERVAL '1 day', 'WM0002', (CURRENT_DATE - INTERVAL '1 day')::date + TIME '09:45:00', (CURRENT_DATE - INTERVAL '1 day')::date + TIME '19:00:00', 'DEV002', 'VZG');

-- Insert sample leave request
INSERT INTO public.leave_requests (employee_id, raw_text, reason, status) VALUES
((SELECT id FROM public.employees WHERE emp_code = 'WM0001'), 'suffering fever, i want leave from 2 Sep to 4 Sep', 'Medical leave due to fever', 'Pending');