-- Fix RLS policies to allow proper access during auth session initialization

-- Drop old restrictive policy
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- Create new policy that works during session initialization
CREATE POLICY "Users can view own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated 
USING (
  auth.uid() = user_id
);

-- Also allow service role to bypass (for server-side operations)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Ensure profiles are properly accessible
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to insert their own profile if it doesn't exist
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);
