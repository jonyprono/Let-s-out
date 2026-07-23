import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

export interface SystemSetting {
  id: string
  key: string
  value: string
  description?: string
  updatedAt: string
}

export function useAdminSystemSettings() {
  const qc = useQueryClient()

  const { data: settings = [], isLoading, error } = useQuery({
    queryKey: ['admin', 'system-settings'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/system-settings')
      return res.data.data as SystemSetting[]
    },
  })

  const { mutate: updateSetting, isPending: isUpdating } = useMutation({
    mutationFn: async ({ key, value, description }: { key: string; value: string; description?: string }) => {
      const res = await apiClient.put(`/admin/system-settings/${key}`, { value, description })
      return res.data.data as SystemSetting
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'system-settings'] })
    },
  })

  return {
    settings,
    isLoading,
    error,
    updateSetting,
    isUpdating,
  }
}
