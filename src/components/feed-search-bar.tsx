'use client'

import { Search } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, FormEvent } from 'react'

export default function FeedSearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  
  const [query, setQuery] = useState(initialQuery)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    
    const params = new URLSearchParams(searchParams.toString())
    if (query.trim()) {
      params.set('q', query.trim())
    } else {
      params.delete('q')
    }
    
    router.push(`/?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 relative flex items-center">
      <Search className="absolute left-4 w-5 h-5 text-muted-foreground" />
      <input
        type="text"
        placeholder="제목이나 내용으로 검색..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full h-full min-h-[44px] pl-11 pr-4 rounded-full border-2 border-border bg-background hover:bg-secondary/20 focus:bg-background focus:border-primary focus:outline-none transition-all font-medium"
      />
    </form>
  )
}
