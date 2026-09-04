'use client'

/**
 * 이 파일은 피드에 표시되는 개별 게시물(Post) 컴포넌트입니다.
 * - 작성자 정보
 * - 다중 이미지 슬라이드 (Carousel)
 * - 좋아요 및 댓글 아이콘
 * - 본문 내용 및 댓글 목록(일부)
 */

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Heart, MessageCircle, Forward, Bookmark, Share, Download, Share2, MoreHorizontal, Edit2, Trash2, ArrowLeft, Eye, EyeOff, BarChart2, Repeat, User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Button } from '@/components/ui/button'
import { Input } from "@/components/ui/input"
import { cn } from '@/lib/utils'
import { formatTimeAgo } from '@/lib/format-time'

import { useRouter, usePathname } from 'next/navigation'

function formatCount(count: number) {
  if (!count) return 0;
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(count);
}

export default function FeedPost({ 
  post: rawPost, 
  currentUserId,
  showBackButton = false
}: { 
  post: any, 
  currentUserId?: string,
  showBackButton?: boolean
}) {
  const post = React.useMemo(() => ({
    ...rawPost,
    profiles: Array.isArray(rawPost?.profiles) ? rawPost.profiles[0] : rawPost?.profiles
  }), [rawPost]);
  const isRepostMatch = post.content?.match(/^\[REPOST:([0-9a-fA-F-]+)\]/);
  const isRepost = !!isRepostMatch;
  const originalPostId = isRepost ? isRepostMatch[1] : null;

  const router = useRouter();

  const [originalPost, setOriginalPost] = useState<any>(null);

  useEffect(() => {
    if (isRepost && originalPostId) {
      const supabase = createClient();
      supabase.from('posts').select(`
        *,
        profiles!posts_user_id_fkey (id, username, avatar_url, instagram_id, is_instagram_public),
        post_images (id, image_url, position),
        likes (id, user_id),
        shares (id, user_id),
        comments (id)
      `).eq('id', originalPostId).single().then(({ data }) => {
        setOriginalPost(data);
      });
    }
  }, [isRepost, originalPostId]);

  if (isRepost) {
    if (!originalPost) return null; // or a skeleton
    return (
      <div className="bg-background border-b border-border">
        <div className="flex items-center gap-1.5 px-4 pt-3 text-xs font-bold text-muted-foreground cursor-pointer hover:underline" onClick={() => router.push(`/profile/${post.profiles?.username}`)}>
          <Repeat className="w-3.5 h-3.5" />
          {post.profiles?.username}님이 리포스트했습니다
        </div>
        <FeedPost post={originalPost} currentUserId={currentUserId} showBackButton={showBackButton} />
      </div>
    );
  }

  const supabase = createClient()
  // router hoisted
  
  const initialLiked = post.likes?.some((like: any) => like.user_id === currentUserId)
  const initialReposted = post.shares?.some((share: any) => share.user_id === currentUserId)
  
  const [isLiked, setIsLiked] = useState(initialLiked)
  const [likesCount, setLikesCount] = useState(post.likes?.length || 0)
  const [hasCommented, setHasCommented] = useState(post.comments?.some((c: any) => c.user_id === currentUserId) || false)
  const [commentCount, setCommentCount] = useState(post.comments?.length || 0)
  
  const [isSaved, setIsSaved] = useState(false)
  const [isSavedLoading, setIsSavedLoading] = useState(true)

  useEffect(() => {
    if (!currentUserId) {
      setIsSavedLoading(false)
      return
    }
    const checkSaved = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('posts').select('id').match({ user_id: currentUserId, content: `[SAVED:${post.id}]` }).single()
      if (data) setIsSaved(true)
      setIsSavedLoading(false)
    }
    checkSaved()
  }, [post.id, currentUserId])

  async function toggleSave(e: any) {
    e.stopPropagation()
    if (!currentUserId) return
    const supabase = createClient()
    
    if (isSaved) {
      setIsSaved(false)
      await supabase.from('posts').delete().match({ user_id: currentUserId, content: `[SAVED:${post.id}]` })
      toast.success('사진첩에서 제거되었습니다.')
    } else {
      setIsSaved(true)
      const { data } = await supabase.from('posts').insert({
        user_id: currentUserId,
        community_id: null,
        content: `[SAVED:${post.id}]`
      }).select().single()
      
      if (post.user_id !== currentUserId) {
          const { error: err3 } = await supabase.from('notifications').insert({ user_id: post.user_id, actor_id: currentUserId, type: 'save', reference_id: post.id }); if (err3) toast.error("저장 알림 실패: " + err3.message);
        }

      if (data && post.post_images && post.post_images.length > 0) {
        const newImages = post.post_images.map((img: any) => ({
          post_id: data.id,
          image_url: img.image_url,
          position: img.position
        }))
        await supabase.from('post_images').insert(newImages)
      }
      toast.success('사진첩에 저장되었습니다.')
    }
  }

  const [isReposted, setIsReposted] = useState(initialReposted)
  const [repostCount, setRepostCount] = useState(post.shares?.length || 0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)

  // post 객체가 변경될 때 상태 동기화 (라우팅 시 이전 캐시 상태로 돌아가는 현상 방지)
  useEffect(() => {
    setIsLiked(post.likes?.some((like: any) => like.user_id === currentUserId))
    setLikesCount(post.likes?.length || 0)
    setIsReposted(post.shares?.some((share: any) => share.user_id === currentUserId))
    setRepostCount(post.shares?.length || 0)
  }, [post, currentUserId])

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/post/${post.id}`
    navigator.clipboard.writeText(url)
    toast.success('링크가 복사되었습니다.')
    
    // 이미 공유를 누르지 않은 경우에만 공유 수 + 1
    if (currentUserId && !isReposted) {
      setIsReposted(true)
      setRepostCount((prev: number) => prev + 1)
      await supabase.from('shares').insert({ post_id: post.id, user_id: currentUserId })
      router.refresh() // 캐시 갱신
    }
  }

  // 좋아요 버튼 클릭 핸들러
  
  const isHidden = post.content?.startsWith('<!--HIDDEN-->')

  async function toggleHide() {
    if (!currentUserId || post.user_id !== currentUserId) return
    const supabase = createClient()
    
    if (isHidden) {
      const newContent = post.content.replace('<!--HIDDEN-->', '')
      await supabase.from('posts').update({ content: newContent }).eq('id', post.id)
      toast.success('숨기기가 해제되었습니다.')
    } else {
      const newContent = `<!--HIDDEN-->${post.content || ''}`
      await supabase.from('posts').update({ content: newContent }).eq('id', post.id)
      toast.success('게시물이 숨겨졌습니다.')
    }
    router.refresh()
  }

  async function toggleLike() {
    if (!currentUserId) return

    // 낙관적 업데이트 (서버 응답 전에 미리 UI 변경)
    const newIsLiked = !isLiked
    setIsLiked(newIsLiked)
    setLikesCount((prev: number) => newIsLiked ? prev + 1 : prev - 1)

    if (newIsLiked) {
      // 좋아요 추가
      await supabase.from('likes').insert({ post_id: post.id, user_id: currentUserId })
      // 알림 전송 로직 (내 게시물이 아니면 알림 발송)
      if (post.user_id !== currentUserId) {
        const { error: notifError } = await supabase.from('notifications').insert({
          user_id: post.user_id, // 게시물 주인
          actor_id: currentUserId, // 좋아요 누른 사람
          type: 'like',
          reference_id: post.id
        })
        if (notifError) toast.error("좋아요 알림 실패: " + notifError.message);
      }
    } else {
      // 좋아요 취소
      await supabase.from('likes')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', currentUserId)
    }
    
    router.refresh() // 다른 곳을 클릭했을 때 구버전 캐시로 되돌아가지 않도록 서버 갱신
  }

  async function handleDelete() {
    if (!confirm('정말로 이 게시글을 삭제하시겠습니까?')) return
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) {
      toast.error('삭제 실패: ' + error.message)
    } else {
      toast.success('게시글이 삭제되었습니다.')
      window.location.reload()
    }
  }

  return (
    <div 
      className={`border-b border-border bg-background overflow-hidden ${showBackButton ? '' : 'py-4 hover:bg-secondary/50 active:bg-secondary/70 cursor-pointer transition-colors'}`}
      onClick={() => { if (!showBackButton) router.push(`/post/${post.id}`) }}
    >
      {/* 1. 작성자 헤더 */}
      <div className={`flex items-center justify-between py-3 relative ${showBackButton ? 'px-0' : 'px-4'}`}>
        <div className="flex items-center gap-3">
          {showBackButton && (
            <button 
              onClick={() => router.back()}
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-secondary/40 hover:bg-secondary transition-colors text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <Link href={`/profile/${post.profiles?.username}`} onClick={(e) => e.stopPropagation()}>
            <Avatar className="h-10 w-10 hover:opacity-80 transition-opacity">
              <AvatarImage src={post.profiles?.avatar_url || ''} />
              <AvatarFallback>{post.profiles?.username ? post.profiles.username.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <Link href={`/profile/${post.profiles?.username}`} className="font-bold text-base hover:underline" onClick={(e) => e.stopPropagation()}>
                {post.profiles?.username}
              </Link>
              <span className="text-muted-foreground text-sm">
                · {formatTimeAgo(post.created_at)}
              </span>
            </div>
            {post.profiles?.is_instagram_public && post.profiles?.instagram_id && (
              <span className="text-sm text-muted-foreground mt-0.5">
                @{post.profiles.instagram_id}
              </span>
            )}
          </div>
        </div>
        {post.user_id === currentUserId && (
          <div onClick={(e) => e.stopPropagation()}><DropdownMenu>
            <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground transition-colors outline-none">
              <MoreHorizontal className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              
              <DropdownMenuItem onClick={toggleHide} className="cursor-pointer">
                {isHidden ? (
                  <><Eye className="w-4 h-4 mr-2" /> 숨기기 취소</>
                ) : (
                  <><EyeOff className="w-4 h-4 mr-2" /> 숨기기</>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/create?edit=${post.id}`)} className="cursor-pointer">
                <Edit2 className="w-4 h-4 mr-2" />
                수정하기
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-red-500 hover:text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950">
                <Trash2 className="w-4 h-4 mr-2" />
                삭제하기
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu></div>
        )}
      </div>

      {/* 2. 글 제목 */}
      {post.title && (
        <div className={`pb-2 cursor-pointer ${showBackButton ? 'px-0' : 'px-4'}`} >
          <h2 className="text-xl font-bold">{post.title}</h2>
        </div>
      )}

      
      {/* 3. 이미지 슬라이더 (Carousel) */}
      {post.post_images && post.post_images.length > 0 && (
        <Carousel className="w-full">
          <CarouselContent>
            {post.post_images
              .sort((a: any, b: any) => a.position - b.position)
              .map((img: any) => (
              <CarouselItem key={img.id} className="relative flex justify-center bg-black overflow-hidden group">
                {(() => {
                  const url = img.image_url;
                  const isVideo = url && (url.includes('youtube.com/embed') || url.includes('tiktok.com/embed') || url.includes('instagram.com/'));
                  return (
                    <>
                      {!isVideo && (
                        <div 
                          className="absolute inset-0 bg-cover bg-center blur-2xl opacity-70 scale-110"
                          style={{ backgroundImage: `url(${url})` }}
                        />
                      )}
                      <div className="absolute inset-0 bg-black/20" />
                      {isVideo ? (
                        <iframe 
                          src={url} 
                          className={`relative w-full object-contain z-10 shadow-2xl rounded-lg ${(url.includes('tiktok') || url.includes('is_short=1') || url.includes('instagram')) ? 'aspect-[9/16] max-h-[70vh]' : 'aspect-video max-h-[70vh]'}`}
                          frameBorder="0"
                          allowFullScreen
                        />
                      ) : (
                        <img 
                          src={url} 
                          alt="Post content" 
                          className="relative w-full max-h-[70vh] object-contain cursor-pointer z-10 shadow-2xl"
                          
                        />
                      )}
                    </>
                  )
                })()}
              </CarouselItem>
            ))}
          </CarouselContent>
          {post.post_images.length > 1 && (
            <>
              <CarouselPrevious className="left-2 bg-black/50 hover:bg-black/70 text-white border-0" />
              <CarouselNext className="right-2 bg-black/50 hover:bg-black/70 text-white border-0" />
            </>
          )}
        </Carousel>
      )}

      {/* 4. 본문 내용 및 액션 버튼 */}
      <div className={`py-3 ${showBackButton ? 'px-0' : 'px-4'}`}>
        {/* 본문 내용 */}
        <div 
          className="text-sm cursor-pointer mb-4"
          
        >
          <div 
            dangerouslySetInnerHTML={{ __html: post.content }} 
            className={cn(
              "mt-1 text-[17px] leading-[1.6] text-foreground prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_h1]:my-2 [&_h3]:my-1 [&_ul]:my-1 [&_*]:!bg-transparent [&_*]:!text-[17px] [&_*]:!leading-[1.6] [&_*]:!font-normal [&_strong]:!font-bold [&_b]:!font-bold",
              !isExpanded && "line-clamp-3"
            )}
          />
          {!isExpanded && (post.content?.replace(/<[^>]*>?/gm, '').length > 80 || post.content?.length > 300) && (
            <button 
              onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
              className="text-muted-foreground text-sm hover:text-foreground mt-1"
            >
              더보기
            </button>
          )}
        </div>

        {/* X(트위터) 스타일 액션 버튼 */}
        <div className="flex items-center justify-between text-muted-foreground pt-1" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-6 sm:gap-10">
            {/* 좋아요 */}
            <button 
              onClick={toggleLike} 
              className="flex items-center gap-1.5 group transition-colors relative"
            >
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-md">좋아요</span>
              <div className="p-2 -ml-2 rounded-full group-hover:bg-zinc-500/10 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors">
                <Heart className={`h-[18px] w-[18px] sm:h-[20px] sm:w-[20px] ${isLiked ? 'text-zinc-700 fill-zinc-700 dark:text-zinc-300 dark:fill-zinc-300' : ''}`} />
              </div>
              <span className={`text-sm sm:text-[15px] font-medium ${isLiked ? 'text-zinc-700 dark:text-zinc-300' : 'group-hover:text-zinc-600 dark:group-hover:text-zinc-400'}`}>{formatCount(likesCount)}</span>
            </button>

            {/* 댓글 */}
            <Link 
              href={`/post/${post.id}`}
              className="flex items-center gap-1.5 group transition-colors relative"
            >
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-md">댓글</span>
              <div className="p-2 -ml-2 rounded-full group-hover:bg-zinc-500/10 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors">
                <MessageCircle className={`h-[18px] w-[18px] sm:h-[20px] sm:w-[20px] ${hasCommented ? 'text-zinc-700 fill-zinc-700 dark:text-zinc-300 dark:fill-zinc-300' : ''}`} />
              </div>
              <span className={`text-sm sm:text-[15px] font-medium ${hasCommented ? 'text-zinc-700 dark:text-zinc-300' : 'group-hover:text-zinc-600 dark:group-hover:text-zinc-400'}`}>{formatCount(commentCount)}</span>
            </Link>

            {/* 리포스트 */}
            <button 
              onClick={async (e) => {
                e.stopPropagation();
                if (!currentUserId) return;
                const newIsReposted = !isReposted;
                setIsReposted(newIsReposted);
                setRepostCount((prev: number) => newIsReposted ? prev + 1 : prev - 1);
                const supabase = createClient();
                if (newIsReposted) {
                  await supabase.from('shares').insert({ post_id: post.id, user_id: currentUserId });
                  await supabase.from('posts').insert({ user_id: currentUserId, community_id: currentUserId, content: `[REPOST:${post.id}]` });
                  if (post.user_id !== currentUserId) {
                    const { error: err1 } = await supabase.from('notifications').insert({ user_id: post.user_id, actor_id: currentUserId, type: 'repost', reference_id: post.id }); if (err1) toast.error("리포스트 알림 실패: " + err1.message);
                  }
                  toast.success('게시물을 리포스트했습니다.');
                  router.refresh();
                } else {
                  await supabase.from('shares').delete().match({ post_id: post.id, user_id: currentUserId });
                  await supabase.from('posts').delete().match({ user_id: currentUserId, content: `[REPOST:${post.id}]` });
                  toast.success('리포스트를 취소했습니다.');
                  router.refresh();
                }
              }}
              className="flex items-center gap-1.5 group transition-colors relative"
            >
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-md">리포스트</span>
              <div className="p-2 -ml-2 rounded-full group-hover:bg-zinc-500/10 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors">
                <Repeat className={`h-[18px] w-[18px] sm:h-[20px] sm:w-[20px] ${isReposted ? 'text-zinc-700 dark:text-zinc-300' : ''}`} />
              </div>
              <span className={`text-sm sm:text-[15px] font-medium ${isReposted ? 'text-zinc-700 dark:text-zinc-300' : 'group-hover:text-zinc-600 dark:group-hover:text-zinc-400'}`}>{formatCount(repostCount)}</span>
            </button>

            {/* 다운로드 (저장하기/북마크) */}
            <button 
              onClick={toggleSave}
              disabled={isSavedLoading}
              className="flex items-center gap-1.5 group transition-colors relative"
            >
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-md">사진첩에 저장하기</span>
              <div className="p-2 -ml-2 rounded-full group-hover:bg-zinc-500/10 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors">
                <Download className={`h-[18px] w-[18px] sm:h-[20px] sm:w-[20px] ${isSaved ? 'text-zinc-700 fill-zinc-700 dark:text-zinc-300 dark:fill-zinc-300' : ''}`} />
              </div>
            </button>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* 뷰 카운트 */}
            <div className="flex items-center gap-1.5 group transition-colors cursor-default relative">
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-md">조회수</span>
              <div className="p-2 -ml-2 rounded-full group-hover:bg-zinc-500/10 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors">
                <BarChart2 className="h-[18px] w-[18px] sm:h-[20px] sm:w-[20px]" />
              </div>
              <span className="text-sm sm:text-[15px] font-medium group-hover:text-zinc-600 dark:group-hover:text-zinc-400">{formatCount(post.view_count || 0)}</span>
            </div>

            {/* 공유 */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsShareOpen(true);
              }}
              className="p-2 rounded-full hover:bg-zinc-500/10 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors group relative"
            >
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-md">공유하기</span>
              <Forward className="h-[18px] w-[18px] sm:h-[20px] sm:w-[20px]" />
            </button>
          </div>
        </div>
      </div>

      <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
        <DialogContent className="sm:max-w-md bg-background border-border rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">게시물 공유하기</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <p className="text-sm text-muted-foreground">아래 링크를 복사하여 친구들에게 공유해보세요!</p>
            <div className="flex items-center gap-2">
              <Input 
                readOnly 
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/post/${post.id}`} 
                className="flex-1 bg-secondary text-secondary-foreground font-medium" 
              />
              <Button 
                onClick={async () => {
                  const url = `${window.location.origin}/post/${post.id}`;
                  navigator.clipboard.writeText(url);
                  const supabase = createClient()
                  // 공유 수도 증가시키기 위해 shares 테이블에 기록
                  await supabase.from('shares').insert({ post_id: post.id, user_id: currentUserId });
                  
                  if (post.user_id !== currentUserId) {
                    const { error: err2 } = await supabase.from('notifications').insert({ user_id: post.user_id, actor_id: currentUserId, type: 'share', reference_id: post.id }); if (err2) toast.error("공유 알림 실패: " + err2.message);
                  }
                  toast.success('링크가 복사되었습니다!');
                  setIsShareOpen(false);
                }}
                className="font-bold shrink-0"
              >
                복사
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
