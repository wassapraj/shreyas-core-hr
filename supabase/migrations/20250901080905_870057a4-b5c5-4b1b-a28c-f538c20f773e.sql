-- Create employee imports table for tracking file uploads and processing
CREATE TABLE public.employee_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded',
  processed_at TIMESTAMP WITH TIME ZONE,
  result_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT employee_imports_status_check CHECK (
    status IN ('uploaded', 'processing', 'parsed', 'completed', 'failed')
  )
);

-- Enable RLS
ALTER TABLE public.employee_imports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "HR and super_admin can manage employee imports" 
ON public.employee_imports 
FOR ALL 
USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Create updated_at trigger
CREATE TRIGGER update_employee_imports_updated_at
BEFORE UPDATE ON public.employee_imports
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();