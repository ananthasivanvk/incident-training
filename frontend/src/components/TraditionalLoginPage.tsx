import React, { useState } from 'react'
import { ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function TraditionalLoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  const labelResetStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    padding: 0,
    display: 'block',
    position: 'static',
    zIndex: 'auto'
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await login(identifier.trim(), password)

      // If server returned a user object, check its Status explicitly first
      const returnedUser = (res && (res as any).user) || null
      const returnedStatus = returnedUser && returnedUser.Status ? String(returnedUser.Status).trim().toLowerCase() : ''

      if (returnedUser && returnedStatus && returnedStatus !== 'active') {
        // user exists but is inactive — show inline error and do not log in
        const msg =
          res.message ||
          'Your account is currently inactive. Please contact your faculty or administrator to request access.'
        setError(msg)
        return
      }

      if (res.ok && res.user) {
        const role = String(res.user.UserRole || '')
        if (role.toLowerCase().includes('faculty')) navigate('/faculty')
        else navigate('/student')
      } else {
        const msg = res.message || 'Invalid credentials'
        // Fallback: show inline error
        setError(msg)
      }
    } catch (err) {
      setError('Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl border border-slate-200 p-8 md:p-10">
          <div className="flex justify-center mb-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-10 h-10 text-blue-600" strokeWidth={2} />
              <div className="flex flex-col">
                <span className="text-blue-900">Incident Investigation Training</span>
              </div>
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-slate-800">LOGIN</h1>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5 login-form">
            <div>
              <label htmlFor="identifier" className="block text-slate-700 mb-2" style={labelResetStyle}>
                ID or Email
              </label>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-slate-700 mb-2" style={labelResetStyle}>
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 text-center text-slate-500 text-xs">
          <p>Authorized Access Only</p>
        </div>
      </div>
    </div>
  )
}