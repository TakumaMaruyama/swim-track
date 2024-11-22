import { useEffect } from 'react'
import { useAuthStore } from '../stores/auth'
import { useToastStore } from '../stores/toast'
import { useNavigate } from 'react-router-dom'

export function useAuth() {
  const { user, isAuthenticated, login, logout, error } = useAuthStore()
  const addToast = useToastStore((state) => state.addToast)
  const navigate = useNavigate()

  useEffect(() => {
    if (error) {
      addToast({
        type: 'error',
        message: error,
        duration: 5000,
      })
    }
  }, [error, addToast])

  const handleLogin = async (username: string, password: string) => {
    await login({ username, password })
    if (isAuthenticated) {
      navigate('/')
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return {
    user,
    isAuthenticated,
    login: handleLogin,
    logout: handleLogout,
  }
}
