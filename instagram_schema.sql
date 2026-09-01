-- ==========================================
-- 1. PROFILES 테이블 업데이트
-- ==========================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- ==========================================
-- 2. POSTS (게시물) 테이블
-- ==========================================
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. POST_IMAGES (게시물 다중 이미지) 테이블
-- ==========================================
CREATE TABLE IF NOT EXISTS public.post_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0, -- 이미지 순서
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 4. COMMENTS (댓글 & 대댓글) 테이블
-- ==========================================
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE, -- 대댓글용
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 5. LIKES (좋아요) 테이블
-- ==========================================
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id) -- 한 사람이 한 게시물에 한 번만 좋아요 가능
);

-- ==========================================
-- 6. NOTIFICATIONS (알림) 테이블
-- ==========================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- 알림을 받을 사람
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- 알림을 발생시킨 사람 (예: 좋아요 누른 사람)
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'dm')),
  reference_id UUID, -- 관련된 게시물 ID 또는 댓글 ID
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 7. RLS (Row Level Security) 설정
-- ==========================================
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Posts Policies
CREATE POLICY "Anyone can view posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can insert posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- Post Images Policies
CREATE POLICY "Anyone can view post images" ON public.post_images FOR SELECT USING (true);
CREATE POLICY "Users can insert post images" ON public.post_images FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.posts WHERE id = post_images.post_id AND user_id = auth.uid())
);

-- Comments Policies
CREATE POLICY "Anyone can view comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can insert comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- Likes Policies
CREATE POLICY "Anyone can view likes" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Users can insert likes" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their likes" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- Notifications Policies
CREATE POLICY "Users can view their notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true); -- 보통 트리거가 삽입하므로 true 허용
CREATE POLICY "Users can update their notifications (read)" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Realtime 활성화
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table comments;
alter publication supabase_realtime add table likes;

-- ==========================================
-- 8. 스토리지(Storage) 버킷 생성 및 정책
-- ==========================================
-- avatars 버킷 생성
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
-- post_images 버킷 생성
INSERT INTO storage.buckets (id, name, public) VALUES ('post_images', 'post_images', true) ON CONFLICT DO NOTHING;

-- Avatars 스토리지 정책 (누구나 읽기 가능, 로그인한 유저만 업로드 가능)
CREATE POLICY "Avatar view" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Avatar insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() = owner);
CREATE POLICY "Avatar update" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid() = owner);

-- Post Images 스토리지 정책
CREATE POLICY "Post image view" ON storage.objects FOR SELECT USING (bucket_id = 'post_images');
CREATE POLICY "Post image insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'post_images' AND auth.uid() = owner);

