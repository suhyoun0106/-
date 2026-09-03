import { createClient } from '@/utils/supabase/server'
import FeedPost from '@/components/feed-post'
import Link from 'next/link'


import CommunityDropdown from '@/components/community-dropdown'
import ScrollHideUI from '@/components/scroll-hide-ui'
import TopDonorMessage from '@/components/top-donor-message'
import FeedSearchBar from '@/components/feed-search-bar'
import LiveDonationStream from '@/components/live-donation-stream'

/**
 * 이 파일은 메인 피드(홈) 페이지입니다.
 * 모든 게시물을 최신순으로 가져와서 보여줍니다.
 */

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined } }) {
  const supabase = await createClient()
  
  // 현재 접속중인 유저 정보 가져오기
  const { data: { user } } = await supabase.auth.getUser()

  // params await 처리 (Next 15 대응)
  const resolvedParams = await searchParams;
  const communityId = resolvedParams?.community_id as string | undefined;
  const searchQuery = resolvedParams?.q as string | undefined;

  let sponsoredCommunities: any[] = []
  
  if (user) {
    const { data: donations } = await supabase
      .from('donations')
      .select('receiver:receiver_id(id, username, avatar_url, instagram_id, is_instagram_public)')
      .eq('donor_id', user.id)
      
    if (donations) {
      sponsoredCommunities = Array.from(new Map(
        donations
          .map(d => d.receiver)
          .filter(Boolean)
          .map((r: any) => [r.id, r])
      ).values())
    }
  }

  // 게시물 가져오기

  let isTopDonor = false
  let initialTopDonorMessage = null
  
  if (communityId) {
    // 1달(30일) 기준 탑 도너 계산
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { data: donorStats } = await supabase
      .from('donations')
      .select('donor_id, amount')
      .eq('receiver_id', communityId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      
    if (donorStats && donorStats.length > 0) {
      const sums: Record<string, number> = {}
      donorStats.forEach(d => {
        if (d.donor_id) {
          sums[d.donor_id] = (sums[d.donor_id] || 0) + d.amount
        }
      })
      const sorted = Object.entries(sums).sort((a, b) => (b[1] as number) - (a[1] as number))
      if (sorted.length > 0 && sorted[0][0] === user?.id) {
        isTopDonor = true
      }
    }

    // 가져오기 (탑 도너 메시지)
    const { data: msgData } = await supabase
      .from('top_donor_messages')
      .select('message')
      .eq('community_id', communityId)
      .maybeSingle()
      
    if (msgData) {
      initialTopDonorMessage = msgData.message
    }
  }

  let query = supabase
    .from('posts')
    .select(`
      *,
      profiles!posts_user_id_fkey (id, username, avatar_url, instagram_id, is_instagram_public),
      post_images (id, image_url, position),
      likes (id, user_id),
      shares (id, user_id),
      comments (id)
    `)

  if (communityId) {
    query = query.eq('community_id', communityId)
  } else if (user) {
    // 전체 보기일 때는 내가 후원한 커뮤니티 + 내 자신의 커뮤니티 글만 보이도록 필터링
    const allowedIds = [user.id, ...sponsoredCommunities.map(c => c.id)]
    query = query.in('community_id', allowedIds)
  }
  
  if (searchQuery) {
    // PostgREST 문법에서 쉼표(,) 충돌을 피하기 위해 검색어를 ""로 감싸줍니다.
    const safeQuery = searchQuery.replace(/"/g, '""')
    query = query.or(`title.ilike."%${safeQuery}%",content.ilike."%${safeQuery}%"`)
  }

  const { data: rawPosts, error } = await query.order('created_at', { ascending: false })

  // Hacker News (Gravity) 알고리즘을 이용한 피드 랭킹 적용
  let posts = rawPosts || [];
  if (posts.length > 0) {
    const gravity = 1.8; // Gravity 상수 (조절 가능)
    
    posts = posts.map(post => {
      // 행동별 가중치 적용
      const views = post.view_count || 0; // 아직 view_count 컬럼이 없다면 0으로 처리
      const likes = post.likes ? post.likes.length : 0;
      const comments = post.comments ? post.comments.length : 0;
      const shares = post.shares ? post.shares.length : 0;
      
      const points = (views * 1) + (likes * 5) + (comments * 10) + (shares * 20);
      
      // 게시된 이후 흐른 시간 (시간 단위)
      const hoursSince = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
      
      // 점수 = (추천수 - 1) / (게시된 이후 흐른 시간 + 2)^Gravity
      const score = (points - 1) / Math.pow((hoursSince + 2), gravity);
      
      return { ...post, score };
    });

    // 점수 순으로 내림차순 정렬
    posts.sort((a, b) => b.score - a.score);
  }

  if (error) {
    console.error('게시물 불러오기 에러:', error)
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 flex flex-col gap-8">
      
      {/* 상단 필터 및 검색 바 (스크롤 반응형) */}
      <ScrollHideUI direction="top" className="sticky top-0 z-30 pt-4 pb-2 -mt-4 mb-2">
        <div className="flex flex-col gap-4">
          <div className="flex flex-row items-stretch gap-3">
            {user && sponsoredCommunities.length > 0 && (
              <CommunityDropdown communities={sponsoredCommunities} currentCommunityId={communityId} />
            )}
            <FeedSearchBar />
          </div>
          
          {communityId && (
            <TopDonorMessage 
              communityId={communityId} 
              currentUserId={user?.id}
              isTopDonor={isTopDonor}
              initialMessage={initialTopDonorMessage}
            />
          )}
          
          {user && (
            <LiveDonationStream 
              subscribedIds={communityId ? [communityId] : sponsoredCommunities.map(c => c.id)}
            />
          )}
        </div>
      </ScrollHideUI>

      {posts?.length === 0 ? (
        <div className="text-center text-muted-foreground py-20">
          {communityId ? '이 커뮤니티에는 아직 게시물이 없습니다.' : '게시물이 없습니다. 첫 게시물을 작성해 보세요!'}
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
