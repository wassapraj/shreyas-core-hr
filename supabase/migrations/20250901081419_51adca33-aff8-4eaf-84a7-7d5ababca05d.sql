-- Add termination fields to employees table
ALTER TABLE public.employees 
ADD COLUMN termination_date DATE,
ADD COLUMN termination_reason TEXT,
ADD COLUMN termination_notes TEXT,
ADD COLUMN avatar_url TEXT;

-- Add constraint for termination reason
ALTER TABLE public.employees 
ADD CONSTRAINT employees_termination_reason_check 
CHECK (termination_reason IN ('Misconduct', 'Performance', 'Absenteeism', 'Redundancy', 'Mutual', 'Other'));

-- Create emp_code_pool table for recycling released employee codes
CREATE TABLE public.emp_code_pool (
  code TEXT PRIMARY KEY,
  released_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  released_by UUID,
  original_employee_id UUID
);

-- Enable RLS on emp_code_pool
ALTER TABLE public.emp_code_pool ENABLE ROW LEVEL SECURITY;

-- Create policies for emp_code_pool
CREATE POLICY "HR and super_admin can manage emp_code_pool" 
ON public.emp_code_pool 
FOR ALL 
USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));