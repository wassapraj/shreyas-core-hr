-- Create offers collection
CREATE TYPE public.offer_status AS ENUM ('Draft', 'Sent', 'Accepted', 'Declined', 'Withdrawn');

CREATE TABLE public.offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_name TEXT NOT NULL,
    candidate_email TEXT NOT NULL,
    candidate_phone TEXT,
    job_title TEXT NOT NULL,
    dept TEXT,
    location TEXT,
    ctc TEXT,
    joining_date DATE,
    recruiter_user_id UUID REFERENCES auth.users(id),
    status offer_status DEFAULT 'Draft',
    offer_html TEXT,
    public_token TEXT UNIQUE,
    signed_at TIMESTAMP WITH TIME ZONE,
    remarks TEXT,
    attachments TEXT[], -- Array of file URLs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on offers
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER handle_offers_updated_at 
    BEFORE UPDATE ON public.offers 
    FOR EACH ROW 
    EXECUTE FUNCTION handle_updated_at();

-- RLS Policies for offers
CREATE POLICY "HR and super_admin can manage offers" 
    ON public.offers 
    FOR ALL 
    USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));

-- Allow public access to offers via public_token (for candidate viewing)
CREATE POLICY "Public can view offers by token" 
    ON public.offers 
    FOR SELECT 
    USING (public_token IS NOT NULL);

-- Function to generate secure random token
CREATE OR REPLACE FUNCTION public.generate_secure_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Generate 24 character secure random token
    RETURN encode(gen_random_bytes(18), 'base64')::TEXT;
END;
$$;