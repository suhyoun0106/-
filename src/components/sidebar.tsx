'use client'

/**
 * 이 파일은 화면 왼쪽(모바일은 하단)에 고정되는 네비게이션 바(사이드바) 컴포넌트입니다.
 * 인스타그램의 왼쪽 메뉴 역할을 하며 홈, 메시지(DM), 알림, 프로필로 이동할 수 있습니다.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MessageCircle, Bell, User, SquarePen, Search, Flame, Settings, LogOut, Menu, X, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import ScrollHideUI from '@/components/scroll-hide-ui'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useState, useRef, useEffect } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function Sidebar({ unreadNotifCount, unreadMsgCount }: { unreadNotifCount: number, unreadMsgCount: number }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  const [localNotifCount, setLocalNotifCount] = useState(unreadNotifCount)
  const [localMsgCount, setLocalMsgCount] = useState(unreadMsgCount)
  
  useEffect(() => {
    setLocalNotifCount(unreadNotifCount)
  }, [unreadNotifCount])
  
  useEffect(() => {
    setLocalMsgCount(unreadMsgCount)
  }, [unreadMsgCount])
  
  useEffect(() => {
    if (pathname === '/notifications') setLocalNotifCount(0)
    if (pathname === '/messages') setLocalMsgCount(0)
  }, [pathname])

  useEffect(() => {
    let sub: any = null
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      sub = supabase.channel('realtime:notifications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const notif = payload.new
            if (notif.type === 'dm') {
              if (pathname !== '/messages') setLocalMsgCount(prev => prev + 1)
              // 알림 메뉴에도 dm을 포함하기로 했으므로 같이 올려줌
              if (pathname !== '/notifications') setLocalNotifCount(prev => prev + 1)
            } else {
              if (pathname !== '/notifications') setLocalNotifCount(prev => prev + 1)
            }
          }
        )
        .subscribe()
    }
    setupRealtime()

    return () => {
      if (sub) supabase.removeChannel(sub)
    }
  }, [pathname])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { name: '홈', href: '/', icon: Home },
    { name: '인기', href: '/search', icon: Flame },
    { name: '만들기', href: '/create', icon: SquarePen },
    { name: '메시지', href: '/messages', icon: MessageCircle, badge: localMsgCount },
    { name: '알림', href: '/notifications', icon: Bell, badge: localNotifCount },
    { name: '프로필', href: '/profile', icon: User },
  ]

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-[80px] h-screen border-r bg-background sticky top-0 flex-col z-50 shrink-0">
        <div className="p-4 flex justify-center">
          <Link href="/">
            <img src="/logo.png" alt="@fan logo" className="h-[48px] object-contain" />
          </Link>
        </div>
        <nav className="flex flex-col justify-start h-full p-3 gap-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center justify-center p-3 rounded-xl transition-colors hover:bg-secondary relative group",
                  isActive ? "font-bold" : "font-medium text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="relative flex items-center justify-center">
                  <Icon className={cn("h-6 w-6 transition-transform group-hover:scale-105", isActive && "stroke-[2.5px]")} />
                  {item.badge ? (
                    <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></div>
                  ) : null}
                </div>
                {/* Tooltip */}
                <div className="absolute left-[110%] px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                  {item.name}
                  <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-2 bg-zinc-900 dark:bg-zinc-100 rotate-45"></div>
                </div>
              </Link>
            )
          })}

          <div className="mt-auto flex items-center justify-center h-auto">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center justify-center p-3 rounded-xl transition-colors hover:bg-secondary relative group font-medium text-muted-foreground hover:text-foreground w-full outline-none"
              >
                <div className="relative flex items-center justify-center">
                  <Settings className="h-6 w-6 transition-transform group-hover:rotate-90" />
                </div>
                <div className="absolute left-[110%] px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                  설정
                  <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-2 bg-zinc-900 dark:bg-zinc-100 rotate-45"></div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={10} className="w-48 ml-4 mb-2 z-[60] rounded-2xl p-2">
                <DropdownMenuItem onClick={() => router.push('/donations')} className="font-bold cursor-pointer h-12 text-base rounded-xl focus:bg-secondary outline-none mb-1">
                  <Receipt className="mr-3 h-5 w-5" />
                  <span>후원 기록</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-red-500 font-bold cursor-pointer h-12 text-base rounded-xl focus:bg-red-50 focus:text-red-600 outline-none">
                  <LogOut className="mr-3 h-5 w-5" />
                  <span>로그아웃</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
      </div>

      {/* Mobile Floating Navigation */}
      <MobileFloatingNav navItems={navItems} handleLogout={handleLogout} />
    </>
  )
}

