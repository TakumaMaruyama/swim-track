import { useEffect, useCallback } from 'react'
import { useAuthStore } from '../stores/auth'
import { useToastStore } from '../stores/toast'
import { useNavigate } from 'react-router-dom'
import { useErrorStore } from '../stores/error'

export function useAuth() {
  const { 
    user, 
    isAuthenticated, 
    login, 
    logout, 
    error,
    checkSession,
    updateLastActivity,
    validateSession
  } = useAuthStore()
  const addToast = useToastStore((state) => state.addToast)
  const addError = useErrorStore((state) => state.addError)
  const navigate = useNavigate()

  // セッションとトークンの管理
  useEffect(() => {
    if (isAuthenticated) {
      // セッションチェック
      const sessionCheck = setInterval(() => {
        if (!validateSession()) {
          handleLogout()
          addToast({
            type: 'warning',
            message: 'セッションの有効期限が切れました。再度ログインしてください。',
            duration: 5000,
          })
        }
      }, 60000) // 1分ごとにチェック

      return () => clearInterval(sessionCheck)
    }
      // トークンリフレッシュ
      const tokenRefresh = setInterval(() => {
        refreshToken().catch(() => {
          handleLogout();
          addToast({
            type: 'error',
            message: 'セッションの更新に失敗しました。再度ログインしてください。',
            duration: 5000,
          });
        });
      }, TOKEN_REFRESH_INTERVAL);

      return () => {
        clearInterval(sessionCheck);
        clearInterval(tokenRefresh);
      };
  }, [isAuthenticated])

  // アクティビティの監視
  useEffect(() => {
    if (isAuthenticated) {
      const handleActivity = () => {
        updateLastActivity()
      }

      window.addEventListener('mousemove', handleActivity)
      window.addEventListener('keypress', handleActivity)

      return () => {
        window.removeEventListener('mousemove', handleActivity)
        window.removeEventListener('keypress', handleActivity)
      }
    }
  }, [isAuthenticated, updateLastActivity])

  // エラー処理
  useEffect(() => {
    if (error) {
      addToast({
        type: 'error',
        message: error,
        duration: 5000,
      })
      addError('auth', error)
    }
  }, [error, addToast, addError])

  // 初期セッションチェック
  useEffect(() => {
    checkSession()
  }, [])

  const handleLogin = useCallback(async (username: string, password: string) => {
    try {
      await login({ username, password })
      if (isAuthenticated) {
        addToast({
          type: 'success',
          message: 'ログインしました',
          duration: 3000,
        })
        navigate('/')
      }
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'ログインに失敗しました',
        duration: 5000,
      })
    }
  }, [login, isAuthenticated, navigate, addToast])

  const handleLogout = useCallback(async () => {
    try {
      await logout()
      addToast({
        type: 'info',
        message: 'ログアウトしました',
        duration: 3000,
      })
      navigate('/login')
    } catch (error) {
      addToast({
        type: 'error',
        message: 'ログアウトに失敗しました',
        duration: 5000,
      })
    }
  }, [logout, navigate, addToast])

  return {
    user,
    isAuthenticated,
    login: handleLogin,
    logout: handleLogout,
    validateSession,
  }
}
