ALTER TABLE public.posts ADD COLUMN title TEXT;
ALTER TABLE public.posts ADD COLUMN community_id UUID REFERENCES public.profiles(id);
