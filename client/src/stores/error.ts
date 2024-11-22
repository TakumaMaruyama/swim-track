import { create } from 'zustand'

interface ErrorState {
  errors: Record<string, string>
  addError: (key: string, message: string) => void
  removeError: (key: string) => void
  clearErrors: () => void
}

export const useErrorStore = create<ErrorState>((set) => ({
  errors: {},
  addError: (key, message) =>
    set((state) => ({
      errors: { ...state.errors, [key]: message },
    })),
  removeError: (key) =>
    set((state) => {
      const { [key]: _, ...rest } = state.errors
      return { errors: rest }
    }),
  clearErrors: () => set({ errors: {} }),
}))
