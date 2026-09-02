'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { X, Edit3 } from 'lucide-react'

export default function TopDonorMessage({ 
  communityId, 
  currentUserId,
  isTopDonor,
  initialMessage
}: { 
  communityId: string,
  currentUserId: string | undefined,
  isTopDonor: boolean,
  initialMessage: string | null
}) {
  const [message, setMessage] = useState(initialMessage || '')
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(message)
  const [isHidden, setIsHidden] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    // Check local storage for hidden state
    const hiddenUntil = localStorage.getItem(`hide_top_donor_${communityId}`)
    if (hiddenUntil && new Date(hiddenUntil) > new Date()) {
      setIsHidden(true)
    }
  }, [communityId])

  const handleHide = () => {
    // Hide for 1 week (7 days)
    const hideUntil = new Date()
    hideUntil.setDate(hideUntil.getDate() + 7)
    localStorage.setItem(`hide_top_donor_${communityId}`, hideUntil.toISOString())
    setIsHidden(true)
    toast.success("1주일 동안 이 메시지를 숨깁니다.")
  }

  const handleSave = async () => {
    if (!editValue.trim()) {
      toast.error("메시지를 입력해주세요.")
      return
    }
    if (editValue.length > 100) {
      toast.error("메시지는 100자 이내로 작성해주세요.")
      return
    }

    try {
      const { error } = await supabase
        .from('top_donor_messages')
        .upsert({
          community_id: communityId,
          donor_id: currentUserId,
          message: editValue.trim(),
          updated_at: new Date().toISOString()
        })
        
      if (error) throw error
      
      setMessage(editValue.trim())
      setIsEditing(false)
      toast.success("메시지가 등록되었습니다!")
    } catch (error) {
      console.error(error)
      toast.error("메시지 등록에 실패했습니다.")
    }
  }

  if (isHidden && !isTopDonor) return null
  if (!isTopDonor && !message) return null

  return (
    <div className="w-full bg-primary/10 border border-primary/20 rounded-xl p-4 mb-4 relative flex items-center justify-between">
      <div className="flex-1 mr-8">
        <h4 className="text-xs font-bold text-primary mb-1">👑 이달의 최고 후원자 메시지</h4>
        
        {isEditing ? (
          <div className="flex flex-col gap-2 mt-2">
            <input 
              type="text" 
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              maxLength={100}
              placeholder="100자 이내로 메시지를 남겨보세요!"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsEditing(false)} className="text-xs px-3 py-1.5 rounded-md hover:bg-secondary">취소</button>
              <button onClick={handleSave} className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-bold">저장</button>
            </div>
          </div>
        ) : (
          <p className="text-sm font-medium whitespace-pre-wrap">{message || "아직 작성된 메시지가 없습니다. 글을 남겨보세요!"}</p>
        )}
      </div>

      {!isEditing && (
        <div className="absolute top-3 right-3 flex gap-2">
          {isTopDonor && (
            <button onClick={() => { setEditValue(message); setIsEditing(true); }} className="p-1.5 bg-background hover:bg-secondary rounded-full text-muted-foreground transition-colors" title="메시지 수정">
              <Edit3 className="w-4 h-4" />
            </button>
          )}
          {!isTopDonor && (
            <button onClick={handleHide} className="p-1.5 bg-background hover:bg-secondary rounded-full text-muted-foreground transition-colors" title="1주일 숨기기">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
