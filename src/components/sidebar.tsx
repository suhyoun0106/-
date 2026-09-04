'use client'

/**
 * 이 파일은 화면 왼쪽(모바일은 하단)에 고정되는 네비게이션 바(사이드바) 컴포넌트입니다.
 * 인스타그램의 왼쪽 메뉴 역할을 하며 홈, 메시지(DM), 알림, 프로필로 이동할 수 있습니다.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MessageCircle, Bell, User, PlusSquare, Search, Flame, Settings, LogOut, Menu, X, Receipt } from 'lucide-react'
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

export default function Sidebar({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { name: '홈', href: '/', icon: Home },
    { name: '인기', href: '/search', icon: Flame },
    { name: '만들기', href: '/create', icon: PlusSquare },
    { name: '메시지', href: '/messages', icon: MessageCircle },
    { name: '알림', href: '/notifications', icon: Bell, badge: unreadCount },
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
                    <Badge variant="destructive" className="absolute -top-2 -right-2 px-1.5 min-w-[20px] h-5 flex items-center justify-center text-xs">
                      {item.badge}
                    </Badge>
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

  if (pathname.startsWith('/post/') || pathname.startsWith('/create')) return null;

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
              <Home className="w-5 h-5 text-black" />
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
