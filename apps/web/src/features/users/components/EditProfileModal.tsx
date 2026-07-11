import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Camera, User } from 'lucide-react'
import { usersApi } from '@/features/users/api'
import { chatApi } from '@/features/chat/api'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { SafeImage } from '@/components/shared/SafeImage'
import { invalidateAvatarQueries } from '@/lib/avatar-cache'

const AVAILABLE_INTERESTS = [
  'Sorties', 'Sport', 'Cinéma', 'Voyage', 'Food', 'Business',
  'Networking', 'Nightlife', 'Musique', 'Culture', 'Art', 'Tech'
]

interface EditProfileModalProps {
  onClose: () => void
}

export function EditProfileModal({ onClose }: EditProfileModalProps) {
  const { user, refreshUser } = useAuthStore()
  const qc = useQueryClient()
  const profile = user?.profile

  const [displayName, setDisplayName] = useState(profile?.displayName || '')
  const [city, setCity] = useState(profile?.city || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [selectedInterests, setSelectedInterests] = useState<string[]>(profile?.interests || [])
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '')
  const [coverUrl, setCoverUrl] = useState((profile as any)?.coverUrl || '')
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
    setIsUploadingAvatar(true)
    try {
      const compressed = await compressImage(file, 800)
      const url = await chatApi.uploadMedia(compressed)
      setAvatarUrl(url)
      await usersApi.updateProfile({ avatarUrl: url })
      await refreshUser()
      invalidateAvatarQueries(qc)
      toast.success('Photo de profil mise à jour !')
    } catch (error) {
      toast.error("Erreur lors de l'envoi de la photo de profil.")
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleCoverChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIsUploadingCover(true)
    try {
      const compressed = await compressImage(file, 1200)
      const url = await chatApi.uploadMedia(compressed)
      setCoverUrl(url)
      await usersApi.updateProfile({ coverUrl: url } as any)
      await refreshUser()
      qc.invalidateQueries({ queryKey: ['me'] })
      toast.success('Photo de couverture mise à jour !')
    } catch (error) {
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

  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-white dark:bg-[#1A1A1A]">
      {/* Header */}
      <div className="px-4 pt-safe-6 pb-3 flex items-center justify-between border-b border-gray-100 dark:border-white/10 bg-white dark:bg-[#1A1A1A]">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:bg-[#2A2A2A] text-gray-900 dark:text-[#FFFFFF]">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-[17px] font-bold text-gray-900 dark:text-[#FFFFFF]">Modifier mon profil</h2>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="text-[15px] font-bold text-action-primary disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-32">

        {/* Cover Photo */}
        <div className="relative w-full h-[140px] bg-gray-100 dark:bg-[#222] overflow-hidden">
          {coverUrl ? (
            <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full"
              style={{ background: 'url(/Checker.png) center/cover repeat' }}
            />
          )}
          {/* Cover overlay + button */}
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <button
              onClick={() => coverInputRef.current?.click()}
              disabled={isUploadingCover}
              className="flex flex-col items-center gap-1.5 text-white"
            >
              {isUploadingCover
                ? <Loader2 className="w-7 h-7 animate-spin" />
                : <Camera className="w-7 h-7 drop-shadow" />
              }
              <span className="text-[12px] font-semibold drop-shadow">Changer la couverture</span>
            </button>
          </div>
          <input
            type="file"
            ref={coverInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleCoverChange}
          />
        </div>

        {/* Avatar (overlapping the cover) */}
        <div className="flex flex-col items-center -mt-10 mb-6 px-5">
          <div className="relative">
            <div className={`w-20 h-20 rounded-full overflow-hidden shadow-md bg-gray-100 dark:bg-[#333333] ring-4 ring-white dark:ring-[#1A1A1A] ${isUploadingAvatar ? 'opacity-50' : ''}`}>
              <SafeImage
                src={avatarUrl || null}
                cacheKey={avatarCacheKey}
                alt="Avatar"
                className="w-full h-full object-cover"
                fallback={
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-10 h-10 text-gray-400" />
                  </div>
                }
              />
            </div>
            {isUploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-action-primary" />
              </div>
            )}
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute bottom-0 right-0 w-7 h-7 bg-action-primary rounded-full border-2 border-white flex items-center justify-center text-white shadow-md"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input
              type="file"
              ref={avatarInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-2">Touchez pour modifier la photo de profil</p>
        </div>

        <div className="px-5 space-y-6">
          {/* Nom */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nom d'affichage</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John Doe"
              className="w-full bg-gray-50 dark:bg-[#222222] border border-gray-100 dark:border-white/10 rounded-xl px-4 py-3 text-[16px] text-gray-900 dark:text-[#FFFFFF] outline-none focus:border-action-primary/30 transition-colors"
            />
          </div>

          {/* Ville */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ville</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Paris"
              className="w-full bg-gray-50 dark:bg-[#222222] border border-gray-100 dark:border-white/10 rounded-xl px-4 py-3 text-[16px] text-gray-900 dark:text-[#FFFFFF] outline-none focus:border-action-primary/30 transition-colors"
            />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">À propos de moi</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="Passionné(e) de sorties..."
              className="w-full bg-gray-50 dark:bg-[#222222] border border-gray-100 dark:border-white/10 rounded-xl px-4 py-3 text-[16px] text-gray-900 dark:text-[#FFFFFF] outline-none focus:border-action-primary/30 transition-colors resize-none"
            />
          </div>

          {/* Intérêts */}
          <div className="space-y-2.5">
            <label className="text-[13px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Centres d'intérêt</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_INTERESTS.map(interest => {
                const isSelected = selectedInterests.includes(interest)
                return (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-[#FFF2D3] border-[#FF7A00] text-[#FF7A00]'
                        : 'bg-gray-50 dark:bg-[#222] border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {interest}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-gray-400">Sélectionnez vos centres d'intérêt ({selectedInterests.length} choisi{selectedInterests.length > 1 ? 's' : ''})</p>
          </div>

          {/* Bouton d'enregistrement */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full min-h-[52px] h-auto py-3 bg-action-primary text-white rounded-full font-bold text-[16px] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer les modifications'}
          </button>
        </div>
      </div>
    </div>
  )
}
