import { createClient } from '@/utils/supabase/server'
import FeedPost from '@/components/feed-post'
import CommentsSection from '@/components/comments-section'
import { notFound } from 'next/navigation'

/**
 * 이 파일은 개별 게시물 상세 페이지입니다.
 * - 특정 게시물 내용 표시
 * - 해당 게시물에 달린 댓글 및 대댓글 목록 표시
 */

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id: postId } = await params
  
  // 현재 접속중인 유저 정보 가져오기
  const { data: { user } } = await supabase.auth.getUser()

  // 특정 게시물 하나만 가져오기
  const { data: post, error } = await supabase
    .from('posts')
    .select(`
      *,
      profiles (id, username, avatar_url),
      post_images (id, image_url, position),
      likes (id, user_id)
    `)
    .eq('id', postId)
    .single()

  if (error || !post) {
    notFound()
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-8">
      {/* 왼쪽: 게시물 본문 (피드 포스트 재사용) */}
      <div className="w-full">
        <FeedPost post={post} currentUserId={user?.id} />
      </div>

      {/* 오른쪽 (또는 아래): 댓글 섹션 */}
      <div className="w-full h-full min-h-[500px] border rounded-lg bg-card overflow-hidden flex flex-col">
        <div className="p-4 border-b font-bold">
          댓글
        </div>
        <CommentsSection postId={postId} currentUserId={user?.id} postOwnerId={post.user_id} />
      </div>
    </div>
  )
}
