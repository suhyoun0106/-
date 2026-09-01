'use client'

/**
 * 이 파일은 화면 왼쪽(모바일은 하단)에 고정되는 네비게이션 바(사이드바) 컴포넌트입니다.
 * 인스타그램의 왼쪽 메뉴 역할을 하며 홈, 메시지(DM), 알림, 프로필로 이동할 수 있습니다.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MessageCircle, Bell, User, PlusSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export default function Sidebar({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname()

  const navItems = [
    { name: '홈', href: '/', icon: Home },
    { name: '만들기', href: '/create', icon: PlusSquare },
    { name: '메시지', href: '/messages', icon: MessageCircle },
    { name: '알림', href: '/notifications', icon: Bell, badge: unreadCount },
    { name: '프로필', href: '/profile', icon: User },
  ]

  return (
    <div className="w-full h-16 md:w-64 md:h-screen border-t md:border-t-0 md:border-r bg-background fixed bottom-0 md:relative md:flex md:flex-col z-50">
      <div className="hidden md:flex p-6 font-bold text-2xl italic tracking-tighter">
        Instagram
      </div>
      <nav className="flex md:flex-col justify-around md:justify-start h-full md:p-4 gap-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-4 p-3 rounded-lg transition-colors hover:bg-secondary relative",
                isActive ? "font-bold" : "font-medium text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-6 w-6", isActive && "stroke-[2.5px]")} />
                {item.badge ? (
                  <Badge variant="destructive" className="absolute -top-2 -right-2 px-1.5 min-w-[20px] h-5 flex items-center justify-center text-xs">
                    {item.badge}
                  </Badge>
                ) : null}
              </div>
              <span className="hidden md:block text-lg">{item.name}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
