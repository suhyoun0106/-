'use client'

/**
 * 이 파일은 내 프로필 페이지입니다.
 * - 내 프로필 사진 변경 (컴퓨터에서 사진 선택하여 업로드)
 * - 로그아웃
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Camera, LogOut, Grid3X3 } from 'lucide-react'
import Link from 'next/link'

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchProfileAndPosts()
  }, [])

  async function fetchProfileAndPosts() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // 1. 프로필 정보 가져오기
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(profileData)

      // 2. 내 게시물 가져오기 (첫 번째 이미지만 썸네일용으로 조인)
      const { data: postsData } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          post_images (image_url)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      if (postsData) {
        setPosts(postsData)
      }
    }
  }

  // 프로필 이미지 업로드 핸들러
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      setIsUploading(true)
      if (!e.target.files || e.target.files.length === 0) return
      
      const file = e.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = `${profile.id}_${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id)

      if (updateError) throw updateError

      toast.success('프로필 사진이 업데이트 되었습니다!')
      fetchProfileAndPosts()
      
    } catch (error: any) {
      toast.error('업로드 중 오류 발생: ' + error.message)
    } finally {
      setIsUploading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!profile) return null

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      {/* 프로필 헤더 영역 */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-8 border-b pb-10">
        
        {/* 프로필 이미지 */}
        <div className="relative group shrink-0">
          <Avatar className="w-32 h-32 md:w-40 md:h-40 border-4 border-background">
            <AvatarImage src={profile.avatar_url || ''} />
            <AvatarFallback className="text-4xl">{profile.username?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          
          <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
            <Camera className="w-8 h-8" />
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleAvatarUpload}
              disabled={isUploading}
            />
          </label>
        </div>

        {/* 유저 정보 */}
        <div className="flex flex-col items-center md:items-start gap-4 flex-1 mt-4 md:mt-0">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold">{profile.username}</h1>
            <Button variant="outline" size="sm" onClick={handleLogout} className="hidden md:flex gap-2">
              <LogOut className="w-4 h-4" />
              로그아웃
            </Button>
          </div>
          
          <div className="flex gap-6 text-sm">
            <span>게시물 <span className="font-bold">{posts.length}</span></span>
          </div>

          <p className="text-muted-foreground">{profile.email}</p>

          {/* 모바일용 로그아웃 버튼 */}
          <Button variant="outline" size="sm" onClick={handleLogout} className="md:hidden flex gap-2 mt-4 w-full">
            <LogOut className="w-4 h-4" />
            로그아웃
          </Button>
        </div>
      </div>

      {/* 게시물 그리드 뷰 (인스타 피드 탭) */}
      <div className="mt-4">
        <div className="flex justify-center border-t -mt-px mb-4">
          <div className="flex items-center gap-2 border-t border-foreground pt-4 px-4 font-semibold text-sm">
            <Grid3X3 className="w-4 h-4" />
            게시물
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            아직 작성한 게시물이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 md:gap-4">
            {posts.map((post) => {
              // 썸네일 이미지 결정 (사진이 없으면 글 내용을 보여줌)
              const hasImage = post.post_images && post.post_images.length > 0
              
              return (
                <Link key={post.id} href={`/post/${post.id}`} className="relative aspect-square bg-muted group overflow-hidden">
                  {hasImage ? (
                    <img 
                      src={post.post_images[0].image_url} 
                      alt="thumbnail" 
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="absolute inset-0 p-2 md:p-4 text-xs md:text-sm font-medium flex items-center justify-center text-center bg-card border hover:bg-secondary/50 transition-colors">
                      {/* 글만 있는 경우 내용 일부 표시 */}
                      <span className="line-clamp-4">{post.content}</span>
                    </div>
                  )}
                  {/* 호버 시 어두워지는 효과 */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
