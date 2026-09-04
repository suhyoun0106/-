'use client'

import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { ChevronsUpDown } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function CommunityDropdown({ 
  communities, 
  currentCommunityId 
}: { 
  communities: any[], 
  currentCommunityId?: string 
}) {
  const router = useRouter()
  
  const currentCommunity = communities.find(c => c.id === currentCommunityId)
  
  const getDisplayName = (creator: any) => {
    if (!creator) return '전체보기'
    return (creator.is_instagram_public && creator.instagram_id) ? creator.instagram_id : (creator.instagram_id || creator.username)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center shrink-0 gap-3 px-5 py-2 rounded-full border-2 border-border bg-background hover:bg-secondary/50 transition-colors outline-none font-bold text-lg">
          {getDisplayName(currentCommunity)}
          <ChevronsUpDown className="w-5 h-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px] rounded-2xl shadow-xl border-border p-2">
          <DropdownMenuItem 
            className="cursor-pointer py-3 px-4 font-bold rounded-xl focus:bg-secondary"
            onClick={() => router.push('/')}
          >
            전체 보기
          </DropdownMenuItem>
          {communities.map(creator => (
            <DropdownMenuItem 
              key={creator.id}
              className="cursor-pointer py-3 px-4 rounded-xl focus:bg-secondary"
              onClick={() => router.push(`/?community_id=${creator.id}`)}
            >
              <div className="flex items-center gap-3 w-full">
                <img 
                  src={creator.avatar_url || '/default-avatar.png'} 
                  alt={getDisplayName(creator)} 
                  className="w-7 h-7 rounded-full object-cover bg-secondary"
                />
                <span className="font-bold truncate">{getDisplayName(creator)}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
  )
}
