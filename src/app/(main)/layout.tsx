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
      <div className="flex min-h-screen bg-background">
        <Sidebar unreadCount={count || 0} />
        {/* 사이드바(80px) 너비만큼 우측에 여백을 주어 메인 컨텐츠가 화면의 정확한 중앙에 오도록 함 */}
        <main className="flex-1 pb-28 md:pb-0 md:pr-[80px] relative">
          {children}
        </main>
      </div>
    </PresenceProvider>
  )
}
