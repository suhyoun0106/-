'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Heart, MessageSquare, ExternalLink, Trophy, Crown, Camera, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import FeedPost from '@/components/feed-post'
import Cropper from 'react-easy-crop'
import { getCroppedImg } from '@/utils/cropImage'


function DonationMessage({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  if (!text) return null;
  
  if (text.length <= 50) {
    return <div className="text-sm text-muted-foreground mt-2 bg-secondary/30 p-3 rounded-lg">{text}</div>
  }
  
  return (
    <div 
      className="text-sm text-muted-foreground mt-2 bg-secondary/30 p-3 rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      {expanded ? text : text.substring(0, 50) + '...'}
      <span className="text-primary font-bold ml-1 text-xs">
        {expanded ? '접기' : '더보기'}
      </span>
    </div>
  )
}

export default function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const unwrappedParams = use(params)
  const username = decodeURIComponent(unwrappedParams.username)
  
  const [profile, setProfile] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [topDonors, setTopDonors] = useState<any[]>([])
  const [isDonateOpen, setIsDonateOpen] = useState(false)
  const [donationAmount, setDonationAmount] = useState('10000')
  const [donationMessage, setDonationMessage] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isUploading, setIsUploading] = useState(false)
  
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [editBio, setEditBio] = useState('')
  const [editInstagramId, setEditInstagramId] = useState('')
  const [editIsDonationEnabled, setEditIsDonationEnabled] = useState(true)
    const [editIsInstagramPublic, setEditIsInstagramPublic] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null)
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<string | null>(null)
  const [originalFileName, setOriginalFileName] = useState<string | null>(null)
  
  const [currentMonthTotal, setCurrentMonthTotal] = useState(0)
  const [currentMonthBackers, setCurrentMonthBackers] = useState(0)
  
  const [activeTab, setActiveTab] = useState<'posts' | 'liked' | 'donors'>('posts')
  const [likedPosts, setLikedPosts] = useState<any[]>([])
  const [hasFetchedLiked, setHasFetchedLiked] = useState(false)

  async function fetchLikedPosts() {
    if (!profile) return
    const { data: likedData } = await supabase
      .from('likes')
      .select('post_id, created_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    
    if (likedData && likedData.length > 0) {
      const postIds = likedData.map(l => l.post_id)
      const { data: pData } = await supabase
        .from('posts')
        .select(`
          *,
          profiles!posts_user_id_fkey (id, username, avatar_url, instagram_id, is_instagram_public),
          post_images (id, image_url, position),
          likes (id, user_id),
          shares (id, user_id),
          comments (id)
        `)
        .in('id', postIds)
      
      if (pData) {
        // Sort posts in memory based on the order of likedData (most recently liked first)
        const sortedPosts = postIds.map(id => pData.find(p => p.id === id)).filter(Boolean)
        setLikedPosts(sortedPosts)
      } else {
        setLikedPosts([])
      }
    } else {
      setLikedPosts([])
    }
    setHasFetchedLiked(true)
  }

  // Tag system state
  const [tags, setTags] = useState<any[]>([])
  const [newTagInput, setNewTagInput] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagValue, setEditingTagValue] = useState('')
  
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadProfileAndData()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from('profiles').select('*').eq('id', data.user.id).single().then(({ data: p }) => setCurrentUser(p))
      }
    })
  }, [username])

  async function loadTags(profileId: string) {
    const { data } = await supabase
      .from('creator_tags')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: true })
    if (data) setTags(data)
  }

  async function loadProfileAndData() {
    let { data: p } = await supabase.from('profiles').select('*').eq('username', username).single()
    
    if (!p) {
      // Create shadow profile
      const { data: newProfile, error } = await supabase.from('profiles').insert({
        username: username,
        is_claimed: false,
        total_donations: 0,
        avatar_url: `https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y`
      }).select().single()
      
      if (error) {
        console.error("Failed to create shadow profile", error)
        return
      }
      p = newProfile
    }
    
    setProfile(p)
    loadTags(p.id)

    // Load posts if any
    const { data: postData, error: postError } = await supabase
      .from('posts')
      .select(`
        *,
        profiles!posts_user_id_fkey (id, username, avatar_url, instagram_id, is_instagram_public),
        post_images (id, image_url, position),
        likes (id, user_id),
        shares (id, user_id),
        comments (id)
      `)
      .eq('user_id', p.id)
      .order('created_at', { ascending: false })
    
    if (postError) {
      console.error("Failed to load posts:", postError)
    }
    
    if (postData) {
      setPosts(postData)
    }

    // Load top donors (THIS MONTH)
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfMonthStr = startOfMonth.toISOString()

    const { data: donorData } = await supabase
      .from('donations')
      .select('donor:donor_id(id, username, avatar_url), amount, created_at, message')
      .eq('receiver_id', p.id)
      .gte('created_at', startOfMonthStr)
      .order('amount', { ascending: false })
    
    if (donorData) {
      let total = 0
      // Aggregate by donor
      const donorMap = new Map()
      donorData.forEach(d => {
        total += d.amount
        if (!d.donor) return // anonymous
        const donor = Array.isArray(d.donor) ? d.donor[0] : d.donor;
        if (!donor) return;
        const existing = donorMap.get(donor.id) || { ...donor, total: 0, message: null }
        existing.total += d.amount
        if (!existing.message && d.message) {
          existing.message = d.message
        }
        donorMap.set(donor.id, existing)
      })
      const sorted = Array.from(donorMap.values()).sort((a, b) => b.total - a.total)
      setTopDonors(sorted)
      setCurrentMonthTotal(total)
      setCurrentMonthBackers(donorMap.size)
    }
  }

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      const url = URL.createObjectURL(file)
      setOriginalFileName(file.name)
      setCropSrc(url)
    }
  }

  async function handleCropSave() {
    try {
      if (!cropSrc || !croppedAreaPixels) return
      const croppedFile = await getCroppedImg(cropSrc, croppedAreaPixels)
      const previewUrl = URL.createObjectURL(croppedFile)
      
      setPendingAvatarFile(croppedFile)
      setPendingAvatarPreview(previewUrl)
      setCropSrc(null) // Return to main edit form
    } catch (error: any) {
      toast.error('크롭 오류: ' + error.message)
    }
  }

  async function saveProfileChanges() {
    try {
      setIsUploading(true)
      let finalAvatarUrl = profile.avatar_url

      if (pendingAvatarFile) {
        const fileName = `${profile.id}_${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, pendingAvatarFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName)
          
        finalAvatarUrl = publicUrl
      }

      const { error } = await supabase.from('profiles').update({
        bio: editBio,
        instagram_id: editInstagramId,
        is_instagram_public: editIsInstagramPublic,
        is_donation_enabled: editIsDonationEnabled,
        avatar_url: finalAvatarUrl
      }).eq('id', profile.id)
      
      if (error) throw error
      
      if (editInstagramId) {
        await supabase.rpc('merge_shadow_profile', {
          real_profile_id: profile.id,
          insta_id: editInstagramId
        })
      }
      
      toast.success('프로필이 성공적으로 업데이트되었습니다.')
      setIsEditProfileOpen(false)
      loadProfileAndData()
    } catch (err: any) {
      toast.error('업데이트 실패: ' + err.message)
    } finally {
      setIsUploading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleDonate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUser) {
      toast.error('로그인이 필요합니다.')
      return
    }
    const amount = parseInt(donationAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('올바른 금액을 입력하세요.')
      return
    }

    const { error } = await supabase.from('donations').insert({
      donor_id: currentUser.id,
      receiver_id: profile.id,
      amount: amount,
      message: donationMessage
    })

    if (error) {
      toast.error('응원에 실패했습니다.')
    } else {
      const newTotal = (profile.total_donations || 0) + amount
      await supabase.from('profiles').update({ total_donations: newTotal }).eq('id', profile.id)
      
      toast.success('응원이 완료되었습니다! 🎉')
      setIsDonateOpen(false)
      setDonationMessage('')
      loadProfileAndData()
    }
  }

  async function startDM() {
    if (!currentUser) {
      toast.error('로그인이 필요합니다.')
      return
    }
    if (currentUser.id === profile.id) {
      toast.error('자기 자신에게는 메시지를 보낼 수 없습니다.')
      return
    }

    await supabase.from('friends').insert({
      user_id: currentUser.id,
      friend_id: profile.id,
      status: 'accepted'
    })
    
    router.push('/messages')
    toast.success(`${profile.username}님과 메시지를 시작합니다!`)
  }

  async function handleAddTag() {
    const rawTrimmed = newTagInput.trim()
    if (!rawTrimmed || !profile) return
    if (rawTrimmed.length > 10) { toast.error('태그는 최대 10자까지만 가능합니다.'); return }
    
    const trimmed = rawTrimmed.replace(/\s+/g, '').toLowerCase()
    
    // 중복 연타 방지: 이미 존재하는 태그면 조용히 닫기
    if (tags.some(t => t.tag === trimmed)) {
      setNewTagInput('')
      setIsAddingTag(false)
      return
    }

    if (tags.length >= 5) { toast.error('태그는 최대 5개까지 추가할 수 있습니다.'); return }
    const { error } = await supabase.from('creator_tags').insert({
      profile_id: profile.id,
      tag: trimmed,
      created_by: currentUser?.id || null
    })
    
    if (error) {
      if (error.code === '23505') {
        setNewTagInput('')
        setIsAddingTag(false)
      } else {
        toast.error('태그 추가 실패: ' + error.message)
      }
    } else {
      toast.success('태그 작성을 완료했습니다.')
      setNewTagInput('')
      setIsAddingTag(false)
      loadTags(profile.id)
    }
  }

  async function handleDeleteTag(tagId: string) {
    const { error } = await supabase.from('creator_tags').delete().eq('id', tagId)
    if (error) toast.error('태그 삭제 실패')
    else {
      toast.success('태그를 삭제했습니다.')
      loadTags(profile.id)
    }
  }

  async function handleEditTag(tagId: string) {
    const rawTrimmed = editingTagValue.trim()
    if (!rawTrimmed) return
    if (rawTrimmed.length > 10) { toast.error('태그는 최대 10자까지만 가능합니다.'); return }
    
    const trimmed = rawTrimmed.replace(/\s+/g, '').toLowerCase()
    // delete old and insert new
    await supabase.from('creator_tags').delete().eq('id', tagId)
    const { error } = await supabase.from('creator_tags').insert({
      profile_id: profile.id,
      tag: trimmed,
      created_by: currentUser?.id || null
    })
    if (error) toast.error('태그 수정 실패')
    else { 
      toast.success('태그 수정을 완료했습니다.')
      setEditingTagId(null)
      loadTags(profile.id) 
    }
  }

  if (!profile) return <div className="p-8 text-center">Loading profile...</div>

  const isUnclaimed = profile.is_claimed === false
  const isMe = currentUser?.id === profile.id
  // Tags can be edited: unclaimed profiles = anyone logged in; claimed profiles = owner only
  const canEditTags = !!currentUser && (isUnclaimed || isMe)

  return (
    <div className="w-full max-w-4xl mx-auto min-h-screen bg-background pb-8">
      {/* Banner / Header */}
      <div className="p-6 md:p-8">
        <div className="grid grid-cols-[auto_1fr] gap-x-5 md:gap-x-10 gap-y-4 md:gap-y-6">
          
          {/* Avatar (Col 1, Row 1 on mobile / Row 1-2 on desktop) */}
          <div className="relative group shrink-0 self-start md:row-span-2">
            <Avatar className="h-20 w-20 md:h-36 md:w-36 border border-border shadow-sm">
              <AvatarImage src={profile.avatar_url || ''} />
              <AvatarFallback>{profile.username.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            {isMe && (
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity z-20">
                <Camera className="w-8 h-8" />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => {
                    setIsEditProfileOpen(true);
                    handleAvatarSelect(e);
                  }}
                  disabled={isUploading}
                />
              </label>
            )}
          </div>
          
          {/* Username & Stats (Col 2, Row 1) */}
          <div className="flex flex-col gap-2 md:gap-4 justify-center md:justify-start pt-1 md:pt-0">
            {/* Top Row: Username and Secondary Name */}
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">{profile.username}</h1>
              <div className="flex items-center gap-2">
                {profile.instagram_id && profile.is_instagram_public ? (
                  <span className="text-muted-foreground font-medium text-sm md:text-base">@{profile.instagram_id}</span>
                ) : isUnclaimed ? (
                  <span className="text-muted-foreground font-medium text-sm md:text-base">@{profile.username}</span>
                ) : null}
                {isUnclaimed && (
                  <span className="bg-secondary text-secondary-foreground text-[10px] px-2 py-0.5 rounded-full font-bold">
                    UNCLAIMED ACCOUNT
                  </span>
                )}
              </div>
            </div>

            </div>

          {/* Bio, Tags, Buttons (Col 1-2 on mobile, Col 2 on desktop) */}
          <div className="col-span-2 md:col-span-1 flex flex-col w-full">
            {/* Bio Row */}
            <div className="text-sm md:text-base max-w-lg whitespace-pre-wrap mb-2">
              {profile.bio ? (
                <p>{profile.bio}</p>
              ) : isMe ? (
                <p className="text-muted-foreground cursor-pointer hover:underline" onClick={() => {
                  setEditBio(profile.bio || '')
                  setEditInstagramId(profile.instagram_id || '')
                  setEditIsInstagramPublic(profile.is_instagram_public || false)
                  setEditIsDonationEnabled(profile.is_donation_enabled !== false)
                                    setIsEditProfileOpen(true)
                }}>
                  소개글을 작성해주세요.
                </p>
              ) : isUnclaimed ? (
                <p className="text-muted-foreground">본인인증이 안된 계정입니다. 응원을 통해 해당 페이지 본인인증을 유도해 보세요!</p>
              ) : null}
            </div>

            {/* Tag / Category Section - Read Only */}
            <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-4">
              {tags.map(t => (
                <span key={t.id} className="text-blue-600 font-medium text-sm md:text-base">
                  #{t.tag}
                </span>
              ))}
            </div>

<div className="flex flex-nowrap gap-2 md:gap-3 items-center w-full overflow-x-auto pb-2 scrollbar-hide">
              {isMe ? (
                <>
                  <Button className="shrink-0 bg-primary hover:opacity-90 text-primary-foreground font-bold rounded-full h-11 px-5" onClick={() => {
                    setEditBio(profile.bio || '')
                    setEditInstagramId(profile.instagram_id || '')
                    setEditIsInstagramPublic(profile.is_instagram_public || false)
                    setEditIsDonationEnabled(profile.is_donation_enabled !== false)
                    setPendingAvatarFile(null)
                    setPendingAvatarPreview(null)
                    setOriginalFileName(null)
                    setIsEditProfileOpen(true)
                  }}>
                    프로필 편집하기
                  </Button>
                  <Button variant="secondary" className="shrink-0 rounded-full font-bold h-11 px-5" onClick={() => router.push('/create')}>
                    게시물 작성하기
                  </Button>
                  {profile.instagram_id ? (
                    profile.is_instagram_public ? (
                      <Button variant="secondary" className="shrink-0 rounded-full font-bold h-11 px-5" onClick={() => window.open(`https://instagram.com/${profile.instagram_id}`, '_blank')}>
                        Instagram: @{profile.instagram_id}
                      </Button>
                    ) : (
                      <Button disabled variant="secondary" className="shrink-0 rounded-full font-bold h-11 px-5 opacity-70">
                        Instagram: 비공개
                      </Button>
                    )
                  ) : (
                    <Button variant="secondary" className="shrink-0 rounded-full font-bold h-11 px-5" onClick={() => setIsEditProfileOpen(true)}>
                      Instagram 연동하기
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {profile.is_donation_enabled !== false ? (
                    <>
                      <Button className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold rounded-xl h-11 px-6 shadow-md shadow-primary/20 border-0" onClick={() => setIsDonateOpen(true)}>
                        <Heart className="w-5 h-5 mr-2 fill-zinc-900 text-zinc-900" />
                        응원하기
                      </Button>
                      <Button variant="secondary" className="shrink-0 rounded-xl font-bold h-11 px-6 bg-secondary/80 hover:bg-secondary" onClick={startDM}>
                        <MessageSquare className="w-5 h-5 mr-2 fill-current" />
                        메시지
                      </Button>
                      {profile.instagram_id && profile.is_instagram_public ? (
                        <Button variant="secondary" className="shrink-0 rounded-xl font-bold h-11 px-6 bg-secondary/80 hover:bg-secondary" onClick={() => window.open(`https://instagram.com/${profile.instagram_id}`, '_blank')}>
                          Instagram: @{profile.instagram_id}
                        </Button>
                      ) : isUnclaimed ? (
                        <Button variant="secondary" className="shrink-0 rounded-xl font-bold h-11 px-6 bg-secondary/80 hover:bg-secondary" onClick={() => window.open(`https://instagram.com/${profile.username}`, '_blank')}>
                          Instagram: @{profile.username}
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Button disabled className="shrink-0 bg-secondary/80 text-muted-foreground font-bold rounded-xl h-11 px-6 border-0">
                        🔒 인스타그램 및 응원 비공개
                      </Button>
                      <Button variant="secondary" className="shrink-0 rounded-xl font-bold h-11 px-6 bg-secondary/80 hover:bg-secondary" onClick={startDM}>
                        <MessageSquare className="w-5 h-5 mr-2 fill-current" />
                        메시지
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>



          
        </div>
      </div>

            {/* Edit Profile Dialog */}
      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{cropSrc ? '프로필 이미지 영역 선택' : '프로필 편집'}</DialogTitle>
          </DialogHeader>
          {cropSrc ? (
            <div className="flex flex-col gap-4 py-4">
              <div className="relative w-full h-[300px] bg-black rounded-md overflow-hidden">
                <Cropper
                  image={cropSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(croppedArea, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setCropSrc(null)}>취소</Button>
                <Button className="flex-1" onClick={handleCropSave} disabled={isUploading}>
                  {isUploading ? '업로드 중...' : '적용'}
                </Button>
              </div>
            </div>
          ) : (
          <>
          <div className="grid gap-6 py-4">
            <div className="flex flex-col gap-4">
              <Label>프로필 이미지 변경</Label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-border shrink-0">
                  <img 
                    src={pendingAvatarPreview || profile.avatar_url || ''} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleAvatarSelect}
                    disabled={isUploading}
                    className="hidden"
                    id="avatar-upload-input"
                  />
                  <label 
                    htmlFor="avatar-upload-input" 
                    className="flex items-center h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-pointer hover:bg-secondary/50 transition-colors truncate"
                  >
                    {pendingAvatarFile && originalFileName ? (
                      <span className="font-bold text-foreground truncate">선택된 파일 : <span className="font-normal text-muted-foreground">{originalFileName}</span></span>
                    ) : (
                      <span className="font-bold text-foreground truncate">파일 선택 <span className="font-normal text-muted-foreground">선택된 파일 없음</span></span>
                    )}
                  </label>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>소개글 (Bio)</Label>
              <Input 
                value={editBio} 
                onChange={(e) => setEditBio(e.target.value)} 
                placeholder="자신을 소개해보세요" 
              />
            </div>
            
            <div className="flex flex-col gap-2 mb-2">
              <Label>태그 (최대 5개)</Label>
              <div className="flex flex-wrap items-center gap-2">
                {tags.map(t => (
                  <div key={t.id} className="group flex items-center">
                    {editingTagId === t.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          maxLength={10}
                          value={editingTagValue}
                          onChange={e => setEditingTagValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleEditTag(t.id); if (e.key === 'Escape') setEditingTagId(null) }}
                          className="border border-primary rounded-full px-3 py-0.5 text-sm font-medium outline-none w-28"
                        />
                        <button onClick={() => handleEditTag(t.id)} className="text-xs text-primary font-bold">✓</button>
                        <button onClick={() => setEditingTagId(null)} className="text-xs text-muted-foreground">✕</button>
                      </div>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 bg-secondary/60 hover:bg-secondary text-foreground text-sm font-semibold px-3 py-1 rounded-full transition-colors cursor-pointer"
                        onClick={() => { setEditingTagId(t.id); setEditingTagValue(t.tag) }}
                      >
                        #{t.tag}
                        <button
                          className="ml-0.5 text-muted-foreground hover:text-red-500 transition-colors text-xs leading-none"
                          onClick={e => { e.stopPropagation(); handleDeleteTag(t.id) }}
                        >✕</button>
                      </span>
                    )}
                  </div>
                ))}
                {isAddingTag ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      maxLength={10}
                      value={newTagInput}
                      onChange={e => setNewTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') { setIsAddingTag(false); setNewTagInput('') } }}
                      placeholder="태그 입력..."
                      className="border border-primary rounded-full px-3 py-0.5 text-sm font-medium outline-none w-28"
                    />
                    <button onClick={handleAddTag} className="text-xs text-primary font-bold">✓</button>
                    <button onClick={() => { setIsAddingTag(false); setNewTagInput('') }} className="text-xs text-muted-foreground">✕</button>
                  </div>
                ) : (
                  tags.length < 5 && (
                    <button
                      onClick={() => setIsAddingTag(true)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-primary border border-primary/30 hover:border-primary hover:bg-primary/5 px-3 py-1 rounded-full transition-colors"
                    >
                      + 태그 추가
                    </button>
                  )
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <Label>Instagram ID</Label>
              <Input 
                value={editInstagramId} 
                onChange={(e) => setEditInstagramId(e.target.value)} 
                placeholder="인스타그램 ID를 입력해주세요 (예: suhyun_dev)" 
              />
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex items-center space-x-4 border p-4 rounded-lg bg-secondary/30">
                <input 
                  type="checkbox" 
                  id="instagram-public"
                  checked={editIsInstagramPublic}
                  onChange={(e) => {
                    setEditIsInstagramPublic(e.target.checked)
                    if (!e.target.checked) {
                      setEditIsDonationEnabled(false)
                    }
                  }}
                  className="w-5 h-5 accent-primary cursor-pointer"
                />
                <Label htmlFor="instagram-public" className="flex-1 cursor-pointer flex flex-col gap-1">
                  <div className="font-bold text-sm">인스타그램 ID 공개</div>
                  <div className="text-xs text-muted-foreground font-normal">프로필과 게시물에서 인스타그램 ID가 공개됩니다.</div>
                </Label>
              </div>
              <div className="flex items-center space-x-4 border p-4 rounded-lg bg-secondary/30">
                <input 
                  type="checkbox" 
                  id="donation-mode"
                  checked={editIsDonationEnabled}
                  onChange={(e) => {
                    setEditIsDonationEnabled(e.target.checked)
                    if (e.target.checked) {
                      setEditIsInstagramPublic(true)
                    }
                  }}
                  className="w-5 h-5 accent-primary cursor-pointer"
                />
                <Label htmlFor="donation-mode" className="flex-1 cursor-pointer flex flex-col gap-1">
                  <div className="font-bold text-sm">응원받기</div>
                  <div className="text-xs text-muted-foreground font-normal">체크 시 응원을 받을 수 있습니다.</div>
                  {!editIsDonationEnabled && (
                    <div className="text-xs text-red-500 font-bold">* 인스타그램 ID를 공개해야 응원을 받을 수 있습니다.</div>
                  )}
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveProfileChanges} disabled={isUploading} className="w-full font-bold">
              {isUploading ? '저장 중...' : '저장하기'}
            </Button>
          </DialogFooter>
          </>
          )}
        </DialogContent>
      </Dialog>

      

      {/* Content Area */}
      <div className="w-full max-w-3xl mx-auto mt-8">
        <div>
          <div className="flex items-center gap-2 mb-2 border-b pb-4 overflow-x-auto scrollbar-hide">
            <button 
              onClick={() => setActiveTab('posts')}
              className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${activeTab === 'posts' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50'}`}
            >
              게시물
            </button>
            {isMe && (
              <button 
                onClick={() => {
                  setActiveTab('liked')
                  if (!hasFetchedLiked) fetchLikedPosts()
                }}
                className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${activeTab === 'liked' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50'}`}
              >
                좋아요 누른 게시물
              </button>
            )}
            {(currentMonthTotal > 0 || isMe) && (
              <button 
                onClick={() => setActiveTab('donors')}
                className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${activeTab === 'donors' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50'}`}
              >
                Donors
              </button>
            )}
          </div>
          
          {activeTab === 'posts' && (
            posts.length === 0 ? (
              <div className="bg-white rounded-2xl border p-12 text-center text-muted-foreground">
                작성된 게시물이 없습니다.
              </div>
            ) : (
              <div className="flex flex-col w-full max-w-2xl mx-auto">
                {posts.map(post => (
                  <FeedPost key={post.id} post={post} currentUserId={currentUser?.id} />
                ))}
              </div>
            )
          )}
          
          {activeTab === 'liked' && isMe && (
            likedPosts.length === 0 ? (
              <div className="bg-white rounded-2xl border p-12 text-center text-muted-foreground">
                좋아요를 누른 게시물이 없습니다.
              </div>
            ) : (
              <div className="flex flex-col w-full max-w-2xl mx-auto">
                {likedPosts.map(post => (
                  <FeedPost key={post.id} post={post} currentUserId={currentUser?.id} />
                ))}
              </div>
            )
          )}

          {activeTab === 'donors' && (
            <div className="bg-white rounded-2xl border p-8 shadow-sm">
              <div className="flex items-end justify-between mb-1">
                <h3 className="text-2xl font-bold">응원</h3>
                {currentMonthTotal > 0 && (
                  <div className="text-sm font-medium text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full flex items-center gap-2">
                    <span>총 <span className="font-bold text-foreground">{currentMonthTotal.toLocaleString()}₩</span></span>
                    <span className="text-border">|</span>
                    <span><span className="font-bold text-foreground">{currentMonthBackers}</span>명</span>
                  </div>
                )}
              </div>
              <p className="text-muted-foreground mb-8">이 크리에이터를 응원하는 사람들</p>
              
              {topDonors.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  아직 응원 내역이 없습니다.
                </div>
              ) : (
                <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-secondary">
                  {topDonors.map((donor, idx) => (
                    <div key={donor.id} className="flex flex-col p-3 hover:bg-secondary/10 rounded-xl transition-colors border border-transparent hover:border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 cursor-pointer hover:underline" onClick={() => router.push(`/profile/${donor.username}`)}>
                          <div className="relative">
                            <Avatar className="h-12 w-12 border">
                              <AvatarImage src={donor.avatar_url || ''} />
                              <AvatarFallback>{donor.username.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            {idx === 0 && <Crown className="w-5 h-5 text-yellow-500 absolute -top-2 -right-1" />}
                            {idx === 1 && <Crown className="w-5 h-5 text-gray-400 absolute -top-2 -right-1" />}
                            {idx === 2 && <Crown className="w-5 h-5 text-amber-600 absolute -top-2 -right-1" />}
                          </div>
                          <span className="font-bold text-base">@{donor.username}</span>
                        </div>
                        <span className="font-bold text-primary text-lg">{donor.total.toLocaleString()}₩</span>
                      </div>
                      {donor.message && (
                        <div className="ml-16">
                          <DonationMessage text={donor.message} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

              </div>

      {/* Donate Modal */}
      <Dialog open={isDonateOpen} onOpenChange={setIsDonateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">@{profile.username}님을 응원하세요!</DialogTitle>
            <DialogDescription className="text-center">
              응원금을 보내면 리더보드에 이름이 올라갑니다.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDonate} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="amount" className="font-bold">응원 금액 (가상 W)</Label>
              <Input
                id="amount"
                type="number"
                value={donationAmount}
                onChange={(e) => setDonationAmount(e.target.value)}
                className="text-lg font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message" className="font-bold">응원 메시지 (선택)</Label>
              <Input
                id="message"
                placeholder="멋진 작업물 항상 응원합니다!"
                value={donationMessage}
                onChange={(e) => setDonationMessage(e.target.value)}
              />
            </div>
            <DialogFooter className="mt-6">
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg h-12 rounded-xl">
                응원하기 🚀
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
