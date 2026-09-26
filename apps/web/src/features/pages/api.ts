import { apiClient } from '@/lib/api-client'

export interface Page {
  id: string
  creatorId: string
  name: string
  description?: string
  category: string
  avatarUrl?: string
  coverUrl?: string
  createdAt: string
  _count?: { followers: number; posts: number }
  isFollowing?: boolean
}

export interface PagePost {
  id: string
  pageId: string
  content?: string
  mediaUrls: string[]
  createdAt: string
}

export const pagesApi = {
  create: (data: { name: string; category: string; description?: string }) =>
    apiClient.post<Page>('/pages', data),

  getMyPages: () =>
    apiClient.get<{ data: Page[] }>('/pages/me').then(res => res.data.data),

  getFeed: () =>
    apiClient.get<{ data: (PagePost & { page: { id: string; name: string; avatarUrl?: string; creatorId: string } })[] }>('/pages/feed').then(res => res.data.data),

  getById: (id: string) =>
    apiClient.get<Page>(`/pages/${id}`).then(res => res.data),

  update: (id: string, data: Partial<Pick<Page, 'name' | 'category' | 'description' | 'avatarUrl' | 'coverUrl'>>) =>
    apiClient.patch<Page>(`/pages/${id}`, data).then(res => res.data),

  deletePage: (id: string) =>
    apiClient.delete(`/pages/${id}`),

  follow: (id: string) =>
    apiClient.post<{ followed: boolean }>(`/pages/${id}/follow`).then(res => res.data),

  createPost: (id: string, data: { content?: string; mediaUrls: string[] }) =>
    apiClient.post<PagePost>(`/pages/${id}/posts`, data).then(res => res.data),

  getPosts: (id: string) =>
    apiClient.get<{ data: PagePost[] }>(`/pages/${id}/posts`).then(res => res.data.data),

  uploadImage: async (pageId: string, file: File, type: 'avatar' | 'cover' | 'post') => {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('type', type)
    return apiClient.post<{ url: string; type: string }>(
      `/pages/${pageId}/upload-image`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(res => res.data)
  }
}
