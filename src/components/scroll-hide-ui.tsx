'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface ScrollHideUIProps {
  children: React.ReactNode
  direction: 'top' | 'bottom'
  className?: string
  style?: React.CSSProperties
}

export default function ScrollHideUI({ children, direction, className, style }: ScrollHideUIProps) {
  const [isVisible, setIsVisible] = useState(true)
  const lastScrollY = useRef(0)
  
  useEffect(() => {
    // layout.tsx에서 main 태그가 overflow-y-auto를 가지고 있으므로 해당 요소를 찾아서 이벤트를 겁니다.
    
    
    

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      // 상단(0px)에 가까우면 무조건 보이게 설정
      if (currentScrollY < 50) {
        setIsVisible(true)
        lastScrollY.current = currentScrollY
        return
      }
      
      if (Math.abs(currentScrollY - lastScrollY.current) < 10) {
        return
      }

      if (currentScrollY > lastScrollY.current) {
        // Scrolling down
        setIsVisible(false)
      } else {
        // Scrolling up
        setIsVisible(true)
      }
      
      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div 
      className={cn(
        "transition-transform duration-300 ease-in-out z-40",
        direction === 'top' 
          ? (isVisible ? "translate-y-0" : "-translate-y-full md:translate-y-0")
          : (isVisible ? "translate-y-0" : "translate-y-[200%] md:translate-y-0"),
        className
      )}
      style={style}
    >
      {children}
    </div>
  )
}
