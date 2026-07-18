import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Loader2, Camera, User, Eye, X, ShieldCheck } from 'lucide-react'
import { usersApi } from '@/features/users/api'
import { chatApi } from '@/features/chat/api'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { SafeImage } from '@/components/shared/SafeImage'
import { invalidateAvatarQueries } from '@/lib/avatar-cache'
import { useNavigate } from 'react-router'

const AVAILABLE_INTERESTS = [
  'Sorties', 'Sport', 'Cinéma', 'Voyage', 'Food', 'Business',
  'Networking', 'Nightlife', 'Musique', 'Culture', 'Art', 'Tech'
]

interface EditProfileModalProps {
  onClose: () => void
}

export function EditProfileModal({ onClose }: EditProfileModalProps) {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuthStore()
  const qc = useQueryClient()
  const profile = user?.profile

  const [displayName, setDisplayName] = useState(profile?.displayName || '')
  const [city, setCity] = useState(profile?.city || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [selectedInterests, setSelectedInterests] = useState<string[]>(profile?.interests || [])
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '')
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatarUrl || '')
  const [coverUrl, setCoverUrl] = useState((profile as any)?.coverUrl || '')
  const [coverPreview, setCoverPreview] = useState((profile as any)?.coverUrl || '')
  const avatarCacheKey = (profile as { updatedAt?: string })?.updatedAt || avatarUrl

  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const compressImage = (file: File, maxWidth = 1200): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const scale = Math.min(1, maxWidth / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file)
        }, 'image/jpeg', 0.82)
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
      img.src = url
    })
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    // Show preview immediately from local file
    const localPreview = URL.createObjectURL(file)
    setAvatarPreview(localPreview)
    setIsUploadingAvatar(true)
    try {
      const compressed = await compressImage(file, 800)
      const url = await chatApi.uploadMedia(compressed)
      setAvatarUrl(url)
      setAvatarPreview(url)
      await usersApi.updateProfile({ avatarUrl: url })
      await refreshUser()
      invalidateAvatarQueries(qc)
      toast.success('Photo de profil mise à jour !')
    } catch (error) {
      setAvatarPreview(avatarUrl) // revert on error
      toast.error("Erreur lors de l'envoi de la photo de profil.")
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleCoverChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    // Show preview immediately
    const localPreview = URL.createObjectURL(file)
    setCoverPreview(localPreview)
    setIsUploadingCover(true)
    try {
      const compressed = await compressImage(file, 1200)
      const url = await chatApi.uploadMedia(compressed)
      setCoverUrl(url)
      setCoverPreview(url)
      await usersApi.updateProfile({ coverUrl: url } as any)
      await refreshUser()
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['public-profile'] })
      toast.success('Photo de couverture mise à jour !')
    } catch (error) {
      setCoverPreview(coverUrl) // revert on error
      toast.error("Erreur lors de l'envoi de la couverture.")
    } finally {
      setIsUploadingCover(false)
    }
  }

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await usersApi.updateProfile({
        displayName,
        city,
        bio,
        interests: selectedInterests,
        avatarUrl,
        coverUrl,
      } as any)
      await refreshUser()
      invalidateAvatarQueries(qc)
      qc.invalidateQueries({ queryKey: ['me'] })
      toast.success('Profil mis à jour avec succès')
      onClose()
    } catch (e) {
      console.error(e)
      toast.error('Erreur lors de la mise à jour du profil')
    } finally {
      setIsSaving(false)
    }
  }

  const getInterestIcon = (interest: string) => {
    const lower = interest.toLowerCase()
    if (lower.includes('sport')) return '⚽'
    if (lower.includes('musique')) return '🎶'
    if (lower.includes('food') || lower.includes('cuisine')) return '🍳'
    if (lower.includes('art')) return '🎨'
    if (lower.includes('culture')) return '🌍'
    if (lower.includes('voyage')) return '✈️'
    if (lower.includes('tech') || lower.includes('business')) return '💼'
    if (lower.includes('networking')) return '🤝'
    if (lower.includes('nightlife')) return '🍸'
    if (lower.includes('cinéma')) return '🎬'
    if (lower.includes('sorties')) return '🎟️'
    return '📌'
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-[#111111] font-poppins">
      
      {/* Header */}
      <div className="px-4 pt-safe-4 pt-4 pb-3 flex items-center justify-between border-b border-gray-100 dark:border-[#252525] bg-white dark:bg-[#1A1A1A] flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-2xl border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#252525] text-gray-900 dark:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
          </button>
          <div className="flex flex-col">
            <h2 className="text-[17px] font-bold text-gray-900 dark:text-white leading-tight">Modifier mon profil</h2>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">Mettez à jour vos informations</p>
          </div>
        </div>
        <button
          onClick={() => {
            onClose();
            navigate('/profile');
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-50 dark:bg-orange-500/10 rounded-full text-[13px] font-semibold text-[#FF7A00] transition-colors"
        >
          <Eye className="w-4 h-4" />
          Aperçu
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="px-4 pt-4 pb-32">
          
          {/* Cover & Avatar Card */}
          <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-[#252525] relative mb-6 pb-6">
            
            {/* Cover Image */}
            <div className="relative w-full h-[140px] bg-gray-100 dark:bg-[#222]">
              {coverPreview ? (
                <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full" style={{ background: 'url(/Checker.png) center/cover repeat' }} />
              )}
              {/* Cover overlay + button */}
              <div className="absolute inset-0 bg-black/30 flex items-start justify-center pt-4">
                <button
                  onClick={() => coverInputRef.current?.click()}
                  disabled={isUploadingCover}
                  className="flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full text-white text-[12px] font-medium border border-white/20 active:scale-95 transition-transform"
                >
                  {isUploadingCover ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  Changer la couverture
                </button>
              </div>
              <input type="file" ref={coverInputRef} accept="image/*" className="hidden" onChange={handleCoverChange} />
            </div>
            
            {/* White/Dark rounded top for content below cover */}
            <div className="absolute top-[120px] left-0 right-0 h-10 bg-white dark:bg-[#1A1A1A] rounded-t-3xl border-t border-gray-100 dark:border-[#252525]" />

            {/* Avatar */}
            <div className="flex flex-col items-center relative z-10 -mt-12">
              <div className="relative">
                <div className={`w-[90px] h-[90px] rounded-full overflow-hidden shadow-md bg-gray-100 dark:bg-[#333] ring-[4px] ring-white dark:ring-[#1A1A1A] ${isUploadingAvatar ? 'opacity-50' : ''}`}>
                  <SafeImage
                    src={avatarPreview || null}
                    cacheKey={avatarCacheKey}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                    fallback={
                      <div className="w-full h-full flex items-center justify-center bg-orange-50 dark:bg-orange-500/20">
                        <User className="w-10 h-10 text-[#FF7A00]" />
                      </div>
                    }
                  />
                </div>
                {isUploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-[#FF7A00]" />
                  </div>
                )}
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute bottom-0 right-0 w-[28px] h-[28px] bg-[#FF7A00] rounded-full ring-2 ring-white dark:ring-[#1A1A1A] flex items-center justify-center text-white shadow-md active:scale-95 transition-transform"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
                <input type="file" ref={avatarInputRef} accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-2">Touchez pour modifier votre photo de profil</p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            
            {/* Nom d'affichage */}
            <div className="flex items-start gap-3">
              <div className="mt-7 w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-[#FF7A00]" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <label className="text-[12px] font-bold text-gray-800 dark:text-gray-200 block mb-1.5 ml-1">Nom d'affichage</label>
                <div className="relative">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value.slice(0, 30))}
                    placeholder="Nom"
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-2xl px-4 py-3.5 text-[15px] font-medium text-gray-900 dark:text-white outline-none focus:border-[#FF7A00] transition-colors pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 font-medium">
                    {displayName.length}/30
                  </span>
                </div>
              </div>
            </div>

            {/* Ville */}
            <div className="flex items-start gap-3">
              <div className="mt-7 w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF7A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              </div>
              <div className="flex-1">
                <label className="text-[12px] font-bold text-gray-800 dark:text-gray-200 block mb-1.5 ml-1">Ville</label>
                <div className="relative">
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ville, Pays"
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-2xl px-4 py-3.5 text-[15px] font-medium text-gray-900 dark:text-white outline-none focus:border-[#FF7A00] transition-colors pr-10"
                  />
                  <ChevronLeft className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 -rotate-90 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Bio */}
            <div className="flex items-start gap-3">
              <div className="mt-7 w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF7A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </div>
              <div className="flex-1">
                <label className="text-[12px] font-bold text-gray-800 dark:text-gray-200 block mb-1.5 ml-1">À propos de moi</label>
                <div className="relative">
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 150))}
                    rows={4}
                    placeholder="Parlez-nous de vous..."
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-2xl px-4 py-3.5 text-[14px] leading-relaxed font-medium text-gray-900 dark:text-white outline-none focus:border-[#FF7A00] transition-colors resize-none pb-8"
                  />
                  <span className="absolute right-4 bottom-3 text-[12px] text-gray-400 font-medium">
                    {bio.length}/150
                  </span>
                </div>
              </div>
            </div>

          </div>
          
          <hr className="my-6 border-gray-100 dark:border-[#252525]" />

          {/* Centres d'intérêt */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">Centres d'intérêt</h3>
              <span className="text-[12px] font-medium text-[#FF7A00]">{selectedInterests.length} sélectionné{selectedInterests.length > 1 ? 's' : ''}</span>
            </div>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 -mt-2">Choisissez vos centres d'intérêt</p>
            
            <div className="flex flex-wrap gap-2.5 pt-2">
              {AVAILABLE_INTERESTS.map(interest => {
                const isSelected = selectedInterests.includes(interest)
                const icon = getInterestIcon(interest)

                return (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-[#FF7A00] text-white shadow-sm border border-[#FF7A00]'
                        : 'bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span className="text-[14px]">{icon}</span>
                    <span>{interest}</span>
                    {isSelected && (
                      <div className="ml-1 w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                        <X className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Footer Fixed Bar */}
      <div className="flex-shrink-0 bg-white dark:bg-[#1A1A1A] border-t border-gray-100 dark:border-[#252525] px-4 pt-4 pb-safe-6 pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-20">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full h-[54px] bg-[#FF7A00] text-white rounded-full font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer les modifications'}
        </button>
        <div className="flex items-center justify-center gap-1.5 mt-3 opacity-70">
          <ShieldCheck className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            Vos données sont sécurisées et confidentielles.
          </span>
        </div>
      </div>

    </div>
  )
}
