-- Create storage buckets for employee files
INSERT INTO storage.buckets (id, name, public) VALUES 
('documents', 'documents', false),
('payslips', 'payslips', false), 
('insurance', 'insurance', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for documents bucket
CREATE POLICY "HR and super_admin can upload documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'documents' AND 
  (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "HR and super_admin can view all documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'documents' AND 
  (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "Employees can view own documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'documents' AND 
  (storage.foldername(name))[1] IN (
    SELECT emp_code FROM employees WHERE user_id = auth.uid()
  )
);

CREATE POLICY "HR and super_admin can update documents" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'documents' AND 
  (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "HR and super_admin can delete documents" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'documents' AND 
  (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

-- Create RLS policies for payslips bucket  
CREATE POLICY "HR and super_admin can upload payslips" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'payslips' AND 
  (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "HR and super_admin can view all payslips" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'payslips' AND 
  (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "Employees can view own payslips" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'payslips' AND 
  (storage.foldername(name))[1] IN (
    SELECT emp_code FROM employees WHERE user_id = auth.uid()
  )
);

CREATE POLICY "HR and super_admin can update payslips" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'payslips' AND 
  (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "HR and super_admin can delete payslips" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'payslips' AND 
  (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

-- Create RLS policies for insurance bucket
CREATE POLICY "HR and super_admin can upload insurance" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'insurance' AND 
  (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "HR and super_admin can view all insurance" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'insurance' AND 
  (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "Employees can view own insurance" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'insurance' AND 
  (storage.foldername(name))[1] IN (
    SELECT emp_code FROM employees WHERE user_id = auth.uid()
  )
);

CREATE POLICY "HR and super_admin can update insurance" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'insurance' AND 
  (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "HR and super_admin can delete insurance" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'insurance' AND 
  (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

-- Add file path columns to employees table
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS aadhaar_file_path text,
ADD COLUMN IF NOT EXISTS pan_file_path text,
ADD COLUMN IF NOT EXISTS qualification_file_path text,
ADD COLUMN IF NOT EXISTS photo_file_path text,
ADD COLUMN IF NOT EXISTS passport_photo_file_path text,
ADD COLUMN IF NOT EXISTS regular_photo_file_path text;

-- Create employee_documents table for other documents
CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  signed_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on employee_documents
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for employee_documents
CREATE POLICY "HR and super_admin can manage employee documents" 
ON employee_documents 
FOR ALL 
USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Employees can view own documents" 
ON employee_documents 
FOR SELECT 
USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

-- Add file_path and signed_url to payslips table
ALTER TABLE payslips 
ADD COLUMN IF NOT EXISTS file_path text,
ADD COLUMN IF NOT EXISTS signed_url text;

-- Add file_path and signed_url to insurance_policies table  
ALTER TABLE insurance_policies 
ADD COLUMN IF NOT EXISTS file_path text,
ADD COLUMN IF NOT EXISTS signed_url text;