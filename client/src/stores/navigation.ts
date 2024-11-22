import { create } from 'zustand'

interface NavigationState {
  currentPath: string
  previousPath: string | null
  isNavigating: boolean
  setPaths: (current: string, previous: string | null) => void
  setNavigating: (isNavigating: boolean) => void
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentPath: '/',
  previousPath: null,
  isNavigating: false,
  setPaths: (current, previous) => set({ currentPath: current, previousPath: previous }),
  setNavigating: (isNavigating) => set({ isNavigating }),
}))
