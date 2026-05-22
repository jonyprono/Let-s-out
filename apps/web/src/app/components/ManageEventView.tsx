import { useState } from 'react'
import { BadgeCheck, Edit3, Loader2, PiggyBank, Send } from 'lucide-react'
import { SafeImage } from '@/components/shared/SafeImage'
import { useNavigate } from 'react-router'
import { apiClient } from '@/lib/api-client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface ManageEventViewProps {
  event: any
  organizerName: string
  organizerAvatar?: string
  formattedDate: string
  formattedStart: string
  formattedEnd: string
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
    <span className="text-[12px] font-bold text-[#FF9F1C] bg-[#FFF0D9] px-3 py-1 rounded-full border border-[#FFD99A]">
      {CATEGORY_LABELS[cat] || cat}
    </span>
  )
}

// ── Section card wrapper ──────────────────────────────────────────────────────
function SectionCard({
  title, onEdit, children
}: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-900 text-[15px]">{title}</h3>
        <button
          onClick={onEdit}
          className="text-[12px] text-gray-500 flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full font-medium active:scale-95 transition-transform"
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
      <span className="text-[14px] text-gray-500">{label}</span>
      <span className="text-[14px] font-medium text-gray-900 text-right max-w-[200px] truncate">{value}</span>
    </div>
  )
}

export function ManageEventView({
  event, organizerName, organizerAvatar, formattedDate, formattedStart, formattedEnd
}: ManageEventViewProps) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [publishing, setPublishing] = useState(false)

  const handleEdit = (step: number) => {
    navigate('/events/create', { state: { editEventId: event.id, step, eventData: event } })
  }

  const handlePublish = async () => {
    setPublishing(true)
    try {
      await apiClient.put(`/events/${event.id}/publish`)
      toast.success('🎉 Événement publié avec succès !')
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
    <div className="relative">
      {/* ── Scrollable content ── */}
      <div className="px-5 py-5 bg-gray-50 pb-44">
        <h1 className="text-[26px] font-bold text-gray-900 leading-tight mb-4">{event.title}</h1>

        {/* Info banner */}
        <div className="bg-[#EBF3FA] mb-6 p-4 rounded-xl border border-blue-100">
          <p className="text-gray-600 text-[13px] leading-relaxed">
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
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF9F1C] to-[#FFB75E] flex items-center justify-center text-white font-bold text-[13px]">
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
                  <div key={coHost.id} className="flex items-center gap-3 pl-2 border-l-2 border-gray-100">
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
                    <span className="text-[13px] text-gray-600 font-medium flex items-center gap-1.5">
                      {name}
                      <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">Co-hôte</span>
                    </span>
                  </div>
                )
              })}
              {/* Let's Out Staff */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#FFCA28] to-[#FF9F1C] flex items-center justify-center">
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
              <span className="text-[14px] text-gray-500">Catégories</span>
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
            <InfoRow label="Ticket" value={event.price > 0 ? `${Number(event.price).toLocaleString()} F CFA` : 'Gratuit'} />
            <InfoRow label="Confidentialité" value={event.isPrivate ? 'Privée' : 'Publique'} />
          </SectionCard>

          {/* Description */}
          <SectionCard title="Description" onEdit={() => handleEdit(4)}>
            <p className="text-[13px] text-gray-600 line-clamp-3">{event.description || 'Aucune description'}</p>
            {event.description && event.description.length > 100 && (
              <span className="text-[13px] text-gray-400 underline mt-1 block cursor-pointer">Voir plus</span>
            )}
          </SectionCard>

          {/* Couverture */}
          <SectionCard title="Couverture" onEdit={() => handleEdit(4)}>
            {event.coverUrl ? (
              <div className="w-full h-36 rounded-xl overflow-hidden">
                <SafeImage src={event.coverUrl} alt="Couverture" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-full h-36 rounded-xl bg-gray-100 flex flex-col items-center justify-center gap-2">
                <span className="text-3xl">🖼</span>
                <span className="text-[13px] text-gray-400">Aucune image</span>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* ── Fixed bottom actions ── */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 px-5 pt-4 pb-8 z-40 space-y-3">
        {/* Ajouter cagnotte */}
        <button
          onClick={handleAddPool}
          className="w-full py-[15px] rounded-full border-2 border-[#FF9F1C] text-[#FF9F1C] font-bold text-[15px] bg-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <PiggyBank className="w-5 h-5" />
          Ajouter cagnotte
        </button>
        {/* Publier l'événement */}
        <button
          onClick={handlePublish}
          disabled={publishing}
          className={`w-full py-[15px] rounded-full font-bold text-[15px] text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${
            publishing ? 'bg-[#FFD99A]' : 'bg-[#FF9F1C]'
          }`}
        >
          {publishing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
          {publishing ? 'Publication...' : 'Publier l\'événement'}
        </button>
      </div>
    </div>
  )
}
