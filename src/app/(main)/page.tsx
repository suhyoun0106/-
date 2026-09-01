import { createClient } from '@/utils/supabase/server'
import FeedPost from '@/components/feed-post'

/**
 * 이 파일은 메인 피드(홈) 페이지입니다.
 * 모든 게시물을 최신순으로 가져와서 보여줍니다.
 */

export default async function FeedPage() {
  const supabase = await createClient()
  
  // 현재 접속중인 유저 정보 가져오기
  const { data: { user } } = await supabase.auth.getUser()

  // 모든 게시물 가져오기 (작성자 프로필 정보와 이미지들을 조인해서 한 번에 가져옴)
  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
      *,
      profiles (id, username, avatar_url),
      post_images (id, image_url, position),
      likes (id, user_id),
      comments (id)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('게시물 불러오기 에러:', error)
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 flex flex-col gap-8">
      {posts?.length === 0 ? (
        <div className="text-center text-muted-foreground py-20">
          게시물이 없습니다. 첫 게시물을 작성해 보세요!
        </div>
      ) : (
        posts?.map((post) => (
          <FeedPost 
            key={post.id} 
            post={post} 
            currentUserId={user?.id} 
          />
        ))
      )}
    </div>
  )
}
