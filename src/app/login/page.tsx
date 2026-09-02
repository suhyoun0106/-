'use client'

import { useState } from 'react'
import { login, signup } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function onSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    
    let result
    if (isLogin) {
      result = await login(formData)
    } else {
      result = await signup(formData)
    }

    if ((result as any)?.error) {
      setError((result as any).error)
      setIsLoading(false)
    } else if ((result as any)?.success) {
      setSuccess((result as any).success)
      setIsLoading(false)
      // 회원가입 성공 시 폼 초기화를 위해 이메일/비밀번호/유저명은 비우는 게 좋지만 일단 여기서는 메시지만 표시
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{isLogin ? '로그인' : '회원가입'}</CardTitle>
          <CardDescription>
            {isLogin
              ? '이메일과 비밀번호를 입력하여 로그인하세요.'
              : '계정을 생성하여 친구들과 대화를 시작하세요.'}
          </CardDescription>
        </CardHeader>
        <form action={onSubmit}>
          <CardContent className="grid gap-4">
            {!isLogin && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="username">@fan ID (사용할 새로운 아이디)</Label>
                  <Input id="username" name="username" type="text" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="instagram_id">Instagram ID (기존 후원 연결용, 없으면 빈칸)</Label>
                  <Input id="instagram_id" name="instagram_id" type="text" />
                </div>
              </>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email">이메일</Label>
              <Input id="email" name="email" type="email" placeholder="m@example.com" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
            {success && <p className="text-sm text-green-600 font-medium">{success}</p>}
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? '처리 중...' : isLogin ? '로그인' : '회원가입'}
            </Button>
            <Button
              type="button"
              variant="link"
              className="w-full text-sm"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
