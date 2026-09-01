'use client'

/**
 * 이 파일은 새 게시물을 작성하는 페이지입니다.
 * - 사진 여러 장 업로드 가능 (Supabase Storage 이용)
 * - 글(텍스트) 작성
 * - 작성 완료 후 피드로 이동
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ImagePlus, X } from 'lucide-react'

export default function CreatePostPage() {
  const [content, setContent] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // 이미지 파일 선택 핸들러
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files)
      setImages(prev => [...prev, ...filesArray])
      
      // 미리보기 URL 생성
      const previews = filesArray.map(file => URL.createObjectURL(file))
      setImagePreviews(prev => [...prev, ...previews])
    }
  }

  // 선택된 이미지 삭제 핸들러
  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  // 폼 제출 (게시물 업로드) 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (images.length === 0 && !content.trim()) {
      toast.error('사진을 업로드하거나 글 내용을 작성해주세요.')
      return
    }

    setIsLoading(true)

    try {
      // 1. 현재 사용자 가져오기
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요합니다.')

      // 2. posts 테이블에 먼저 빈 데이터(글 내용만) 삽입하여 게시물 ID 확보
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .insert({ user_id: user.id, content })
        .select()
        .single()
      
      if (postError) throw postError

      const postId = postData.id

      // 3. 선택된 이미지가 있다면 Supabase Storage에 업로드하고 DB에 기록
      if (images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const file = images[i]
          const fileExt = file.name.split('.').pop()
          const fileName = `${postId}_${i}_${Date.now()}.${fileExt}` // 고유한 파일명 생성

          // 스토리지에 파일 업로드 ('post_images' 버킷)
          const { error: uploadError } = await supabase.storage
            .from('post_images')
            .upload(fileName, file)

          if (uploadError) throw uploadError

          // 업로드된 파일의 공개(Public) URL 가져오기
          const { data: { publicUrl } } = supabase.storage
            .from('post_images')
            .getPublicUrl(fileName)

          // post_images 테이블에 저장
          const { error: imageDbError } = await supabase
            .from('post_images')
            .insert({
              post_id: postId,
              image_url: publicUrl,
              position: i // 순서 저장
            })

          if (imageDbError) throw imageDbError
        }
      }

      toast.success('게시물이 성공적으로 업로드되었습니다!')
      router.push('/')
      router.refresh()

    } catch (error: any) {
      console.error(error)
      toast.error(error.message || '업로드 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">새 게시물 만들기</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 이미지 업로드 영역 */}
        <div className="space-y-4">
          <Label>사진 업로드 (선택)</Label>
          <div className="grid grid-cols-3 gap-4">
            {imagePreviews.map((preview, idx) => (
              <div key={idx} className="relative aspect-square rounded-md overflow-hidden bg-muted border">
                <img src={preview} alt="preview" className="object-cover w-full h-full" />
                <button 
                  type="button" 
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <label className="flex flex-col items-center justify-center aspect-square rounded-md border-2 border-dashed border-muted-foreground/30 bg-muted/50 cursor-pointer hover:bg-muted transition-colors">
              <ImagePlus className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="text-xs text-muted-foreground font-medium">사진 추가</span>
              <Input 
                type="file" 
                accept="image/*" 
                multiple 
                className="hidden" 
                onChange={handleImageChange}
              />
            </label>
          </div>
        </div>

        {/* 게시글 내용 작성 영역 */}
        <div className="space-y-2">
          <Label htmlFor="content">문구 입력</Label>
          <Textarea 
            id="content"
            placeholder="어떤 생각을 하고 계신가요?" 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[150px] resize-none"
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading || (images.length === 0 && !content.trim())}>
          {isLoading ? '업로드 중...' : '공유하기'}
        </Button>
      </form>
    </div>
  )
}
