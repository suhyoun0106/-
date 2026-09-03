import { createClient } from '@/utils/supabase/server'
import FeedPost from '@/components/feed-post'
import Link from 'next/link'


import CommunityDropdown from '@/components/community-dropdown'
import ScrollHideUI from '@/components/scroll-hide-ui'
import TopDonorMessage from '@/components/top-donor-message'
import FeedSearchBar from '@/components/feed-search-bar'

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

  // The IDs the current user sponsors (directly)
  const sponsoredIds = sponsoredCommunities.map(c => c.id)
  // Primary feed IDs: myself + sponsored creators
  const primaryIds = user ? [user.id, ...sponsoredIds] : []

  if (communityId) {
    // Specific community view: no tag logic
    query = query.eq('community_id', communityId)
  } else if (user) {
    query = query.in('community_id', primaryIds)
  }
  
  if (searchQuery) {
    const safeQuery = searchQuery.replace(/"/g, '""')
    query = query.or(`title.ilike."%${safeQuery}%",content.ilike."%${safeQuery}%"`)
  }

  const { data: rawPosts, error } = await query.order('created_at', { ascending: false })

  // ── 7:3 Tag-based related content (no communityId, logged in, has sponsored creators) ──
  let relatedPosts: any[] = []
  if (!communityId && user && sponsoredIds.length > 0 && !searchQuery) {
    // 1. Gather tags from all sponsored creators
    const { data: tagRows } = await supabase
      .from('creator_tags')
      .select('tag, profile_id')
      .in('profile_id', sponsoredIds)

    if (tagRows && tagRows.length > 0) {
      const myTags = [...new Set(tagRows.map(r => r.tag))]

      // 2. Find OTHER creators with overlapping tags (not already in primaryIds)
      const { data: relatedTagRows } = await supabase
        .from('creator_tags')
        .select('profile_id')
        .in('tag', myTags)
        .not('profile_id', 'in', `(${primaryIds.join(',')})`)

      if (relatedTagRows && relatedTagRows.length > 0) {
        const relatedCreatorIds = [...new Set(relatedTagRows.map(r => r.profile_id))]

        // 3. Fetch their posts
        const { data: relatedRaw } = await supabase
          .from('posts')
          .select(`
            *,
            profiles!posts_user_id_fkey (id, username, avatar_url, instagram_id, is_instagram_public),
            post_images (id, image_url, position),
            likes (id, user_id),
            shares (id, user_id),
            comments (id)
          `)
          .in('community_id', relatedCreatorIds)
          .order('created_at', { ascending: false })
          .limit(30)

        if (relatedRaw) relatedPosts = relatedRaw
      }
    }
  }

  // Ranking helper
  const rankPosts = (arr: any[]) => {
    const gravity = 1.8
    return arr.map(post => {
      const likes = post.likes?.length || 0
      const comments = post.comments?.length || 0
      const shares = post.shares?.length || 0
      const views = post.view_count || 0
      const points = views * 1 + likes * 5 + comments * 10 + shares * 20
      const hoursSince = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60)
      const score = (points - 1) / Math.pow(hoursSince + 2, gravity)
      return { ...post, score }
    }).sort((a, b) => b.score - a.score)
  }

  // Hacker News (Gravity) 알고리즘을 이용한 피드 랭킹 적용
  let primaryPosts = rankPosts(rawPosts || [])
  let relatedRanked = rankPosts(relatedPosts)

  // 7:3 interleaving: for every 10 posts, 7 primary + 3 related
  let posts: any[] = []
  if (relatedRanked.length > 0) {
    const primaryDeduped = primaryPosts
    const relatedDeduped = relatedRanked.filter(r => !primaryDeduped.find(p => p.id === r.id))
    
    const totalSlots = Math.max(primaryDeduped.length + Math.ceil(primaryDeduped.length * 3 / 7), 1)
    let pi = 0, ri = 0
    for (let i = 0; i < totalSlots; i++) {
      // Every 10 slots: positions 0-6 → primary, 7-9 → related
      const slotInGroup = i % 10
      if (slotInGroup < 7) {
        if (pi < primaryDeduped.length) posts.push(primaryDeduped[pi++])
      } else {
        if (ri < relatedDeduped.length) posts.push(relatedDeduped[ri++])
        else if (pi < primaryDeduped.length) posts.push(primaryDeduped[pi++])
      }
    }
    // Append any remaining primary posts
    while (pi < primaryDeduped.length) posts.push(primaryDeduped[pi++])
  } else {
    posts = primaryPosts
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
