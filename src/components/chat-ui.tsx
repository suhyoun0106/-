'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import ScrollHideUI from '@/components/scroll-hide-ui'
import { LogOut, Send, UserPlus, ArrowLeft, Home, User } from 'lucide-react'
import { Message, MessageContent } from '@/components/ui/message'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle, AttachmentDescription, AttachmentActions, AttachmentAction } from '@/components/ui/attachment'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { usePresence } from '@/components/presence-provider'

export default function ChatUI({ currentUser }: { currentUser: any }) {
  const [friends, setFriends] = useState<any[]>([])
  const [selectedFriend, setSelectedFriend] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [searchUsername, setSearchUsername] = useState('')
  
  const onlineUsers = usePresence()
  const supabase = createClient()
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchFriends()
    
    // Subscribe to friends changes
    const friendsSub = supabase
      .channel('friends_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' }, () => {
        fetchFriends()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(friendsSub)
    }
  }, [])

  useEffect(() => {
    if (selectedFriend) {
      fetchMessages()
      
      const msgSub = supabase
        .channel('messages_channel')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `receiver_id=eq.${currentUser.id}`
          }, 
          (payload) => {
            if (payload.new.sender_id === selectedFriend.id) {
              setMessages(prev => [...prev, payload.new])
            }
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(msgSub)
      }
    }
  }, [selectedFriend])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchFriends() {
    // Fetch friends where I am user_id or friend_id
    const { data, error } = await supabase
      .from('friends')
      .select('*, user:user_id(id, username, avatar_url), friend:friend_id(id, username, avatar_url)')
      .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`)
    
    if (data) {
      const formattedFriends = data.map(f => {
        if (f.user_id === currentUser.id) {
          return { id: f.friend.id, username: f.friend.username, avatar_url: f.friend.avatar_url }
        } else {
          return { id: f.user.id, username: f.user.username, avatar_url: f.user.avatar_url }
        }
      })
      
      // Remove duplicates just in case
      const uniqueFriends = Array.from(new Map(formattedFriends.map(item => [item.id, item])).values())
      setFriends(uniqueFriends)
    }
  }

  async function fetchMessages() {
    if (!selectedFriend) return
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedFriend.id}),and(sender_id.eq.${selectedFriend.id},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true })

    if (data) {
      setMessages(data)
    }
  }

  async function addFriend(e: React.FormEvent) {
    e.preventDefault()
    if (!searchUsername.trim()) return

    if (searchUsername === currentUser.username) {
      toast.error('자기 자신은 추가할 수 없습니다.')
      return
    }

    const { data: userToAdd, error: searchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', searchUsername)
      .single()

    if (!userToAdd || searchError) {
      toast.error('존재하지 않는 사용자입니다.')
      return
    }

    // Check if already friends
    if (friends.some(f => f.id === userToAdd.id)) {
      toast.error('이미 친구입니다.')
      return
    }

    const { error } = await supabase
      .from('friends')
      .insert({
        user_id: currentUser.id,
        friend_id: userToAdd.id,
        status: 'accepted'
      })

    if (error) {
      toast.error('친구 추가에 실패했습니다.')
    } else {
      toast.success('친구가 추가되었습니다.')
      setSearchUsername('')
      fetchFriends() // Will also trigger via subscription, but good to have
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || !selectedFriend) return

    const msg = {
      sender_id: currentUser.id,
      receiver_id: selectedFriend.id,
      content: newMessage,
    }
    
    setMessages(prev => [...prev, { ...msg, id: Math.random().toString(), created_at: new Date().toISOString() }])
    setNewMessage('')

    const { error } = await supabase
      .from('messages')
      .insert(msg)

    if (error) {
      toast.error('메시지 전송 실패')
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex w-full h-full border rounded-lg overflow-hidden bg-background">
      {/* Sidebar */}
      <div className={`w-full md:w-80 border-r flex-col bg-card ${selectedFriend ? 'hidden md:flex' : 'flex'}`}>
        {/* 모바일 고정 프로필 버튼 */}
        <div className="md:hidden fixed top-[16px] right-[16px] z-50">
          <Button variant="outline" size="icon" className="rounded-full bg-white/60 dark:bg-black/60 backdrop-blur-xl border-border/50 shadow-sm outline-none w-[44px] h-[44px] text-black dark:text-white" onClick={() => router.push('/profile')} style={{ WebkitBackdropFilter: "blur(20px) saturate(180%)", backdropFilter: "blur(20px) saturate(180%)" }}>
            <User className="h-5 w-5" />
          </Button>
        </div>

        <ScrollHideUI direction="top" className="sticky top-0 z-40 px-4 pt-[16px] md:pt-4 pb-3">
          {/* 모바일 화면용 그라데이션 블러 배경 */}
          <div 
            className="absolute inset-0 z-0 dark:bg-black/40 bg-white/40 pointer-events-none md:hidden"
            style={{
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)'
            }}
          />
          
          <div className="relative z-10 flex w-full items-center justify-center h-[44px]">
            <form onSubmit={addFriend} className="flex-1 flex max-w-full md:px-0 px-[52px]">
              <Input 
                placeholder="유저 이름으로 친구 추가" 
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                className="rounded-full bg-white/60 dark:bg-black/60 backdrop-blur-xl border-border/50 shadow-sm font-medium h-[44px] px-5 w-full text-center md:text-left"
                style={{ WebkitBackdropFilter: "blur(20px) saturate(180%)", backdropFilter: "blur(20px) saturate(180%)" }}
              />
            </form>
          </div>
        </ScrollHideUI>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {friends.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center p-4">친구가 없습니다. 친구를 추가해보세요!</p>
            ) : (
              friends.map((friend) => (
                <button
                  key={friend.id}
                  onClick={() => setSelectedFriend(friend)}
                  className={`w-full flex items-center gap-3 p-3 rounded-md transition-colors ${
                    selectedFriend?.id === friend.id ? 'bg-secondary' : 'hover:bg-secondary/50'
                  }`}
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={friend.avatar_url || ''} />
                      <AvatarFallback>{friend.username.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {onlineUsers[friend.id] && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></div>
                    )}
                  </div>
                  <span className="font-medium">{friend.username}</span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex-col bg-background ${!selectedFriend ? 'hidden md:flex' : 'flex'}`}>
        {selectedFriend ? (
          <>
            <div className="p-4 border-b flex items-center gap-3 bg-card">
              <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => setSelectedFriend(null)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Avatar className="h-10 w-10">
                <AvatarFallback>{selectedFriend.username.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <h3 className="font-bold text-lg">{selectedFriend.username}</h3>
            </div>
            
            <ScrollArea className="flex-1 p-4">
              <div className="flex flex-col gap-6 py-4">
                {messages.map((msg, idx) => {
                  const isMe = msg.sender_id === currentUser.id
                  return (
                    <Message key={msg.id || idx} align={isMe ? 'end' : 'start'}>
                      <MessageContent>
                        <Bubble variant={isMe ? 'default' : 'secondary'}>
                          <BubbleContent>
                            {msg.content}
                          </BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-4 border-t bg-card">
              <form onSubmit={sendMessage} className="flex gap-2">
                <Input
                  className="flex-1 rounded-full"
                  placeholder="메시지 입력..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <Button type="submit" size="icon" className="rounded-full shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col gap-4 text-muted-foreground">
            <div className="h-24 w-24 rounded-full border-2 border-dashed flex items-center justify-center">
              <Send className="h-10 w-10" />
            </div>
            <p className="text-xl font-medium text-foreground">내 메시지</p>
            <p>친구에게 개인 메시지를 보내보세요.</p>
          </div>
        )}
      </div>
    </div>
  )
}
