'use client'

/**
 * 이 파일은 화면 왼쪽(모바일은 하단)에 고정되는 네비게이션 바(사이드바) 컴포넌트입니다.
 * 인스타그램의 왼쪽 메뉴 역할을 하며 홈, 메시지(DM), 알림, 프로필로 이동할 수 있습니다.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MessageCircle, Bell, User, PlusSquare, Search, Settings, LogOut, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import ScrollHideUI from '@/components/scroll-hide-ui'
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
    { name: '검색', href: '/search', icon: Search },
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
              <DropdownMenuContent align="start" sideOffset={10} className="w-48 ml-4 mb-2 z-[60]">
                <DropdownMenuItem onClick={handleLogout} className="text-red-500 font-bold cursor-pointer h-12 text-lg focus:bg-red-50 focus:text-red-600 outline-none">
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
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const pointerStart = useRef({ x: 0, y: 0 })
  const translateStart = useRef({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

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

  const onPointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY }
    translateStart.current = { ...translate }
    isDragging.current = false
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons !== 1 && e.buttons !== 0) return // Handle touch/mouse properly
    // for touch, buttons might be 0 but pointerId is captured
    
    const dx = e.clientX - pointerStart.current.x
    const dy = e.clientY - pointerStart.current.y
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      isDragging.current = true
    }
    if (isDragging.current) {
      setTranslate({
        x: translateStart.current.x + dx,
        y: translateStart.current.y + dy
      })
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    if (!isDragging.current) {
      setIsOpen(!isOpen)
    }
    isDragging.current = false
  }

  return (
    <div className="md:hidden fixed z-50 pointer-events-none" style={{ bottom: '24px', left: '16px' }}>
      <div 
        ref={menuRef}
        className={cn(
          "relative pointer-events-auto flex items-center bg-white border border-border/50 shadow-xl overflow-visible transition-all duration-300 ease-out",
          isOpen ? "rounded-[2rem] px-2 py-2 w-max max-w-[90vw]" : "rounded-full w-[52px] h-[52px] justify-center"
        )}
        style={{ 
          transform: `translate(${translate.x}px, ${translate.y}px)`,
          touchAction: 'none' // Prevent scrolling while dragging
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {!isOpen ? (
          <Menu className="w-6 h-6 text-black" />
        ) : (
          <div className="flex items-center gap-1 sm:gap-2">
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
                  <Icon className={cn("h-6 w-6 transition-transform", isActive && "stroke-[2.5px]")} />
                  {item.badge ? (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 flex items-center justify-center text-[10px] border border-white">
                      {item.badge}
                    </Badge>
                  ) : null}
                </Link>
              )
            })}
            
            <DropdownMenu>
              <DropdownMenuTrigger
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center p-2.5 rounded-full transition-colors text-black/60 hover:bg-black/5 hover:text-black relative outline-none"
              >
                <Settings className="h-6 w-6" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={10} className="w-48 z-[60]">
                <DropdownMenuItem onClick={handleLogout} className="text-red-500 font-bold cursor-pointer h-12 text-lg focus:bg-red-50 focus:text-red-600 outline-none">
                  <LogOut className="mr-3 h-5 w-5" />
                  <span>로그아웃</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  )
}