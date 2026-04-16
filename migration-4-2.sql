-- ============================================
-- Migration: Notifications & Subscription Payments
-- ============================================

-- Function to safely get auth role (if not already existing)
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS user_role
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- 1. Table: notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_role text,
  title text,
  message text,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- 2. Table: subscription_payments
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sub_admin_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  method text NOT NULL,
  status text DEFAULT 'Pending',
  reference text,
  proof_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all subscription payments"
ON public.subscription_payments FOR SELECT
USING (public.get_auth_role() = 'super_admin');

CREATE POLICY "Super admins can update payments"
ON public.subscription_payments FOR UPDATE
USING (public.get_auth_role() = 'super_admin');

CREATE POLICY "Sub admins can view their own subscription payments"
ON public.subscription_payments FOR SELECT
USING (auth.uid() = sub_admin_id);

CREATE POLICY "Sub admins can insert their own payments"
ON public.subscription_payments FOR INSERT
WITH CHECK (auth.uid() = sub_admin_id);

-- 3. Broadcast real-time changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscription_payments;


-- 4. Add Missing Columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_slug text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_package text DEFAULT 'Standard';

