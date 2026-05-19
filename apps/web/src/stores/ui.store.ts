import { create } from 'zustand'

interface UiState {
  // Bottom sheet / modal states
  isCreateEventOpen: boolean
  activeTab: 'home' | 'explorer' | 'messages' | 'notifications' | 'profile'
  // Actions
  setCreateEventOpen: (open: boolean) => void
  setActiveTab: (tab: UiState['activeTab']) => void
}

export const useUiStore = create<UiState>((set) => ({
  isCreateEventOpen: false,
  activeTab: 'home',
  setCreateEventOpen: (open) => set({ isCreateEventOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
