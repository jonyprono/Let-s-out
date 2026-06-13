import { apiClient } from '@/lib/api-client'

export interface AdminUser {
  id: string
  phone: string
  name: string | null
  createdAt: string
  updatedAt: string
}

export const adminsApi = {
  list: async (): Promise<AdminUser[]> => {
    const res = await apiClient.get('/admin/admins')
    return res.data
  },
  
  add: async (phone: string, name?: string): Promise<AdminUser> => {
    const res = await apiClient.post('/admin/admins', { phone, name })
    return res.data
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/admins/${id}`)
  }
}
