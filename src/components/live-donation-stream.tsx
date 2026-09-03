'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatTimeAgo } from '@/lib/format-time'

export default function LiveDonationStream({ 
  subscribedIds 
}: { 
  subscribedIds: string[] 
}) {
  const [donations, setDonations] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (subscribedIds.length === 0) return

    // 초기 데이터 로드 (최신 10개)
    const fetchInitial = async () => {
      const { data } = await supabase
        .from('donations')
        .select(`
          id, amount, message, created_at,
          donor:donor_id(username, avatar_url),
          receiver:receiver_id(username)
        `)
        .in('receiver_id', subscribedIds)
        .order('created_at', { ascending: false })
        .limit(10)
      
      if (data) setDonations(data)
    }

    fetchInitial()

    // 실시간 구독
    const channel = supabase.channel('donations_stream')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'donations' 
      }, async (payload) => {
        const newDoc = payload.new
        if (subscribedIds.includes(newDoc.receiver_id)) {
          let donor = null;
          if (newDoc.donor_id) {
            const { data: d } = await supabase.from('profiles').select('username, avatar_url').eq('id', newDoc.donor_id).single()
            donor = d
          }
          const { data: receiver } = await supabase.from('profiles').select('username').eq('id', newDoc.receiver_id).single()
          
          const newDonation = {
            ...newDoc,
            donor,
            receiver
          }
          setDonations(prev => [newDonation, ...prev].slice(0, 10))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [subscribedIds])

  if (subscribedIds.length === 0 || donations.length === 0) return null;

  return (
    <div className="w-full bg-secondary/20 rounded-xl p-3 flex flex-col gap-2 border border-border/50">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs font-bold text-foreground uppercase tracking-wider">Live Donations</span>
      </div>
      <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto scrollbar-hide">
        {donations.map((d) => (
          <div key={d.id} className="flex gap-3 bg-background rounded-lg p-2.5 shadow-sm text-sm border border-border/30">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={d.donor?.avatar_url} />
              <AvatarFallback className="text-xs bg-blue-500 text-white font-bold">{d.donor?.username?.charAt(0) || '익'}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center gap-1.5 text-[13px] leading-tight">
                <span className="font-bold truncate max-w-[80px] text-foreground">{d.donor?.username || '익명'}</span>
                <span className="text-muted-foreground text-[10px]">▶</span>
                <span className="font-bold truncate max-w-[80px] text-foreground">{d.receiver?.username}</span>
                <span className="text-blue-500 font-bold ml-auto">{d.amount.toLocaleString()}원</span>
              </div>
              {d.message && (
                <span className="text-muted-foreground text-[13px] truncate mt-1">"{d.message}"</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
