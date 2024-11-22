import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { devtools } from 'zustand/middleware'
import type { User } from '../../../db/schema'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  lastActivity: number
  sessionExpiry: number | null
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  setError: (error: string | null) => void
  setLoading: (isLoading: boolean) => void
  updateLastActivity: () => void
  validateSession: () => boolean
  login: (credentials: { username: string; password: string }) => Promise<void>
  logout: () => Promise<void>
  checkSession: () => Promise<void>
  refreshToken: () => Promise<void>
}

// セッションの有効期限（30分）
const SESSION_TIMEOUT = 30 * 60 * 1000;
const TOKEN_REFRESH_INTERVAL = 15 * 60 * 1000; // 15分ごとにトークンをリフレッシュ
const SESSION_CHECK_INTERVAL = 60 * 1000; // 1分ごとにセッションをチェック

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        lastActivity: Date.now(),
        sessionExpiry: null,
        setUser: (user) => set({ user, isAuthenticated: !!user }),
        setToken: (token) => set({ token }),
        setError: (error) => set({ error }),
        setLoading: (isLoading) => set({ isLoading }),
        updateLastActivity: () => set({ lastActivity: Date.now() }),
        validateSession: () => {
          const state = get();
          if (!state.sessionExpiry) return false;
          return Date.now() < state.sessionExpiry;
        },
        login: async (credentials) => {
          try {
            set({ isLoading: true, error: null });
            const response = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(credentials),
            });
            
            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.message || 'ログインに失敗しました');
            }
            
            const data = await response.json();
            const expiry = Date.now() + SESSION_TIMEOUT;
            set({
              user: data.user,
              token: data.token,
              isAuthenticated: true,
              error: null,
              lastActivity: Date.now(),
              sessionExpiry: expiry,
            });
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'ログインに失敗しました',
              isAuthenticated: false,
              user: null,
              token: null,
            });
          } finally {
            set({ isLoading: false });
          }
        },
        logout: async () => {
          try {
            set({ isLoading: true });
            await fetch('/api/auth/logout', { 
              method: 'POST',
              credentials: 'include',
            });
          } catch (error) {
            set({ error: 'ログアウトに失敗しました' });
          } finally {
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
              sessionExpiry: null,
            });
          }
        },
        refreshToken: async () => {
          try {
            const response = await fetch('/api/auth/refresh', {
              method: 'POST',
              credentials: 'include',
            });
            
            if (!response.ok) {
              throw new Error('トークンの更新に失敗しました');
            }
            
            const data = await response.json();
            const expiry = Date.now() + SESSION_TIMEOUT;
            set({
              token: data.token,
              sessionExpiry: expiry,
              lastActivity: Date.now(),
            });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'トークンの更新に失敗しました',
              user: null,
              token: null,
              isAuthenticated: false,
              sessionExpiry: null,
            });
          }
        },
        checkSession: async () => {
          try {
            const response = await fetch('/api/auth/session', {
              credentials: 'include',
            });
            
            if (!response.ok) {
              throw new Error('セッションが無効です');
            }
            
            const data = await response.json();
            const expiry = Date.now() + SESSION_TIMEOUT;
            set({
              user: data.user,
              isAuthenticated: true,
              sessionExpiry: expiry,
              lastActivity: Date.now(),
            });
          } catch (error) {
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              sessionExpiry: null,
            });
          }
        },
      }),
      {
        name: 'auth-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          user: state.user,
          token: state.token,
          isAuthenticated: state.isAuthenticated,
          sessionExpiry: state.sessionExpiry,
        }),
      }
    )
  )
);
