-- ==========================================
-- creator_tags 테이블 생성
-- ==========================================
CREATE TABLE IF NOT EXISTS public.creator_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, tag)
);

ALTER TABLE public.creator_tags ENABLE ROW LEVEL SECURITY;

-- 누구나 태그를 읽을 수 있음
CREATE POLICY "Anyone can view tags" ON public.creator_tags 
  FOR SELECT USING (true);

-- 로그인한 사용자는 태그를 추가할 수 있음 (5개 제한은 앱 레벨에서 처리)
CREATE POLICY "Auth users can insert tags" ON public.creator_tags 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 삭제: 미인증 프로필이면 누구나, 인증 프로필이면 소유자만
CREATE POLICY "Delete tags policy" ON public.creator_tags 
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = creator_tags.profile_id AND is_claimed = false
      )
      OR
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = creator_tags.profile_id 
          AND is_claimed = true 
          AND id = auth.uid()
      )
    )
  );
