import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User } from '../../../db/schema'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  setError: (error: string | null) => void
  setLoading: (isLoading: boolean) => void
  login: (credentials: { username: string; password: string }) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      setError: (error) => set({ error }),
      setLoading: (isLoading) => set({ isLoading }),
      login: async (credentials) => {
        try {
          set({ isLoading: true, error: null });
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'ログインに失敗しました');
          }
          
          const data = await response.json();
          set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
            error: null,
          });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'ログインに失敗しました' });
        } finally {
          set({ isLoading: false });
        }
      },
      logout: async () => {
        try {
          set({ isLoading: true });
          await fetch('/api/auth/logout', { method: 'POST' });
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          });
        } catch (error) {
          set({ error: 'ログアウトに失敗しました' });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
