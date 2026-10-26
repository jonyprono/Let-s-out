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
  creator?: {
    id: string
    profile?: {
      displayName?: string
      avatarUrl?: string
      username?: string
    } | null
  }
}

export interface PagePostComment {
  id: string
  postId: string
  userId: string
  text: string
  createdAt: string
  user: {
    id: string
    profile: { username: string; avatarUrl?: string; displayName?: string } | null
  }
}

export interface PagePost {
  id: string
  pageId: string
  content?: string
  mediaUrls: string[]
  createdAt: string
  _count?: { comments: number }
  comments?: PagePostComment[]
}

export const pagesApi = {
  create: (data: { name: string; category: string; description?: string }) =>
    apiClient.post<Page>('/pages', data),

  getMyPages: () =>
    apiClient.get<{ data: Page[] }>('/pages/me').then(res => res.data.data),

  getByCreator: (creatorId: string) =>
    apiClient.get<{ data: Page[] }>('/pages', { params: { creatorId } }).then(res => res.data.data),

  getAll: (params?: { limit?: number }) =>
    apiClient.get<{ data: Page[] }>('/pages', { params }).then(res => res.data.data),

  getFeed: (params?: { limit?: number; offset?: number; cursor?: string }) =>
    apiClient.get<{
      data: (PagePost & {
        page: { id: string; name: string; avatarUrl?: string; creatorId: string };
        isFollowing?: boolean;
        isOwner?: boolean;
        _count?: { comments: number };
      })[];
      nextCursor?: string | null;
      hasMore?: boolean;
    }>('/pages/feed', { params }).then(res => res.data.data),

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

  deletePost: (pageId: string, postId: string) =>
    apiClient.delete(`/pages/${pageId}/posts/${postId}`),

  updatePost: (pageId: string, postId: string, data: { content?: string }) =>
    apiClient.patch<PagePost>(`/pages/${pageId}/posts/${postId}`, data).then(res => res.data),

  getComments: (pageId: string, postId: string) =>
    apiClient.get<{ data: PagePostComment[] }>(`/pages/${pageId}/posts/${postId}/comments`).then(res => res.data.data),

  addComment: (pageId: string, postId: string, text: string) =>
    apiClient.post<PagePostComment>(`/pages/${pageId}/posts/${postId}/comments`, { text }).then(res => res.data),

  deleteComment: (pageId: string, postId: string, commentId: string) =>
    apiClient.delete(`/pages/${pageId}/posts/${postId}/comments/${commentId}`).then(res => res.data),

  uploadImage: async (pageId: string, file: File, type: 'avatar' | 'cover' | 'post') => {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('type', type)
    return apiClient.post<{ url: string; type: string }>(
      `/pages/${pageId}/upload-image`,
      formData
    ).then(res => res.data)
  },

  uploadVideo: async (
    pageId: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<{ url: string }> => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_VIDEO_UPLOAD_PRESET

    if (cloudName && uploadPreset) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('upload_preset', uploadPreset)
        formData.append('folder', `pages/${pageId}`)
        formData.append('resource_type', 'video')

        const res = await new Promise<{ secure_url: string }>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`)
          if (xhr.upload) {
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable && onProgress) {
                onProgress(Math.min(Math.round((e.loaded / e.total) * 100), 99))
              }
            }
          }
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText)
                resolve(data)
              } catch (e) {
                reject(e)
              }
            } else {
              try {
                const errData = JSON.parse(xhr.responseText)
                reject(new Error(errData?.error?.message || 'Erreur Cloudinary'))
              } catch {
                reject(new Error(`Erreur HTTP ${xhr.status}`))
              }
            }
          }
          xhr.onerror = () => reject(new Error('Erreur réseau Cloudinary'))
          xhr.send(formData)
        })

        if (onProgress) onProgress(100)
        return { url: res.secure_url }
      } catch (err) {
        console.warn('[uploadVideo] Direct Cloudinary upload failed, falling back to server:', err)
      }
    }

    // Fallback via server
    const formData = new FormData()
    formData.append('image', file)
    formData.append('type', 'post')
    return apiClient.post<{ url: string; type: string }>(
      `/pages/${pageId}/upload-image`,
      formData,
      {
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percent = Math.min(Math.round((progressEvent.loaded / progressEvent.total) * 100), 99)
            onProgress(percent)
          }
        }
      }
    ).then(res => {
      if (onProgress) onProgress(100)
      return { url: res.data.url }
    })
  }
}
