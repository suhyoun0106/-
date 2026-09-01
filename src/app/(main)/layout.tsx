import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import { PresenceProvider } from '@/components/presence-provider'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // 서버에서 로그인 확인
  const { data: { user }, error } = await supabase.auth.getUser()

  if (!user || error) {
    redirect('/login')
  }

  // 안 읽은 알림 개수 가져오기
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  return (
    <PresenceProvider userId={user.id}>
      <div className="flex h-screen bg-background">
        <Sidebar unreadCount={count || 0} />
        {/* 모바일에서는 사이드바가 하단에 위치하므로 padding-bottom 추가 */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0 relative">
          {children}
        </main>
      </div>
    </PresenceProvider>
  )
}
