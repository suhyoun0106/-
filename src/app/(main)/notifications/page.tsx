'use client'

/**
 * 이 파일은 알림(Notifications)을 확인하는 페이지입니다.
 * - 좋아요, 댓글, DM 알림 목록 표시
 * - 페이지 접속 시 안 읽은 알림을 모두 '읽음' 처리
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Heart, MessageCircle, Send, Home, User } from 'lucide-react'
import ScrollHideUI from '@/components/scroll-hide-ui'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchAndMarkRead()
  }, [])

  async function fetchAndMarkRead() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 1. 알림 가져오기 (알림 발생시킨 사람의 정보 포함)
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        actor:actor_id (username, avatar_url)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (data) {
      setNotifications(data)
    }

    // 2. 안 읽은 알림을 모두 읽음(is_read: true) 처리
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
  }

  // 알림 종류에 따른 아이콘 및 텍스트 렌더링
  function getNotificationContent(type: string, actorName: string) {
    const NameSpan = () => (
      <span 
        className="font-bold hover:underline cursor-pointer" 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/profile/${actorName}`) }}
      >
        {actorName}
      </span>
    )

    switch(type) {
      case 'like':
        return { icon: <Heart className="w-5 h-5 text-red-500 fill-red-500 shrink-0" />, text: <><NameSpan />님이 회원님의 게시물을 좋아합니다.</> }
      case 'comment':
        return { icon: <MessageCircle className="w-5 h-5 text-blue-500 fill-blue-500 shrink-0" />, text: <><NameSpan />님이 댓글을 남겼습니다.</> }
      case 'dm':
        return { icon: <Send className="w-5 h-5 text-green-500 fill-green-500 shrink-0" />, text: <><NameSpan />님이 메시지를 보냈습니다.</> }
      default:
        return { icon: null, text: '새로운 알림이 있습니다.' }
    }
  }

  return (
    <div className="max-w-xl mx-auto pb-8">
      <ScrollHideUI direction="top" className="sticky top-0 z-40 px-4 pt-8 md:pt-8 pb-3">
        {/* 모바일 화면용 그라데이션 블러 배경 (데스크탑에서도 적용) */}
        <div 
          className="absolute inset-0 z-0 dark:bg-black/40 bg-white/40"
          style={{
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)'
          }}
        />
        
        <div className="flex flex-row items-center justify-between gap-3 relative z-10 h-[44px]">
          {/* 모바일 홈 버튼 */}
          <Button variant="outline" size="icon" className="rounded-full shrink-0 md:hidden bg-white/80 dark:bg-black/80 backdrop-blur-xl border-border/50 shadow-sm outline-none" onClick={() => router.push('/')}>
            <Home className="h-5 w-5" />
          </Button>

          {/* 데스크탑에서는 왼쪽 정렬, 모바일에서는 가운데 정렬처럼 보이게 */}
          <h1 className="text-2xl font-bold flex-1 text-center md:text-left">알림</h1>

          {/* 모바일 프로필 버튼 */}
          <Button variant="outline" size="icon" className="rounded-full shrink-0 md:hidden bg-white/80 dark:bg-black/80 backdrop-blur-xl border-border/50 shadow-sm outline-none" onClick={() => router.push('/profile')}>
            <User className="h-5 w-5" />
          </Button>
        </div>
      </ScrollHideUI>
      
      <div className="flex flex-col gap-4 px-4 pt-4">
        {notifications.length === 0 ? (
          <p className="text-muted-foreground text-center py-10">새로운 알림이 없습니다.</p>
        ) : (
          notifications.map(notif => {
            const { icon, text } = getNotificationContent(notif.type, notif.actor?.username)
            const linkHref = notif.type === 'dm' ? '/messages' : `/post/${notif.reference_id}`

            return (
              <div 
                key={notif.id} 
                onClick={() => router.push(linkHref)}
                className={`flex items-center gap-4 p-4 border rounded-lg transition-colors hover:bg-secondary/50 cursor-pointer ${!notif.is_read ? 'bg-secondary/20' : 'bg-card'}`}
              >
                <Avatar 
                  className="h-12 w-12 shrink-0 cursor-pointer" 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/profile/${notif.actor?.username}`) }}
                >
                  <AvatarImage src={notif.actor?.avatar_url} />
                  <AvatarFallback>{notif.actor?.username?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 flex items-center gap-2">
                  {icon}
                  <span className="font-medium text-sm break-all">{text}</span>
                </div>
                {!notif.is_read && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
