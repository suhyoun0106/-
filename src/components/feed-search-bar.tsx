'use client'

import { Search } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, FormEvent, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function FeedSearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  
  const [query, setQuery] = useState(initialQuery)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  
  const supabase = createClient()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const q = query.trim().replace('@', '')
    if (!q) {
      setSearchResults([])
      return
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true)
      
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, is_claimed, instagram_id, is_instagram_public')
        .or(`username.ilike.%${q}%,instagram_id.ilike.%${q}%`)
        .order('total_donations', { ascending: false, nullsFirst: false })
        .limit(5)
        
      setSearchResults(data || [])
      setIsSearching(false)
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [query])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setIsFocused(false)
    
    const params = new URLSearchParams(searchParams.toString())
    if (query.trim()) {
      params.set('q', query.trim())
    } else {
      params.delete('q')
    }
    
    router.push(`/?${params.toString()}`)
  }

  return (
    <div ref={containerRef} className="flex-1 relative flex flex-col z-50">
      <form onSubmit={handleSubmit} className="relative flex items-center h-[44px]">
        <Search className="absolute left-4 w-5 h-5 text-muted-foreground z-10" />
        <input
          type="text"
          placeholder="아이디, 제목, 내용 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          className="absolute inset-0 w-full h-full pl-11 pr-4 rounded-full border border-border/50 bg-white/70 dark:bg-black/70 backdrop-blur-xl shadow-sm hover:bg-white/80 dark:hover:bg-black/80 focus:bg-background focus:border-primary focus:outline-none transition-all font-medium"
          style={{ WebkitBackdropFilter: "blur(16px)" }}
        />
      </form>
      
      {isFocused && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-border overflow-hidden z-50">
          {isSearching ? (
            <div className="p-4 text-center text-sm text-muted-foreground font-medium">검색 중...</div>
          ) : searchResults.length > 0 ? (
            <div className="flex flex-col">
              {searchResults.map((user) => (
                <div 
                  key={user.id} 
                  className="flex items-center justify-between p-3 cursor-pointer transition-colors border-b last:border-b-0 hover:bg-secondary/50"
                  onClick={() => {
                    setQuery('')
                    setIsFocused(false)
                    router.push(`/profile/${user.username}`)
                  }}
                >
                  <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border">
                    <AvatarImage src={user.avatar_url || ''} />
                    <AvatarFallback className="bg-secondary font-bold text-sm text-muted-foreground">{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1 font-bold text-sm">
                      {user.username}
                      {user.is_claimed && <span className="text-blue-500 text-xs">✓</span>}
                      {user.instagram_id && user.is_instagram_public && (
                        <span className="text-xs text-muted-foreground font-normal ml-1">@{user.instagram_id}</span>
                      )}
                    </div>
                  </div>
                  </div>
                </div>
              ))}
              <div 
                className="p-3 text-center text-sm font-bold text-primary hover:bg-secondary/50 cursor-pointer border-t"
                onClick={handleSubmit}
              >
                "{query}" 게시물 검색하기
              </div>
              <div 
                className="p-3 text-center text-sm font-bold text-muted-foreground hover:bg-secondary/50 cursor-pointer border-t"
                onClick={() => {
                  setQuery('')
                  setIsFocused(false)
                  router.push(`/profile/${query.trim().replace('@', '')}`)
                }}
              >
                "{query}" 프로필 이동 / 생성하기
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              <div 
                className="p-4 text-center text-sm font-bold text-primary hover:bg-secondary/50 cursor-pointer"
                onClick={handleSubmit}
              >
                "{query}" 게시물 검색하기
              </div>
              <div 
                className="p-4 text-center text-sm font-bold text-muted-foreground hover:bg-secondary/50 cursor-pointer border-t"
                onClick={() => {
                  setQuery('')
                  setIsFocused(false)
                  router.push(`/profile/${query.trim().replace('@', '')}`)
                }}
              >
                "{query}" 새로운 프로필 이동/생성
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
