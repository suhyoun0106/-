import { createClient } from '@/utils/supabase/server'
import ChatUI from '@/components/chat-ui'
import { redirect } from 'next/navigation'

/**
 * 이 파일은 DM(메시지) 기능을 담당하는 페이지입니다.
 * 기존의 채팅 UI 컴포넌트를 그대로 사용합니다.
 */

export default async function MessagesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 메시지 페이지에 진입하면 DM 관련 알림을 모두 읽음 처리
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('type', 'dm')
    .eq('is_read', false)

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="h-full">
      <ChatUI currentUser={profile} />
    </div>
  )
}
