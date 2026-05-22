import { useRef, useState } from 'react'
import { X, Loader2, Camera, User } from 'lucide-react'
import { usersApi } from '@/features/users/api'
import { chatApi } from '@/features/chat/api'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { SafeImage } from '@/components/shared/SafeImage'

interface EditProfileModalProps {
  onClose: () => void
}

export function EditProfileModal({ onClose }: EditProfileModalProps) {
  const { user, refreshUser } = useAuthStore()
  const profile = user?.profile

  const [displayName, setDisplayName] = useState(profile?.displayName || '')
  const [city, setCity] = useState(profile?.city || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [interestsText, setInterestsText] = useState(profile?.interests?.join(', ') || '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '')
  
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const compressImage = (file: File, maxWidth = 800): Promise<File> => {
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
    
    setIsUploading(true)
    try {
      const compressed = await compressImage(file)
      const url = await chatApi.uploadMedia(compressed)
      setAvatarUrl(url)
    } catch (error) {
      console.error('Failed to upload avatar', error)
      toast.error("Erreur lors de l'envoi de l'image.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const interests = interestsText.split(',').map(i => i.trim()).filter(i => i.length > 0)
      await usersApi.updateProfile({
        displayName,
        city,
        bio,
        interests: interests.length > 0 ? interests : undefined,
        avatarUrl
      })
      await refreshUser()
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
      <div className="px-4 pt-16 pb-3 flex items-center justify-between border-b border-gray-100 bg-white dark:bg-[#1A1A1A]">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:bg-[#2A2A2A] text-gray-900 dark:text-[#FFFFFF]">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-[17px] font-bold text-gray-900 dark:text-[#FFFFFF]">Modifier mon profil</h2>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="text-[15px] font-bold text-[#FF9F1C] disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 pb-32 space-y-6">
        
        {/* Avatar */}
        <div className="flex flex-col items-center justify-center space-y-2 mb-4">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Avatar</span>
          <div className="relative">
            <div className={`w-24 h-24 rounded-full overflow-hidden shadow-sm bg-gray-100 dark:bg-[#333333] ${isUploading ? 'opacity-50' : ''}`}>
              <SafeImage
                src={avatarUrl || null}
                alt="Avatar"
                className="w-full h-full object-cover"
                fallback={
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                  </div>
                }
              />
            </div>
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#FF9F1C]" />
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute bottom-0 right-0 w-8 h-8 bg-[#FF9F1C] rounded-full border-2 border-white flex items-center justify-center text-white shadow-md hover:bg-[#8338ec] transition-colors"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 font-medium">Modifier la photo</p>
        </div>

        {/* Nom */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nom d'affichage</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="John Doe"
            className="w-full bg-gray-50 dark:bg-[#222222] border border-gray-100 rounded-xl px-4 py-3 text-[16px] text-gray-900 dark:text-[#FFFFFF] outline-none focus:border-[#FF9F1C]/30 focus:bg-white dark:bg-[#1A1A1A] transition-colors"
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
            className="w-full bg-gray-50 dark:bg-[#222222] border border-gray-100 rounded-xl px-4 py-3 text-[16px] text-gray-900 dark:text-[#FFFFFF] outline-none focus:border-[#FF9F1C]/30 focus:bg-white dark:bg-[#1A1A1A] transition-colors"
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
            className="w-full bg-gray-50 dark:bg-[#222222] border border-gray-100 rounded-xl px-4 py-3 text-[16px] text-gray-900 dark:text-[#FFFFFF] outline-none focus:border-[#FF9F1C]/30 focus:bg-white dark:bg-[#1A1A1A] transition-colors resize-none"
          />
        </div>

        {/* Intérêts */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Centres d'intérêt</label>
          <input
            type="text"
            value={interestsText}
            onChange={(e) => setInterestsText(e.target.value)}
            placeholder="Sport, Cinéma, Musique..."
            className="w-full bg-gray-50 dark:bg-[#222222] border border-gray-100 rounded-xl px-4 py-3 text-[16px] text-gray-900 dark:text-[#FFFFFF] outline-none focus:border-[#FF9F1C]/30 focus:bg-white dark:bg-[#1A1A1A] transition-colors"
          />
          <p className="text-[12px] text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">Séparez vos intérêts par des virgules.</p>
        </div>

      </div>
    </div>
  )
}



