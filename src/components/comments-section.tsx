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
import { Send, ThumbsUp, ThumbsDown } from 'lucide-react'

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
    <div className="flex flex-col absolute inset-0">
      <div className="flex-1 p-4 overflow-y-auto min-h-0">
        {parentComments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center mt-10">첫 댓글을 남겨보세요!</p>
        ) : (
          <div className="space-y-6">
            {parentComments.map(parent => (
              <div key={parent.id} className="flex flex-col gap-2">
                {/* 부모 댓글 */}
                <div className="flex gap-3 justify-between group">
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarImage src={parent.profiles?.avatar_url} />
                      <AvatarFallback>{parent.profiles?.username?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm">
                        <span className="font-bold mr-2">{parent.profiles?.username}</span>
                        <span>{parent.content}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <button onClick={() => toggleReaction(parent.id, 'like')} className="flex items-center gap-1 group/like">
                          <ThumbsUp className={`w-3.5 h-3.5 ${parent.comment_likes?.some((l: any) => l.user_id === currentUserId && !l.is_dislike) ? 'fill-foreground text-foreground' : 'text-muted-foreground group-hover/like:text-foreground'}`} />
                          {(parent.comment_likes?.filter((l: any) => !l.is_dislike).length || 0) > 0 && (
                            <span className="text-xs text-muted-foreground font-semibold">
                              {parent.comment_likes.filter((l: any) => !l.is_dislike).length}
                            </span>
                          )}
                        </button>
                        <button onClick={() => toggleReaction(parent.id, 'dislike')} className="flex items-center group/dislike">
                          <ThumbsDown className={`w-3.5 h-3.5 ${parent.comment_likes?.some((l: any) => l.user_id === currentUserId && l.is_dislike) ? 'fill-foreground text-foreground' : 'text-muted-foreground group-hover/dislike:text-foreground'}`} />
                        </button>
                        <button 
                          onClick={() => handleReplyClick(parent.id, parent.profiles?.username, parent.user_id)}
                          className="text-xs text-muted-foreground font-semibold hover:text-foreground ml-2"
                        >
                          답글 달기
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 대댓글 목록 (부모 id를 가진 댓글들) */}
                {comments.filter(c => c.parent_id === parent.id).length > 0 && (
                  <div className="ml-11 mt-1">
                    {!expandedReplies[parent.id] ? (
                      <button 
                        onClick={() => setExpandedReplies(prev => ({ ...prev, [parent.id]: true }))}
                        className="text-xs font-semibold text-blue-500 hover:text-blue-600 flex items-center gap-2"
                      >
                        <div className="w-8 h-[1px] bg-border" />
                        답글 {comments.filter(c => c.parent_id === parent.id).length}개 보기
                      </button>
                    ) : (
                      <div className="space-y-3">
                        {comments
                          .filter(c => c.parent_id === parent.id)
                          .sort(sortByReactionScore)
                          .map(child => (
                            <div key={child.id} className="flex gap-3 justify-between group">
                              <div className="flex gap-3">
                                <Avatar className="h-6 w-6 mt-1">
                                  <AvatarImage src={child.profiles?.avatar_url} />
                                  <AvatarFallback>{child.profiles?.username?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="text-sm">
                                    <span className="font-bold mr-2">{child.profiles?.username}</span>
                                    <span>{child.content}</span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-1">
                                    <button onClick={() => toggleReaction(child.id, 'like')} className="flex items-center gap-1 group/like">
                                      <ThumbsUp className={`w-3.5 h-3.5 ${child.comment_likes?.some((l: any) => l.user_id === currentUserId && !l.is_dislike) ? 'fill-foreground text-foreground' : 'text-muted-foreground group-hover/like:text-foreground'}`} />
                                      {(child.comment_likes?.filter((l: any) => !l.is_dislike).length || 0) > 0 && (
                                        <span className="text-xs text-muted-foreground font-semibold">
                                          {child.comment_likes.filter((l: any) => !l.is_dislike).length}
                                        </span>
                                      )}
                                    </button>
                                    <button onClick={() => toggleReaction(child.id, 'dislike')} className="flex items-center group/dislike">
                                      <ThumbsDown className={`w-3.5 h-3.5 ${child.comment_likes?.some((l: any) => l.user_id === currentUserId && l.is_dislike) ? 'fill-foreground text-foreground' : 'text-muted-foreground group-hover/dislike:text-foreground'}`} />
                                    </button>
                                    <button 
                                      onClick={() => handleReplyClick(parent.id, child.profiles?.username, child.user_id)}
                                      className="text-xs text-muted-foreground font-semibold hover:text-foreground ml-2"
                                    >
                                      답글 달기
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        
                        <button 
                          onClick={() => setExpandedReplies(prev => ({ ...prev, [parent.id]: false }))}
                          className="text-xs font-semibold text-blue-500 hover:text-blue-600 flex items-center gap-2 pt-1"
                        >
                          <div className="w-8 h-[1px] bg-border" />
                          답글 숨기기
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 댓글 입력창 */}
      <div className="p-3 border-t shrink-0">
        {replyTo && (
          <div className="flex items-center justify-between bg-muted p-2 rounded-t-md text-xs">
            <span><strong>{replyTo.username}</strong>님에게 답글 남기는 중...</span>
            <button onClick={() => setReplyTo(null)} className="font-bold">✕</button>
          </div>
        )}
        <form onSubmit={submitComment} className="flex items-center gap-2 relative">
          <Input 
            placeholder="댓글 달기..." 
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className={`border-none focus-visible:ring-0 rounded-none shadow-none px-2 ${replyTo ? 'rounded-b-md' : 'rounded-md'}`}
          />
          <Button type="submit" variant="ghost" size="icon" disabled={!newComment.trim()}>
            <Send className="h-5 w-5 text-blue-500" />
          </Button>
        </form>
      </div>
    </div>
  )
}
