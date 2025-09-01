-- Ensure emp_code_pool table exists for WM code recycling
CREATE TABLE IF NOT EXISTS public.emp_code_pool (
  code TEXT NOT NULL PRIMARY KEY,
  original_employee_id UUID,
  released_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  released_by UUID
);

-- Enable RLS on emp_code_pool
ALTER TABLE public.emp_code_pool ENABLE ROW LEVEL SECURITY;

-- Create policy for emp_code_pool
CREATE POLICY "HR and super_admin can manage emp_code_pool" 
ON public.emp_code_pool 
FOR ALL 
USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Ensure employee_documents table exists for other documents
CREATE TABLE IF NOT EXISTS public.employee_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  signed_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on employee_documents
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- Create policies for employee_documents (these should already exist based on the schema)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'employee_documents' 
    AND policyname = 'Employees can view own documents'
  ) THEN
    CREATE POLICY "Employees can view own documents" 
    ON public.employee_documents 
    FOR SELECT 
    USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'employee_documents' 
    AND policyname = 'HR and super_admin can manage employee documents'
  ) THEN
    CREATE POLICY "HR and super_admin can manage employee documents" 
    ON public.employee_documents 
    FOR ALL 
    USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
  END IF;
END $$;