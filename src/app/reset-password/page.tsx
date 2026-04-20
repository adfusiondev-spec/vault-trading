'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) return alert(t.password_too_short)
    if (newPassword !== confirm) return alert(t.passwords_dont_match)
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setDone(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch (err: any) {
      alert(err.message || t.password_reset_error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0b0e11', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        background: 'rgba(11,14,17,0.9)', border: '1px solid rgba(255,215,0,0.3)',
        borderRadius: 12, padding: 40, width: '100%', maxWidth: 400,
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, background: '#FFD700', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <ShieldCheck size={26} color="#000" strokeWidth={2.5} />
          </div>
          <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 20, letterSpacing: '0.1em', margin: 0 }}>{t.reset_password_title}</h1>
          <p style={{ color: '#8a8e9b', fontSize: 13, marginTop: 8 }}>Nokhba — {t.secure_portal}</p>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', color: '#26a69a', fontWeight: 700, fontSize: 14 }}>
            {t.password_reset_success}
          </div>
        ) : (
          <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 8, letterSpacing: '0.08em' }}>{t.new_password.toUpperCase()}</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,215,0,0.3)',
                  color: '#fff', fontSize: 14, outline: 'none', letterSpacing: '0.1em',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 8, letterSpacing: '0.08em' }}>{t.confirm_password}</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••••••"
                required
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,215,0,0.3)',
                  color: '#fff', fontSize: 14, outline: 'none', letterSpacing: '0.1em',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 8, padding: '14px 0', background: '#FFD700', border: 'none',
                borderRadius: 6, color: '#000', fontWeight: 700, fontSize: 13,
                letterSpacing: '0.1em', cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? t.updating : t.update_password}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
