import { BadgeCheck, Edit3 } from 'lucide-react'
import { SafeImage } from '@/components/shared/SafeImage'
import { useNavigate } from 'react-router'

interface ManageEventViewProps {
  event: any
  organizerName: string
  organizerAvatar?: string
  formattedDate: string
  formattedStart: string
  formattedEnd: string
}

export function ManageEventView({
  event,
  organizerName,
  organizerAvatar,
  formattedDate,
  formattedStart,
  formattedEnd
}: ManageEventViewProps) {
  const navigate = useNavigate()

  const handleEdit = (step: number) => {
    navigate('/events/create', { state: { editEventId: event.id, step, eventData: event } })
  }

  return (
    <div className="px-5 py-5 bg-gray-50 min-h-full">
      <h1 className="text-[26px] font-bold text-gray-900 leading-tight mb-4">{event.title}</h1>
      
      <div className="bg-[#EBF3FA] mb-6 p-4 rounded-xl text-gray-600 text-[13px] leading-relaxed">
        Cet événement n'est pas encore visible sur Let's Out.<br/>
        Publiez-le pour le rendre accessible publiquement.<br/>
        Ou ajoutez une cagnotte pour partager les frais.
      </div>

      <div className="space-y-4">
        {/* Organisateurs Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
           <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-gray-900 text-[15px]">Organisateurs</h3>
             <button onClick={() => handleEdit(5)} className="text-[12px] text-gray-500 flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full font-medium active:scale-95 transition-transform"><Edit3 className="w-3.5 h-3.5"/> Modifier</button>
           </div>
           <div className="space-y-3 mb-3">
             <div className="flex items-center gap-3">
               <SafeImage src={organizerAvatar} alt={organizerName} className="w-8 h-8 rounded-full object-cover" />
               <span className="text-[14px] text-gray-700 font-medium">{organizerName}</span>
             </div>
             {event.coHosts?.map((coHost: any) => {
               const coHostName = coHost.profile?.displayName || 'Co-organisateur'
               const coHostAvatar = coHost.profile?.avatarUrl
               return (
                 <div key={coHost.id} className="flex items-center gap-3 pl-2 border-l-2 border-gray-100">
                   {coHostAvatar ? (
                     <SafeImage src={coHostAvatar} alt={coHostName} className="w-6 h-6 rounded-full object-cover" />
                   ) : (
                     <div className="w-6 h-6 rounded-full bg-orange-200 flex items-center justify-center text-white font-bold text-[9px]">
                       {coHostName.charAt(0).toUpperCase()}
                     </div>
                   )}
                   <span className="text-[13px] text-gray-600 font-medium flex items-center gap-1.5">
                     {coHostName}
                     <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">Co-hôte</span>
                   </span>
                 </div>
               )
             })}
           </div>
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FFCA28] to-[#FF9F1C] flex items-center justify-center">
               <span className="text-white font-bold text-[10px]">LO</span>
             </div>
             <span className="text-[14px] text-gray-700 font-medium flex items-center gap-1">Let's Out Staff <BadgeCheck className="w-4 h-4 text-blue-500 fill-blue-500 text-white" /></span>
           </div>
        </div>

        {/* Informations Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
           <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-gray-900 text-[15px]">Informations</h3>
             <button onClick={() => handleEdit(1)} className="text-[12px] text-gray-500 flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full font-medium active:scale-95 transition-transform"><Edit3 className="w-3.5 h-3.5"/> Modifier</button>
           </div>
           <div className="flex justify-between items-center mb-3">
             <span className="text-[14px] text-gray-500">Nom</span>
             <span className="text-[14px] font-medium text-gray-900 truncate max-w-[180px]">{event.title}</span>
           </div>
           <div className="flex justify-between items-center">
             <span className="text-[14px] text-gray-500">Catégories</span>
             <span className="text-[12px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{event.category || 'Non spécifié'}</span>
           </div>
        </div>

        {/* Date & Lieu */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
           <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-gray-900 text-[15px]">Date & lieu</h3>
             <button onClick={() => handleEdit(2)} className="text-[12px] text-gray-500 flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full font-medium active:scale-95 transition-transform"><Edit3 className="w-3.5 h-3.5"/> Modifier</button>
           </div>
           <div className="flex justify-between items-center mb-3">
             <span className="text-[14px] text-gray-500">Date</span>
             <span className="text-[14px] font-medium text-gray-900">{formattedDate}</span>
           </div>
           <div className="flex justify-between items-center mb-3">
             <span className="text-[14px] text-gray-500">Heure</span>
             <span className="text-[14px] font-medium text-gray-900">{formattedStart} - {formattedEnd} (GMT)</span>
           </div>
           <div className="flex justify-between items-center mb-3">
             <span className="text-[14px] text-gray-500">Ville</span>
             <span className="text-[14px] font-medium text-gray-900">{event.city || 'Non spécifiée'}</span>
           </div>
           <div className="flex justify-between items-center">
             <span className="text-[14px] text-gray-500">Localisation</span>
             <span className="text-[14px] font-medium text-gray-900 truncate max-w-[150px]">{event.address || 'Non spécifiée'}</span>
           </div>
        </div>

        {/* Participation */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
           <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-gray-900 text-[15px]">Participation</h3>
             <button onClick={() => handleEdit(3)} className="text-[12px] text-gray-500 flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full font-medium active:scale-95 transition-transform"><Edit3 className="w-3.5 h-3.5"/> Modifier</button>
           </div>
           <div className="flex justify-between items-center mb-3">
             <span className="text-[14px] text-gray-500">Places</span>
             <span className="text-[14px] font-medium text-gray-900">{event.maxAttendees || 'Illimitées'}</span>
           </div>
           <div className="flex justify-between items-center mb-3">
             <span className="text-[14px] text-gray-500">Ticket</span>
             <span className="text-[14px] font-medium text-gray-900">{event.price > 0 ? `${event.price.toLocaleString()} F CFA` : 'Gratuit'}</span>
           </div>
           <div className="flex justify-between items-center">
             <span className="text-[14px] text-gray-500">Confidentialité</span>
             <span className="text-[14px] font-medium text-gray-900">{event.isPrivate ? 'Privée' : 'Publique'}</span>
           </div>
        </div>

        {/* Description */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
           <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-gray-900 text-[15px]">Description</h3>
             <button onClick={() => handleEdit(4)} className="text-[12px] text-gray-500 flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full font-medium active:scale-95 transition-transform"><Edit3 className="w-3.5 h-3.5"/> Modifier</button>
           </div>
           <p className="text-[13px] text-gray-600 line-clamp-3">{event.description || 'Aucune description'}</p>
           <span className="text-[13px] text-gray-400 underline mt-1 block">Voir plus</span>
        </div>

      </div>
    </div>
  )
}
