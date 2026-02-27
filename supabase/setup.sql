-- =============================================================
-- Munchboxd — Supabase Database Setup
-- Run this entire file in your Supabase SQL Editor (once).
-- Dashboard → SQL Editor → New query → paste → Run
-- =============================================================

-- -------------------------------------------------------------
-- 1. Profiles table
--    One row per user. id mirrors auth.users.id.
--    username is unique and stored in lowercase.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    text        UNIQUE NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- -------------------------------------------------------------
-- 2. Add user_id column to sessions
--    References profiles.id so Supabase can join
--    sessions → profiles in a single query.
-- -------------------------------------------------------------
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- -------------------------------------------------------------
-- 3. Enable Row Level Security on all tables
-- -------------------------------------------------------------
ALTER TABLE public.sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.munchies  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles  ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------
-- 4. sessions policies
--    • Everyone can read (public feed)
--    • Authenticated users can insert their own sessions
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Sessions are publicly readable"        ON public.sessions;
DROP POLICY IF EXISTS "Users insert their own sessions"       ON public.sessions;

CREATE POLICY "Sessions are publicly readable"
  ON public.sessions FOR SELECT
  USING (true);

CREATE POLICY "Users insert their own sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 5. munchies policies
--    • Everyone can read
--    • Users can insert munchies only for sessions they own
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Munchies are publicly readable"           ON public.munchies;
DROP POLICY IF EXISTS "Users insert munchies for own sessions"   ON public.munchies;

CREATE POLICY "Munchies are publicly readable"
  ON public.munchies FOR SELECT
  USING (true);

CREATE POLICY "Users insert munchies for own sessions"
  ON public.munchies FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id      = session_id
        AND sessions.user_id = auth.uid()
    )
  );

-- -------------------------------------------------------------
-- 6. profiles policies
--    • Everyone can read (needed for public feed usernames)
--    • Users can only insert/update their own profile
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles are publicly readable"   ON public.profiles;
DROP POLICY IF EXISTS "Users can create own profile"     ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"     ON public.profiles;

CREATE POLICY "Profiles are publicly readable"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can create own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- -------------------------------------------------------------
-- 7. Trigger: auto-create a profile row on signup
--    The username comes from the `data` option passed to
--    supabase.auth.signUp({ options: { data: { username } } })
--    A fallback is generated if username is somehow missing.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  un text;
BEGIN
  un := new.raw_user_meta_data->>'username';

  -- Fallback: derive a username from the user ID if none was provided
  IF un IS NULL OR un = '' THEN
    un := 'user_' || substring(new.id::text, 1, 8);
  END IF;

  INSERT INTO public.profiles (id, username)
  VALUES (new.id, un)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =============================================================
-- Done! Your database is now ready for Munchboxd auth.
-- =============================================================
