'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function BackButton() {
  const router = useRouter()

  return (
    <Button 
      variant="ghost" 
      onClick={() => router.back()} 
      className="mb-4 text-muted-foreground hover:text-foreground flex items-center gap-2 -ml-2"
    >
      <ArrowLeft className="w-5 h-5" />
      <span>뒤로가기</span>
    </Button>
  )
}
