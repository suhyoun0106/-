'use client'

/**
 * 이 파일은 피드에 표시되는 개별 게시물(Post) 컴포넌트입니다.
 * - 작성자 정보
 * - 다중 이미지 슬라이드 (Carousel)
 * - 좋아요 및 댓글 아이콘
 * - 본문 내용 및 댓글 목록(일부)
 */

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Heart, MessageCircle, Send } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Button } from '@/components/ui/button'

export default function FeedPost({ post, currentUserId }: { post: any, currentUserId?: string }) {
  const supabase = createClient()
  
  // 현재 유저가 이 게시물에 좋아요를 눌렀는지 초기 상태 설정
  const initialLiked = post.likes?.some((like: any) => like.user_id === currentUserId)
  
  const [isLiked, setIsLiked] = useState(initialLiked)
  const [likesCount, setLikesCount] = useState(post.likes?.length || 0)

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
  }

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* 1. 작성자 헤더 */}
      <div className="flex items-center p-3 gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={post.profiles?.avatar_url || ''} />
          <AvatarFallback>{post.profiles?.username?.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <Link href={`/profile/${post.profiles?.username}`} className="font-semibold text-sm hover:underline">
          {post.profiles?.username}
        </Link>
      </div>

      {/* 2. 이미지 슬라이더 (Carousel) */}
      {post.post_images && post.post_images.length > 0 && (
        <Carousel className="w-full">
          <CarouselContent>
            {post.post_images
              .sort((a: any, b: any) => a.position - b.position)
              .map((img: any) => (
              <CarouselItem key={img.id} className="relative aspect-square bg-muted">
                {/* next/image 대신 간단하게 img 태그를 사용할 수도 있지만 최적화를 위해 Image 권장 */}
                <img 
                  src={img.image_url} 
                  alt="Post content" 
                  className="absolute inset-0 w-full h-full object-cover"
                />
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

      {/* 3. 액션 버튼 (좋아요, 댓글 등) */}
      <div className="p-3">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={toggleLike} className="hover:opacity-70 transition-opacity">
            <Heart 
              className={`h-7 w-7 transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-foreground'}`} 
            />
          </button>
          <Link href={`/post/${post.id}`}>
            <MessageCircle className="h-7 w-7 text-foreground hover:opacity-70 transition-opacity" />
          </Link>
          <button className="hover:opacity-70 transition-opacity">
            <Send className="h-7 w-7 text-foreground" />
          </button>
        </div>

        {/* 4. 좋아요 개수 */}
        <div className="font-semibold text-sm mb-1">
          좋아요 {likesCount}개
        </div>

        {/* 5. 본문 내용 */}
        <div className="text-sm">
          <span className="font-semibold mr-2">{post.profiles?.username}</span>
          <span>{post.content}</span>
        </div>

        {/* 6. 댓글 모두 보기 링크 */}
        {post.comments?.length > 0 && (
          <Link href={`/post/${post.id}`} className="text-sm text-muted-foreground mt-1 block">
            댓글 {post.comments.length}개 모두 보기
          </Link>
        )}
      </div>
    </div>
  )
}
