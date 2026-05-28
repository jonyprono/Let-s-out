import { SafeImage } from '@/components/shared/SafeImage'

interface ParticipantAvatarsProps {
  count: number;
  max?: number;
  attendees?: any[];
}

export function ParticipantAvatars({ count, max, attendees = [] }: ParticipantAvatarsProps) {
  const displayCount = Math.min(count, 3)
  const colors = ['#FF7A00', '#9747FF', '#10B981']

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {attendees.slice(0, displayCount).map((attendee, i) => {
          const avatar = attendee?.user?.profile?.avatarUrl
          return (
            <div
              key={i}
              className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold overflow-hidden bg-gray-200"
              style={{ backgroundColor: avatar ? 'transparent' : colors[i % colors.length], zIndex: displayCount - i }}
            >
              {avatar ? (
                <SafeImage src={avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                String.fromCharCode(65 + i)
              )}
            </div>
          )
        })}
        {/* Fallback grey circles when attendees array is empty but count > 0 */}
        {attendees.length === 0 && Array.from({ length: displayCount }).map((_, i) => (
          <div
            key={i}
            className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold overflow-hidden"
            style={{ backgroundColor: colors[i % colors.length], zIndex: displayCount - i }}
          >
            {String.fromCharCode(65 + i)}
          </div>
        ))}
        {displayCount === 0 && (
          <div className="w-7 h-7 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center">
            <span className="text-[10px] text-gray-400 font-bold">-</span>
          </div>
        )}
      </div>
      <span className="text-[11px] text-gray-500 font-medium">
        {max ? `${count}/${max} Participants` : `${count} participants`}
      </span>
    </div>
  )
}
