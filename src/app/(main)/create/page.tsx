'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { ImagePlus, X, ChevronDown, ArrowLeft, ChevronLeft, ChevronRight, Trash2, Link2, Bold, Italic, Strikethrough, Image as ImageIcon, List, ListOrdered, Underline, Edit2 } from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
  });
};

const dataURLtoFile = (dataurl: string, filename: string): File => {
  let arr = dataurl.split(','),
      mimeMatch = arr[0].match(/:(.*?);/),
      mime = mimeMatch ? mimeMatch[1] : 'image/jpeg',
      bstr = atob(arr[1]), 
      n = bstr.length, 
      u8arr = new Uint8Array(n);
      
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, {type:mime});
}


export default function CreatePostPage() {
  const router = useRouter()
  const supabase = createClient()
  const [title, setTitle] = useState('')
  type MediaItem = { id: string, url: string, file?: File }
  const [media, setMedia] = useState<MediaItem[]>([])
  const imagePreviews = media.map(m => m.url)
  const images = media.filter(m => m.file).map(m => m.file as File)
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const [communities, setCommunities] = useState<any[]>([])
  const [selectedCommunity, setSelectedCommunity] = useState<any | null>(null)
  
  const [isLoading, setIsLoading] = useState(false)
  
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  
  type Draft = {
    id: number
    title: string
    content: string
    community_id: string | null
    timestamp: number
    media?: { url: string, base64?: string, isExisting?: boolean, fileObj?: any }[]
  }

  const [drafts, setDrafts] = useState<Draft[]>([])
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(null)

  const [isGalleryEditOpen, setIsGalleryEditOpen] = useState(false)
  const [tempMedia, setTempMedia] = useState<MediaItem[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  useEffect(() => {
    if (isGalleryEditOpen) {
      setTempMedia([...media])
    }
  }, [isGalleryEditOpen, media])

  const handleDragStart = (index: number) => setDraggedIndex(index)
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    const items = [...tempMedia]
    const draggedItem = items[draggedIndex]
    items.splice(draggedIndex, 1)
    items.splice(index, 0, draggedItem)
    setDraggedIndex(index)
    setTempMedia(items)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDraggedIndex(null)
  }

  useEffect(() => {
    const saved = localStorage.getItem('post_drafts')
    if (saved) {
      setDrafts(JSON.parse(saved))
    }
  }, [])

  const handleSaveDraft = async () => {
    const htmlContent = editorRef.current?.innerHTML || ''
    
    if (!title.trim() && !htmlContent.trim() && htmlContent === '<br>') {
      toast.error('저장할 내용이 없습니다.')
      return
    }
    
    toast.info('임시저장 중입니다...')
    setIsLoading(true)

    try {
      const draftMedia = await Promise.all(media.map(async (item) => {
        if (item.file) {
          const base64 = await compressImage(item.file);
          return { url: item.url, base64, isExisting: false, fileObj: { name: item.file.name } };
        } else {
          return { url: item.url, isExisting: true };
        }
      }));

      const draftData: Draft = {
        id: currentDraftId || Date.now(),
        title: title.trim() || '제목 없음',
        content: htmlContent,
        community_id: selectedCommunity?.id || null,
        timestamp: Date.now(),
        media: draftMedia
      }

      let newDrafts;
      if (currentDraftId) {
        newDrafts = drafts.map(d => d.id === currentDraftId ? draftData : d)
      } else {
        newDrafts = [draftData, ...drafts]
        setCurrentDraftId(draftData.id)
      }
      
      setDrafts(newDrafts)
      try {
        localStorage.setItem('post_drafts', JSON.stringify(newDrafts))
        toast.success('게시글이 임시저장되었습니다.')
      } catch (e: any) {
        if (e.name === 'QuotaExceededError') {
          toast.error('이미지 용량이 너무 커서 임시저장에 실패했습니다.')
        } else {
          toast.error('임시저장 중 오류가 발생했습니다.')
        }
      }
    } catch (e) {
      toast.error('이미지 압축 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const loadDraft = (draft: Draft) => {
    setTitle(draft.title === '제목 없음' ? '' : draft.title)
    if (editorRef.current) {
      editorRef.current.innerHTML = draft.content
    }
    if (draft.community_id) {
      const comm = communities.find(c => c.id === draft.community_id)
      if (comm) setSelectedCommunity(comm)
    }
    
    if (draft.media && draft.media.length > 0) {
      const loadedMedia = draft.media.map(m => {
        if (m.base64 && m.fileObj) {
          const file = dataURLtoFile(m.base64, m.fileObj.name || 'image.jpg')
          return { id: Math.random().toString(36), url: URL.createObjectURL(file), file }
        }
        return { id: Math.random().toString(36), url: m.url }
      })
      setMedia(loadedMedia)
      setCurrentImageIndex(0)
    } else {
      setMedia([])
    }

    setCurrentDraftId(draft.id)
  }

  const deleteDraft = (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    const newDrafts = drafts.filter(d => d.id !== id)
    setDrafts(newDrafts)
    localStorage.setItem('post_drafts', JSON.stringify(newDrafts))
    if (currentDraftId === id) setCurrentDraftId(null)
  }

  const editorRef = useRef<HTMLDivElement>(null)

  // --- 새로 추가: 페이지 이동 방지 ---
  useEffect(() => {
    const hasUnsavedChanges = () => {
      const htmlContent = editorRef.current?.innerHTML || ''
      return title.trim() !== '' || (htmlContent.trim() !== '' && htmlContent !== '<br>') || media.length > 0
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    const handleClick = async (e: MouseEvent) => {
      const target = (e.target as Element).closest('a')
      if (!target || !target.href) return

      const targetUrl = new URL(target.href)
      const currentUrl = new URL(window.location.href)
      
      // 같은 페이지 내 이동이거나, 새 탭 열기라면 무시
      if (targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search) return
      if (target.target === '_blank') return

      if (hasUnsavedChanges()) {
        e.preventDefault()
        e.stopPropagation()
        
        const wantToSave = window.confirm('작성 중인 내용이 있습니다. 저장하시겠습니까?\n(확인을 누르면 임시저장 후 이동합니다.)')
        
        if (wantToSave) {
          // 임시저장 로직 실행
          await handleSaveDraft()
        }
        
        router.push(target.href)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleClick, { capture: true })

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleClick, { capture: true })
    }
  }, [title, media, drafts, currentDraftId, selectedCommunity, router])

  const handleAddLink = () => {
    if (!linkUrl.trim()) return
    let embedHtml = `<a href="${linkUrl}" target="_blank" class="text-blue-500 underline">${linkUrl}</a><br/>`

    try {
      if (linkUrl.includes('youtube.com/watch') || linkUrl.includes('youtu.be/') || linkUrl.includes('youtube.com/shorts/')) {
        let videoId = null;
        if (linkUrl.includes('youtube.com/shorts/')) {
          videoId = linkUrl.split('youtube.com/shorts/')[1].split('?')[0]
        } else if (linkUrl.includes('youtu.be/')) {
          videoId = linkUrl.split('youtu.be/')[1].split('?')[0]
        } else {
          videoId = new URL(linkUrl).searchParams.get('v')
        }
        if (videoId) {
          const isShort = linkUrl.includes('shorts/');
          embedHtml = `<div class="aspect-video w-full my-4 rounded-xl overflow-hidden"><iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}${isShort ? '?is_short=1' : ''}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div><br/>`
        }
      } else if (linkUrl.includes('tiktok.com/')) {
        const videoId = linkUrl.split('/video/')[1]?.split('?')[0]
        if (videoId) {
          embedHtml = `<div class="flex justify-center my-4"><iframe width="325" height="705" src="https://www.tiktok.com/embed/v2/${videoId}" frameborder="0" allowfullscreen></iframe></div><br/>`
        }
      } else if (linkUrl.includes('instagram.com/')) {
        const match = linkUrl.match(/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/)
        if (match && match[1]) {
          const shortcode = match[1]
          embedHtml = `<div class="flex justify-center my-4"><iframe width="400" height="500" src="https://www.instagram.com/p/${shortcode}/embed" frameborder="0" scrolling="no" allowtransparency="true"></iframe></div><br/>`
        }
      }
    } catch(e) {}

    if (embedHtml.includes('<iframe')) {
      // Extract iframe src
      const srcMatch = embedHtml.match(/src="([^"]+)"/);
      if (srcMatch && srcMatch[1]) {
        setMedia(prev => {
          setCurrentImageIndex(prev.length);
          return [...prev, { id: Date.now().toString(), url: srcMatch[1] }];
        });
        setIsLinkModalOpen(false);
        setLinkUrl('');
        return;
      }
    }

    editorRef.current?.focus()
    document.execCommand('insertHTML', false, embedHtml)
    setIsLinkModalOpen(false)
    setLinkUrl('')
  }

  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
  }

  useEffect(() => {
    async function fetchCommunities() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: donations } = await supabase
        .from('donations')
        .select('receiver:receiver_id(id, username, avatar_url)')
        .eq('donor_id', user.id)

      if (donations) {
        // deduplicate communities
        const unique = Array.from(new Map(
          donations
            .map(d => d.receiver)
            .filter(Boolean)
            .map((r: any) => [r.id, r])
        ).values())
        setCommunities(unique)

        // 만약 수정 모드라면 기존 글 불러오기
        const urlParams = new URLSearchParams(window.location.search)
        const editId = urlParams.get('edit')
        if (editId) {
          const { data: postData } = await supabase
            .from('posts')
            .select('*, post_images(image_url)')
            .eq('id', editId)
            .single()

          if (postData) {
            setTitle(postData.title || '')
            if (editorRef.current) {
              editorRef.current.innerHTML = postData.content || ''
            }
            const comm = unique.find((c: any) => c.id === postData.community_id)
            if (comm) setSelectedCommunity(comm)
            
            // 기존 이미지가 있다면 미리보기에 추가 (File 객체는 아니므로 새로 업로드되진 않음)
            if (postData.post_images && postData.post_images.length > 0) {
              const items = postData.post_images.map((img: any) => ({
                id: Math.random().toString(36),
                url: img.image_url
              }))
              setMedia(items)
              setCurrentImageIndex(0)
            }
          }
        }
      }
    }
    fetchCommunities()
  }, [])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files)
      const newMedia = filesArray.map(file => ({
        id: Math.random().toString(36),
        url: URL.createObjectURL(file),
        file
      }))
      setMedia(prev => {
        setCurrentImageIndex(prev.length)
        return [...prev, ...newMedia]
      })
      e.target.value = ''
    }
  }

  const removeCurrentImage = () => {
    if (media.length === 0) return
    setMedia(prev => {
      const newMedia = prev.filter((_, i) => i !== currentImageIndex)
      if (currentImageIndex >= newMedia.length) {
        setCurrentImageIndex(Math.max(0, newMedia.length - 1))
      }
      return newMedia
    })
  }

  const prevImage = () => setCurrentImageIndex(i => Math.max(0, i - 1))
  const nextImage = () => setCurrentImageIndex(i => Math.min(imagePreviews.length - 1, i + 1))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      toast.error('제목을 입력해주세요.')
      return
    }
    if (!selectedCommunity) {
      toast.error('커뮤니티를 선택해주세요.')
      return
    }
    
    const htmlContent = editorRef.current?.innerHTML || ''
    const textContent = editorRef.current?.textContent || ''

    if (media.length === 0 && !textContent.trim()) {
      toast.error('사진을 업로드하거나 글 내용을 작성해주세요.')
      return
    }

    setIsLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요합니다.')

      const urlParams = new URLSearchParams(window.location.search)
      const editId = urlParams.get('edit')

      let postId;

      if (editId) {
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .update({ 
            title,
            content: htmlContent,
            community_id: selectedCommunity.id
          })
          .eq('id', editId)
          .select()
          .single()
        
        if (postError) throw postError
        postId = postData.id
      } else {
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .insert({ 
            user_id: user.id, 
            title,
            content: htmlContent,
            community_id: selectedCommunity.id
          })
          .select()
          .single()
        
        if (postError) throw postError
        postId = postData.id
      }

      if (editId) {
        // 기존 이미지 관계를 모두 삭제
        const { error: deleteError } = await supabase.from('post_images').delete().eq('post_id', postId)
        if (deleteError) {
          console.error("Failed to delete old images:", deleteError)
          toast.error("기존 이미지 초기화 중 오류가 발생했습니다.")
          throw deleteError
        }
      }

      if (media.length > 0) {
        for (let i = 0; i < media.length; i++) {
          const item = media[i]
          let publicUrl = item.url
          
          if (item.file) {
            const file = item.file
            const fileExt = file.name.split('.').pop()
            const fileName = `${postId}_${i}_${Date.now()}.${fileExt}`
  
            const { error: uploadError } = await supabase.storage
              .from('post_images')
              .upload(fileName, file)
            if (uploadError) throw uploadError
  
            const { data: urlData } = supabase.storage
              .from('post_images')
              .getPublicUrl(fileName)
            publicUrl = urlData.publicUrl
          }

          const { error: imageDbError } = await supabase
            .from('post_images')
            .insert({
              post_id: postId,
              image_url: publicUrl,
              position: i
            })
          if (imageDbError) throw imageDbError
        }
      }

      if (currentDraftId) {
        const newDrafts = drafts.filter(d => d.id !== currentDraftId)
        setDrafts(newDrafts)
        localStorage.setItem('post_drafts', JSON.stringify(newDrafts))
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
    <div className="max-w-4xl mx-auto py-8 px-4 flex flex-col min-h-screen">
      
      {/* Top Navigation / Toolbar */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => router.back()}
            className="w-11 h-11 flex items-center justify-center rounded-full border border-border bg-background hover:bg-secondary/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-full h-11 px-6 font-bold border border-border bg-background flex gap-2 cursor-pointer hover:bg-secondary/50">
            {selectedCommunity ? (
              <>
                <Avatar className="w-5 h-5">
                  <AvatarImage src={selectedCommunity.avatar_url || ''} />
                  <AvatarFallback>{selectedCommunity.username.charAt(0)}</AvatarFallback>
                </Avatar>
                {selectedCommunity.username}
              </>
            ) : (
              '커뮤니티 선택'
            )}
            <ChevronDown className="w-4 h-4 ml-1 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px]">
            {communities.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">후원한 인물이 없습니다.</div>
            ) : (
              communities.map(c => (
                <DropdownMenuItem key={c.id} onClick={() => setSelectedCommunity(c)} className="flex items-center gap-2 cursor-pointer py-2">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={c.avatar_url || ''} />
                    <AvatarFallback>{c.username.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="font-bold">{c.username}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>

        {drafts.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="text-sm font-bold text-muted-foreground flex items-center gap-2 cursor-pointer hover:text-foreground outline-none">
              임시 저장본 <span className="bg-secondary text-foreground px-2 py-0.5 rounded-full text-xs">{drafts.length}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[280px]">
              {drafts.map((draft) => (
                <div key={draft.id} className="flex items-center justify-between group px-2 py-2 hover:bg-secondary/50 rounded-md cursor-pointer" onClick={() => loadDraft(draft)}>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-semibold truncate">{draft.title}</span>
                    <span className="text-xs text-muted-foreground truncate">{new Date(draft.timestamp).toLocaleString()}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="w-6 h-6 opacity-0 group-hover:opacity-100" onClick={(e) => deleteDraft(e, draft.id)}>
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </Button>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="text-sm font-bold text-muted-foreground flex items-center gap-2">
            임시 저장본 <span className="bg-secondary text-foreground px-2 py-0.5 rounded-full text-xs">0</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        
        {/* Title */}
        <div className="mb-4 relative">
          <input
            type="text"
            placeholder="제목"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full text-3xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/50 py-2 focus:ring-0"
          />
          {title.length === 0 && (
            <span className="absolute top-3 left-[72px] text-red-500 text-3xl font-bold">*</span>
          )}
        </div>



        {/* Image Carousel Area */}
        {imagePreviews.length > 0 && (
          <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] bg-black rounded-3xl border border-border overflow-hidden mb-6 flex items-center justify-center group">
            {(() => {
              const url = imagePreviews[currentImageIndex];
              const isVideo = url.includes('youtube.com/embed') || url.includes('tiktok.com/embed') || url.includes('instagram.com/');
              return (
                <>
                  {!isVideo && (
                    <div 
                      className="absolute inset-0 bg-cover bg-center blur-2xl opacity-70 scale-110"
                      style={{ backgroundImage: `url(${url})` }}
                    />
                  )}
                  <div className="absolute inset-0 bg-black/20" />
                  {isVideo ? (
                    <iframe 
                          src={url} 
                          className={`relative w-full object-contain z-10 shadow-2xl rounded-lg ${(url.includes('tiktok') || url.includes('is_short=1') || url.includes('instagram')) ? 'aspect-[9/16] max-h-[70vh]' : 'aspect-video max-h-[70vh]'}`}
                      frameBorder="0"
                      allowFullScreen
                    />
                  ) : (
                    <img 
                      src={url} 
                      alt="preview" 
                      className="relative w-full h-full object-contain z-10 shadow-2xl"
                    />
                  )}
                </>
              )
            })()}
            
            {/* Overlay Actions */}
            <div className="absolute top-4 left-4 flex gap-2 z-20 flex-wrap">
              <label className="bg-black/50 hover:bg-black/70 text-white text-sm font-bold px-4 py-2 rounded-full cursor-pointer transition-colors flex items-center gap-2 backdrop-blur-sm">
                <ImagePlus className="w-4 h-4" />
                사진 추가
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
              </label>
              <button type="button" onClick={() => setIsLinkModalOpen(true)} className="bg-black/50 hover:bg-black/70 text-white text-sm font-bold px-4 py-2 rounded-full cursor-pointer transition-colors flex items-center gap-2 backdrop-blur-sm">
                <Link2 className="w-4 h-4" />
                URL 추가
              </button>
              {media.length > 1 && (
                <button type="button" onClick={() => setIsGalleryEditOpen(true)} className="bg-black/50 hover:bg-black/70 text-white text-sm font-bold px-4 py-2 rounded-full transition-colors flex items-center gap-2 backdrop-blur-sm">
                  <Edit2 className="w-4 h-4" />
                  전체 설정
                </button>
              )}
            </div>

            <button type="button" onClick={removeCurrentImage} className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors backdrop-blur-sm flex items-center justify-center w-10 h-10 z-20">
              <Trash2 className="w-5 h-5" />
            </button>

            {/* Navigation Arrows */}
            {imagePreviews.length > 1 && (
              <>
                <button 
                  type="button" 
                  onClick={prevImage}
                  disabled={currentImageIndex === 0}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 disabled:opacity-30 disabled:hover:bg-black/50 text-white p-2 rounded-full transition-all backdrop-blur-sm flex items-center justify-center w-10 h-10 z-20"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button 
                  type="button" 
                  onClick={nextImage}
                  disabled={currentImageIndex === imagePreviews.length - 1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 disabled:opacity-30 disabled:hover:bg-black/50 text-white p-2 rounded-full transition-all backdrop-blur-sm flex items-center justify-center w-10 h-10 z-20"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        )}

        {/* Text Area */}
        <div className="flex-1 min-h-[500px] flex flex-col">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="여기에 글쓰는 곳"
            className="flex-1 w-full outline-none text-lg empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50 cursor-text"
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                if (e.shiftKey) {
                  document.execCommand('outdent', false, undefined);
                } else {
                  if (document.queryCommandState('insertUnorderedList') || document.queryCommandState('insertOrderedList')) {
                    document.execCommand('indent', false, undefined);
                  } else {
                    document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
                  }
                }
              }
            }}
          />
        </div>

        {/* Toolbar */}
        <div className="border-t border-border mt-4 py-4 flex items-center justify-between text-muted-foreground overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-6 min-w-max px-2">
            <button type="button" onClick={() => setIsLinkModalOpen(true)} className="w-5 h-5 cursor-pointer text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center">
              <Link2 className="w-5 h-5" />
            </button>
            <label className="cursor-pointer hover:text-foreground transition-colors flex items-center justify-center text-muted-foreground ml-2">
              <ImageIcon className="w-5 h-5" />
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
            </label>
            <div className="w-px h-6 bg-border mx-2"></div>
            <Bold onMouseDown={(e) => { e.preventDefault(); applyFormat('bold'); }} strokeWidth={3} className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors text-foreground" />
            <Italic onMouseDown={(e) => { e.preventDefault(); applyFormat('italic'); }} className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors" />
            <Strikethrough onMouseDown={(e) => { e.preventDefault(); applyFormat('strikeThrough'); }} className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors" />
            <Underline onMouseDown={(e) => { e.preventDefault(); applyFormat('underline'); }} className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors" />
            <div className="w-px h-6 bg-border mx-2"></div>
            <List onMouseDown={(e) => { e.preventDefault(); applyFormat('insertUnorderedList'); }} className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors" />
            <ListOrdered onMouseDown={(e) => { e.preventDefault(); applyFormat('insertOrderedList'); }} className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors" />
          </div>
          <div className="flex items-center gap-3 shrink-0 pl-4">
            <Button type="button" variant="secondary" onClick={handleSaveDraft} className="rounded-full font-bold px-6 bg-secondary text-secondary-foreground hover:bg-secondary/80">
              임시 저장하기
            </Button>
            <Button type="submit" disabled={isLoading} className="rounded-full font-bold px-6 bg-black text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-200">
              {isLoading ? '게시 중...' : '게시하기'}
            </Button>
          </div>
        </div>
      </form>

      <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
        <DialogContent className="sm:max-w-md bg-background rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="text-xl font-bold">링크 추가</DialogTitle>
          </DialogHeader>
          <div className="p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-2 relative">
              <label className="text-sm font-semibold text-muted-foreground bg-background px-1 absolute -top-2 left-3">링크 URL <span className="text-red-500">*</span></label>
              <Input
                autoFocus
                placeholder="https://youtu.be/..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="h-12 border-muted-foreground/30 focus-visible:ring-primary rounded-lg"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddLink()
                  }
                }}
              />
            </div>
          </div>
          <div className="p-4 bg-secondary/30 flex justify-end">
            <Button type="button" onClick={handleAddLink} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg px-8 py-2">
              추가하기
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isGalleryEditOpen} onOpenChange={setIsGalleryEditOpen}>
        <DialogContent className="w-fit max-w-[90vw] md:max-w-[850px] max-h-[90vh] bg-background border-none shadow-2xl p-0 flex flex-col rounded-3xl overflow-hidden">
          <DialogHeader className="p-6 pb-2 border-b shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold">갤러리 수정</DialogTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-2">사진이나 영상을 드래그하여 순서를 변경하세요.</p>
          </DialogHeader>
          <div className="p-6 overflow-y-auto flex-1 bg-secondary/30">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 auto-rows-max">
              {tempMedia.map((item, index) => {
                const isVideo = item.url.includes('youtube.com/embed') || item.url.includes('tiktok.com/embed') || item.url.includes('instagram.com/')
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={handleDrop}
                    className={`relative aspect-square rounded-2xl overflow-hidden cursor-move bg-black border-2 transition-all ${
                      draggedIndex === index ? 'border-primary scale-105 shadow-xl opacity-50' : 'border-transparent hover:border-primary/50 hover:shadow-md'
                    }`}
                  >
                    <div className="absolute inset-0 z-20" />
                    {isVideo ? (
                      <iframe 
                        src={item.url} 
                        className="w-full h-full object-cover pointer-events-none" 
                        frameBorder="0" 
                        tabIndex={-1} 
                      />
                    ) : (
                      <img src={item.url} alt="gallery item" className="w-full h-full object-cover" />
                    )}
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm z-30">
                      {index + 1}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setTempMedia(tempMedia.filter((_, i) => i !== index))
                      }}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-red-500 text-white p-1.5 rounded-full transition-colors backdrop-blur-sm z-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="p-4 border-t flex justify-between items-center bg-background shrink-0">
            <label className="text-sm font-bold flex items-center gap-2 cursor-pointer hover:text-primary transition-colors">
              <ImagePlus className="w-5 h-5" />
              미디어 더 추가
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                if (e.target.files) {
                  const filesArray = Array.from(e.target.files)
                  const newMedia = filesArray.map(file => ({
                    id: Math.random().toString(36),
                    url: URL.createObjectURL(file),
                    file
                  }))
                  setTempMedia([...tempMedia, ...newMedia])
                  e.target.value = ''
                }
              }} />
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setIsGalleryEditOpen(false)} className="rounded-full font-bold px-6">
                뒤로
              </Button>
              <Button type="button" onClick={() => {
                setMedia(tempMedia)
                setCurrentImageIndex(0)
                setIsGalleryEditOpen(false)
              }} className="rounded-full font-bold px-6 bg-black text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black">
                저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
