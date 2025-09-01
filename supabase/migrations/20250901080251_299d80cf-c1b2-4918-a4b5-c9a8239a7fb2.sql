-- Create admin audit log table
CREATE TABLE public.admin_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  counts JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super_admin can view audit logs
CREATE POLICY "Only super_admin can view audit logs" 
ON public.admin_audit_log 
FOR SELECT 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Only super_admin can insert audit logs
CREATE POLICY "Only super_admin can insert audit logs" 
ON public.admin_audit_log 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));