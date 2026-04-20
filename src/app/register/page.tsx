'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShieldCheck, ChevronRight, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'

function RegisterContent() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [focusedField, setFocusedField] = useState<'fullName' | 'email' | 'password' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const { t } = useTranslation()

  const searchParams = useSearchParams()
  const companySlug = searchParams.get('company')
  const inviteToken = searchParams.get('invite')
  const [company, setCompany] = useState<{id: string, full_name: string} | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Invite token flow — resolve company name from token
    if (inviteToken) {
      const supabase = createClient()
      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('invite_token', inviteToken)
        .eq('role', 'sub_admin')
        .single()
        .then(({ data }) => {
          if (data) setCompany(data)
          else setError('Invalid invite link. Please request a new one from your broker.')
        })
      return
    }

    // Legacy company slug flow
    if (!companySlug) {
      router.push('/login')
      return
    }

    const supabase = createClient()
    supabase
      .from('profiles')
      .select('id, full_name, company_slug')
      .eq('company_slug', companySlug)
      .eq('role', 'sub_admin')
      .single()
      .then(({ data }) => {
        if (data) setCompany(data)
        else router.push('/login')
      })
  }, [companySlug, inviteToken, router])

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !fullName) return
    setError(null)
    setIsSubmitting(true)

    // Invite token flow — uses secure server-side API
    if (inviteToken) {
      try {
        const res = await fetch('/api/register-via-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, full_name: fullName, invite_token: inviteToken }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Registration failed')
        setIsSuccess(true)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    // Legacy company slug flow
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          assigned_to_slug: companySlug
        }
      }
    })

    if (error) {
      setError(error.message)
      setIsSubmitting(false)
      return
    }

    setIsSuccess(true)
    setIsSubmitting(false)
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

      {/* ── Register Card ── */}
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
          <h1 style={{ fontWeight: 800, fontSize: 22, letterSpacing: '0.15em', marginBottom: 6 }}>Nokhba</h1>
          <p style={{ color: '#8a8e9b', fontSize: 13, letterSpacing: '0.05em' }}>
            {isSuccess ? t.registration_complete : company ? `${t.register} — ${company.full_name}` : inviteToken ? 'Verifying invite link...' : t.request_institutional}
          </p>
          <div style={{ marginTop: 12 }}><LanguageToggle /></div>
        </div>

        {isSuccess ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <CheckCircle2 size={48} color="#FFD700" />
            </div>
            <h2 style={{ fontSize: 18, marginBottom: 10 }}>{t.check_email}</h2>
            <p style={{ color: '#8a8e9b', fontSize: 13, lineHeight: 1.5, marginBottom: 30 }}>
              {t.verification_sent} <strong style={{ color: '#fff' }}>{email}</strong>.
              {t.verify_to_activate}
            </p>
            <Link href="/login" style={{
              display: 'block', padding: '15px 0', width: '100%', borderRadius: 6,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
              color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em',
              textDecoration: 'none', textAlign: 'center', transition: 'background 0.2s'
            }}>
              {t.return_to_login}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Full Name */}
            <div>
              <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>{t.full_name.toUpperCase()}</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setError(null); }}
                onFocus={() => setFocusedField('fullName')}
                onBlur={() => setFocusedField(null)}
                placeholder="John Doe"
                required
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.02)',
                  border: focusedField === 'fullName' ? '1px solid #FFD700' : '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', fontSize: 14, outline: 'none',
                  transition: 'all 0.2s ease', fontFamily: 'monospace'
                }}
              />
            </div>
            
            {/* Email */}
            <div>
              <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>{t.email_address}</label>
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
              <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>{t.password.toUpperCase()}</label>
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
              disabled={isSubmitting || !email || !password || !fullName}
              style={{
                marginTop: 10, padding: '15px 0', width: '100%', borderRadius: 6,
                background: '#FFD700', border: 'none', cursor: 'pointer',
                color: '#000', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em',
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
                opacity: isSubmitting || (!email || !password || !fullName) ? 0.7 : 1,
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
                <>{t.request_access} <ChevronRight size={16} strokeWidth={2.5} /></>
              )}
            </button>
          </form>
        )}

        {/* ── Footer ── */}
        {!isSuccess && (
          <div style={{ marginTop: 30, textAlign: 'center' }}>
            <p style={{ color: '#8a8e9b', fontSize: 12 }}>
              {t.already_have_account} <Link href="/login" style={{ color: '#FFD700', textDecoration: 'none', fontWeight: 600, marginLeft: 4 }}>{t.access_vault_link}</Link>
            </p>
          </div>
        )}
        
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

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0e11' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,215,0,0.1)', borderTopColor: '#FFD700', animation: 'spin 1s linear infinite' }} />
        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { to { transform: rotate(360deg); } }' }} />
      </div>
    }>
      <RegisterContent />
    </Suspense>
  )
}
