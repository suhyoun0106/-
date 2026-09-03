'use client'

/**
 * 이 파일은 댓글과 대댓글(1 depth)을 표시하고 작성하는 컴포넌트입니다.
 * - 댓글 목록 실시간 업데이트 (옵션) 또는 로드 시 렌더링
 * - 답글 달기 버튼을 통해 대댓글 기능 지원
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { toast } from 'sonner'
import { ThumbsUp, ThumbsDown, MoreVertical, ChevronDown, ChevronUp, Menu } from 'lucide-react'
import { formatTimeAgo } from '@/lib/format-time'

export default function CommentsSection({ 
  postId, 
  currentUserId,
  postOwnerId
}: { 
  postId: string, 
  currentUserId?: string,
  postOwnerId: string
}) {
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string, username: string, targetUserId: string } | null>(null)
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  
  const handleReplyClick = (parentId: string, targetUsername: string, targetUserId: string) => {
    setReplyTo({ id: parentId, username: targetUsername, targetUserId })
    setNewComment(`@${targetUsername} `)
  }
  
  const supabase = createClient()

  useEffect(() => {
    fetchComments()
  }, [])

  async function fetchComments() {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles (id, username, avatar_url),
        comment_likes (id, user_id, is_dislike)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (data) {
      setComments(data)
    }
  }

  // 댓글 전송 핸들러
  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim() || !currentUserId) return

    const commentData = {
      post_id: postId,
      user_id: currentUserId,
      content: newComment,
      parent_id: replyTo ? replyTo.id : null
    }

    if (replyTo) {
      setExpandedReplies(prev => ({ ...prev, [replyTo.id]: true }))
    }

    const currentTargetUserId = replyTo ? replyTo.targetUserId : postOwnerId

    // 로컬 상태 초기화
    setNewComment('')
    setReplyTo(null)

    const { data: insertedComment, error } = await supabase
      .from('comments')
      .insert(commentData)
      .select()
      .single()

    if (error) {
      toast.error('댓글 작성 실패')
    } else {
      // 목록 다시 불러오기
      fetchComments()

      // 알림(Notification) 전송 로직
      if (currentTargetUserId && currentTargetUserId !== currentUserId) {
        await supabase.from('notifications').insert({
          user_id: currentTargetUserId,
          actor_id: currentUserId,
          type: 'comment',
          reference_id: postId
        })
      }
    }
  }

  async function toggleReaction(commentId: string, type: 'like' | 'dislike') {
    if (!currentUserId) return
    
    // 현재 유저의 기존 리액션 상태 확인
    const comment = comments.find(c => c.id === commentId)
    if (!comment) return
    
    const existingLikes = comment.comment_likes || []
    const userLike = existingLikes.find((l: any) => l.user_id === currentUserId)
    const isCurrentlyLiked = userLike && !userLike.is_dislike
    const isCurrentlyDisliked = userLike && userLike.is_dislike

    // 낙관적 업데이트
    setComments(prev => prev.map(c => {
      if (c.id === commentId) {
        const likes = c.comment_likes || []
        const filtered = likes.filter((l: any) => l.user_id !== currentUserId) // 내 리액션 제거

        if (type === 'like') {
          if (isCurrentlyLiked) return { ...c, comment_likes: filtered } // 취소
          return { ...c, comment_likes: [...filtered, { id: 'temp', user_id: currentUserId, is_dislike: false }] } // 좋아요 추가
        } else {
          if (isCurrentlyDisliked) return { ...c, comment_likes: filtered } // 취소
          return { ...c, comment_likes: [...filtered, { id: 'temp', user_id: currentUserId, is_dislike: true }] } // 싫어요 추가
        }
      }
      return c
    }))

    // DB 업데이트
    if (type === 'like') {
      if (isCurrentlyLiked) {
        await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUserId)
      } else {
        if (isCurrentlyDisliked) {
          await supabase.from('comment_likes').update({ is_dislike: false }).eq('comment_id', commentId).eq('user_id', currentUserId)
        } else {
          await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: currentUserId, is_dislike: false })
        }
      }
    } else {
      if (isCurrentlyDisliked) {
        await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUserId)
      } else {
        if (isCurrentlyLiked) {
          await supabase.from('comment_likes').update({ is_dislike: true }).eq('comment_id', commentId).eq('user_id', currentUserId)
        } else {
          await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: currentUserId, is_dislike: true })
        }
      }
    }
  }

  // 내가 쓴 댓글을 최상단으로, 그 다음엔 좋아요 순으로 정렬
  const sortByReactionScore = (a: any, b: any) => {
    // 1. 내가 쓴 댓글인지 확인
    if (currentUserId) {
      if (a.user_id === currentUserId && b.user_id !== currentUserId) return -1
      if (b.user_id === currentUserId && a.user_id !== currentUserId) return 1
    }

    // 2. 좋아요 점수 (순수 좋아요 수 = 좋아요 - 싫어요)
    const aLikes = a.comment_likes?.filter((l: any) => !l.is_dislike).length || 0
    const aDislikes = a.comment_likes?.filter((l: any) => l.is_dislike).length || 0
    const aScore = aLikes - aDislikes
    
    const bLikes = b.comment_likes?.filter((l: any) => !l.is_dislike).length || 0
    const bDislikes = b.comment_likes?.filter((l: any) => l.is_dislike).length || 0
    const bScore = bLikes - bDislikes

    if (bScore !== aScore) return bScore - aScore
    
    // 3. 점수가 같으면 오래된 순
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  }

  const parentComments = comments.filter(c => !c.parent_id).sort(sortByReactionScore)
  
  return (
    <div className="flex flex-col w-full text-foreground bg-background">
      
      {/* 1. 상단: 댓글 개수 및 정렬 */}
      <div className="flex items-center gap-6 mb-6">
        <h2 className="text-xl font-bold">{comments.length} Comments</h2>
        <button className="flex items-center gap-2 text-sm font-semibold hover:bg-secondary/50 px-2 py-1 rounded-lg transition-colors">
          <Menu className="w-5 h-5" />
          Sort by
        </button>
      </div>

      {/* 2. 댓글 입력창 */}
      <div className="flex gap-4 mb-8">
        {/* 현재 사용자 아바타 (임시) */}
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src="" />
          <AvatarFallback className="bg-blue-500 text-white font-bold">ME</AvatarFallback>
        </Avatar>
        
        <div className="flex-1">
          {replyTo && (
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-2">
              <span>@{replyTo.username} 님에게 답글 작성 중...</span>
              <button onClick={() => setReplyTo(null)} className="hover:text-foreground">✕</button>
            </div>
          )}
          <form onSubmit={submitComment} className="flex flex-col gap-2">
            <input 
              placeholder="Add a comment..." 
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full pb-1 bg-transparent border-b border-border/50 focus:border-foreground focus:outline-none transition-colors text-sm"
            />
            {newComment.trim() && (
              <div className="flex justify-end gap-2 mt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => {setNewComment(''); setReplyTo(null);}} className="rounded-full hover:bg-secondary font-semibold">
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4">
                  Comment
                </Button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* 3. 댓글 목록 */}
      <div className="w-full">
        {parentComments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10 font-medium">첫 댓글을 남겨보세요!</p>
        ) : (
          <div className="space-y-8">
            {parentComments.map(parent => {
              const upvotes = parent.comment_likes?.filter((l: any) => !l.is_dislike).length || 0;
              const hasUpvoted = parent.comment_likes?.some((l: any) => l.user_id === currentUserId && !l.is_dislike);
              const hasDownvoted = parent.comment_likes?.some((l: any) => l.user_id === currentUserId && l.is_dislike);
              const childComments = comments.filter(c => c.parent_id === parent.id);
              
              return (
                <div key={parent.id} className="flex flex-col">
                  {/* 부모 댓글 */}
                  <div className="flex gap-4 group">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={parent.profiles?.avatar_url} />
                      <AvatarFallback>{parent.profiles?.username?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs mb-1">
                          <span className="font-bold text-[13px]">@{parent.profiles?.username}</span>
                          <span className="text-muted-foreground">{formatTimeAgo(parent.created_at)}</span>
                        </div>
                        <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-secondary rounded-full transition-all">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="text-[14px] mb-2">{parent.content}</div>
                      
                      {/* 액션 버튼 */}
                      <div className="flex items-center gap-2 mt-1 text-[13px] font-bold text-foreground">
                        <button onClick={() => toggleReaction(parent.id, 'like')} className="flex items-center gap-1.5 hover:bg-secondary p-1.5 px-2 rounded-full transition-colors">
                          <ThumbsUp className={`w-[18px] h-[18px] ${hasUpvoted ? 'fill-foreground' : ''}`} />
                          <span className="text-muted-foreground text-xs">{upvotes > 0 ? upvotes : ''}</span>
                        </button>
                        <button onClick={() => toggleReaction(parent.id, 'dislike')} className="flex items-center hover:bg-secondary p-1.5 px-2 rounded-full transition-colors">
                          <ThumbsDown className={`w-[18px] h-[18px] ${hasDownvoted ? 'fill-foreground' : ''}`} />
                        </button>
                        
                        <button 
                          onClick={() => handleReplyClick(parent.id, parent.profiles?.username, parent.user_id)}
                          className="flex items-center ml-2 hover:bg-secondary p-1.5 px-3 rounded-full transition-colors text-xs"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 대댓글 영역 */}
                  {childComments.length > 0 && (
                    <div className="ml-5 mt-2 flex relative">
                      {/* 유튜브 스타일 둥근 연결선 (아바타 중앙 20px에 완벽 정렬) */}
                      <div className="absolute left-0 top-0 bottom-[20px] w-[30px] border-l-[2px] border-b-[2px] border-border/40 rounded-bl-[16px] z-0" />
                      
                      <div className="flex-1 flex flex-col pl-8 z-10 pt-1">
                        {!expandedReplies[parent.id] ? (
                          <button 
                            onClick={() => setExpandedReplies(prev => ({ ...prev, [parent.id]: true }))}
                            className="text-[14px] font-bold text-blue-500 hover:bg-blue-500/10 self-start px-3 py-1.5 rounded-full flex items-center gap-2 transition-colors relative z-10 bg-background"
                          >
                            <ChevronDown className="w-4 h-4" />
                            {childComments.length} replies
                          </button>
                        ) : (
                          <div className="space-y-4 pt-1">
                            {childComments
                              .sort(sortByReactionScore)
                              .map(child => {
                                const childUpvotes = child.comment_likes?.filter((l: any) => !l.is_dislike).length || 0;
                                const childHasUpvoted = child.comment_likes?.some((l: any) => l.user_id === currentUserId && !l.is_dislike);
                                const childHasDownvoted = child.comment_likes?.some((l: any) => l.user_id === currentUserId && l.is_dislike);
                                
                                return (
                                  <div key={child.id} className="flex gap-3 group">
                                    <Avatar className="h-7 w-7 mt-0.5 shrink-0">
                                      <AvatarImage src={child.profiles?.avatar_url} />
                                      <AvatarFallback>{child.profiles?.username?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    
                                    <div className="flex flex-col flex-1">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs mb-1">
                                          <span className="font-bold text-[13px]">@{child.profiles?.username}</span>
                                          <span className="text-muted-foreground">{formatTimeAgo(child.created_at)}</span>
                                        </div>
                                        <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-secondary rounded-full transition-all">
                                          <MoreVertical className="w-4 h-4" />
                                        </button>
                                      </div>
                                      
                                      <div className="text-[14px] mb-1.5">{child.content}</div>
                                      
                                      {/* 대댓글 액션 버튼 */}
                                      <div className="flex items-center gap-2 text-[13px] font-bold text-foreground">
                                        <button onClick={() => toggleReaction(child.id, 'like')} className="flex items-center gap-1.5 hover:bg-secondary p-1.5 px-2 rounded-full transition-colors">
                                          <ThumbsUp className={`w-[16px] h-[16px] ${childHasUpvoted ? 'fill-foreground' : ''}`} />
                                          <span className="text-muted-foreground text-[11px]">{childUpvotes > 0 ? childUpvotes : ''}</span>
                                        </button>
                                        <button onClick={() => toggleReaction(child.id, 'dislike')} className="flex items-center hover:bg-secondary p-1.5 px-2 rounded-full transition-colors">
                                          <ThumbsDown className={`w-[16px] h-[16px] ${childHasDownvoted ? 'fill-foreground' : ''}`} />
                                        </button>
                                        
                                        <button 
                                          onClick={() => handleReplyClick(parent.id, child.profiles?.username, child.user_id)}
                                          className="flex items-center ml-1 hover:bg-secondary p-1.5 px-3 rounded-full transition-colors text-xs"
                                        >
                                          Reply
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            
                            <button 
                              onClick={() => setExpandedReplies(prev => ({ ...prev, [parent.id]: false }))}
                              className="text-[14px] font-bold text-blue-500 hover:bg-blue-500/10 self-start px-3 py-1.5 rounded-full flex items-center gap-2 mt-2 transition-colors relative z-10 bg-background"
                            >
                              <ChevronUp className="w-4 h-4" />
                              Hide replies
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  )
}
