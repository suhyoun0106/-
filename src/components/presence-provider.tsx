'use client'

/**
 * 이 파일은 접속 중인 사용자(온라인 상태)를 추적하는 컴포넌트입니다.
 * Supabase의 Presence 기능을 활용하여 사용자가 사이트에 들어오면
 * 온라인 상태로 표시하고, 나가면 오프라인으로 자동 변경합니다.
 */

import { useEffect, useState, createContext, useContext } from 'react'
import { createClient } from '@/utils/supabase/client'

// 온라인 유저 목록을 앱 전체에서 공유하기 위한 Context
const PresenceContext = createContext<Record<string, any>>({})

export function usePresence() {
  return useContext(PresenceContext)
}

export function PresenceProvider({ 
  children, 
  userId 
}: { 
  children: React.ReactNode, 
  userId: string 
}) {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({})
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return

    // 'online-users'라는 방(채널)을 생성합니다.
    const room = supabase.channel('online-users')

    // 누군가 들어오거나 나갈 때(상태 변경)마다 실행됩니다.
    room.on('presence', { event: 'sync' }, () => {
      const newState = room.presenceState()
      const users: Record<string, boolean> = {}
      
      // 모든 접속자의 ID를 추출하여 users 객체에 저장합니다.
      Object.keys(newState).forEach(key => {
        const presences = newState[key] as any[]
        if (presences.length > 0) {
          users[presences[0].user_id] = true
        }
      })
      setOnlineUsers(users)
    })

    // 방에 접속(구독)하고 나의 정보를 보냅니다.
    room.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await room.track({
          user_id: userId,
          online_at: new Date().toISOString(),
        })
      }
    })

    return () => {
      supabase.removeChannel(room)
    }
  }, [userId, supabase])

  return (
    <PresenceContext.Provider value={onlineUsers}>
      {children}
    </PresenceContext.Provider>
  )
}
