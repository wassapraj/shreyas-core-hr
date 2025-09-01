-- Create employee_documents table if not exists
CREATE TABLE IF NOT EXISTS public.employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  content_type TEXT,
  size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add document file path columns to employees table if not exists
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS aadhaar_key TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pan_key TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS qualification_key TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS photo_key TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS passport_photo_key TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS regular_photo_key TEXT;

-- Add S3 columns to existing tables if not exists
ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS s3_key TEXT;
ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS content_type TEXT;
ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS size BIGINT;

ALTER TABLE public.insurance_policies ADD COLUMN IF NOT EXISTS s3_key TEXT;
ALTER TABLE public.insurance_policies ADD COLUMN IF NOT EXISTS content_type TEXT;
ALTER TABLE public.insurance_policies ADD COLUMN IF NOT EXISTS size BIGINT;

-- Enable RLS on employee_documents if table was created
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'employee_documents' AND table_schema = 'public') THEN
        ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies if they exist and recreate
        DROP POLICY IF EXISTS "HR and super_admin can manage employee documents" ON public.employee_documents;
        DROP POLICY IF EXISTS "Employees can view own documents" ON public.employee_documents;
        
        -- Create RLS policies for employee_documents
        CREATE POLICY "HR and super_admin can manage employee documents"
        ON public.employee_documents
        FOR ALL 
        USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
        WITH CHECK (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

        CREATE POLICY "Employees can view own documents"
        ON public.employee_documents
        FOR SELECT
        USING (employee_id IN (
          SELECT id FROM public.employees WHERE user_id = auth.uid()
        ));

        -- Add trigger for updated_at if it doesn't exist
        DROP TRIGGER IF EXISTS update_employee_documents_updated_at ON public.employee_documents;
        CREATE TRIGGER update_employee_documents_updated_at
          BEFORE UPDATE ON public.employee_documents
          FOR EACH ROW
          EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END $$;