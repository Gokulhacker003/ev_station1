-- Update RLS policies for bookings to work with auth metadata

-- Drop existing booking policies
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "admins_view_all_bookings" ON public.bookings;
DROP POLICY IF EXISTS "users_view_own_bookings" ON public.bookings;

-- Create a function to check if user is admin from auth metadata
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'app_metadata')::json ->> 'role' = 'admin',
    (auth.jwt() ->> 'user_metadata')::json ->> 'role' = 'admin',
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    ),
    false
  )
$$;

-- Policy 1: Admins can view all bookings (using auth metadata)
CREATE POLICY "admin_view_all_bookings" 
ON public.bookings 
FOR SELECT 
TO authenticated 
USING (public.is_admin());

-- Policy 2: Users can view their own bookings
CREATE POLICY "user_view_own_bookings" 
ON public.bookings 
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

-- Policy 3: Users can create their own bookings
CREATE POLICY "user_create_own_bookings" 
ON public.bookings 
FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

-- Policy 4: Users can update their own bookings
CREATE POLICY "user_update_own_bookings" 
ON public.bookings 
FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Policy 5: Admins can update any booking
CREATE POLICY "admin_update_all_bookings" 
ON public.bookings 
FOR UPDATE 
TO authenticated 
USING (public.is_admin());

-- Ensure profiles are accessible for admin queries
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "view_all_profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (true);

-- Add comment for documentation
COMMENT ON FUNCTION public.is_admin() IS 'Checks if current user is admin from JWT metadata or user_roles table';
COMMENT ON POLICY "admin_view_all_bookings" ON public.bookings IS 'Allows admin users to view all bookings in the system';
COMMENT ON POLICY "user_view_own_bookings" ON public.bookings IS 'Allows users to view only their own bookings';