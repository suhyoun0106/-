'use client'

/**
 * 이 파일은 화면 왼쪽(모바일은 하단)에 고정되는 네비게이션 바(사이드바) 컴포넌트입니다.
 * 인스타그램의 왼쪽 메뉴 역할을 하며 홈, 메시지(DM), 알림, 프로필로 이동할 수 있습니다.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MessageCircle, Bell, User, PlusSquare, Search, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
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
    <div className="w-full h-16 md:w-[80px] md:h-screen border-t md:border-t-0 md:border-r bg-background fixed bottom-0 md:relative md:flex md:flex-col z-50 shrink-0">
      <div className="hidden md:flex p-4 justify-center">
        <Link href="/">
          <img src="/logo.png" alt="@fan logo" className="h-[40px] md:h-[48px] object-contain" />
        </Link>
      </div>
      <nav className="flex md:flex-col justify-around md:justify-start h-full md:p-3 gap-2">
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
                          {/* 툴팁 */}
              <div className="absolute left-[110%] px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 hidden md:block">
                {item.name}
                <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-2 bg-zinc-900 dark:bg-zinc-100 rotate-45"></div>
              </div>
            </Link>
          )
        })}

        {/* 설정(환경설정) 메뉴 */}
        <div className="md:mt-auto flex items-center justify-center h-full md:h-auto">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "flex items-center justify-center p-3 rounded-xl transition-colors hover:bg-secondary relative group font-medium text-muted-foreground hover:text-foreground w-full outline-none"
              )}
              
            >
              <div className="relative flex items-center justify-center">
                <Settings className="h-6 w-6 transition-transform group-hover:rotate-90" />
              </div>
                          <div className="absolute left-[110%] px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 hidden md:block">
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
  )
}
