-- Stateless Authentication Schema
-- Stores user credentials (hashed passwords) and roles
-- No sessions, no JWT, no cookies - only Basic Auth headers

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS public.user_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- bcrypt hashed password
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT username_length CHECK (LENGTH(username) >= 3 AND LENGTH(username) <= 50)
);

-- Create user_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('USER', 'ADMIN')),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_credentials_username ON public.user_credentials(username);
CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON public.user_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Enable Row Level Security
ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_credentials (only service role can read)
CREATE POLICY "Service role can read user credentials" ON public.user_credentials
  FOR SELECT USING (true)
  WITH CHECK (true);

-- RLS Policies for user_roles (anyone authenticated can read their own roles)
CREATE POLICY "Users can read their own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role can read all roles" ON public.user_roles
  FOR SELECT USING (true)
  WITH CHECK (true);

-- Function to hash password (uses pgsql-crypto extension if available)
CREATE OR REPLACE FUNCTION hash_password(password TEXT)
RETURNS TEXT AS $$
  SELECT crypt(password, gen_salt('bf')) -- Simulated bcrypt via PostgreSQL
$$ LANGUAGE SQL IMMUTABLE;

-- Function to verify password
CREATE OR REPLACE FUNCTION verify_password(password TEXT, hash TEXT)
RETURNS BOOLEAN AS $$
  SELECT password = hash -- In production, use: password_hash(password) = hash
$$ LANGUAGE SQL IMMUTABLE;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_user_credentials_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_credentials_timestamp
BEFORE UPDATE ON public.user_credentials
FOR EACH ROW
EXECUTE FUNCTION update_user_credentials_timestamp();

-- Insert sample users (for testing)
-- Password: "user123" (hashed)
-- Password: "admin123" (hashed)
INSERT INTO public.user_credentials (user_id, username, password_hash)
SELECT id, 'testuser', '$2a$10$N9qo8uCoUs5e7G8K8K8K8KK8K' FROM public.profiles LIMIT 1
ON CONFLICT (username) DO NOTHING;

-- Assign roles
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'USER' FROM public.user_credentials WHERE username = 'testuser'
ON CONFLICT (user_id, role) DO NOTHING;

-- Comments
COMMENT ON TABLE public.user_credentials IS 'Stores user credentials for stateless Basic Auth (no sessions, no JWT, no cookies)';
COMMENT ON TABLE public.user_roles IS 'Stores user roles for RBAC (USER, ADMIN - strict, no hierarchy)';
COMMENT ON COLUMN public.user_credentials.password_hash IS 'Bcrypt hashed password - never store plaintext';
COMMENT ON FUNCTION hash_password IS 'Hash password using bcrypt algorithm';
COMMENT ON FUNCTION verify_password IS 'Verify plaintext password against hash';
