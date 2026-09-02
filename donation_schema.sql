-- ==========================================
-- 1. PROFILES 테이블 수정 (Shadow Profile 지원)
-- ==========================================
-- 기존에 auth.users와 1:1로 묶여있던 제약조건(Foreign Key)을 삭제하여,
-- 가입하지 않은 인스타그램 ID도 프로필을 가질 수 있게 합니다.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 새로운 컬럼들 추가
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_claimed BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_donations INTEGER DEFAULT 0;

-- username에 유니크 제약조건이 없다면 추가해둡니다. (검색을 위해 필요)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'profiles_username_key'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
    END IF;
END $$;


-- ==========================================
-- 2. DONATIONS (후원) 테이블 생성
-- ==========================================
CREATE TABLE IF NOT EXISTS public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- 후원자 (익명일 수도 있으므로 NULL 허용)
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- 후원받는 사람 (그림자 프로필 ID)
  amount INTEGER NOT NULL DEFAULT 0, -- 후원 금액
  message TEXT, -- 응원 메시지
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. RLS (Row Level Security) 설정
-- ==========================================
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- 누구나 후원 내역을 볼 수 있음 (리더보드, 실시간 스트림용)
CREATE POLICY "Anyone can view donations" ON public.donations FOR SELECT USING (true);

-- 로그인한 사용자만 후원할 수 있음
CREATE POLICY "Users can insert donations" ON public.donations FOR INSERT WITH CHECK (auth.uid() = donor_id);

-- Realtime 활성화 (실시간 후원 스트림용)
alter publication supabase_realtime add table donations;
