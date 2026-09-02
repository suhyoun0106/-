ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_instagram_public BOOLEAN DEFAULT false;
