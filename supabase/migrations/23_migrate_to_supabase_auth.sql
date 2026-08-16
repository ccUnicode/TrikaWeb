-- Drop foreign keys depending on user_id as text
ALTER TABLE public.teacher_ratings DROP CONSTRAINT IF EXISTS teacher_ratings_user_id_fkey;

-- Truncate tables to safely alter types (this clears local dev data to prevent UUID casting errors from old firebase IDs)
TRUNCATE TABLE public.student_details CASCADE;
TRUNCATE TABLE public.teacher_ratings CASCADE;
TRUNCATE TABLE public.contributions CASCADE;
DROP VIEW IF EXISTS public.public_teacher_ratings;

-- Drop RLS policies that depend on user_id
DROP POLICY IF EXISTS "contributions_select_own" ON public.contributions;

-- Alter column types to uuid
ALTER TABLE public.student_details ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.teacher_ratings ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.contributions ALTER COLUMN user_id TYPE uuid USING user_id::uuid;

-- Recreate RLS policies with UUID compatibility
CREATE POLICY "contributions_select_own"
  ON public.contributions FOR SELECT
  USING (auth.uid() = user_id OR (select auth.jwt() ->> 'email') = user_email);

-- Recreate the view
CREATE VIEW public.public_teacher_ratings AS
SELECT
  rating.id,
  rating.teacher_id,
  rating.overall,
  rating.difficulty,
  rating.didactic,
  rating.resources,
  rating.responsability,
  rating.grading,
  rating.comment,
  rating.created_at,
  rating.is_hidden,
  rating.is_anonymous,
  CASE
    WHEN rating.is_anonymous THEN null
    ELSE rating.user_id
  END AS user_id,
  CASE
    WHEN rating.is_anonymous THEN 'Anónimo'
    ELSE rating.user_name
  END AS user_name,
  CASE
    WHEN rating.is_anonymous THEN null
    ELSE student.avatar_url
  END AS avatar_url
FROM public.teacher_ratings AS rating
LEFT JOIN public.student_details AS student
  ON student.user_id = rating.user_id
WHERE rating.is_hidden = false
  AND coalesce(rating.needs_review, true) = false;

REVOKE ALL PRIVILEGES ON TABLE public.public_teacher_ratings FROM public, anon, authenticated;
GRANT SELECT ON TABLE public.public_teacher_ratings TO anon, authenticated;

-- Re-establish foreign keys, now properly linked to auth.users natively
ALTER TABLE public.student_details 
  ADD CONSTRAINT student_details_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.teacher_ratings
  ADD CONSTRAINT teacher_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.student_details(user_id) ON DELETE CASCADE;

-- Function and Trigger to handle new users securely on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Enforce @uni.pe directly in the DB
  IF NEW.email NOT LIKE '%@uni.pe' THEN
    RAISE EXCEPTION 'Solo se permiten correos @uni.pe';
  END IF;

  INSERT INTO public.student_details (user_id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
