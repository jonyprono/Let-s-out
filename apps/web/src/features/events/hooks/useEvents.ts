import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { eventsApi, type EventsQuery, type CreateEventPayload } from '../api'
import { toast } from 'sonner'

export const eventKeys = {
  all: ['events'] as const,
  lists: () => [...eventKeys.all, 'list'] as const,
  list: (filters: EventsQuery) => [...eventKeys.lists(), filters] as const,
  detail: (id: string) => [...eventKeys.all, 'detail', id] as const,
  attendees: (id: string) => [...eventKeys.all, 'attendees', id] as const,
}

export function useEvents(filters: EventsQuery = {}) {
  return useQuery({
    queryKey: eventKeys.list(filters),
    queryFn: () => eventsApi.list(filters).then((r) => r.data),
  })
}

export function useInfiniteEvents(filters: Omit<EventsQuery, 'offset'> = {}) {
  return useInfiniteQuery({
    queryKey: [...eventKeys.lists(), 'infinite', filters],
    queryFn: ({ pageParam = 0 }) =>
      eventsApi.list({ ...filters, limit: 20, offset: pageParam }).then((r) => r.data),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.data.length === 20 ? pages.length * 20 : undefined,
  })
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: eventKeys.detail(id),
    queryFn: () => eventsApi.getById(id).then((r) => r.data),
    enabled: !!id,
  })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateEventPayload) => eventsApi.create(payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventKeys.lists() })
      toast.success('Événement créé ! 🎉')
    },
    onError: () => toast.error('Erreur lors de la création'),
  })
}

export function useJoinEvent(eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => eventsApi.join(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventKeys.detail(eventId) })
      toast.success('Tu as rejoint l\'événement ! 🙌')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Erreur')
    },
  })
}

export function useLeaveEvent(eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => eventsApi.leave(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventKeys.detail(eventId) })
      toast.info('Tu as quitté l\'événement')
    },
  })
}

export function useEventAttendees(id: string) {
  return useQuery({
    queryKey: eventKeys.attendees(id),
    queryFn: () => eventsApi.getAttendees(id).then((r) => r.data),
    enabled: !!id,
  })
}
