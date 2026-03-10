-- Add email field to profiles table for easier access
ALTER TABLE public.profiles 
ADD COLUMN email TEXT;

-- Add constraint to ensure email uniqueness
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_email_key UNIQUE (email);

-- Populate existing records with emails from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id;

-- Make email NOT NULL for new records (optional: comment out if you want it nullable)
-- ALTER TABLE public.profiles 
-- ALTER COLUMN email SET NOT NULL;

-- Create a trigger to sync email when user updates their auth email
CREATE OR REPLACE FUNCTION public.sync_email_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles 
  SET email = NEW.email 
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Note: This trigger would be on auth.users, but that's managed by Supabase
-- Instead, we'll handle email updates via the application
