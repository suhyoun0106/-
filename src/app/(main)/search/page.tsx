'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Trophy, MessageCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { createClient } from '@/utils/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [liveStream, setLiveStream] = useState<any[]>([])
  const [subscribedIds, setSubscribedIds] = useState<string[]>([])
  
  const router = useRouter()
  const supabase = createClient()
  
  // Use a ref to always access the latest subscribedIds inside the realtime callback
  const subscribedIdsRef = useRef(subscribedIds)
  useEffect(() => {
    subscribedIdsRef.current = subscribedIds
  }, [subscribedIds])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('donations').select('receiver_id').eq('donor_id', user.id)
        if (data) {
          const ids = Array.from(new Set(data.map(d => d.receiver_id)))
          setSubscribedIds(ids)
          fetchLiveStream(ids)
        } else {
          fetchLiveStream([])
        }
      } else {
        fetchLiveStream([])
      }
    }
    
    init()
    fetchLeaderboard()
    
    // Subscribe to new donations
    const donationSub = supabase
      .channel('public:donations')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'donations' },
        (payload) => {
          fetchLiveStream(subscribedIdsRef.current) // Refresh live stream on new donation
          fetchLeaderboard() // Refresh leaderboard too
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(donationSub)
    }
  }, [])

  async function fetchLeaderboard() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, is_claimed, total_donations')
      .order('total_donations', { ascending: false })
      .limit(5)
    
    if (data) {
      setLeaderboard(data)
    }
  }

  async function fetchLiveStream(idsToFilter: string[]) {
    let query = supabase
      .from('donations')
      .select('*, donor:donor_id(username), receiver:receiver_id(username)')
      .order('created_at', { ascending: false })
      .limit(10)
      
    if (idsToFilter && idsToFilter.length > 0) {
      query = query.in('receiver_id', idsToFilter)
    }
    
    const { data, error } = await query
    
    if (data) {
      setLiveStream(data)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    const username = searchQuery.trim().replace('@', '')
    router.push(`/profile/${username}`)
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 w-full h-full flex flex-col">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-12 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
        <Input 
          className="w-full pl-12 py-6 text-lg rounded-xl bg-secondary/50 border-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Search Creator (e.g. @chulsoo_art)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </form>

      <div className="grid md:grid-cols-2 gap-8 flex-1 min-h-0">
        {/* Leaderboard */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Top Creators</h2>
              <p className="text-sm text-muted-foreground">Real-time list of most virtually sponsored creators</p>
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="space-y-6">
              {leaderboard.map((creator, idx) => (
                <div key={creator.id} className="flex items-center justify-between cursor-pointer hover:bg-secondary/20 p-2 rounded-lg transition-colors" onClick={() => router.push(`/profile/${creator.username}`)}>
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white ${
                      idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-700' : 'bg-secondary text-foreground'
                    }`}>
                      {idx + 1}
                    </div>
                    <Avatar className="h-12 w-12 border">
                      <AvatarImage src={creator.avatar_url || ''} />
                      <AvatarFallback className='bg-secondary'>
                        {creator.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold">{creator.username}</span>
                        {creator.is_claimed && (
                          <span className="text-blue-500 text-xs">✓</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        @{creator.username}
                      </div>
                    </div>
                  </div>
                  <div className="font-bold text-muted-foreground">
                    {creator.total_donations ? creator.total_donations.toLocaleString() : 0} ₩
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Live Stream */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-500/10 p-2 rounded-lg">
              <MessageCircle className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Live Donation Stream</h2>
              <p className="text-sm text-muted-foreground">
                {subscribedIds.length > 0 
                  ? "Real-time donations to creators you subscribe to" 
                  : "Real-time activities happening across the platform"}
              </p>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-6">
              {liveStream.map((donation, idx) => (
                <div key={donation.id} className="border-b last:border-0 pb-4 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">
                      {donation.donor ? donation.donor.username : 'Anonymous'} → <span className="text-muted-foreground cursor-pointer hover:underline" onClick={() => router.push(`/profile/${donation.receiver?.username}`)}>@{donation.receiver?.username}</span>
                    </div>
                    <div className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-full">
                      {donation.amount.toLocaleString()} ₩
                    </div>
                  </div>
                  {donation.message && (
                    <p className="text-sm text-muted-foreground italic">
                      "{donation.message}"
                    </p>
                  )}
                  <div className="text-xs text-muted-foreground/60 text-right mt-1">
                    {new Date(donation.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {liveStream.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  No recent donations.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