function MobileFloatingNav({ navItems, handleLogout }: { navItems: any[], handleLogout: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()
  const isProfile = pathname.startsWith('/profile')



  useEffect(() => {
    const handleScroll = () => {
      if (isOpen) setIsOpen(false)
    }
    const handleClickOutside = (e: Event) => {
      if (isOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('touchstart', handleClickOutside)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen])

  if (pathname.startsWith('/post/') || pathname.startsWith('/create')) return null;

  return (
    <div className="md:hidden">
      <ScrollHideUI direction="top" className="fixed top-0 left-0 right-0 z-50 pointer-events-none h-0">
        <div className={`absolute top-[16px] ${isProfile ? "right-[16px]" : "left-[16px]"}`}>
          <div 
            ref={menuRef}
            className={cn(
              "relative pointer-events-auto flex flex-col items-center bg-white/60 dark:bg-black/60 backdrop-blur-xl border border-border/50 shadow-sm overflow-hidden transition-all duration-300 ease-out cursor-pointer",
              isOpen ? "rounded-[2rem] px-2 py-3 h-max max-h-[80vh]" : "rounded-full w-[44px] h-[44px] justify-center"
            )}
            onClick={() => setIsOpen(!isOpen)}
            style={{ WebkitBackdropFilter: "blur(20px) saturate(180%)", backdropFilter: "blur(20px) saturate(180%)" }}
          >
            {!isOpen ? (
              <div className="relative">
                <Home className="w-5 h-5 text-black" />
                {(navItems.find(i => i.name === '알림')?.badge || navItems.find(i => i.name === '메시지')?.badge) ? (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white"></div>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={(e) => { e.stopPropagation(); setIsOpen(false) }}
                      className={cn(
                        "flex items-center justify-center p-2.5 rounded-full transition-colors relative",
                        isActive ? "bg-black/5 text-black" : "text-black/60 hover:bg-black/5 hover:text-black"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      {item.badge ? (
                        <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-black"></div>
                      ) : null}
                    </Link>
                  )
                })}
                <DropdownMenu>
                  <DropdownMenuTrigger
                      onClick={(e) => { e.stopPropagation(); }}
                      className="flex items-center justify-center p-2.5 rounded-full text-muted-foreground hover:bg-black/5 hover:text-black transition-colors mt-2 outline-none"
                    >
                      <Settings className="w-5 h-5" />
                    </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side={isProfile ? "left" : "right"} sideOffset={16} className="w-48 rounded-2xl p-2 z-[70]">
                    <DropdownMenuItem onClick={() => { setIsOpen(false); router.push('/donations') }} className="font-bold cursor-pointer h-12 text-base rounded-xl focus:bg-secondary outline-none mb-1">
                      <Receipt className="mr-3 h-5 w-5" />
                      <span>후원 기록</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setIsOpen(false); handleLogout() }} className="text-red-500 font-bold cursor-pointer h-12 text-base rounded-xl focus:bg-red-50 focus:text-red-600 outline-none">
                      <LogOut className="mr-3 h-5 w-5" />
                      <span>로그아웃</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>

        {!isProfile && (
        <div className="absolute top-[16px] right-[16px]">
          <div 
            onClick={() => router.push('/profile')}
            className="pointer-events-auto flex items-center justify-center bg-white/60 dark:bg-black/60 backdrop-blur-xl border border-border/50 shadow-sm rounded-full w-[44px] h-[44px] cursor-pointer hover:bg-foreground/5 transition-colors"
            style={{ WebkitBackdropFilter: "blur(20px) saturate(180%)", backdropFilter: "blur(20px) saturate(180%)" }}
          >
            <User className="w-5 h-5 text-black" />
          </div>
        </div>
        )}
      </ScrollHideUI>
    </div>
  )
}
