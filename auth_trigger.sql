CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  shadow_id UUID;
  shadow_donations INTEGER;
  insta_id TEXT;
BEGIN
  insta_id := new.raw_user_meta_data->>'instagram_id';
  
  -- 1. 기본 프로필 생성 (새로운 @fan ID 적용)
  INSERT INTO public.profiles (id, username, is_claimed, total_donations, avatar_url)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'username', 
    true, 
    0, 
    'https://api.dicebear.com/9.x/initials/svg?seed=' || (new.raw_user_meta_data->>'username')
  );

  -- 2. 만약 가입 시 instagram_id를 입력했다면, 그림자 프로필을 찾아서 병합
  IF insta_id IS NOT NULL AND insta_id != '' THEN
    SELECT id, total_donations INTO shadow_id, shadow_donations 
    FROM public.profiles 
    WHERE username = insta_id AND is_claimed = false LIMIT 1;
    
    IF shadow_id IS NOT NULL THEN
      -- 2-1. 후원 내역(donations)과 메시지(messages), 친구(friends)를 새 ID로 모두 옮김
      UPDATE public.donations SET receiver_id = new.id WHERE receiver_id = shadow_id;
      UPDATE public.messages SET receiver_id = new.id WHERE receiver_id = shadow_id;
      UPDATE public.friends SET friend_id = new.id WHERE friend_id = shadow_id;
      
      -- 2-2. 새로운 프로필에 기존 누적 후원금 합산
      UPDATE public.profiles SET total_donations = shadow_donations WHERE id = new.id;
      
      -- 2-3. 합쳐진 그림자 프로필은 삭제
      DELETE FROM public.profiles WHERE id = shadow_id;
    END IF;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
