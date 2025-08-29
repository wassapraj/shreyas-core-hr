
-- 1) Extend employees table with additional fields
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS pf_portal_user text,
  ADD COLUMN IF NOT EXISTS pf_portal_pass text,
  ADD COLUMN IF NOT EXISTS highlights_cache jsonb,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS father_name text,
  ADD COLUMN IF NOT EXISTS mother_name text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS blood_group text,
  ADD COLUMN IF NOT EXISTS alt_phone text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_phone text,
  ADD COLUMN IF NOT EXISTS permanent_address text,
  ADD COLUMN IF NOT EXISTS current_address text,
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_ifsc text,
  ADD COLUMN IF NOT EXISTS bank_branch text,
  ADD COLUMN IF NOT EXISTS upi_id text,
  ADD COLUMN IF NOT EXISTS aadhaar_number text,
  ADD COLUMN IF NOT EXISTS pan_number text,
  ADD COLUMN IF NOT EXISTS linkedin text,
  ADD COLUMN IF NOT EXISTS facebook text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS twitter text,
  ADD COLUMN IF NOT EXISTS other_social text,
  ADD COLUMN IF NOT EXISTS hobbies_interests text,
  ADD COLUMN IF NOT EXISTS languages_known text,
  ADD COLUMN IF NOT EXISTS tshirt_size text,
  ADD COLUMN IF NOT EXISTS personal_vision text,
  ADD COLUMN IF NOT EXISTS open_box_notes text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS passport_photo_url text,
  ADD COLUMN IF NOT EXISTS regular_photo_url text,
  ADD COLUMN IF NOT EXISTS qualification text,
  ADD COLUMN IF NOT EXISTS qualification_proof_url text;

-- 2) Enums (idempotent creation)
DO $$ BEGIN
  CREATE TYPE public.handover_status AS ENUM ('Requested','Approved','Rejected','Completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.message_channel AS ENUM ('Email','WhatsApp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) hikes table
CREATE TABLE IF NOT EXISTS public.hikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  pct numeric,
  amount numeric,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.hikes ENABLE ROW LEVEL SECURITY;

-- RLS: HR & super_admin manage, employees read own
DO $$ BEGIN
  CREATE POLICY "HR and super_admin can manage hikes"
  ON public.hikes
  FOR ALL
  USING (has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'super_admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Employees can view own hikes"
  ON public.hikes
  FOR SELECT
  USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TRIGGER set_updated_at_hikes
BEFORE UPDATE ON public.hikes
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4) payslips table
CREATE TABLE IF NOT EXISTS public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL,
  run_id text,
  gross numeric DEFAULT 0,
  deductions numeric DEFAULT 0,
  net numeric DEFAULT 0,
  pdf_url text,
  remarks text,
  visible_to_employee boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- RLS
DO $$ BEGIN
  CREATE POLICY "HR and super_admin can manage payslips"
  ON public.payslips
  FOR ALL
  USING (has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'super_admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Employees can view own payslips when visible"
  ON public.payslips
  FOR SELECT
  USING (
    (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()))
    AND visible_to_employee = true
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS payslips_emp_month_year_idx ON public.payslips (employee_id, year, month);

CREATE TRIGGER set_updated_at_payslips
BEFORE UPDATE ON public.payslips
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5) insurance_policies table
CREATE TABLE IF NOT EXISTS public.insurance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  insurer_name text,
  product_name text,
  policy_number text,
  start_date date,
  end_date date,
  card_image_url text,
  insurer_logo_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "HR and super_admin can manage insurance policies"
  ON public.insurance_policies
  FOR ALL
  USING (has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'super_admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Employees can view own insurance policies"
  ON public.insurance_policies
  FOR SELECT
  USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS insurance_policies_employee_idx ON public.insurance_policies (employee_id);

CREATE TRIGGER set_updated_at_insurance_policies
BEFORE UPDATE ON public.insurance_policies
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6) asset_handover_requests table
CREATE TABLE IF NOT EXISTS public.asset_handover_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  from_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  to_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status public.handover_status NOT NULL DEFAULT 'Requested',
  requested_on timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.asset_handover_requests ENABLE ROW LEVEL SECURITY;

-- RLS: HR manage all
DO $$ BEGIN
  CREATE POLICY "HR and super_admin can manage handover requests"
  ON public.asset_handover_requests
  FOR ALL
  USING (has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'super_admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Employees can view own (as requester or recipient)
DO $$ BEGIN
  CREATE POLICY "Employees can view own handover requests"
  ON public.asset_handover_requests
  FOR SELECT
  USING (
    from_employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR to_employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Employees can create requests only for assets currently assigned to them
DO $$ BEGIN
  CREATE POLICY "Employees can create handover for current assets"
  ON public.asset_handover_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    from_employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    AND (
      SELECT COUNT(1) > 0
      FROM public.asset_assignments aa
      WHERE aa.asset_id = asset_handover_requests.asset_id
        AND aa.employee_id = asset_handover_requests.from_employee_id
        AND aa.returned_on IS NULL
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS asset_handover_requests_status_idx ON public.asset_handover_requests (status);
CREATE INDEX IF NOT EXISTS asset_handover_requests_requested_on_idx ON public.asset_handover_requests (requested_on);

CREATE TRIGGER set_updated_at_asset_handover_requests
BEFORE UPDATE ON public.asset_handover_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7) messages_log table
CREATE TABLE IF NOT EXISTS public.messages_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  channel public.message_channel NOT NULL,
  subject text,
  body text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_on timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.messages_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "HR and super_admin can manage messages"
  ON public.messages_log
  FOR ALL
  USING (has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'super_admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Employees can view own messages"
  ON public.messages_log
  FOR SELECT
  USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS messages_log_employee_created_on_idx ON public.messages_log (employee_id, created_on);

CREATE TRIGGER set_updated_at_messages_log
BEFORE UPDATE ON public.messages_log
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
