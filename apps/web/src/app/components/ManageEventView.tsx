import { useState } from 'react'
import { BadgeCheck, Edit3, Loader2, PiggyBank, Megaphone, ChevronLeft } from 'lucide-react'
import { SafeImage } from '@/components/shared/SafeImage'
import { useNavigate } from 'react-router'
import { apiClient } from '@/lib/api-client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getEventParticipationMode } from '@/lib/utils'
import { useAuthStore } from '@/features/auth/store'
import { clearCreateEventDraft } from './CreateEvent'

interface ManageEventViewProps {
  event: any
  organizerName: string
  organizerAvatar?: string
  formattedDate: string
  formattedStart: string
  formattedEnd: string
  onBack: () => void
}

const CATEGORY_LABELS: Record<string, string> = {
  SPORT: 'Sport', CULTURE: 'Culture & Art', FOOD: 'Gastronomie',
  NIGHTLIFE: 'Soirées', TRAVEL: 'Voyages', GAMING: 'Gaming',
  WELLNESS: 'Bien-être', MUSIC: 'Musique', OTHER: 'Autre',
  SOCIAL: 'Social', TECH: 'Technologie', SCIENCE: 'Science & Education',
  LIFESTYLE: 'Lifestyle', TOURISM: 'Tourisme', ART: 'Art',
}

// ── Pill badge for categories ─────────────────────────────────────────────────
function CategoryPill({ cat }: { cat: string }) {
  return (
    <span className="text-[12px] font-bold text-[#3B82F6] bg-[#EFF6FF] px-3 py-1 rounded-full">
      {CATEGORY_LABELS[cat] || cat}
    </span>
  )
}

// ── Section card wrapper ──────────────────────────────────────────────────────
function SectionCard({
  title, onEdit, children
}: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-white/10 rounded-[16px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-900 dark:text-white text-[15px]">{title}</h3>
        <button
          onClick={onEdit}
          className="text-[11px] text-gray-600 dark:text-gray-300 flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-full font-bold active:scale-95 transition-transform"
        >
          <Edit3 className="w-3.5 h-3.5" /> Modifier
        </button>
      </div>
      {children}
    </div>
  )
}

// ── Row helper ────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center mb-3 last:mb-0">
      <span className="text-[14px] text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-[14px] font-medium text-gray-900 dark:text-white text-right max-w-[200px] truncate">{value}</span>
    </div>
  )
}

