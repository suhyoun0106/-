CREATE TABLE IF NOT EXISTS public.shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view shares" ON public.shares FOR SELECT USING (true);
CREATE POLICY "Users can insert shares" ON public.shares FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their shares" ON public.shares FOR DELETE USING (auth.uid() = user_id);

alter publication supabase_realtime add table shares;
