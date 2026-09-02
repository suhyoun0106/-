'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        username: formData.get('username') as string,
        instagram_id: formData.get('instagram_id') as string,
      }
    }
  }

  // Check if username already exists in profiles
  const { data: existingUser } = await supabase.from('profiles').select('id').eq('username', data.options.data.username).single()
  
  if (existingUser) {
     return { error: 'Username already taken' }
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  
  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        username: data.options.data.username,
      },
      emailRedirectTo: `${origin}/auth/confirm`
    }
  })

  if (error) {
    return { error: error.message }
  }

  // 이메일 인증이 켜져 있는 경우, 로그인 세션이 바로 생성되지 않습니다.
  if (authData.user && authData.user.identities && authData.user.identities.length > 0) {
    // 세션이 없다는 것은 이메일 인증이 필요하다는 뜻입니다.
    if (!authData.session) {
      return { success: '가입하신 이메일로 인증 메일을 발송했습니다. 이메일을 확인해주세요!' }
    }
  }
  
  revalidatePath('/', 'layout')
  redirect('/')
}
