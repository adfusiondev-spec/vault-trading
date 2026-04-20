'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck, ChevronRight } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

export default function TenantAuthPage() {
  const { t } = useTranslation()
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const supabase = createClient()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push(`/sub-admin/${slug}`)
      } else {
        // Find the sub_admin who owns this slug to assign the new trader
        const { data: tenantProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('company_slug', slug)
          .eq('role', 'sub_admin')
          .single()

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
        if (error) throw error

        if (data.user && tenantProfile) {
          await supabase.from('profiles').update({
            full_name: fullName,
            role: 'trader',
            assigned_to: tenantProfile.id,
          }).eq('id', data.user.id)
        }

        setError(null)
        alert(t.account_created)
        setMode('signin')
      }
    } catch (err: any) {
      setError(err.message || t.auth_failed)
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
          <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 18, letterSpacing: '0.1em', margin: 0 }}>Nokhba</h1>
          <p style={{ color: '#FFD700', fontSize: 12, marginTop: 6, letterSpacing: '0.05em', fontWeight: 600 }}>/{slug}</p>
          <p style={{ color: '#8a8e9b', fontSize: 12, marginTop: 4 }}>{mode === 'signin' ? t.sign_in : t.create_account}</p>
        </div>

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'signup' && (
            <div>
              <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6, letterSpacing: '0.08em' }}>{t.full_name.toUpperCase()}</label>
              <input
                type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Your full name" required
                style={{ width: '100%', padding: '12px 16px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,215,0,0.2)', color: '#fff', fontSize: 13, outline: 'none' }}
              />
            </div>
          )}
          <div>
            <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6, letterSpacing: '0.08em' }}>{t.email.toUpperCase()}</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="trader@example.com" required
              style={{ width: '100%', padding: '12px 16px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,215,0,0.2)', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'monospace' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6, letterSpacing: '0.08em' }}>{t.password.toUpperCase()}</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••••" required
              style={{ width: '100%', padding: '12px 16px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,215,0,0.2)', color: '#fff', fontSize: 13, outline: 'none', letterSpacing: '0.15em' }}
            />
          </div>

          {error && <div style={{ color: '#ef5350', fontSize: 12 }}>{error}</div>}

          <button
            type="submit" disabled={loading}
            style={{
              marginTop: 6, padding: '13px 0', background: '#FFD700', border: 'none',
              borderRadius: 6, color: '#000', fontWeight: 700, fontSize: 13,
              letterSpacing: '0.08em', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? t.processing.toUpperCase() : (mode === 'signin' ? t.sign_in : t.create_account)} {!loading && <ChevronRight size={16} />}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
          style={{ marginTop: 16, background: 'transparent', border: 'none', color: '#8a8e9b', fontSize: 12, cursor: 'pointer', width: '100%', textAlign: 'center' }}
        >
          {mode === 'signin' ? `${t.dont_have_account} ${t.request_access_link}` : `${t.already_have_account} ${t.sign_in}`}
        </button>
      </div>
    </div>
  )
}
