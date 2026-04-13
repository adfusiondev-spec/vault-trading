'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Trigger fade-in animation slightly after mount
    setMounted(true)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setError(null)
    setIsSubmitting(true)

    const supabase = createClient()
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    
    if (authError || !authData.user) {
      setError(authError?.message || 'Invalid credentials. Please try again.')
      setIsSubmitting(false)
      return
    }

    // Fetch user profile to get their role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !profile) {
      setError('Account profile not found. Please contact support.')
      setIsSubmitting(false)
      return
    }

    if (profile?.role === 'super_admin') {
      router.push('/admin')
    } else if (profile?.role === 'sub_admin') {
      router.push('/sub-admin')
    } else {
      router.push('/user')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center', background: '#0b0e11',
      fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff', overflow: 'hidden'
    }}>
      
      {/* ── Background ambient glow ── */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 600, height: 600, background: 'radial-gradient(circle, rgba(255,215,0,0.03) 0%, rgba(11,14,17,0) 70%)',
        pointerEvents: 'none', zIndex: 0
      }} />

      {/* ── Login Card ── */}
      <div style={{
        width: '100%', maxWidth: 400, padding: 40,
        background: 'rgba(11,14,17,0.7)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,215,0,0.15)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,215,0,0.05)',
        borderRadius: 12, position: 'relative', zIndex: 10,
        opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(15px)',
        transition: 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 10, background: 'var(--gold, #FFD700)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            boxShadow: '0 4px 15px rgba(255,215,0,0.2)'
          }}>
            <ShieldCheck size={26} strokeWidth={2.5} color="#000" />
          </div>
          <h1 style={{ fontWeight: 800, fontSize: 22, letterSpacing: '0.15em', marginBottom: 6 }}>THE VAULT</h1>
          <p style={{ color: '#8a8e9b', fontSize: 13, letterSpacing: '0.05em' }}>SECURE INSTITUTIONAL TRADING</p>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Email */}
          <div>
            <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>EMAIL ADDRESS</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              placeholder="trader@institution.io"
              required
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 6,
                background: 'rgba(255,255,255,0.02)',
                border: focusedField === 'email' ? '1px solid #FFD700' : '1px solid rgba(255,255,255,0.1)',
                color: '#fff', fontSize: 14, outline: 'none',
                transition: 'all 0.2s ease', fontFamily: 'monospace'
              }}
            />
          </div>

          {/* Password */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <label style={{ color: '#8a8e9b', fontSize: 11, letterSpacing: '0.08em', fontWeight: 600 }}>PASSWORD</label>
              <a href="#" style={{ color: '#8a8e9b', fontSize: 11, textDecoration: 'none', transition: 'color 0.2s', ...({ ':hover': { color: '#fff' } } as any) }}>Forgot?</a>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              placeholder="••••••••••••"
              required
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 6,
                background: 'rgba(255,255,255,0.02)',
                border: focusedField === 'password' ? '1px solid #FFD700' : error ? '1px solid var(--red, #EF5350)' : '1px solid rgba(255,255,255,0.1)',
                color: '#fff', fontSize: 14, outline: 'none',
                transition: 'all 0.2s ease', fontFamily: 'monospace', letterSpacing: '0.15em'
              }}
            />
            {error && (
              <div style={{ color: 'var(--red, #EF5350)', fontSize: 11, marginTop: 8, letterSpacing: '0.02em' }}>
                {error}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || !email || !password}
            style={{
              marginTop: 10, padding: '15px 0', width: '100%', borderRadius: 6,
              background: '#FFD700', border: 'none', cursor: 'pointer',
              color: '#000', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em',
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
              opacity: isSubmitting || (!email || !password) ? 0.7 : 1,
              transition: 'opacity 0.2s', position: 'relative'
            }}
          >
            {isSubmitting ? (
              <div style={{
                width: 18, height: 18, border: '2px solid rgba(0,0,0,0.2)',
                borderTopColor: '#000', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
            ) : (
              <>ACCESS VAULT <ChevronRight size={16} strokeWidth={2.5} /></>
            )}
          </button>
        </form>

        {/* ── Footer ── */}
        <div style={{ marginTop: 30, textAlign: 'center' }}>
          <p style={{ color: '#8a8e9b', fontSize: 12 }}>
            Don't have an account? <a href="#" style={{ color: '#FFD700', textDecoration: 'none', fontWeight: 600, marginLeft: 4 }}>Request Access</a>
          </p>
        </div>
        
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { to { transform: rotate(360deg); } }
        /* Reset autofill styles that ruin dark mode */
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
            -webkit-box-shadow: 0 0 0 30px #0b0e11 inset !important;
            -webkit-text-fill-color: white !important;
            transition: background-color 5000s ease-in-out 0s;
        }
      `}} />
    </div>
  )
}
