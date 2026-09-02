CREATE TABLE IF NOT EXISTS public.top_donor_messages (
  community_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  donor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.top_donor_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view top donor messages" ON public.top_donor_messages FOR SELECT USING (true);
CREATE POLICY "Users can manage their own top donor messages" ON public.top_donor_messages FOR ALL USING (auth.uid() = donor_id);
