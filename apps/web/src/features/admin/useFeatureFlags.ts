import { apiClient } from '@/lib/api-client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface FeatureFlag {
  id: string
  key: string
  isActive: boolean
  description: string
  updatedAt: string
}

// Clés connues de l'application
export const FLAG_KEYS = {
  PROFILE_PRO_BANNER: 'profile_pro_banner',
  SETTINGS_PRO_BANNER: 'settings_pro_banner',
  EVENT_TRANSPORT_CARD: 'event_transport_card',
  ENABLE_NON_VOTER_PENALTIES: 'enable_non_voter_penalties',
  NEW_EVENT_BROADCAST: 'new_event_broadcast',
} as const

type FlagKey = (typeof FLAG_KEYS)[keyof typeof FLAG_KEYS]

export const featureFlagsApi = {
  getAll: () => apiClient.get<{ data: FeatureFlag[] }>('/admin/feature-flags'),
  update: (key: string, isActive: boolean, description?: string) =>
    apiClient.put<{ data: FeatureFlag }>(`/admin/feature-flags/${key}`, { isActive, description }),
}

// ─── Hook public (lecture seule, très long cache) ────────────────────────────
// Accessible à tous les composants sans être admin
export function useFeatureFlags() {
  const { data } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ data: FeatureFlag[] }>('/feature-flags')
        return res.data.data
      } catch {
        return [] as FeatureFlag[]
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes de cache
    gcTime: 30 * 60 * 1000,
    retry: false,
  })

  const flags = data ?? []

  return {
    isEnabled: (key: FlagKey) => flags.find(f => f.key === key)?.isActive ?? false,
    flags,
  }
}

// ─── Hook admin (lecture + écriture) ─────────────────────────────────────────
export function useAdminFeatureFlags() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-feature-flags'],
    queryFn: () => featureFlagsApi.getAll().then(r => r.data.data),
    staleTime: 30 * 1000,
  })

  const updateMutation = useMutation({
    mutationFn: ({ key, isActive, description }: { key: string; isActive: boolean; description?: string }) =>
      featureFlagsApi.update(key, isActive, description),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-feature-flags'] })
      qc.invalidateQueries({ queryKey: ['feature-flags'] })
    },
  })

  return {
    flags: data ?? [],
    isLoading,
    toggle: (key: string, isActive: boolean, description?: string) =>
      updateMutation.mutate({ key, isActive, description }),
    isToggling: updateMutation.isPending,
  }
}
