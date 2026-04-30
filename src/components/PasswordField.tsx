'use client'

import { useState } from 'react'
import { Eye, EyeOff, Copy, Check } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

interface PasswordFieldProps {
  userId: string
  label?: string
  containerStyle?: React.CSSProperties
}

export function PasswordField({ userId, label = 'Password', containerStyle }: PasswordFieldProps) {
  const { t } = useTranslation()
  const [isVisible, setIsVisible] = useState(false)
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const fetchPassword = async () => {
    if (password) { setIsVisible(!isVisible); return }
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/decrypt-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 404 || data.error?.includes('No password reference')) {
          setError('No password reference available. User must reset password.')
          return
        }
        throw new Error(data.error || 'Failed to fetch password')
      }
      if (data.password?.startsWith('PLACEHOLDER:')) {
        setError('Original password not available. Use "Reset Password" below.')
        return
      }
      setPassword(data.password)
      setIsVisible(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = () => {
    if (!password) return
    navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={containerStyle}>
      <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>
        {label.toUpperCase()}
      </label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type={isVisible ? 'text' : 'password'}
          value={isVisible ? password : '••••••••'}
          readOnly
          style={{
            flex: 1, background: error ? 'rgba(239,83,80,0.05)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${error ? 'rgba(239,83,80,0.4)' : 'rgba(255,215,0,0.3)'}`,
            color: isVisible ? '#FFD700' : '#555', padding: '10px 14px', borderRadius: 6,
            fontSize: 13, fontFamily: isVisible ? 'monospace' : 'inherit', outline: 'none', cursor: 'default',
          }}
        />
        <button
          type="button"
          onClick={fetchPassword}
          disabled={isLoading || !!error}
          style={{
            background: error ? 'rgba(255,255,255,0.04)' : 'rgba(255,215,0,0.1)',
            border: `1px solid ${error ? 'rgba(255,255,255,0.1)' : 'rgba(255,215,0,0.3)'}`,
            color: error ? '#555' : '#FFD700',
            borderRadius: 6, padding: '10px 12px', cursor: (isLoading || !!error) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: (isLoading || !!error) ? 0.5 : 1,
          }}
          title={isVisible ? t.hide_password : t.reveal_password}
        >
          {isLoading ? '…' : isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        {password && !error && (
          <button
            type="button"
            onClick={handleCopy}
            style={{
              background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,215,0,0.1)',
              border: `1px solid ${copied ? 'rgba(34,197,94,0.5)' : 'rgba(255,215,0,0.3)'}`,
              color: copied ? '#22c55e' : '#FFD700',
              borderRadius: 6, padding: '10px 12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
            }}
            title={t.copy_password}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
      </div>
      {error && <div style={{ color: '#EF5350', fontSize: 11, marginTop: 5 }}>⚠️ {error}</div>}
      {!error && password && <div style={{ color: '#555', fontSize: 11, marginTop: 5 }}>{t.encrypted_at_rest}</div>}
    </div>
  )
}
