-- Remove the insecure RLS policy that allows public access to all offers with tokens
DROP POLICY IF EXISTS "Public can view offers by token" ON public.offers;

-- Offers should only be accessible to HR/super_admin or through secure token validation
-- The secure token validation will be handled by an edge function