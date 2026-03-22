-- Add phone number field to user profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Optional sanity check for typical phone lengths (digits, spaces, symbols)
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_phone_length_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_phone_length_check
CHECK (phone IS NULL OR length(trim(phone)) BETWEEN 7 AND 20);