export function ManageEventView({
  event, organizerName, organizerAvatar, formattedDate, formattedStart, formattedEnd, onBack
}: ManageEventViewProps) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [publishing, setPublishing] = useState(false)

  const handleEdit = (step: number) => {
    navigate('/events/create', { state: { editEventId: event.id, step, eventData: event } })
  }

  const handlePublish = async () => {
    // Vérification de profil obligatoire pour les événements payants ou cagnotte
    const needsVerification = (event.price && event.price > 0) || (event.poolTarget && event.poolTarget > 0)
    if (needsVerification && !user?.profile?.isVerified) {
      toast.error("Votre compte doit être vérifié pour publier un événement payant ou avec cagnotte.")
      navigate('/verify-profile')
      return
    }

    setPublishing(true)
    try {
      await apiClient.put(`/events/${event.id}/publish`)
      clearCreateEventDraft()
      toast.success('🎉 Événement publié avec succès !')
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['events', event.id] })
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur lors de la publication')
    } finally {
      setPublishing(false)
    }
  }

  const handleAddPool = () => {
    navigate('/events/create', { state: { editEventId: event.id, step: 3, eventData: event, openPool: true } })
  }

  const categories: string[] = event.category ? [event.category] : []

  return (
    <div className="w-full h-full flex flex-col bg-[#F8F9FA]">
      {/* ── Header ── */}
      <div className="px-5 pt-4 pt-safe-4 pb-2 flex items-center justify-between border-b border-gray-100 dark:border-white/10 bg-white dark:bg-[#1A1A1A] shadow-sm flex-shrink-0">
        <button
          onClick={onBack}
          className="w-10 h-10 bg-[#F5F5F5] rounded-full flex items-center justify-center active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-6 h-6 text-gray-800 dark:text-gray-200" strokeWidth={2.5} />
        </button>
        <span className="text-[15px] font-bold text-gray-900 dark:text-white">Détails événement</span>
        <div className="w-10 h-10" /> {/* Spacer for centering */}
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 pb-44" style={{ scrollbarWidth: 'none' }}>
        <h1 className="text-[26px] font-bold text-gray-900 dark:text-white leading-tight mb-4">{event.title}</h1>

        {/* Info banner */}
        <div className="bg-[#EBF5FF] mb-6 p-4 rounded-[12px]">
          <p className="text-gray-600 dark:text-gray-300 text-[12px] leading-relaxed">
            Cet événement n'est pas encore visible sur Let's Out.<br />
            Publiez-le pour le rendre accessible publiquement.<br />
            Ou ajoutez une cagnotte pour partager les frais.
          </p>
        </div>

        <div className="space-y-4">
          {/* Organisateurs */}
          <SectionCard title="Organisateurs" onEdit={() => handleEdit(5)}>
            <div className="space-y-3">
              {/* Main organizer */}
              <div className="flex items-center gap-3">
                <SafeImage
                  src={organizerAvatar}
                  alt={organizerName}
                  className="w-9 h-9 rounded-full object-cover"
                  fallback={
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF7A00] to-[#FFB75E] flex items-center justify-center text-white font-bold text-[13px]">
                      {organizerName.charAt(0).toUpperCase()}
                    </div>
                  }
                />
                <span className="text-[14px] text-gray-700 font-medium">{organizerName}</span>
              </div>
              {/* Co-hosts */}
              {event.coHosts?.map((coHost: any) => {
                const name = coHost.profile?.displayName || 'Co-organisateur'
                return (
                  <div key={coHost.id} className="flex items-center gap-3 pl-2 border-l-2 border-gray-100 dark:border-white/10">
                    <SafeImage
                      src={coHost.profile?.avatarUrl}
                      alt={name}
                      className="w-7 h-7 rounded-full object-cover"
                      fallback={
                        <div className="w-7 h-7 rounded-full bg-orange-200 flex items-center justify-center text-white font-bold text-[11px]">
                          {name.charAt(0).toUpperCase()}
                        </div>
                      }
                    />
                    <span className="text-[13px] text-gray-600 dark:text-gray-300 font-medium flex items-center gap-1.5">
                      {name}
                      <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">Co-hôte</span>
                    </span>
                  </div>
                )
              })}
              {/* Let's Out Staff */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#FFCA28] to-[#FF7A00] flex items-center justify-center">
                  <span className="text-white font-bold text-[10px]">LO</span>
                </div>
                <span className="text-[14px] text-gray-700 font-medium flex items-center gap-1">
                  Let's Out Staff <BadgeCheck className="w-4 h-4 text-blue-500 fill-blue-500" />
                </span>
              </div>
            </div>
          </SectionCard>

          {/* Informations */}
          <SectionCard title="Informations" onEdit={() => handleEdit(1)}>
            <InfoRow label="Nom" value={event.title} />
            <div className="flex justify-between items-center">
              <span className="text-[14px] text-gray-500 dark:text-gray-400">Catégories</span>
              <div className="flex flex-wrap gap-1.5 justify-end">
                {categories.map(cat => <CategoryPill key={cat} cat={cat} />)}
                {categories.length === 0 && <span className="text-[14px] text-gray-400">Non spécifié</span>}
              </div>
            </div>
          </SectionCard>

          {/* Date & lieu */}
          <SectionCard title="Date & lieu" onEdit={() => handleEdit(2)}>
            <InfoRow label="Date" value={formattedDate} />
            <InfoRow label="Heure" value={`${formattedStart} – ${formattedEnd} (GMT)`} />
            <InfoRow label="Ville" value={event.city || 'Non spécifiée'} />
            <InfoRow label="Localisation" value={event.address || 'Non spécifiée'} />
          </SectionCard>

          {/* Participation */}
          <SectionCard title="Participation" onEdit={() => handleEdit(3)}>
            <InfoRow label="Places" value={event.maxAttendees ? String(event.maxAttendees) : 'Illimitées'} />
            <InfoRow label="Participation" value={event.price > 0 ? `${Number(event.price).toLocaleString()} F CFA` : getEventParticipationMode(event)} />
            <InfoRow label="Confidentialité" value={event.isPrivate ? 'Privée' : 'Publique'} />
          </SectionCard>

          {/* Description */}
          <SectionCard title="Description" onEdit={() => handleEdit(4)}>
            <p className="text-[13px] text-gray-600 dark:text-gray-300 line-clamp-3">{event.description || 'Aucune description'}</p>
            {event.description && event.description.length > 100 && (
              <span className="text-[13px] text-gray-400 underline mt-1 block cursor-pointer">Voir plus</span>
            )}
          </SectionCard>

          {/* Couverture */}
          <SectionCard title="Couverture" onEdit={() => handleEdit(4)}>
            {event.coverUrl ? (
              <div className="w-full h-40 rounded-[12px] overflow-hidden">
                <SafeImage src={event.coverUrl} alt="Couverture" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-full h-40 rounded-[12px] bg-gray-100 dark:bg-[#2a2a2a] flex flex-col items-center justify-center gap-2">
                <span className="text-3xl">🖼</span>
                <span className="text-[13px] text-gray-400">Aucune image</span>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* ── Fixed bottom actions ── */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#F8F9FA] px-5 pb-safe-4 pt-4 flex flex-col gap-3">
        {/* Ajouter/Modifier cagnotte */}
        <button
          onClick={handleAddPool}
          className="w-full py-[14px] rounded-full border border-action-primary text-action-primary font-bold text-[14px] bg-white dark:bg-[#1A1A1A] flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <PiggyBank className="w-4 h-4" />
          {event.poolTarget ? 'Modifier la cagnotte' : 'Ajouter cagnotte'}
        </button>
        {/* Publier l'événement */}
        <button
          onClick={handlePublish}
          disabled={publishing}
          className={`w-full py-[14px] rounded-full font-bold text-[14px] text-white flex items-center justify-center gap-2 active:scale-95 transition-all ${
            publishing ? 'bg-[#FFD99A]' : 'bg-action-primary'
          }`}
        >
          {publishing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Megaphone className="w-4 h-4" />
          )}
          {publishing ? 'Publication...' : 'Publier l\'événement'}
        </button>
      </div>
    </div>
  )
}
