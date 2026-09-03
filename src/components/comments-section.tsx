'use client'

/**
 * 이 파일은 댓글과 대댓글(1 depth)을 표시하고 작성하는 컴포넌트입니다.
 * - 댓글 목록 실시간 업데이트 (옵션) 또는 로드 시 렌더링
 * - 답글 달기 버튼을 통해 대댓글 기능 지원
 */

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { toast } from 'sonner'
import { ThumbsUp, ThumbsDown, MoreVertical, ChevronDown, ChevronUp, Menu, Image as ImageIcon, MonitorPlay, Type } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
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
  
  // 상태 분리: 탑레벨 댓글 vs 인라인 대댓글
  const [topLevelComment, setTopLevelComment] = useState('')
  const [inlineReplyText, setInlineReplyText] = useState('')
  
  // replyTo: id는 현재 답글을 달 대상 댓글의 ID, rootParentId는 최상위 부모 ID
  const [replyTo, setReplyTo] = useState<{ id: string, username: string, targetUserId: string, rootParentId: string } | null>(null)
  
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  const [sortType, setSortType] = useState<'top' | 'newest'>('top')
  const [currentUserProfile, setCurrentUserProfile] = useState<{avatar_url?: string, username?: string} | null>(null)
  const textareaRef = useRef<HTMLInputElement>(null)
  
  const supabase = createClient()

  useEffect(() => {
    fetchComments()
    if (currentUserId) {
      supabase.from('profiles').select('avatar_url, username').eq('id', currentUserId).single().then(({data}) => {
        if (data) setCurrentUserProfile(data as any)
      })
    }
  }, [currentUserId])

  async function fetchComments() {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles (id, username, avatar_url),
        comment_likes (user_id, is_dislike)
      `)
      .eq('post_id', postId)
      
    if (!error && data) {
      setComments(data)
    }
  }

  const handleReplyClick = (commentId: string, targetUsername: string, targetUserId: string, rootParentId: string) => {
    setReplyTo({ id: commentId, username: targetUsername, targetUserId, rootParentId })
    setInlineReplyText('')
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 10)
  }

  const handleReport = () => {
    toast.success('신고가 완료되었습니다')
  }

  async function submitTopLevelComment(e: React.FormEvent) {
    e.preventDefault()
    if (!topLevelComment.trim() || !currentUserId) return

    const commentData = {
      post_id: postId,
      user_id: currentUserId,
      content: topLevelComment.trim(),
      parent_id: null
    }

    setTopLevelComment('')

    const { data: insertedComment, error } = await supabase
      .from('comments')
      .insert(commentData)
      .select()
      .single()

    if (error) {
      toast.error('댓글 작성 실패')
    } else {
      fetchComments()
    }
  }

  async function submitInlineReply(e: React.FormEvent) {
    e.preventDefault()
    if (!inlineReplyText.trim() || !currentUserId || !replyTo) return

    const commentData = {
      post_id: postId,
      user_id: currentUserId,
      content: `@${replyTo.username} ${inlineReplyText.trim()}`,
      parent_id: replyTo.rootParentId
    }

    const currentTargetUserId = replyTo.targetUserId
    setReplyTo(null)
    setInlineReplyText('')

    const { data: insertedComment, error } = await supabase
      .from('comments')
      .insert(commentData)
      .select()
      .single()

    if (error) {
      toast.error('답글 작성 실패')
    } else {
      fetchComments()
      // 알림 전송
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
    
    const comment = comments.find(c => c.id === commentId)
    if (!comment) return
    
    const existingLikes = comment.comment_likes || []
    const userLike = existingLikes.find((l: any) => l.user_id === currentUserId)
    const isCurrentlyLiked = userLike && !userLike.is_dislike
    const isCurrentlyDisliked = userLike && userLike.is_dislike

    if (type === 'like') {
      if (isCurrentlyLiked) {
        await supabase.from('comment_likes').delete().match({ comment_id: commentId, user_id: currentUserId })
      } else {
        if (isCurrentlyDisliked) await supabase.from('comment_likes').delete().match({ comment_id: commentId, user_id: currentUserId })
        await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: currentUserId, is_dislike: false })
      }
    } else {
      if (isCurrentlyDisliked) {
        await supabase.from('comment_likes').delete().match({ comment_id: commentId, user_id: currentUserId })
      } else {
        if (isCurrentlyLiked) await supabase.from('comment_likes').delete().match({ comment_id: commentId, user_id: currentUserId })
        await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: currentUserId, is_dislike: true })
      }
    }
    fetchComments()
  }

  const sortByReactionScore = (a: any, b: any) => {
    if (currentUserId) {
      const aIsMine = a.user_id === currentUserId;
      const bIsMine = b.user_id === currentUserId;
      
      if (aIsMine && !bIsMine) return -1;
      if (!aIsMine && bIsMine) return 1;
      
      if (aIsMine && bIsMine) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    }

    if (sortType === 'newest') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }

    const aLikes = a.comment_likes?.filter((l: any) => !l.is_dislike).length || 0
    const aDislikes = a.comment_likes?.filter((l: any) => l.is_dislike).length || 0
    const aScore = aLikes - aDislikes
    
    const bLikes = b.comment_likes?.filter((l: any) => !l.is_dislike).length || 0
    const bDislikes = b.comment_likes?.filter((l: any) => l.is_dislike).length || 0
    const bScore = bLikes - bDislikes

    if (bScore !== aScore) return bScore - aScore
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  }

  const parentComments = comments.filter(c => !c.parent_id).sort(sortByReactionScore)

  const renderInlineReplyForm = () => (
    <div className="flex gap-3 mt-3 w-full pr-4">
      <Avatar className="h-6 w-6 mt-1 shrink-0">
        <AvatarImage src={currentUserProfile?.avatar_url || ''} />
        <AvatarFallback className="bg-blue-500 text-[10px] text-white font-bold">{currentUserProfile?.username?.charAt(0) || 'ME'}</AvatarFallback>
      </Avatar>
      <form onSubmit={submitInlineReply} className="flex-1 flex flex-col">
        <div className="flex items-center gap-1 border-b border-foreground pb-1">
          <span className="bg-secondary/80 px-2 py-0.5 rounded-full text-[12px] font-bold">@{replyTo?.username}</span>
          <input
            ref={textareaRef}
            value={inlineReplyText}
            onChange={(e) => setInlineReplyText(e.target.value)}
            className="flex-1 bg-transparent focus:outline-none text-[14px] px-1"
          />
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            onClick={() => { setReplyTo(null); setInlineReplyText(''); }} 
            className="rounded-full text-foreground hover:bg-secondary font-bold text-xs px-4 h-8"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            size="sm" 
            disabled={!inlineReplyText.trim()}
            className="rounded-full bg-secondary/80 hover:bg-secondary text-foreground font-bold text-xs px-4 h-8 disabled:opacity-50"
          >
            Reply
          </Button>
        </div>
      </form>
    </div>
  )
  
  return (
    <div className="flex flex-col w-full px-0 text-foreground bg-background">
      
      {/* 2. 메인 댓글 입력창 (요청된 2번 이미지 형태 - 단순 라운드 폼) */}
      <div className="mb-8">
        <form 
          onSubmit={submitTopLevelComment}
          className="flex flex-col border border-border/50 rounded-full bg-background hover:bg-secondary/20 transition-all duration-200"
        >
          <input
            placeholder="대화에 참여해보세요"
            value={topLevelComment}
            onChange={(e) => setTopLevelComment(e.target.value)}
            className="w-full bg-transparent focus:outline-none px-5 py-3.5 text-[15px]"
          />
          {/* 엔터키로 제출됨 */}
        </form>
      </div>

      {/* 1. 상단: 댓글 개수 및 정렬 */}
      <div className="flex items-center gap-6 mb-6">
        <h2 className="text-xl font-bold">{comments.length} Comments</h2>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 text-sm font-bold hover:bg-secondary/50 px-3 py-1.5 rounded-lg transition-colors outline-none">
            <Menu className="w-5 h-5" />
            Sort by
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[160px] bg-background text-foreground border border-border rounded-xl shadow-lg p-1">
            <DropdownMenuItem 
              onClick={() => setSortType('top')}
              className={`flex items-center px-4 py-2.5 cursor-pointer rounded-lg font-bold text-sm ${sortType === 'top' ? 'bg-secondary' : 'hover:bg-secondary/70'}`}
            >
              Top
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setSortType('newest')}
              className={`flex items-center px-4 py-2.5 cursor-pointer rounded-lg font-bold text-sm ${sortType === 'newest' ? 'bg-secondary' : 'hover:bg-secondary/70'}`}
            >
              Newest
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
                  <div className="flex gap-4">
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
                        {/* 더보기 (항상 표시, 클릭 시 신고하기/취소) */}
                        <DropdownMenu>
                          <DropdownMenuTrigger className="p-1 hover:bg-secondary rounded-full transition-all outline-none text-foreground">
                            <MoreVertical className="w-4 h-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[120px] bg-background border border-border shadow-md rounded-xl p-1">
                            <DropdownMenuItem onClick={handleReport} className="text-[13px] font-bold cursor-pointer rounded-lg px-3 py-2 hover:bg-secondary">
                              신고하기
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[13px] font-bold cursor-pointer rounded-lg px-3 py-2 hover:bg-secondary text-muted-foreground">
                              취소
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="text-[14px] mb-2">{parent.content}</div>
                      
                      {/* 액션 버튼 */}
                      <div className="flex items-center gap-2 mt-1 -ml-2 text-[13px] font-bold text-foreground">
                        <button onClick={() => toggleReaction(parent.id, 'like')} className="flex items-center gap-1.5 hover:bg-secondary p-1.5 px-2 rounded-full transition-colors">
                          <ThumbsUp className={`w-[18px] h-[18px] ${hasUpvoted ? 'fill-foreground' : ''}`} />
                          <span className="text-muted-foreground text-xs">{upvotes > 0 ? upvotes : ''}</span>
                        </button>
                        <button onClick={() => toggleReaction(parent.id, 'dislike')} className="flex items-center hover:bg-secondary p-1.5 px-2 rounded-full transition-colors">
                          <ThumbsDown className={`w-[18px] h-[18px] ${hasDownvoted ? 'fill-foreground' : ''}`} />
                        </button>
                        
                        <button 
                          onClick={() => handleReplyClick(parent.id, parent.profiles?.username, parent.user_id, parent.id)}
                          className="flex items-center ml-2 hover:bg-secondary p-1.5 px-3 rounded-full transition-colors text-xs"
                        >
                          Reply
                        </button>
                      </div>

                      {/* 부모 댓글에 대한 인라인 답글 폼 */}
                      {replyTo?.id === parent.id && renderInlineReplyForm()}
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
                                  <div key={child.id} className="flex gap-3">
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
                                        {/* 더보기 (항상 표시, 클릭 시 신고하기/취소) */}
                                        <DropdownMenu>
                                          <DropdownMenuTrigger className="p-1 hover:bg-secondary rounded-full transition-all outline-none text-foreground">
                                            <MoreVertical className="w-4 h-4" />
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-[120px] bg-background border border-border shadow-md rounded-xl p-1">
                                            <DropdownMenuItem onClick={handleReport} className="text-[13px] font-bold cursor-pointer rounded-lg px-3 py-2 hover:bg-secondary">
                              신고하기
                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-[13px] font-bold cursor-pointer rounded-lg px-3 py-2 hover:bg-secondary text-muted-foreground">
                                              취소
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
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
                                          onClick={() => handleReplyClick(child.id, child.profiles?.username, child.user_id, parent.id)}
                                          className="flex items-center ml-1 hover:bg-secondary p-1.5 px-3 rounded-full transition-colors text-xs"
                                        >
                                          Reply
                                        </button>
                                      </div>

                                      {/* 대댓글에 대한 인라인 답글 폼 */}
                                      {replyTo?.id === child.id && renderInlineReplyForm()}
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
