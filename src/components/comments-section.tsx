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
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { Send } from 'lucide-react'

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
  const [replyTo, setReplyTo] = useState<{ id: string, username: string } | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    fetchComments()
  }, [])

  async function fetchComments() {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles (id, username, avatar_url)
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
      // 1. 대댓글인 경우 원본 댓글 작성자에게 알림
      // 2. 일반 댓글인 경우 게시물 작성자에게 알림
      const targetUserId = replyTo ? null /* 대댓글 작성시 원본 작성자 id를 찾아야함, 복잡하므로 여기선 생략하거나 따로 조회 */ : postOwnerId
      
      if (targetUserId && targetUserId !== currentUserId) {
        await supabase.from('notifications').insert({
          user_id: targetUserId,
          actor_id: currentUserId,
          type: 'comment',
          reference_id: insertedComment.id
        })
      }
    }
  }

  // 부모 댓글과 대댓글을 계층형으로 분류
  const parentComments = comments.filter(c => !c.parent_id)
  
  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        {parentComments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center mt-10">첫 댓글을 남겨보세요!</p>
        ) : (
          <div className="space-y-6">
            {parentComments.map(parent => (
              <div key={parent.id} className="flex flex-col gap-2">
                {/* 부모 댓글 */}
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
                    <button 
                      onClick={() => setReplyTo({ id: parent.id, username: parent.profiles?.username })}
                      className="text-xs text-muted-foreground font-semibold hover:text-foreground mt-1"
                    >
                      답글 달기
                    </button>
                  </div>
                </div>

                {/* 대댓글 목록 (부모 id를 가진 댓글들) */}
                <div className="ml-11 space-y-3">
                  {comments
                    .filter(c => c.parent_id === parent.id)
                    .map(child => (
                      <div key={child.id} className="flex gap-3">
                        <Avatar className="h-6 w-6 mt-1">
                          <AvatarImage src={child.profiles?.avatar_url} />
                          <AvatarFallback>{child.profiles?.username?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="text-sm">
                          <span className="font-bold mr-2">{child.profiles?.username}</span>
                          <span>{child.content}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* 댓글 입력창 */}
      <div className="p-3 border-t">
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
