'use client'

/**
 * 이 파일은 피드에 표시되는 개별 게시물(Post) 컴포넌트입니다.
 * - 작성자 정보
 * - 다중 이미지 슬라이드 (Carousel)
 * - 좋아요 및 댓글 아이콘
 * - 본문 내용 및 댓글 목록(일부)
 */

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { ThumbsUp, MessageCircle, Forward, MoreHorizontal, Edit2, Trash2, ArrowLeft } from 'lucide-react'
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

import { useRouter } from 'next/navigation'

export default function FeedPost({ 
  post, 
  currentUserId,
  showBackButton = false
}: { 
  post: any, 
  currentUserId?: string,
  showBackButton?: boolean
}) {
  const supabase = createClient()
  const router = useRouter()
  
  const initialLiked = post.likes?.some((like: any) => like.user_id === currentUserId)
  const initialShared = post.shares?.some((share: any) => share.user_id === currentUserId)
  
  const [isLiked, setIsLiked] = useState(initialLiked)
  const [likesCount, setLikesCount] = useState(post.likes?.length || 0)
  const [isShared, setIsShared] = useState(initialShared)
  const [shareCount, setShareCount] = useState(post.shares?.length || 0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)

  // post 객체가 변경될 때 상태 동기화 (라우팅 시 이전 캐시 상태로 돌아가는 현상 방지)
  useEffect(() => {
    setIsLiked(post.likes?.some((like: any) => like.user_id === currentUserId))
    setLikesCount(post.likes?.length || 0)
    setIsShared(post.shares?.some((share: any) => share.user_id === currentUserId))
    setShareCount(post.shares?.length || 0)
  }, [post, currentUserId])

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/post/${post.id}`
    navigator.clipboard.writeText(url)
    toast.success('링크가 복사되었습니다.')
    
    // 이미 공유를 누르지 않은 경우에만 공유 수 + 1
    if (currentUserId && !isShared) {
      setIsShared(true)
      setShareCount((prev: number) => prev + 1)
      await supabase.from('shares').insert({ post_id: post.id, user_id: currentUserId })
      router.refresh() // 캐시 갱신
    }
  }

  // 좋아요 버튼 클릭 핸들러
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
        await supabase.from('notifications').insert({
          user_id: post.user_id, // 게시물 주인
          actor_id: currentUserId, // 좋아요 누른 사람
          type: 'like',
          reference_id: post.id
        })
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
    <div className={`${showBackButton ? 'bg-background' : 'border rounded-lg bg-card overflow-hidden'}`}>
      {/* 1. 작성자 헤더 */}
      <div className={`flex items-center justify-between py-3 relative ${showBackButton ? 'px-0' : 'px-4'}`}>
        <div className="flex items-center gap-3">
          {showBackButton && (
            <button 
              onClick={() => router.back()}
              className="absolute -left-11 w-9 h-9 flex items-center justify-center rounded-full bg-secondary/40 hover:bg-secondary transition-colors text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <Avatar className="h-8 w-8">
            <AvatarImage src={post.profiles?.avatar_url || ''} />
            <AvatarFallback>{post.profiles?.username?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <Link href={`/profile/${post.profiles?.username}`} className="font-semibold text-sm hover:underline">
                {post.profiles?.username}
              </Link>
              <span className="text-muted-foreground text-sm">
                · {formatTimeAgo(post.created_at)}
              </span>
            </div>
            {post.profiles?.is_instagram_public && post.profiles?.instagram_id && (
              <span className="text-xs text-muted-foreground mt-0.5">
                @{post.profiles.instagram_id}
              </span>
            )}
          </div>
        </div>
        {post.user_id === currentUserId && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground transition-colors outline-none">
              <MoreHorizontal className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/create?edit=${post.id}`)} className="cursor-pointer">
                <Edit2 className="w-4 h-4 mr-2" />
                수정하기
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-red-500 hover:text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950">
                <Trash2 className="w-4 h-4 mr-2" />
                삭제하기
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* 2. 글 제목 */}
      {post.title && (
        <div className={`pb-2 cursor-pointer ${showBackButton ? 'px-0' : 'px-4'}`} onClick={() => router.push(`/post/${post.id}`)}>
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
                          onClick={() => router.push(`/post/${post.id}`)}
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
          onClick={() => router.push(`/post/${post.id}`)}
        >
          <div 
            dangerouslySetInnerHTML={{ __html: post.content }} 
            className={cn(
              "mt-1 prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_h1]:my-2 [&_h3]:my-1 [&_ul]:my-1",
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

        {/* 액션 버튼 (좋아요, 댓글, 공유) */}
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleLike} 
            className="flex items-center gap-1.5 px-4 py-1.5 bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition-colors font-semibold text-sm"
          >
            <ThumbsUp className={`h-5 w-5 ${isLiked ? 'fill-foreground text-foreground' : 'text-foreground'}`} />
            <span>{likesCount}</span>
          </button>
          
          <Link 
            href={`/post/${post.id}`}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition-colors font-semibold text-sm"
          >
            <MessageCircle className="h-5 w-5" />
            <span>{post.comments?.length || 0}</span>
          </Link>

          <button 
            onClick={() => setIsShareOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition-colors font-semibold text-sm"
          >
            <Forward className={`h-5 w-5 ${isShared ? 'fill-foreground text-foreground' : 'text-foreground'}`} />
            <span>{shareCount}</span>
          </button>
        </div>
      </div>

      <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-900 text-white border-zinc-800 rounded-xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-left font-semibold text-lg text-white flex justify-between items-center">
              Share in a post
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex justify-center mb-2">
            <Button variant="secondary" className="rounded-full bg-zinc-100 text-black hover:bg-zinc-200 h-10 px-6 font-bold">
              Create post
            </Button>
          </div>
          <div className="text-center text-zinc-400 text-sm mb-6">
            No subscribers
          </div>

          <div className="px-4 pb-6">
            <div className="text-white text-base mb-4 font-medium">Share</div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
              <div className="flex flex-col items-center gap-2 min-w-[72px] snap-start">
                <button onClick={handleCopyLink} className="w-16 h-16 rounded-full bg-white flex items-center justify-center hover:opacity-90 transition-opacity">
                  <div className="w-8 h-8 flex items-center justify-center">
                    <span className="text-xl font-medium text-black">{"<>"}</span>
                  </div>
                </button>
                <span className="text-xs text-zinc-300">Embed</span>
              </div>
              <div className="flex flex-col items-center gap-2 min-w-[72px] snap-start">
                <button onClick={handleCopyLink} className="w-16 h-16 rounded-full bg-[#FF4500] flex items-center justify-center hover:opacity-90 transition-opacity">
                  <span className="font-bold text-white text-xl">Reddit</span>
                </button>
                <span className="text-xs text-zinc-300">Reddit</span>
              </div>
              <div className="flex flex-col items-center gap-2 min-w-[72px] snap-start">
                <button onClick={handleCopyLink} className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center hover:opacity-90 transition-opacity">
                  <MessageCircle className="w-8 h-8 fill-white text-blue-500" />
                </button>
                <span className="text-xs text-zinc-300">Messages</span>
              </div>
              <div className="flex flex-col items-center gap-2 min-w-[72px] snap-start">
                <button onClick={handleCopyLink} className="w-16 h-16 rounded-full bg-[#25D366] flex items-center justify-center hover:opacity-90 transition-opacity">
                  <MessageCircle className="w-8 h-8 fill-white text-[#25D366]" />
                </button>
                <span className="text-xs text-zinc-300">WhatsApp</span>
              </div>
              <div className="flex flex-col items-center gap-2 min-w-[72px] snap-start">
                <button onClick={handleCopyLink} className="w-16 h-16 rounded-full bg-[#1877F2] flex items-center justify-center hover:opacity-90 transition-opacity">
                  <span className="font-bold text-3xl text-white">f</span>
                </button>
                <span className="text-xs text-zinc-300">Facebook</span>
              </div>
            </div>
            
            <div className="mt-4 flex items-center gap-2 p-2 bg-transparent rounded-full border border-zinc-700 h-14 relative overflow-hidden">
              <input 
                type="text" 
                readOnly 
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/post/${post.id}`} 
                className="flex-1 bg-transparent border-none text-sm text-zinc-200 focus:outline-none px-4 truncate pr-24"
              />
              <Button onClick={handleCopyLink} className="absolute right-1 top-1 bottom-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full px-6 border border-zinc-700 font-semibold">
                Copy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
