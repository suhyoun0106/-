'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function ProfileRedirect() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        supabase.from('profiles').select('username').eq('id', data.user.id).single().then(({ data: p }) => {
          if (p) {
            router.replace(`/profile/${p.username}`)
          } else {
            router.push('/login')
          }
        })
      } else {
        router.push('/login')
      }
    })
  }, [router, supabase])

  return <div className="p-8 text-center text-muted-foreground font-medium">프로필을 불러오는 중입니다...</div>
}
