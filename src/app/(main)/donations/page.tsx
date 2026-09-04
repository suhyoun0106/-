'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import Link from 'next/link'
import ScrollHideUI from '@/components/scroll-hide-ui'
import { Trash2, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function DonationsPage() {
  const [donations, setDonations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadDonations()
  }, [])

  async function loadDonations() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('donations')
      .select('*, receiver:receiver_id(id, username, avatar_url, total_donations)')
      .eq('donor_id', user.id)
      .order('created_at', { ascending: false })

    if (data) {
      setDonations(data)
    }
    setLoading(false)
  }

  async function handleCancelDonation(donationId: string, receiverId: string, amount: number, currentTotal: number) {
    if (!confirm('정말 이 후원을 취소하시겠습니까?')) return

    const { error } = await supabase
      .from('donations')
      .delete()
      .eq('id', donationId)

    if (error) {
      toast.error('후원 취소에 실패했습니다.')
      return
    }

    // Update receiver's total_donations
    const newTotal = Math.max(0, (currentTotal || 0) - amount)
    await supabase.from('profiles').update({ total_donations: newTotal }).eq('id', receiverId)

    toast.success('후원이 취소되었습니다.')
    loadDonations()
  }

  return (
    <div className="max-w-2xl mx-auto pb-8 w-full h-full flex flex-col">
      <ScrollHideUI direction="top" className="sticky top-0 z-30 pt-4 pb-4 mb-6 pl-4 pr-4">
        <div 
          className="absolute inset-0 pointer-events-none bg-white/30 dark:bg-black/30"
          style={{
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)'
          }}
        />
        <div className="flex items-center gap-3 relative z-10 px-4 py-2">
          <button 
            onClick={() => router.back()}
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-secondary/40 hover:bg-secondary transition-colors text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">내 후원 기록</h1>
        </div>
      </ScrollHideUI>

      <div className="px-4 flex flex-col gap-4">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">불러오는 중...</div>
        ) : donations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-secondary/20 rounded-2xl">
            아직 후원한 기록이 없습니다.
          </div>
        ) : (
          donations.map((donation) => (
            <div key={donation.id} className="flex items-start justify-between p-4 bg-secondary/10 rounded-2xl border">
              <div className="flex items-start gap-3">
                <Link href={`/profile/${donation.receiver?.username}`}>
                  <Avatar className="h-10 w-10 border hover:opacity-80 transition-opacity">
                    <AvatarImage src={donation.receiver?.avatar_url || ''} />
                    <AvatarFallback>{donation.receiver?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <Link href={`/profile/${donation.receiver?.username}`} className="font-bold hover:underline">
                      {donation.receiver?.username}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {new Date(donation.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="font-bold text-primary mt-1">
                    {donation.amount.toLocaleString()} ₩
                  </div>
                  {donation.message && (
                    <div className="text-sm mt-2 text-muted-foreground italic">
                      "{donation.message}"
                    </div>
                  )}
                </div>
              </div>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => handleCancelDonation(donation.id, donation.receiver?.id, donation.amount, donation.receiver?.total_donations)}
                className="shrink-0 rounded-full h-8 px-3 text-xs"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                취소
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
