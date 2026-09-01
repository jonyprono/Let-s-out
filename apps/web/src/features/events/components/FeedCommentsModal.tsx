import { BottomSheet } from '@/components/ui/bottom-sheet'
import { EventComments } from '@/features/events/components/EventComments'

interface FeedCommentsModalProps {
  eventId: string
  organizerId?: string
  open: boolean
  onClose: () => void
}

export function FeedCommentsModal({ eventId, organizerId, open, onClose }: FeedCommentsModalProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      noPadding
      className="h-[80vh]"
    >
      <div className="flex flex-col h-full">
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700 mx-auto mt-3 mb-1 flex-none" />
        <EventComments eventId={eventId} organizerId={organizerId} />
      </div>
    </BottomSheet>
  )
}
